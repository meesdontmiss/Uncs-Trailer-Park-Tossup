import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  // Set up socket.io for multiplayer state syncing
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  const players: Record<string, any> = {};

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Initialize player state
    players[socket.id] = { 
      id: socket.id, 
      position: [(Math.random() - 0.5) * 40, 5, (Math.random() - 0.5) * 40], 
      yaw: 0, 
      pitch: 0,
      kills: 0,
      deaths: 0
    };

    // Send the joining player all current players
    socket.emit('currentPlayers', players);
    // Tell everyone else about the new player
    socket.broadcast.emit('playerJoined', players[socket.id]);
    io.emit('scoreUpdate', players);

    socket.on('updateState', (state) => {
      if (players[socket.id]) {
        players[socket.id] = { ...players[socket.id], ...state };
        // Broadcast movement to all OTHER players
        socket.broadcast.emit('playerMoved', players[socket.id]);
      }
    });

    socket.on('shoot', (data) => {
      // Broadcast shooting event (creates projectiles on their screens)
      socket.broadcast.emit('playerShot', { id: socket.id, ...data });
    });

    socket.on('hit', (targetId) => {
      // Update scores
      if (players[socket.id]) players[socket.id].kills += 1;
      if (players[targetId]) players[targetId].deaths += 1;

      // Broadcast that targetId was killed by socket.id
      io.emit('playerKilled', { targetId, killerId: socket.id });
      io.emit('scoreUpdate', players);
      
      // Reset the target's position on server
      if (players[targetId]) {
        players[targetId].position = [(Math.random() - 0.5) * 40, 5, (Math.random() - 0.5) * 40];
        io.emit('playerMoved', players[targetId]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      delete players[socket.id];
      io.emit('playerLeft', socket.id);
      io.emit('scoreUpdate', players);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
