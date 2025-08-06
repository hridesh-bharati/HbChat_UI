// server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const users = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_joined', (userData) => {
    users.set(socket.id, userData);
    console.log(`${userData.username} joined, userId: ${userData.userId}`);
    io.emit('user_joined', userData);
  });

  socket.on('send_message', (msg) => {
    io.emit('receive_message', msg);
  });

  socket.on('delete_message', (msgId) => {
    io.emit('delete_message', msgId);
  });

  socket.on('typing', (userData) => {
    socket.broadcast.emit('typing', userData);
  });

  socket.on('stop_typing', (userData) => {
    socket.broadcast.emit('stop_typing', userData);
  });

  socket.on('disconnect', () => {
    const userData = users.get(socket.id);
    if (userData) {
      console.log(`${userData.username} left.`);
      io.emit('user_left', userData);
      users.delete(socket.id);
    }
    console.log('Disconnect:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
