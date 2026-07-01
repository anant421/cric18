import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();

router.post('/', requireAdmin, async (req, res) => {
  const { tournamentId, name, shortName, colorHex } = req.body || {};
  if (!tournamentId || !name || !shortName) {
    return res.status(400).json({ error: 'tournamentId, name and shortName are required' });
  }
  const team = await prisma.team.create({
    data: { tournamentId, name, shortName, colorHex: colorHex || '#1d9bf0' },
  });
  res.status(201).json(team);
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const { name, shortName, colorHex } = req.body || {};
  const team = await prisma.team.update({
    where: { id: req.params.id },
    data: { name, shortName, colorHex },
  });
  res.json(team);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.team.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
