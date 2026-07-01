import { Router } from 'express';
import { issueToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password' });
  }
  res.json({ token: issueToken() });
});

export default router;
