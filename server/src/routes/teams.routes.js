import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { tournamentId, name, shortName, colorHex } = req.body || {};
  if (!tournamentId || !name || !shortName) {
    return res.status(400).json({ error: 'tournamentId, name and shortName are required' });
  }
  const team = await prisma.team.create({
    data: { tournamentId, name, shortName, colorHex: colorHex || '#1d9bf0' },
  });
  res.status(201).json(team);
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, shortName, colorHex } = req.body || {};
  const team = await prisma.team.update({
    where: { id: req.params.id },
    data: { name, shortName, colorHex },
  });
  res.json(team);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const hasMatches = await prisma.match.findFirst({
    where: { OR: [{ teamAId: req.params.id }, { teamBId: req.params.id }] },
    select: { id: true },
  });
  if (hasMatches) {
    return res.status(400).json({
      error: 'This team has scheduled or played matches and can’t be removed. Delete those matches first if you need to remove the team.',
    });
  }
  await prisma.team.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
