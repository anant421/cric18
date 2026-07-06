// Core cricket scoring engine: turns a flat list of Ball rows into every
// derived stat the UI needs (scoreboard, batting/bowling cards, per-over
// breakdown, fall of wickets, run rates).

export function oversDisplay(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return `${overs}.${balls}`;
}

export function runRate(runs, legalBalls) {
  if (legalBalls === 0) return 0;
  return Number(((runs / legalBalls) * 6).toFixed(2));
}

function ballTotalRuns(b) {
  return b.runsBat + b.extraRuns;
}

export function inningsSummary(innings, balls, players, oversLimit) {
  const totalRuns = balls.reduce((s, b) => s + ballTotalRuns(b), 0);
  const totalWickets = balls.filter((b) => b.isWicket).length;
  const legalBalls = balls.filter((b) => b.isLegal).length;
  const battingTeamPlayerCount = players.filter((p) => p.teamId === innings.battingTeamId).length;
  const allOut = battingTeamPlayerCount > 0 && totalWickets >= battingTeamPlayerCount - 1;
  const oversDone = legalBalls >= oversLimit * 6;
  const target = innings.target;
  const targetReached = target != null && totalRuns >= target;
  return {
    totalRuns,
    totalWickets,
    legalBalls,
    oversStr: oversDisplay(legalBalls),
    oversLimit,
    runRate: runRate(totalRuns, legalBalls),
    allOut,
    oversDone,
    targetReached,
    isDone: allOut || oversDone || targetReached,
  };
}

export function battingCard(balls, teamPlayers, allPlayers = teamPlayers) {
  const allMap = new Map(allPlayers.map((p) => [p.id, p]));
  const map = new Map();
  for (const p of teamPlayers) {
    map.set(p.id, {
      playerId: p.id,
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      dismissal: null,
      battedAt: null,
      didBat: false,
    });
  }
  balls.forEach((b, idx) => {
    const striker = map.get(b.strikerId);
    if (!striker) return;
    striker.didBat = true;
    if (striker.battedAt === null) striker.battedAt = idx;
    if (b.extraType === 'NONE' || b.extraType === 'NOBALL') {
      striker.runs += b.runsBat;
      if (b.runsBat === 4) striker.fours += 1;
      if (b.runsBat === 6) striker.sixes += 1;
    }
    if (b.isLegal || b.extraType === 'NOBALL') {
      striker.balls += 1;
    }
    if (b.isWicket && b.dismissedId) {
      const dismissed = map.get(b.dismissedId);
      if (dismissed) {
        dismissed.isOut = true;
        dismissed.dismissal = describeDismissal(b, allMap);
      }
    }
  });
  return [...map.values()]
    // A non-striker who is run out without ever facing a ball still needs to
    // show up (and count as unavailable for the next-batsman picker) even
    // though they never "batted" in the didBat sense.
    .filter((p) => p.didBat || p.isOut)
    .sort((a, b) => (a.battedAt ?? Infinity) - (b.battedAt ?? Infinity))
    .map((p) => ({
      ...p,
      strikeRate: p.balls > 0 ? Number(((p.runs / p.balls) * 100).toFixed(2)) : 0,
    }));
}

function describeDismissal(ball, playerMap) {
  const bowler = ball.bowlerId;
  const fielder = ball.fielderId ? playerMap.get(ball.fielderId)?.name : null;
  switch (ball.wicketType) {
    case 'BOWLED':
      return `b. ${bowlerName(ball, playerMap)}`;
    case 'CAUGHT':
      return `c. ${fielder || '?'} b. ${bowlerName(ball, playerMap)}`;
    case 'LBW':
      return `lbw b. ${bowlerName(ball, playerMap)}`;
    case 'STUMPED':
      return `st. ${fielder || '?'} b. ${bowlerName(ball, playerMap)}`;
    case 'RUNOUT':
      return `run out${fielder ? ` (${fielder})` : ''}`;
    case 'HITWICKET':
      return `hit wicket b. ${bowlerName(ball, playerMap)}`;
    case 'RETIRED':
      return 'retired';
    default:
      return 'out';
  }
}

function bowlerName(ball, playerMap) {
  return playerMap.get(ball.bowlerId)?.name || '?';
}

export function bowlingCard(balls, teamPlayers) {
  const map = new Map();
  for (const p of teamPlayers) {
    map.set(p.id, {
      playerId: p.id,
      name: p.name,
      legalBalls: 0,
      runsConceded: 0,
      wickets: 0,
      overRuns: {},
      didBowl: false,
    });
  }
  balls.forEach((b) => {
    const bowler = map.get(b.bowlerId);
    if (!bowler) return;
    bowler.didBowl = true;
    if (b.isLegal) bowler.legalBalls += 1;
    if (b.extraType === 'BYE') {
      // byes don't count against the bowler
    } else {
      bowler.runsConceded += ballTotalRuns(b) - (b.extraType === 'BYE' ? b.extraRuns : 0);
    }
    if (b.isWicket && b.wicketType !== 'RUNOUT') bowler.wickets += 1;
    bowler.overRuns[b.overNumber] = (bowler.overRuns[b.overNumber] || 0) + ballTotalRuns(b);
  });
  return [...map.values()]
    .filter((p) => p.didBowl)
    .map((p) => {
      const maidens = Object.values(p.overRuns).filter((r) => r === 0).length;
      return {
        playerId: p.playerId,
        name: p.name,
        oversStr: oversDisplay(p.legalBalls),
        maidens,
        runsConceded: p.runsConceded,
        wickets: p.wickets,
        economy: runRate(p.runsConceded, p.legalBalls),
      };
    });
}

export function overByOver(balls, players) {
  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  const overs = new Map();
  for (const b of balls) {
    if (!overs.has(b.overNumber)) {
      overs.set(b.overNumber, { overNumber: b.overNumber, bowlerId: b.bowlerId, balls: [], runs: 0, wickets: 0 });
    }
    const o = overs.get(b.overNumber);
    o.runs += ballTotalRuns(b);
    if (b.isWicket) o.wickets += 1;
    o.balls.push(ballShorthand(b));
  }
  return [...overs.values()]
    .sort((a, b) => a.overNumber - b.overNumber)
    .map((o) => ({ ...o, bowlerName: playerMap.get(o.bowlerId) || '?' }));
}

function ballShorthand(b) {
  if (b.isWicket) return 'W';
  if (b.extraType === 'WIDE') return b.extraRuns > 1 ? `Wd+${b.extraRuns - 1}` : 'Wd';
  if (b.extraType === 'NOBALL') return b.runsBat > 0 ? `Nb+${b.runsBat}` : 'Nb';
  if (b.extraType === 'BYE') return `${b.extraRuns}b`;
  if (b.extraType === 'LEGBYE') return `${b.extraRuns}lb`;
  return String(b.runsBat);
}

export function fallOfWickets(balls, players) {
  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  let runningTotal = 0;
  const fow = [];
  for (const b of balls) {
    runningTotal += ballTotalRuns(b);
    if (b.isWicket) {
      fow.push({
        wicketNumber: fow.length + 1,
        score: runningTotal,
        playerName: playerMap.get(b.dismissedId) || '?',
        overStr: oversDisplay(balls.filter((x) => x.isLegal && x.sequence <= b.sequence).length),
      });
    }
  }
  return fow;
}

// Determines the next over number / ball-in-over and whether strike should
// rotate, given the balls already recorded in this innings.
export function nextBallContext(existingBalls) {
  const legal = existingBalls.filter((b) => b.isLegal);
  const legalCount = legal.length;
  const overNumber = Math.floor(legalCount / 6);
  const ballInOver = (legalCount % 6) + 1;
  const isNewOver = legalCount % 6 === 0;
  return { overNumber, ballInOver, isNewOver, legalCount };
}

export function shouldRotateStrike(type, runsBat, extraRuns) {
  if (type === 'RUN' || type === 'NOBALL') return runsBat % 2 === 1;
  if (type === 'BYE' || type === 'LEGBYE') return extraRuns % 2 === 1;
  if (type === 'WIDE') return Math.max(extraRuns - 1, 0) % 2 === 1;
  return false;
}
