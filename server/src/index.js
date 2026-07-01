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
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
const port = process.env.PORT || 4000;

initSockets(server, clientOrigin).then(() => {
  server.listen(port, () => {
    console.log(`CPL Scorer API listening on http://localhost:${port}`);
  });
});
