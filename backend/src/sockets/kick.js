// Cuts live access when access is lost. Sockets authorize at handshake, so a
// user who loses access must be disconnected (or dropped from rooms).

const disconnectRoom = (io, room) => {
  if (io) {
    io.in(room).disconnectSockets(true);
  }
};

// Logout / password change: only the listed sessions' sockets.
const disconnectSessions = (io, sessionIds = []) => {
  sessionIds.forEach((sessionId) => disconnectRoom(io, `session:${String(sessionId)}`));
};

// Password reset / account disabled: every socket of the user.
const disconnectUser = (io, userId) => disconnectRoom(io, `user:${String(userId)}`);

// Removed / disabled org member: only their sockets bound to that org.
const disconnectUserInOrg = (io, userId, organizationId) =>
  disconnectRoom(io, `user:${String(userId)}:org:${String(organizationId)}`);

// Leaving / removal from a channel: drop the user's sockets from the channel
// room and from the thread rooms of that channel they joined.
const leaveChannelRooms = async (io, userId, channelId) => {
  if (!io) {
    return;
  }
  const id = String(channelId);
  const sockets = await io.in(`user:${String(userId)}`).fetchSockets();
  sockets.forEach((socket) => {
    socket.leave(`channel:${id}`);
    Object.entries(socket.data.threadChannels || {}).forEach(([rootId, threadChannelId]) => {
      if (threadChannelId === id) {
        socket.leave(`thread:${rootId}`);
      }
    });
  });
};

module.exports = { disconnectSessions, disconnectUser, disconnectUserInOrg, leaveChannelRooms };
