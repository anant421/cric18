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

// Normally an over is exactly 6 legal balls. A ball can be voided out of the
// innings' over-budget entirely (voidedFromOver) - e.g. a bowler barred
// mid-over for an illegal/dangerous action voids that whole over - so this
// walk has to skip those balls completely rather than just dividing legal
// balls by 6. Voided balls still count everywhere else (team total, batter's
// runs/balls faced, the bowler's own personal figures) - only the innings-
// wide "how many overs used" tally ignores them, which is what lets a new
// bowler restart the very same over number from ball 1.
export function overProgress(balls) {
  let completedOvers = 0;
  let legalInCurrentOver = 0;
  for (const b of balls) {
    if (b.voidedFromOver) continue;
    if (b.isLegal) legalInCurrentOver += 1;
    if (b.isLegal && legalInCurrentOver === 6) {
      completedOvers += 1;
      legalInCurrentOver = 0;
    }
  }
  return { completedOvers, legalInCurrentOver };
}

export function oversStrFromProgress({ completedOvers, legalInCurrentOver }) {
  return `${completedOvers}.${legalInCurrentOver}`;
}

// Where the next ball to be recorded lands: which over, and which position
// within it (1-indexed, same convention an illegal ball shares with the
// legal ball that would come after it).
export function nextBallPosition(existingBalls) {
  const { completedOvers, legalInCurrentOver } = overProgress(existingBalls);
  return { overNumber: completedOvers, ballInOver: legalInCurrentOver + 1 };
}

// Dismissal types that aren't credited to the bowler as a wicket - either
// because no delivery dismissed them (retirements) or because the bowler
// didn't do the dismissing (run out).
const NOT_BOWLERS_WICKET = ['RUNOUT', 'RETIRED_OUT', 'RETIRED_HURT'];

// "Retired hurt" (Law 25.4) is voluntary and temporary - the batter can
// resume their innings later, so it must never count toward the total
// wickets down or permanently mark them out. "Retired out" (Law 25.5) is
// the opposite: permanent, and does count, just like any real dismissal.
const NOT_A_FALLEN_WICKET = ['RETIRED_HURT'];

export function inningsSummary(innings, balls, players, oversLimit) {
  const totalRuns = balls.reduce((s, b) => s + ballTotalRuns(b), 0);
  const totalWickets = balls.filter((b) => b.isWicket && !NOT_A_FALLEN_WICKET.includes(b.wicketType)).length;
  const legalBalls = balls.filter((b) => b.isLegal).length;
  const progress = overProgress(balls);
  // Squads can carry more than 11 registered players (substitutes on the
  // bench), but an innings is only ever played by 11 - cap here so a 13-man
  // squad doesn't wrongly let the innings run to 12 wickets down.
  const battingTeamPlayerCount = Math.min(players.filter((p) => p.teamId === innings.battingTeamId).length, 11);
  const allOut = battingTeamPlayerCount > 0 && totalWickets >= battingTeamPlayerCount - 1;
  const oversDone = progress.completedOvers >= oversLimit;
  const target = innings.target;
  const targetReached = target != null && totalRuns >= target;
  return {
    totalRuns,
    totalWickets,
    legalBalls,
    oversStr: oversStrFromProgress(progress),
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
    // Facing a ball proves a "retired hurt" batter has resumed their
    // innings - clear the stale note so they don't show retired forever.
    if (striker.dismissal === 'retired hurt' && !striker.isOut) striker.dismissal = null;
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
        // Retired hurt isn't a real dismissal - they keep their spot free to
        // come back and bat again later, so isOut must stay false for them.
        if (!NOT_A_FALLEN_WICKET.includes(b.wicketType)) dismissed.isOut = true;
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
    case 'RETIRED_OUT':
      return 'retired out';
    case 'RETIRED_HURT':
      return 'retired hurt';
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
      overStats: {},
      didBowl: false,
      wasBarred: false,
    });
  }
  balls.forEach((b) => {
    const bowler = map.get(b.bowlerId);
    if (!bowler) return;
    bowler.didBowl = true;
    if (b.voidedFromOver) bowler.wasBarred = true;
    if (b.isLegal) bowler.legalBalls += 1;
    if (b.extraType === 'BYE') {
      // byes don't count against the bowler
    } else {
      bowler.runsConceded += ballTotalRuns(b) - (b.extraType === 'BYE' ? b.extraRuns : 0);
    }
    if (b.isWicket && !NOT_BOWLERS_WICKET.includes(b.wicketType)) bowler.wickets += 1;
    if (!bowler.overStats[b.overNumber]) bowler.overStats[b.overNumber] = { runs: 0, legalBalls: 0 };
    bowler.overStats[b.overNumber].runs += ballTotalRuns(b);
    if (b.isLegal) bowler.overStats[b.overNumber].legalBalls += 1;
  });
  return [...map.values()]
    .filter((p) => p.didBowl)
    .map((p) => {
      // A maiden requires a full, uninterrupted 6-ball over - a curtailed
      // over (bowler barred mid-over) can never be one, however many (zero)
      // runs came off it.
      const maidens = Object.values(p.overStats).filter((o) => o.legalBalls === 6 && o.runs === 0).length;
      return {
        playerId: p.playerId,
        name: p.name,
        oversStr: oversDisplay(p.legalBalls),
        maidens,
        runsConceded: p.runsConceded,
        wickets: p.wickets,
        economy: runRate(p.runsConceded, p.legalBalls),
        wasBarred: p.wasBarred,
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
    // A voided over and its restart share the same over number, and could
    // have two different bowlers - the label shows whoever bowled most
    // recently in this slot (the bowler actually still at work).
    o.bowlerId = b.bowlerId;
    o.runs += ballTotalRuns(b);
    if (b.isWicket && !NOT_A_FALLEN_WICKET.includes(b.wicketType)) o.wickets += 1;
    o.balls.push({ text: ballShorthand(b), voided: b.voidedFromOver });
  }
  return [...overs.values()]
    .sort((a, b) => a.overNumber - b.overNumber)
    .map((o) => ({ ...o, bowlerName: playerMap.get(o.bowlerId) || '?' }));
}

function ballShorthand(b) {
  // Retired hurt isn't a genuine dismissal (the batter can come back and bat
  // again later), so it gets its own "H" marker instead of the wicket "W".
  if (b.isWicket && b.wicketType === 'RETIRED_HURT') return 'H';
  if (b.isWicket) return 'W';
  if (b.extraType === 'WIDE') return b.extraRuns > 1 ? `Wd+${b.extraRuns - 1}` : 'Wd';
  if (b.extraType === 'NOBALL') return b.runsBat > 0 ? `Nb+${b.runsBat}` : 'Nb';
  if (b.extraType === 'BYE') return `${b.extraRuns}b`;
  if (b.extraType === 'LEGBYE') return `${b.extraRuns}lb`;
  if (b.isOverthrow) return `${b.runsBat}ot`;
  return String(b.runsBat);
}

export function fallOfWickets(balls, players) {
  const playerMap = new Map(players.map((p) => [p.id, p.name]));
  let runningTotal = 0;
  const fow = [];
  for (const b of balls) {
    runningTotal += ballTotalRuns(b);
    if (b.isWicket && !NOT_A_FALLEN_WICKET.includes(b.wicketType)) {
      fow.push({
        wicketNumber: fow.length + 1,
        score: runningTotal,
        playerName: playerMap.get(b.dismissedId) || '?',
        overStr: oversStrFromProgress(overProgress(balls.filter((x) => x.sequence <= b.sequence))),
      });
    }
  }
  return fow;
}

export function shouldRotateStrike(type, runsBat, extraRuns) {
  if (type === 'RUN' || type === 'NOBALL') return runsBat % 2 === 1;
  if (type === 'BYE' || type === 'LEGBYE') return extraRuns % 2 === 1;
  if (type === 'WIDE') return Math.max(extraRuns - 1, 0) % 2 === 1;
  return false;
}

// Man of the Match / Man of the Tournament point formula. Fully deterministic
// from ball data, so both awards are calculated rather than picked - the
// breakdown is returned too so the UI can show why someone won it, not just
// the final number.
const AWARD_POINTS = {
  perRun: 1,
  four: 1,
  six: 2,
  wicket: 25,
  catch: 10,
  runOut: 10,
  stumping: 10,
  maidenOver: 8,
};

export function computeAwardPoints(balls, players) {
  const nameMap = new Map(players.map((p) => [p.id, p]));
  const pts = new Map();
  const ensure = (id) => {
    if (!pts.has(id)) {
      pts.set(id, { playerId: id, name: nameMap.get(id)?.name || '?', battingPoints: 0, bowlingPoints: 0, fieldingPoints: 0 });
    }
    return pts.get(id);
  };

  for (const b of balls) {
    if (b.extraType === 'NONE' || b.extraType === 'NOBALL') {
      const p = ensure(b.strikerId);
      p.battingPoints += b.runsBat * AWARD_POINTS.perRun;
      if (b.runsBat === 4) p.battingPoints += AWARD_POINTS.four;
      if (b.runsBat === 6) p.battingPoints += AWARD_POINTS.six;
    }
    if (b.isWicket) {
      if (!NOT_BOWLERS_WICKET.includes(b.wicketType)) {
        ensure(b.bowlerId).bowlingPoints += AWARD_POINTS.wicket;
      }
      if (b.fielderId) {
        const fieldingAward =
          b.wicketType === 'CAUGHT' ? AWARD_POINTS.catch : b.wicketType === 'RUNOUT' ? AWARD_POINTS.runOut : b.wicketType === 'STUMPED' ? AWARD_POINTS.stumping : 0;
        if (fieldingAward) ensure(b.fielderId).fieldingPoints += fieldingAward;
      }
    }
  }

  const overStatsByBowler = new Map();
  for (const b of balls) {
    if (!overStatsByBowler.has(b.bowlerId)) overStatsByBowler.set(b.bowlerId, new Map());
    const overs = overStatsByBowler.get(b.bowlerId);
    if (!overs.has(b.overNumber)) overs.set(b.overNumber, { runs: 0, legalBalls: 0 });
    const stat = overs.get(b.overNumber);
    stat.runs += b.runsBat + b.extraRuns;
    if (b.isLegal) stat.legalBalls += 1;
  }
  for (const [bowlerId, overs] of overStatsByBowler) {
    // Same rule as bowlingCard: only a full, uninterrupted 6-ball over can
    // be a maiden.
    const maidens = [...overs.values()].filter((o) => o.legalBalls === 6 && o.runs === 0).length;
    if (maidens > 0) ensure(bowlerId).bowlingPoints += maidens * AWARD_POINTS.maidenOver;
  }

  return [...pts.values()]
    .map((p) => ({ ...p, totalPoints: p.battingPoints + p.bowlingPoints + p.fieldingPoints }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
