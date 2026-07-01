import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { getMatchState } from '../matchState.js';
import { emitMatchUpdate } from '../sockets.js';
import { asyncHandler } from '../asyncHandler.js';

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
  res.json(match);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.match.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// --- Toss: decides who bats first and opens innings 1 ---
router.post('/:id/toss', requireAdmin, asyncHandler(async (req, res) => {
  const { tossWinnerTeamId, tossDecision } = req.body || {};
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
      data: { tossWinnerTeamId, tossDecision, status: 'LIVE', currentInningsNumber: 1 },
    }),
    prisma.innings.create({
      data: { matchId: match.id, inningsNumber: 1, battingTeamId, bowlingTeamId },
    }),
  ]);

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
  await sendState(res, req.params.id);
}));

// --- Start second innings once the first has finished ---
router.post('/:id/start-second-innings', requireAdmin, asyncHandler(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id }, include: { innings: true } });
  if (!match) return res.status(404).json({ error: 'Match not found' });
  const first = match.innings.find((i) => i.inningsNumber === 1);
  if (!first || !first.isCompleted) return res.status(400).json({ error: 'First innings is not complete yet' });
  if (match.innings.some((i) => i.inningsNumber === 2)) {
    return res.status(400).json({ error: 'Second innings already started' });
  }
  const state = await getMatchState(match.id);
  const firstRuns = state.innings[0].summary.totalRuns;

  await prisma.$transaction([
    prisma.match.update({ where: { id: match.id }, data: { currentInningsNumber: 2 } }),
    prisma.innings.create({
      data: {
        matchId: match.id,
        inningsNumber: 2,
        battingTeamId: first.bowlingTeamId,
        bowlingTeamId: first.battingTeamId,
        target: firstRuns + 1,
      },
    }),
  ]);

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
  } = req.body || {};

  if (!inningsId || !strikerId || !nonStrikerId || !bowlerId || !type) {
    return res.status(400).json({ error: 'inningsId, strikerId, nonStrikerId, bowlerId and type are required' });
  }

  const existingCount = await prisma.ball.count({ where: { inningsId } });
  if (existingCount !== expectedSequence) {
    return res.status(409).json({ error: 'Match state has changed - please refresh before scoring the next ball' });
  }

  const isLegal = type !== 'WIDE' && type !== 'NOBALL';
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

  const legalCountBefore = await prisma.ball.count({ where: { inningsId, isLegal: true } });
  const overNumber = Math.floor(legalCountBefore / 6);
  const ballInOver = (legalCountBefore % 6) + 1;

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
    },
  });

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
  await prisma.match.updateMany({ where: { id: req.params.id, status: 'COMPLETED' }, data: { status: 'LIVE', winnerTeamId: null, resultText: null } });
  await sendState(res, req.params.id);
}));

async function maybeFinishInningsOrMatch(matchId, inningsId) {
  const state = await getMatchState(matchId);
  const inn = state.innings.find((i) => i.id === inningsId);
  if (!inn || !inn.summary.isDone) return;

  await prisma.innings.update({ where: { id: inningsId }, data: { isCompleted: true } });

  if (inn.inningsNumber === 2) {
    const first = state.innings.find((i) => i.inningsNumber === 1);
    const second = inn;
    const match = await prisma.match.findUnique({ where: { id: matchId }, include: { teamA: { include: { players: true } }, teamB: { include: { players: true } } } });
    const secondTeamPlayerCount = second.battingTeamId === match.teamAId ? match.teamA.players.length : match.teamB.players.length;

    let winnerTeamId = null;
    let resultText = 'Match tied';
    if (second.summary.totalRuns > first.summary.totalRuns) {
      const wicketsInHand = Math.max(secondTeamPlayerCount - 1 - second.summary.totalWickets, 0);
      winnerTeamId = second.battingTeamId;
      const teamName = second.battingTeamId === match.teamAId ? match.teamA.name : match.teamB.name;
      resultText = `${teamName} won by ${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}`;
    } else if (first.summary.totalRuns > second.summary.totalRuns) {
      const margin = first.summary.totalRuns - second.summary.totalRuns;
      winnerTeamId = first.battingTeamId;
      const teamName = first.battingTeamId === match.teamAId ? match.teamA.name : match.teamB.name;
      resultText = `${teamName} won by ${margin} run${margin === 1 ? '' : 's'}`;
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'COMPLETED', winnerTeamId, resultText },
    });
  }
}

export default router;
