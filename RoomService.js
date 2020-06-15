/** @type {SocketIO.Server} */
let _io;
const MAX_CLIENTS = 50;

/** @param {SocketIO.Socket} socket */
function listen(socket) {
  const io = _io;

  socket.on('join', ({roomId, roomMemberName, isHost}, callback) =>  {
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

      socket.on('screensharing', ({id}) => {
        socket.broadcast.to(roomId).emit('screensharing', socket.id, id);
      });
      socket.on('offerScreensharing', ({id, message}) => {
        socket.to(id).emit('offerScreensharing', socket.id, message, isHost, roomMemberName);
      });

      socket.join(roomId);
      callback({id: socket.id});
      
    //}
    //  else {
    //   socket.emit('full', roomId);
    // }
  });
}

/** @param {SocketIO.Server} io */
module.exports = function(io) {
  _io = io;
  return {listen};
};