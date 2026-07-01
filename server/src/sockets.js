let io = null;

export function initSockets(server, corsOrigin) {
  // Lazy import so this file has no hard dependency at module-load time.
  return import('socket.io').then(({ Server }) => {
    io = new Server(server, { cors: { origin: corsOrigin } });
    io.on('connection', (socket) => {
      socket.on('match:join', (matchId) => socket.join(`match:${matchId}`));
      socket.on('match:leave', (matchId) => socket.leave(`match:${matchId}`));
    });
    return io;
  });
}

export function emitMatchUpdate(matchId, payload) {
  if (!io) return;
  io.to(`match:${matchId}`).emit('match:update', payload);
}

export function emitTournamentUpdate(tournamentId) {
  if (!io) return;
  io.to(`tournament:${tournamentId}`).emit('tournament:update');
}
