import { io } from 'socket.io-client';
import { API_BASE_URL } from './api.js';

export const socket = io(API_BASE_URL, { autoConnect: true });

export function joinMatchRoom(matchId) {
  socket.emit('match:join', matchId);
}

export function leaveMatchRoom(matchId) {
  socket.emit('match:leave', matchId);
}
