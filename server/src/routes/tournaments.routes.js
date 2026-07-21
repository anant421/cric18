import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { computeAwardPoints } from '../scoring.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { teams: true, _count: { select: { matches: true } } },
  });
  res.json(tournaments);
}));

// Never select mobileNumber here - these fields get echoed straight back in
// the public tournament-detail response. Phone numbers only ever need to be
// read server-side, for the registration duplicate check.
const publicPlayerSelect = {
  id: true,
  tournamentId: true,
  teamId: true,
  name: true,
  role: true,
  gender: true,
  battingStyle: true,
  bowlingStyle: true,
  photoUrl: true,
  createdAt: true,
};

const tournamentDetailInclude = {
  teams: { include: { players: { select: publicPlayerSelect } } },
  matches: {
    include: { teamA: true, teamB: true, winnerTeam: true, manOfMatch: { select: publicPlayerSelect } },
    orderBy: { scheduledAt: 'asc' },
  },
};

// Every viewer on the tournament page hits this route, and it's expensive
// (nested teams/players/matches). Unlike ball-by-ball match state, roster
// and match-list changes aren't second-by-second critical, so a short TTL
// is enough to absorb concurrent reads without needing exact invalidation
// wired through every route (teams/players/matches) that can touch this data.
const DETAIL_TTL_MS = 5000;
const detailCache = new Map();
// Coalesces concurrent cache-misses onto one in-flight query instead of
// letting every simultaneous viewer trigger their own redundant fetch.
const detailInFlight = new Map();

export function invalidateTournamentDetail(tournamentId) {
  detailCache.delete(tournamentId);
}

router.get('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) {
    if (!cached.state) return res.status(404).json({ error: 'Tournament not found' });
    return res.json(cached.state);
  }

  let promise = detailInFlight.get(id);
  if (!promise) {
    promise = prisma.tournament
      .findUnique({ where: { id }, include: tournamentDetailInclude })
      .then((t) => {
        detailCache.set(id, { state: t, at: Date.now() });
        return t;
      })
      .finally(() => detailInFlight.delete(id));
    detailInFlight.set(id, promise);
  }

  const t = await promise;
  if (!t) return res.status(404).json({ error: 'Tournament not found' });
  res.json(t);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, season } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const t = await prisma.tournament.create({ data: { name, season } });
  res.status(201).json(t);
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, season } = req.body || {};
  if (name != null && !name.trim()) return res.status(400).json({ error: 'name cannot be empty' });
  const t = await prisma.tournament.update({
    where: { id: req.params.id },
    data: { name: name?.trim(), season },
  });
  invalidateTournamentDetail(req.params.id);
  res.json(t);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.tournament.delete({ where: { id: req.params.id } });
  invalidateTournamentDetail(req.params.id);
  res.status(204).end();
}));

// --- Points table (with Net Run Rate, per ICC convention) ---
async function computePointsTable(tournamentId) {
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
      // Retired hurt is temporary (the batter can resume later) and never
      // counts as a fallen wicket, unlike a permanent "retired out".
      const wickets = inningsBalls.filter((x) => x.isWicket && x.wicketType !== 'RETIRED_HURT').length;
      // Cap at 11 - squads can carry substitutes beyond the playing XI.
      const battingSquadSize = Math.min(playerCount.get(inn.battingTeamId) || 0, 11);
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

  return [...table.values()]
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
}

router.get('/:id/points-table', asyncHandler(async (req, res) => {
  res.json(await computePointsTable(req.params.id));
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
    // Retired hurt isn't a genuine dismissal (the batter can resume later),
    // so it shouldn't count as an "out" for batting average purposes.
    if (b.isWicket && b.wicketType !== 'RETIRED_HURT' && b.dismissedId && batting.has(b.dismissedId)) {
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
      if (b.isWicket && !['RUNOUT', 'RETIRED_OUT', 'RETIRED_HURT'].includes(b.wicketType)) bowl.wickets += 1;
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

// --- Awards: per-match Player of the Match + tournament-wide awards ---
router.get('/:id/awards', asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const players = await prisma.player.findMany({ where: { tournamentId } });
  const allMatches = await prisma.match.findMany({ where: { tournamentId } });
  const completedMatches = await prisma.match.findMany({
    where: { tournamentId, status: 'COMPLETED' },
    include: { teamA: true, teamB: true, manOfMatch: true },
    orderBy: { scheduledAt: 'asc' },
  });
  const balls = await prisma.ball.findMany({
    where: { innings: { match: { tournamentId, status: 'COMPLETED' } } },
  });

  // These tournament-wide awards are only crowned once the tournament has
  // actually finished: the Final (if one was set up) is completed, or - for
  // tournaments run without the auto-fixtures Final - every match is done.
  const finalMatch = allMatches.find((m) => m.stage === 'FINAL');
  const isComplete = finalMatch
    ? finalMatch.status === 'COMPLETED'
    : allMatches.length > 0 && allMatches.every((m) => m.status === 'COMPLETED' || m.status === 'ABANDONED');

  const tournamentAwards = computeAwardPoints(balls, players);
  const genderById = new Map(players.map((p) => [p.id, p.gender]));
  const womanOfTournament = tournamentAwards.find((p) => genderById.get(p.playerId) === 'FEMALE') || null;

  // Best Batter: most runs across the tournament.
  const playerById = new Map(players.map((p) => [p.id, p]));
  const runsByPlayer = new Map();
  for (const b of balls) {
    if (b.extraType === 'NONE' || b.extraType === 'NOBALL') {
      runsByPlayer.set(b.strikerId, (runsByPlayer.get(b.strikerId) || 0) + b.runsBat);
    }
  }
  const [bestBatterId, bestBatterRuns] = [...runsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const bestBatter = bestBatterId ? { playerId: bestBatterId, name: playerById.get(bestBatterId)?.name || '?', runs: bestBatterRuns } : null;

  // Best Bowler: most wickets, tiebreak by fewest runs conceded.
  const bowlerStats = new Map();
  for (const b of balls) {
    if (!bowlerStats.has(b.bowlerId)) bowlerStats.set(b.bowlerId, { wickets: 0, runsConceded: 0 });
    const s = bowlerStats.get(b.bowlerId);
    if (b.isWicket && !['RUNOUT', 'RETIRED_OUT', 'RETIRED_HURT'].includes(b.wicketType)) s.wickets += 1;
    if (b.extraType !== 'BYE') s.runsConceded += b.runsBat + b.extraRuns;
  }
  const [bestBowlerId, bestBowlerStats] =
    [...bowlerStats.entries()].sort((a, b) => b[1].wickets - a[1].wickets || a[1].runsConceded - b[1].runsConceded)[0] || [];
  const bestBowler = bestBowlerId
    ? { playerId: bestBowlerId, name: playerById.get(bestBowlerId)?.name || '?', wickets: bestBowlerStats.wickets, runsConceded: bestBowlerStats.runsConceded }
    : null;

  // Best Catch: admin-designated (can't be derived from stats alone).
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { bestCatchBall: { include: { fielder: true, innings: { include: { match: { include: { teamA: true, teamB: true } } } } } } },
  });
  const bestCatch = tournament?.bestCatchBall
    ? {
        fielderName: tournament.bestCatchBall.fielder?.name || '?',
        matchTeams: `${tournament.bestCatchBall.innings.match.teamA.name} vs ${tournament.bestCatchBall.innings.match.teamB.name}`,
      }
    : null;

  res.json({
    isComplete,
    playerOfTournament: isComplete ? tournamentAwards[0] || null : null,
    contenders: tournamentAwards.slice(0, 10),
    bestBatter: isComplete ? bestBatter : null,
    bestBowler: isComplete ? bestBowler : null,
    bestCatch: isComplete ? bestCatch : null,
    womanOfTournament: isComplete ? womanOfTournament : null,
    matchAwards: completedMatches.map((m) => ({
      matchId: m.id,
      teamA: m.teamA.name,
      teamB: m.teamB.name,
      resultText: m.resultText,
      manOfMatchId: m.manOfMatchId,
      manOfMatchName: m.manOfMatch?.name || null,
    })),
  });
}));

// --- Best Catch: admin picks from all catches taken in the tournament ---
router.get('/:id/catches', requireAdmin, asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const balls = await prisma.ball.findMany({
    where: { isWicket: true, wicketType: 'CAUGHT', innings: { match: { tournamentId, status: 'COMPLETED' } } },
    include: {
      fielder: true,
      dismissed: true,
      innings: { include: { match: { include: { teamA: true, teamB: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(
    balls.map((b) => ({
      ballId: b.id,
      fielderName: b.fielder?.name || 'Unknown',
      dismissedName: b.dismissed?.name || 'Unknown',
      matchTeams: `${b.innings.match.teamA.name} vs ${b.innings.match.teamB.name}`,
      overStr: `${b.overNumber}.${b.ballInOver}`,
    }))
  );
}));

router.post('/:id/best-catch', requireAdmin, asyncHandler(async (req, res) => {
  const { ballId } = req.body || {};
  const tournament = await prisma.tournament.update({
    where: { id: req.params.id },
    data: { bestCatchBallId: ballId || null },
  });
  res.json(tournament);
}));

// --- Fixtures: round-robin league stage, then a Final between the top 2 ---
router.post('/:id/generate-fixtures', requireAdmin, asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const existing = await prisma.match.findFirst({ where: { tournamentId, stage: 'LEAGUE' } });
  if (existing) return res.status(400).json({ error: 'League fixtures have already been generated for this tournament' });

  const teams = await prisma.team.findMany({ where: { tournamentId } });
  if (teams.length < 2) return res.status(400).json({ error: 'Add at least two teams before generating fixtures' });

  const { oversLimit = 8 } = req.body || {};
  const pairs = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      pairs.push([teams[i].id, teams[j].id]);
    }
  }

  await prisma.match.createMany({
    data: pairs.map(([teamAId, teamBId]) => ({ tournamentId, teamAId, teamBId, oversLimit, stage: 'LEAGUE' })),
  });

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: tournamentDetailInclude });
  invalidateTournamentDetail(tournamentId);
  res.status(201).json(t);
}));

router.post('/:id/generate-final', requireAdmin, asyncHandler(async (req, res) => {
  const tournamentId = req.params.id;
  const existingFinal = await prisma.match.findFirst({ where: { tournamentId, stage: 'FINAL' } });
  if (existingFinal) return res.status(400).json({ error: 'The Final has already been set up' });

  const leagueMatches = await prisma.match.findMany({ where: { tournamentId, stage: 'LEAGUE' } });
  if (leagueMatches.length === 0) return res.status(400).json({ error: 'Generate the league fixtures first' });
  if (leagueMatches.some((m) => m.status !== 'COMPLETED')) {
    return res.status(400).json({ error: 'All league matches must be completed before the Final can be set up' });
  }

  const table = await computePointsTable(tournamentId);
  if (table.length < 2) return res.status(400).json({ error: 'Need at least two teams on the points table' });
  const [first, second] = table;
  const { oversLimit = 8 } = req.body || {};

  await prisma.match.create({
    data: { tournamentId, teamAId: first.teamId, teamBId: second.teamId, oversLimit, stage: 'FINAL' },
  });

  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: tournamentDetailInclude });
  invalidateTournamentDetail(tournamentId);
  res.status(201).json(t);
}));

export default router;
