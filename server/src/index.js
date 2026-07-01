import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { initSockets } from './sockets.js';

import authRoutes from './routes/auth.routes.js';
import tournamentRoutes from './routes/tournaments.routes.js';
import teamRoutes from './routes/teams.routes.js';
import playerRoutes from './routes/players.routes.js';
import matchRoutes from './routes/matches.routes.js';

const app = express();
// Supports a comma-separated list so both a production frontend and local
// dev can talk to the same deployed API, e.g. "https://app.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err?.code === 'P2003' || err?.code === '23503' || err?.code === '23001') {
    return res.status(409).json({ error: 'This action conflicts with related data and cannot be completed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Last-resort safety net: every route is already wrapped with asyncHandler,
// so this should never fire in practice. It exists purely so an unforeseen
// error logs instead of silently taking the whole live-scoring app down.
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));

const server = http.createServer(app);
const port = process.env.PORT || 4000;

initSockets(server, allowedOrigins).then(() => {
  server.listen(port, () => {
    console.log(`CPL Scorer API listening on http://localhost:${port}`);
  });
});
