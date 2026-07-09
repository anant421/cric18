import { prisma } from './db.js';
import {
  inningsSummary,
  battingCard,
  bowlingCard,
  overByOver,
  fallOfWickets,
  shouldRotateStrike,
  runRate,
} from './scoring.js';

function ballKind(ball) {
  return ball.extraType === 'NONE' ? 'RUN' : ball.extraType;
}

// Given the most recent ball (or null) plus the innings' chosen openers,
// work out who's on strike / bowling right now and what the admin still
// needs to supply before the next ball can be recorded.
function deriveLiveState(innings, lastBall) {
  if (!lastBall) {
    return {
      strikerId: innings.openingStrikerId || null,
      nonStrikerId: innings.openingNonStrikerId || null,
      bowlerId: innings.openingBowlerId || null,
      previousBowlerId: null,
      needsNewBatsman: false,
      needsNewBowler: false,
      outSlot: null,
    };
  }
  let striker = lastBall.strikerId;
  let nonStriker = lastBall.nonStrikerId;
  const bowler = lastBall.bowlerId;

  const rotate = shouldRotateStrike(ballKind(lastBall), lastBall.runsBat, lastBall.extraRuns);
  if (rotate) [striker, nonStriker] = [nonStriker, striker];

  let needsNewBatsman = false;
  let outSlot = null;
  if (lastBall.isWicket) {
    needsNewBatsman = true;
    outSlot = lastBall.dismissedId === striker ? 'striker' : 'nonStriker';
  }

  let needsNewBowler = false;
  let previousBowlerId = null;
  if (lastBall.isLegal && lastBall._legalCountAfter % 6 === 0) {
    [striker, nonStriker] = [nonStriker, striker];
    needsNewBowler = true;
    previousBowlerId = bowler;
  }

  return {
    strikerId: outSlot === 'striker' ? null : striker,
    nonStrikerId: outSlot === 'nonStriker' ? null : nonStriker,
    bowlerId: needsNewBowler ? null : bowler,
    previousBowlerId,
    needsNewBatsman,
    needsNewBowler,
    outSlot,
  };
}

// Never select mobileNumber here - these fields get echoed straight back in
// public API responses (match state, tournament detail), and phone numbers
// are only ever needed server-side for the registration duplicate check.
const publicPlayerSelect = {
  id: true,
  tournamentId: true,
  teamId: true,
  name: true,
  role: true,
  battingStyle: true,
  bowlingStyle: true,
  photoUrl: true,
  createdAt: true,
};

export async function getMatchState(matchId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: { include: { players: { select: publicPlayerSelect } } },
      teamB: { include: { players: { select: publicPlayerSelect } } },
      tournament: true,
      winnerTeam: true,
      tossWinnerTeam: true,
      manOfMatch: true,
      innings: { orderBy: { inningsNumber: 'asc' } },
    },
  });
  if (!match) return null;

  const allPlayers = [...match.teamA.players, ...match.teamB.players];

  const inningsData = [];
  for (const inn of match.innings) {
    const balls = await prisma.ball.findMany({
      where: { inningsId: inn.id },
      orderBy: { sequence: 'asc' },
    });
    const legalBallsSoFar = [];
    let legalCount = 0;
    for (const b of balls) {
      if (b.isLegal) legalCount += 1;
      b._legalCountAfter = legalCount;
      legalBallsSoFar.push(b);
    }
    const battingTeamPlayers = allPlayers.filter((p) => p.teamId === inn.battingTeamId);
    const bowlingTeamPlayers = allPlayers.filter((p) => p.teamId === inn.bowlingTeamId);
    const summary = inningsSummary(inn, balls, allPlayers, match.oversLimit);
    const lastBall = balls[balls.length - 1] || null;
    const live = deriveLiveState(inn, lastBall);

    let requiredRunRate = null;
    let runsNeeded = null;
    let ballsRemaining = null;
    if (inn.target != null && !summary.isDone) {
      runsNeeded = Math.max(inn.target - summary.totalRuns, 0);
      ballsRemaining = match.oversLimit * 6 - summary.legalBalls;
      requiredRunRate = ballsRemaining > 0 ? runRate(runsNeeded, ballsRemaining) : null;
    }

    inningsData.push({
      id: inn.id,
      inningsNumber: inn.inningsNumber,
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      target: inn.target,
      isCompleted: inn.isCompleted,
      summary,
      requiredRunRate,
      runsNeeded,
      ballsRemaining,
      battingCard: battingCard(balls, battingTeamPlayers, allPlayers),
      bowlingCard: bowlingCard(balls, bowlingTeamPlayers),
      overByOver: overByOver(balls, allPlayers),
      fallOfWickets: fallOfWickets(balls, allPlayers),
      live: {
        ...live,
        strikerName: allPlayers.find((p) => p.id === live.strikerId)?.name || null,
        nonStrikerName: allPlayers.find((p) => p.id === live.nonStrikerId)?.name || null,
        bowlerName: allPlayers.find((p) => p.id === live.bowlerId)?.name || null,
      },
      expectedSequence: balls.length,
    });
  }

  return {
    id: match.id,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    status: match.status,
    stage: match.stage,
    venue: match.venue,
    scheduledAt: match.scheduledAt,
    oversLimit: match.oversLimit,
    manOfMatchId: match.manOfMatchId,
    manOfMatchName: match.manOfMatch?.name || null,
    teamA: { id: match.teamA.id, name: match.teamA.name, shortName: match.teamA.shortName, colorHex: match.teamA.colorHex, players: match.teamA.players },
    teamB: { id: match.teamB.id, name: match.teamB.name, shortName: match.teamB.shortName, colorHex: match.teamB.colorHex, players: match.teamB.players },
    tossWinnerTeamId: match.tossWinnerTeamId,
    tossDecision: match.tossDecision,
    currentInningsNumber: match.currentInningsNumber,
    winnerTeamId: match.winnerTeamId,
    resultText: match.resultText,
    innings: inningsData,
  };
}
