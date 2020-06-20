/** @type {SocketIO.Server} */
let _io;
const MAX_CLIENTS = 6;

/** @param {SocketIO.Socket} socket */
function listen(socket) {
  const io = _io;
  const rooms = io.nsps['/'].adapter.rooms;
  socket.on('join', ({roomId, roomMemberName, isHost}, callback) =>  {
    let numClients = 0;
    if (rooms[roomId]) {
      numClients = rooms[roomId].length;
    }
    if (numClients < MAX_CLIENTS) {
      socket.on('ready', function() {
        socket.broadcast.to(roomId).emit('ready', socket.id, isHost, roomMemberName);
      });
      socket.on('offer', ({id, message}) => {
        socket.to(id).emit('offer', socket.id, message, isHost, roomMemberName);
      });
      socket.on('answer', ({id, message}) => {
        socket.to(id).emit('answer', socket.id, message);
      });
      socket.on('candidate', ({id, message}) => {
        socket.to(id).emit('candidate', socket.id, message);
      });
      socket.on('disconnect', () => {
        socket.broadcast.to(roomId).emit('bye', socket.id);
      });

      socket.join(roomId);
      callback({id: socket.id});
      
    }
     else {
      socket.emit('full', roomId);
    }
  });
}

/** @param {SocketIO.Server} io */
module.exports = function(io) {
  _io = io;
  return {listen};
};