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

// Many viewers read the same match state between balls; recomputing the full
// scorecard from the database for every single one of them is wasteful and
// is what makes the app feel laggy under concurrent load. Every write path
// (ball, toss, lineup, undo, etc.) calls invalidateMatchState() right before
// broadcasting, so cached readers never see stale data - the TTL below is
// purely a safety net in case a future write path forgets to invalidate.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

export function invalidateMatchState(matchId) {
  cache.delete(matchId);
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

// If many viewers request the same never-yet-cached (or just-invalidated)
// match at once, only the first should actually hit the database - the rest
// wait on that same in-flight computation instead of each triggering their
// own redundant one (a "cache stampede").
const inFlight = new Map();

export async function getMatchState(matchId) {
  const cached = cache.get(matchId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.state;

  if (inFlight.has(matchId)) return inFlight.get(matchId);

  const promise = computeMatchState(matchId)
    .then((state) => {
      if (state) cache.set(matchId, { state, at: Date.now() });
      return state;
    })
    .finally(() => inFlight.delete(matchId));
  inFlight.set(matchId, promise);
  return promise;
}

async function computeMatchState(matchId) {
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

  // One query for every innings' balls instead of one round-trip per innings.
  const allBalls = match.innings.length
    ? await prisma.ball.findMany({
        where: { inningsId: { in: match.innings.map((i) => i.id) } },
        orderBy: { sequence: 'asc' },
      })
    : [];
  const ballsByInnings = new Map();
  for (const b of allBalls) {
    if (!ballsByInnings.has(b.inningsId)) ballsByInnings.set(b.inningsId, []);
    ballsByInnings.get(b.inningsId).push(b);
  }

  const inningsData = [];
  for (const inn of match.innings) {
    const balls = ballsByInnings.get(inn.id) || [];
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
