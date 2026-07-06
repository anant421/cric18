import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { teams: true, _count: { select: { matches: true } } },
  });
  res.json(tournaments);
}));

const tournamentDetailInclude = {
  teams: { include: { players: true } },
  matches: {
    include: { teamA: true, teamB: true, winnerTeam: true },
    orderBy: { scheduledAt: 'asc' },
  },
};

// This app is dedicated to a single tournament (CData Premier League).
// These two routes must be registered before the generic "/:id" route below,
// otherwise Express would match "cpl" as an :id param instead.
router.get('/cpl', asyncHandler(async (req, res) => {
  const t = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'asc' },
    include: tournamentDetailInclude,
  });
  if (!t) return res.status(404).json({ error: 'not_initialized' });
  res.json(t);
}));

router.post('/cpl/init', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await prisma.tournament.findFirst({
    orderBy: { createdAt: 'asc' },
    include: tournamentDetailInclude,
  });
  if (existing) return res.json(existing);
  const created = await prisma.tournament.create({ data: { name: 'CData Premier League' } });
  const full = await prisma.tournament.findUnique({ where: { id: created.id }, include: tournamentDetailInclude });
  res.status(201).json(full);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const t = await prisma.tournament.findUnique({
    where: { id: req.params.id },
    include: tournamentDetailInclude,
  });
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  res.json(t);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, season } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const t = await prisma.tournament.create({ data: { name, season } });
  res.status(201).json(t);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.tournament.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

// --- Points table (with Net Run Rate, per ICC convention) ---
router.get('/:id/points-table', asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    include: { _count: { select: { players: true } } },
  });
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: 'COMPLETED' },
    include: { innings: true },
  });

  const playerCount = new Map(teams.map((t) => [t.id, t._count.players]));
  const table = new Map(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        name: t.name,
        shortName: t.shortName,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0,
        runsFor: 0,
        oversFor: 0,
        runsAgainst: 0,
        oversAgainst: 0,
      },
    ])
  );

  const allInningsIds = matches.flatMap((m) => m.innings.map((i) => i.id));
  const balls = allInningsIds.length
    ? await prisma.ball.findMany({
        where: { inningsId: { in: allInningsIds } },
        select: { inningsId: true, runsBat: true, extraRuns: true, isLegal: true, isWicket: true },
      })
    : [];
  const ballsByInnings = new Map();
  for (const b of balls) {
    if (!ballsByInnings.has(b.inningsId)) ballsByInnings.set(b.inningsId, []);
    ballsByInnings.get(b.inningsId).push(b);
  }

  for (const m of matches) {
    const a = table.get(m.teamAId);
    const b = table.get(m.teamBId);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    if (!m.winnerTeamId) {
      a.tied += 1;
      b.tied += 1;
      a.points += 1;
      b.points += 1;
    } else if (m.winnerTeamId === m.teamAId) {
      a.won += 1;
      a.points += 2;
      b.lost += 1;
    } else {
      b.won += 1;
      b.points += 2;
      a.lost += 1;
    }

    for (const inn of m.innings) {
      const inningsBalls = ballsByInnings.get(inn.id) || [];
      const totalRuns = inningsBalls.reduce((s, x) => s + x.runsBat + x.extraRuns, 0);
      const legalBalls = inningsBalls.filter((x) => x.isLegal).length;
      const wickets = inningsBalls.filter((x) => x.isWicket).length;
      const battingSquadSize = playerCount.get(inn.battingTeamId) || 0;
      const allOut = battingSquadSize > 0 && wickets >= battingSquadSize - 1;
      // ICC rule: a side bowled out inside its overs is deemed to have used
      // its full quota for its own run-rate calculation; the bowling side's
      // overs-bowled figure is always the actual balls they delivered.
      const oversFacedForBattingSide = allOut ? m.oversLimit : legalBalls / 6;
      const oversBowledForBowlingSide = legalBalls / 6;

      const battingRow = table.get(inn.battingTeamId);
      const bowlingRow = table.get(inn.bowlingTeamId);
      if (battingRow) {
        battingRow.runsFor += totalRuns;
        battingRow.oversFor += oversFacedForBattingSide;
      }
      if (bowlingRow) {
        bowlingRow.runsAgainst += totalRuns;
        bowlingRow.oversAgainst += oversBowledForBowlingSide;
      }
    }
  }

  const rows = [...table.values()]
    .map((r) => {
      const forRate = r.oversFor > 0 ? r.runsFor / r.oversFor : 0;
      const againstRate = r.oversAgainst > 0 ? r.runsAgainst / r.oversAgainst : 0;
      const nrr = r.played > 0 ? Number((forRate - againstRate).toFixed(3)) : 0;
      return {
        teamId: r.teamId,
        name: r.name,
        shortName: r.shortName,
        played: r.played,
        won: r.won,
        lost: r.lost,
        tied: r.tied,
        points: r.points,
        nrr,
      };
    })
    .sort((x, y) => y.points - x.points || y.nrr - x.nrr);
  res.json(rows);
}));

// --- Leaderboards ---
router.get('/:id/stats/leaderboards', asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const players = await prisma.player.findMany({ where: { tournamentId }, include: { team: true } });
  const balls = await prisma.ball.findMany({
    where: { innings: { match: { tournamentId } } },
  });

  const batting = new Map();
  const bowling = new Map();
  for (const p of players) {
    batting.set(p.id, { playerId: p.id, name: p.name, team: p.team.shortName, runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, outs: 0 });
    bowling.set(p.id, { playerId: p.id, name: p.name, team: p.team.shortName, wickets: 0, runsConceded: 0, legalBalls: 0, innings: 0 });
  }
  const battedInnings = new Set();
  const bowledInnings = new Set();
  for (const b of balls) {
    const bat = batting.get(b.strikerId);
    if (bat) {
      const key = `${b.strikerId}:${b.inningsId}`;
      if (!battedInnings.has(key)) {
        battedInnings.add(key);
        bat.innings += 1;
      }
      if (b.extraType === 'NONE' || b.extraType === 'NOBALL') {
        bat.runs += b.runsBat;
        if (b.runsBat === 4) bat.fours += 1;
        if (b.runsBat === 6) bat.sixes += 1;
      }
      if (b.isLegal || b.extraType === 'NOBALL') bat.balls += 1;
    }
    if (b.isWicket && b.dismissedId && batting.has(b.dismissedId)) {
      batting.get(b.dismissedId).outs += 1;
    }
    const bowl = bowling.get(b.bowlerId);
    if (bowl) {
      const key = `${b.bowlerId}:${b.inningsId}`;
      if (!bowledInnings.has(key)) {
        bowledInnings.add(key);
        bowl.innings += 1;
      }
      if (b.isLegal) bowl.legalBalls += 1;
      if (b.extraType !== 'BYE') bowl.runsConceded += b.runsBat + b.extraRuns;
      if (b.isWicket && b.wicketType !== 'RUNOUT') bowl.wickets += 1;
    }
  }

  const battingList = [...batting.values()]
    .filter((p) => p.balls > 0)
    .map((p) => ({ ...p, strikeRate: p.balls ? Number(((p.runs / p.balls) * 100).toFixed(2)) : 0 }))
    .sort((a, b) => b.runs - a.runs);

  const bowlingList = [...bowling.values()]
    .filter((p) => p.legalBalls > 0)
    .map((p) => ({
      ...p,
      overs: `${Math.floor(p.legalBalls / 6)}.${p.legalBalls % 6}`,
      economy: p.legalBalls ? Number(((p.runsConceded / p.legalBalls) * 6).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded);

  res.json({ topBatting: battingList.slice(0, 20), topBowling: bowlingList.slice(0, 20) });
}));

export default router;
