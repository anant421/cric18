import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();

router.post('/', requireAdmin, async (req, res) => {
  const { tournamentId, teamId, name, role, battingStyle, bowlingStyle } = req.body || {};
  if (!tournamentId || !teamId || !name) {
    return res.status(400).json({ error: 'tournamentId, teamId and name are required' });
  }
  const player = await prisma.player.create({
    data: { tournamentId, teamId, name, role: role || 'BATSMAN', battingStyle, bowlingStyle },
  });
  res.status(201).json(player);
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const { name, role, battingStyle, bowlingStyle } = req.body || {};
  const player = await prisma.player.update({
    where: { id: req.params.id },
    data: { name, role, battingStyle, bowlingStyle },
  });
  res.json(player);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.player.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
