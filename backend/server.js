const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

// Import Routes
const authRoutes = require('./routes/authRoutes');
const householdRoutes = require('./routes/householdRoutes');
const itemRoutes = require('./routes/itemRoutes');

const app = express();

// 1. Create native HTTP server
const server = http.createServer(app);

// 2. Configure Socket.io with CORS allowing client connections
const io = new Server(server, {
  cors: {
    origin: '*', // Allows connections from React frontend during development
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Store io instance in Express app state so route controllers can access it
app.set('socketio', io);

// 3. Core Express Middleware
app.use(cors());
app.use(express.json());

// 4. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/households', householdRoutes);
app.use('/api/items', itemRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'SyncCart Server Running' });
});

// 5. Socket.io Connection & Room Logic
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // User joins their household's real-time room
  socket.on('JOIN_HOUSEHOLD', (householdId) => {
    socket.join(householdId);
    console.log(`🏠 Socket ${socket.id} joined room: ${householdId}`);
  });

  // User leaves household room
  socket.on('LEAVE_HOUSEHOLD', (householdId) => {
    socket.leave(householdId);
    console.log(`🚪 Socket ${socket.id} left room: ${householdId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// 6. Database Connection & Server Startup
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/synccart';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`🚀 SyncCart Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
  });