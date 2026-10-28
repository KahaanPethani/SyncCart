import { io } from 'socket.io-client';

// Establish connection to backend WebSocket server
const socket = io('http://localhost:5000', {
  autoConnect: false, // Connect manually after user logs in
});

export default socket;