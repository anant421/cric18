import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';

const router = Router();

// Normalizes to digits-only (plus a leading "+") so "98765 43210" and
// "+91-98765-43210" are recognized as the same number for the dedupe check.
function normalizeMobile(raw) {
  const trimmed = String(raw).trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

function isValidMobile(normalized) {
  return /^\+?[0-9]{7,15}$/.test(normalized);
}

// Deliberately public (no requireAdmin): players self-register into a team,
// CricHeroes-style. Admins can still add/edit/remove entries on their end.
// Mobile number is required and globally unique (across every tournament) so
// the same person can't register twice - this is a plain duplicate check, not
// SMS/OTP verification, so it doesn't confirm the registrant actually owns
// the number.
router.post('/', asyncHandler(async (req, res) => {
  const { tournamentId, teamId, name, role, battingStyle, bowlingStyle, photoUrl, mobileNumber } = req.body || {};
  if (!tournamentId || !teamId || !name || !mobileNumber) {
    return res.status(400).json({ error: 'tournamentId, teamId, name and mobileNumber are required' });
  }
  const normalized = normalizeMobile(mobileNumber);
  if (!isValidMobile(normalized)) {
    return res.status(400).json({ error: 'Enter a valid mobile number (7-15 digits)' });
  }
  const existing = await prisma.player.findUnique({ where: { mobileNumber: normalized } });
  if (existing) {
    return res.status(409).json({ error: 'This mobile number is already registered. Each player can only register once.' });
  }
  const player = await prisma.player.create({
    data: { tournamentId, teamId, name, role: role || 'BATSMAN', battingStyle, bowlingStyle, photoUrl, mobileNumber: normalized },
  });
  res.status(201).json(player);
}));

router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { name, role, battingStyle, bowlingStyle, photoUrl, mobileNumber } = req.body || {};
  let normalized;
  if (mobileNumber != null) {
    normalized = normalizeMobile(mobileNumber);
    if (!isValidMobile(normalized)) {
      return res.status(400).json({ error: 'Enter a valid mobile number (7-15 digits)' });
    }
    const existing = await prisma.player.findUnique({ where: { mobileNumber: normalized } });
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: 'This mobile number is already registered to another player.' });
    }
  }
  const player = await prisma.player.update({
    where: { id: req.params.id },
    data: { name, role, battingStyle, bowlingStyle, photoUrl, mobileNumber: normalized },
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
