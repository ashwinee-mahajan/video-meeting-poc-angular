const express = require('express');
const http = require('http');
const socketio = require('socket.io');

var cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3100;

// Middleware
app.use(cors());
var distDir = __dirname + "/dist/";
app.use(express.static(distDir));
const RoomService = require('./RoomService')(io);
io.sockets.on('connection', RoomService.listen);

// Start Server
server.listen(PORT, ()=> console.log(`Server has started on port ${PORT}`));