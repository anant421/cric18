import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { tournamentId, teamId, name, role, battingStyle, bowlingStyle } = req.body || {};
  if (!tournamentId || !teamId || !name) {
    return res.status(400).json({ error: 'tournamentId, teamId and name are required' });
  }
  const player = await prisma.player.create({
    data: { tournamentId, teamId, name, role: role || 'BATSMAN', battingStyle, bowlingStyle },
  });
  res.status(201).json(player);
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, role, battingStyle, bowlingStyle } = req.body || {};
  const player = await prisma.player.update({
    where: { id: req.params.id },
    data: { name, role, battingStyle, bowlingStyle },
  });
  res.json(player);
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const hasRecordedBalls = await prisma.ball.findFirst({
    where: {
      OR: [
        { strikerId: req.params.id },
        { nonStrikerId: req.params.id },
        { bowlerId: req.params.id },
        { dismissedId: req.params.id },
        { fielderId: req.params.id },
      ],
    },
    select: { id: true },
  });
  if (hasRecordedBalls) {
    return res.status(400).json({
      error: 'This player has already been scored in a match and can’t be removed. Delete the match first if you need to remove them.',
    });
  }
  await prisma.player.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
