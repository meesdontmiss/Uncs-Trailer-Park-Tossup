import { io } from 'socket.io-client';

// Connect to the same origin URL running the Express + Vite server
export const socket = io();
