import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { getMatchState, invalidateMatchState } from '../matchState.js';
import { emitMatchUpdate } from '../sockets.js';
import { asyncHandler } from '../asyncHandler.js';
import { computeAwardPoints, nextBallPosition } from '../scoring.js';
import { invalidateTournamentDetail } from './tournaments.routes.js';

const router = Router();

async function sendState(res, matchId) {
  const state = await getMatchState(matchId);
  if (!state) return res.status(404).json({ error: 'Match not found' });
  emitMatchUpdate(matchId, state);
  res.json(state);
}

router.get('/:id', asyncHandler(async (req, res) => {
  const state = await getMatchState(req.params.id);
  if (!state) return res.status(404).json({ error: 'Match not found' });
  res.json(state);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { tournamentId, teamAId, teamBId, oversLimit, venue, scheduledAt } = req.body || {};
  if (!tournamentId || !teamAId || !teamBId) {
    return res.status(400).json({ error: 'tournamentId, teamAId and teamBId are required' });
  }
  if (teamAId === teamBId) return res.status(400).json({ error: 'A team cannot play itself' });
  const match = await prisma.match.create({
    data: {
      tournamentId,
      teamAId,
      teamBId,
      oversLimit: oversLimit || 8,
      venue,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });
  invalidateTournamentDetail(tournamentId);
  res.status(201).json(match);
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { oversLimit, venue, scheduledAt } = req.body || {};
  const match = await prisma.match.update({
    where: { id: req.params.id },
    data: {
      oversLimit,
      venue,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
  });
  invalidateMatchState(req.params.id);
  invalidateTournamentDetail(match.tournamentId);
  res.json(match);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const match = await prisma.match.delete({ where: { id: req.params.id } });
  invalidateMatchState(req.params.id);
  invalidateTournamentDetail(match.tournamentId);
  res.status(204).end();
}));

// --- Toss: decides who bats first and opens innings 1 ---
router.post('/:id/toss', requireAdmin, asyncHandler(async (req, res) => {
  const { tossWinnerTeamId, tossDecision, umpire1, umpire2 } = req.body || {};
  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (![match.teamAId, match.teamBId].includes(tossWinnerTeamId)) {
    return res.status(400).json({ error: 'tossWinnerTeamId must be one of the two teams' });
  }
  if (!['BAT', 'BOWL'].includes(tossDecision)) {
    return res.status(400).json({ error: 'tossDecision must be BAT or BOWL' });
  }
  const otherTeamId = tossWinnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const battingTeamId = tossDecision === 'BAT' ? tossWinnerTeamId : otherTeamId;
  const bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId;

  await prisma.$transaction([
    prisma.match.update({
      where: { id: match.id },
      data: { tossWinnerTeamId, tossDecision, status: 'LIVE', currentInningsNumber: 1, umpire1: umpire1 || null, umpire2: umpire2 || null },
    }),
    prisma.innings.create({
      data: { matchId: match.id, inningsNumber: 1, battingTeamId, bowlingTeamId },
    }),
  ]);

  invalidateMatchState(match.id);
  invalidateTournamentDetail(match.tournamentId);
  await sendState(res, match.id);
}));

// --- Set opening lineup for an innings (must happen before ball 1) ---
router.post('/:id/lineup', requireAdmin, asyncHandler(async (req, res) => {
  const { inningsId, strikerId, nonStrikerId, bowlerId } = req.body || {};
  if (!inningsId || !strikerId || !nonStrikerId || !bowlerId) {
    return res.status(400).json({ error: 'inningsId, strikerId, nonStrikerId and bowlerId are required' });
  }
  if (strikerId === nonStrikerId) return res.status(400).json({ error: 'Striker and non-striker must differ' });
  await prisma.innings.update({
    where: { id: inningsId },
    data: { openingStrikerId: strikerId, openingNonStrikerId: nonStrikerId, openingBowlerId: bowlerId },
  });
  invalidateMatchState(req.params.id);
  await sendState(res, req.params.id);
}));

// --- Start the second half of the current innings pair once the first has
// finished - this covers both the normal innings 1 -> 2 handoff and a Super
// Over's own first -> second innings handoff, since they work identically. ---
router.post('/:id/start-second-innings', requireAdmin, asyncHandler(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id }, include: { innings: true } });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const maxNumber = Math.max(0, ...match.innings.map((i) => i.inningsNumber));
  const first = match.innings.find((i) => i.inningsNumber === maxNumber);
  if (!first || maxNumber % 2 !== 1) return res.status(400).json({ error: 'No innings is awaiting its second half' });
  if (!first.isCompleted) return res.status(400).json({ error: 'First innings is not complete yet' });
  if (match.innings.some((i) => i.inningsNumber === maxNumber + 1)) {
    return res.status(400).json({ error: 'Second innings already started' });
  }
  const state = await getMatchState(match.id);
  const firstRuns = state.innings.find((i) => i.inningsNumber === maxNumber).summary.totalRuns;

  await prisma.$transaction([
    prisma.match.update({ where: { id: match.id }, data: { currentInningsNumber: maxNumber + 1 } }),
    prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: maxNumber + 1,
        battingTeamId: first.bowlingTeamId,
        bowlingTeamId: first.battingTeamId,
        target: firstRuns + 1,
        isSuperOver: first.isSuperOver,
      },
    }),
  ]);

  invalidateMatchState(match.id);
  await sendState(res, match.id);
}));

// --- Start a Super Over once the Final's previous innings pair has ended
// level - per the Laws, the team that batted second (chased) in the pair
// that just tied bats first in the Super Over. ---
router.post('/:id/start-super-over', requireAdmin, asyncHandler(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id }, include: { innings: true } });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.stage !== 'FINAL') return res.status(400).json({ error: 'A Super Over is only available for the Final' });

  const maxNumber = Math.max(0, ...match.innings.map((i) => i.inningsNumber));
  if (maxNumber < 2 || maxNumber % 2 !== 0) {
    return res.status(400).json({ error: 'The previous innings pair must be complete first' });
  }
  const pairSecond = match.innings.find((i) => i.inningsNumber === maxNumber);
  const pairFirst = match.innings.find((i) => i.inningsNumber === maxNumber - 1);
  if (!pairSecond?.isCompleted || !pairFirst?.isCompleted) {
    return res.status(400).json({ error: 'The previous innings pair is not complete yet' });
  }

  const state = await getMatchState(match.id);
  const firstRuns = state.innings.find((i) => i.inningsNumber === maxNumber - 1).summary.totalRuns;
  const secondRuns = state.innings.find((i) => i.inningsNumber === maxNumber).summary.totalRuns;
  if (firstRuns !== secondRuns) return res.status(400).json({ error: 'Scores are not level - no Super Over needed' });

  await prisma.$transaction([
    prisma.match.update({
      where: { id: match.id },
      data: { currentInningsNumber: maxNumber + 1, status: 'LIVE', winnerTeamId: null, resultText: null },
    }),
    prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: maxNumber + 1,
        battingTeamId: pairSecond.battingTeamId,
        bowlingTeamId: pairSecond.bowlingTeamId,
        isSuperOver: true,
      },
    }),
  ]);

  invalidateMatchState(match.id);
  invalidateTournamentDetail(match.tournamentId);
  await sendState(res, match.id);
}));

// --- Record one ball ---
router.post('/:id/ball', requireAdmin, asyncHandler(async (req, res) => {
  const {
    inningsId,
    expectedSequence,
    strikerId,
    nonStrikerId,
    bowlerId,
    type, // RUN | WIDE | NOBALL | BYE | LEGBYE
    runs = 0,
    isWicket = false,
    wicketType,
    dismissedId,
    fielderId,
    isOverthrow = false,
  } = req.body || {};

  if (!inningsId || !strikerId || !nonStrikerId || !bowlerId || !type) {
    return res.status(400).json({ error: 'inningsId, strikerId, nonStrikerId, bowlerId and type are required' });
  }

  const existingBalls = await prisma.ball.findMany({
    where: { inningsId },
    orderBy: { sequence: 'asc' },
    select: { isLegal: true, voidedFromOver: true },
  });
  const existingCount = existingBalls.length;
  if (existingCount !== expectedSequence) {
    return res.status(409).json({ error: 'Match state has changed - please refresh before scoring the next ball' });
  }

  // A retirement isn't a delivery at all - the batter simply leaves the
  // crease between balls, so it must never consume a legal ball or advance
  // the over, no matter what `type` the client sent alongside it.
  const isRetirement = isWicket && ['RETIRED_OUT', 'RETIRED_HURT'].includes(wicketType);
  const isLegal = !isRetirement && type !== 'WIDE' && type !== 'NOBALL';
  let runsBat = 0;
  let extraRuns = 0;
  let extraType = 'NONE';
  if (type === 'RUN') {
    runsBat = runs;
  } else if (type === 'WIDE') {
    extraType = 'WIDE';
    extraRuns = 1 + runs;
  } else if (type === 'NOBALL') {
    extraType = 'NOBALL';
    extraRuns = 1;
    runsBat = runs;
  } else if (type === 'BYE') {
    extraType = 'BYE';
    extraRuns = runs;
  } else if (type === 'LEGBYE') {
    extraType = 'LEGBYE';
    extraRuns = runs;
  } else {
    return res.status(400).json({ error: 'Invalid ball type' });
  }
  if (isRetirement) runsBat = 0;

  const { overNumber, ballInOver } = nextBallPosition(existingBalls);

  await prisma.ball.create({
    data: {
      inningsId,
      sequence: existingCount,
      overNumber,
      ballInOver,
      isLegal,
      strikerId,
      nonStrikerId,
      bowlerId,
      runsBat,
      extraType,
      extraRuns,
      isWicket,
      wicketType: isWicket ? wicketType : null,
      dismissedId: isWicket ? dismissedId || strikerId : null,
      fielderId: isWicket ? fielderId || null : null,
      isOverthrow: type === 'RUN' && isOverthrow,
    },
  });

  invalidateMatchState(req.params.id);
  await maybeFinishInningsOrMatch(req.params.id, inningsId);
  await sendState(res, req.params.id);
}));

// --- Void the current over entirely, e.g. a bowler barred mid-over for an
// illegal/dangerous action. Every ball already bowled this over keeps its
// runs/wickets for the team total, the batter, and that bowler's own
// figures - but none of them count toward the innings' overs-used budget.
// A new bowler is required, and the very next ball restarts this same over
// number from ball 1, with the innings' overs limit untouched. ---
router.post('/:id/end-over', requireAdmin, asyncHandler(async (req, res) => {
  const { inningsId } = req.body || {};
  if (!inningsId) return res.status(400).json({ error: 'inningsId is required' });
  const last = await prisma.ball.findFirst({ where: { inningsId }, orderBy: { sequence: 'desc' } });
  if (!last) return res.status(400).json({ error: 'No balls bowled yet this over' });
  if (last.voidedFromOver) return res.status(400).json({ error: 'This over has already been ended' });
  await prisma.ball.updateMany({ where: { inningsId, overNumber: last.overNumber }, data: { voidedFromOver: true } });
  invalidateMatchState(req.params.id);
  await maybeFinishInningsOrMatch(req.params.id, inningsId);
  await sendState(res, req.params.id);
}));

// --- Undo the last ball recorded in an innings ---
router.post('/:id/undo', requireAdmin, asyncHandler(async (req, res) => {
  const { inningsId } = req.body || {};
  if (!inningsId) return res.status(400).json({ error: 'inningsId is required' });
  const last = await prisma.ball.findFirst({ where: { inningsId }, orderBy: { sequence: 'desc' } });
  if (!last) return res.status(400).json({ error: 'No balls to undo' });
  await prisma.ball.delete({ where: { id: last.id } });
  await prisma.innings.update({ where: { id: inningsId }, data: { isCompleted: false } });
  // Reset any result already recorded off the back of this innings - covers
  // both a fully COMPLETED match and a tied Final left LIVE while awaiting a
  // Super Over (resultText set, status never flipped to COMPLETED).
  const { count } = await prisma.match.updateMany({
    where: { id: req.params.id, OR: [{ status: 'COMPLETED' }, { resultText: { not: null } }] },
    data: { status: 'LIVE', winnerTeamId: null, resultText: null, manOfMatchId: null },
  });
  if (count > 0) {
    const match = await prisma.match.findUnique({ where: { id: req.params.id }, select: { tournamentId: true } });
    invalidateTournamentDetail(match.tournamentId);
  }
  invalidateMatchState(req.params.id);
  await sendState(res, req.params.id);
}));

async function maybeFinishInningsOrMatch(matchId, inningsId) {
  const state = await getMatchState(matchId);
  const inn = state.innings.find((i) => i.id === inningsId);
  if (!inn || !inn.summary.isDone) return;

  await prisma.innings.update({ where: { id: inningsId }, data: { isCompleted: true } });
  invalidateMatchState(matchId);

  // Only the second innings of a pair (normal 1/2, or a Super Over's own
  // pair) can decide anything - the first innings of a pair just sets the
  // target and waits for its second half.
  if (inn.inningsNumber % 2 === 0) {
    const first = state.innings.find((i) => i.inningsNumber === inn.inningsNumber - 1);
    const second = inn;
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { teamA: { include: { players: true } }, teamB: { include: { players: true } } } });
    // Cap at 11 - a squad can carry substitutes beyond the playing XI, but
    // only 11 ever bat, so the win margin should never exceed 10 wickets.
    const secondTeamPlayerCount = Math.min(second.battingTeamId === match.teamAId ? match.teamA.players.length : match.teamB.players.length, 11);

    const suffix = second.isSuperOver ? ' (Super Over)' : '';
    let winnerTeamId = null;
    let resultText = null;
    let isTied = false;
    if (second.summary.totalRuns > first.summary.totalRuns) {
      const wicketsInHand = Math.max(secondTeamPlayerCount - 1 - second.summary.totalWickets, 0);
      winnerTeamId = second.battingTeamId;
      const teamName = second.battingTeamId === match.teamAId ? match.teamA.name : match.teamB.name;
      resultText = `${teamName} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}${suffix}`;
    } else if (first.summary.totalRuns > second.summary.totalRuns) {
      const margin = first.summary.totalRuns - second.summary.totalRuns;
      winnerTeamId = first.battingTeamId;
      const teamName = first.battingTeamId === match.teamAId ? match.teamA.name : match.teamB.name;
      resultText = `${teamName} won by ${margin} run${margin === 1 ? '' : 's'}${suffix}`;
    } else {
      isTied = true;
    }

    // A tied Final isn't finished - a Super Over is needed (and if that ties
    // too, another one). Every other tie (league stage, or a non-final) ends
    // the match as a draw right here.
    if (isTied && match.stage === 'FINAL') {
      resultText = second.isSuperOver
        ? 'Scores level after the Super Over — another Super Over needed'
        : 'Scores level — Super Over needed';
      await prisma.match.update({ where: { id: matchId }, data: { winnerTeamId: null, resultText } });
      invalidateMatchState(matchId);
      invalidateTournamentDetail(match.tournamentId);
      return;
    }
    if (isTied) resultText = 'Match tied';

    const allPlayers = [...match.teamA.players, ...match.teamB.players];
    const allBalls = await prisma.ball.findMany({
      where: { innings: { matchId } },
      orderBy: { sequence: 'asc' },
    });
    const awards = computeAwardPoints(allBalls, allPlayers);
    const manOfMatchId = awards[0]?.playerId || null;

    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'COMPLETED', winnerTeamId, resultText, manOfMatchId },
    });
    invalidateMatchState(matchId);
    invalidateTournamentDetail(match.tournamentId);
  }
}

export default router;
