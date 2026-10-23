const { Server: SocketServer } = require('socket.io');
const { corsOrigin } = require('../utils/corsOrigin');
const { logger } = require('../config/logger');
const { readSessionCookie } = require('../utils/cookies');
const { findActiveSession } = require('../services/session.service');
const presenceService = require('../services/presence.service');
const channelService = require('../services/channel.service');
const conversationService = require('../services/conversation.service');
const messageService = require('../services/message.service');
const { toPublicUser } = require('../services/user.service');
const organizationService = require('../services/organization.service');
const { MEMBER_STATUS } = require('../config/constants');
const { registerHuddleHandlers, leaveHuddlesOnDisconnect } = require('./huddle.sockets');

const TYPING_TTL_MS = 5000;

const typingTimers = new Map();

const roomFor = (kind, id) => `${kind}:${id}`;

const stopTyping = (io, socket, kind, id) => {
  const key = `${socket.id}:${kind}:${id}`;
  const timer = typingTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(key);
  }
  io.to(roomFor(kind, id)).emit('typing.updated', {
    kind,
    id: String(id),
    user: { id: String(socket.data.user._id), fullName: socket.data.user.fullName },
    typing: false,
  });
};

const handleTyping = (io, socket, payload, typing) => {
  const kind = payload?.kind;
  const id = payload?.id;
  if ((kind !== 'channel' && kind !== 'conversation' && kind !== 'thread') || !id) {
    return;
  }
  if (!socket.rooms.has(roomFor(kind, id))) {
    return;
  }
  if (!typing) {
    stopTyping(io, socket, kind, id);
    return;
  }

  io.to(roomFor(kind, id)).emit('typing.updated', {
    kind,
    id: String(id),
    user: { id: String(socket.data.user._id), fullName: socket.data.user.fullName },
    typing: true,
  });

  const key = `${socket.id}:${kind}:${id}`;
  clearTimeout(typingTimers.get(key));
  typingTimers.set(
    key,
    setTimeout(() => stopTyping(io, socket, kind, id), TYPING_TTL_MS),
  );
};

// Broadcasts typing=false for every key the socket was typing in, so other
// clients never keep a stale "is typing" after a disconnect.
const clearTypingForSocket = (io, socket) => {
  const prefix = `${socket.id}:`;
  for (const key of [...typingTimers.keys()]) {
    if (key.startsWith(prefix)) {
      const [kind, ...rest] = key.slice(prefix.length).split(':');
      stopTyping(io, socket, kind, rest.join(':'));
    }
  }
};

const createSocketServer = (server) => {
  const io = new SocketServer(server, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = readSessionCookie(socket.request);
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      const session = await findActiveSession(token);
      if (!session || !session.user || session.user.isDisabled) {
        next(new Error('Session is invalid'));
        return;
      }
      if (session.activeOrganization) {
        const membership = await organizationService.getMembership(
          session.user._id,
          session.activeOrganization,
        );
        if (!membership || membership.status !== MEMBER_STATUS.ACTIVE) {
          next(new Error('You do not have access to this organization'));
          return;
        }
      }
      socket.data.user = session.user;
      socket.data.sessionId = String(session._id);
      socket.data.organizationId = session.activeOrganization
        ? String(session.activeOrganization)
        : null;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const organizationId = socket.data.organizationId;

    socket.join(`user:${user._id}`);
    // Lets HTTP handlers target this session (org switch) or this user within
    // one organization (removal) without touching their other sockets.
    socket.join(`session:${socket.data.sessionId}`);
    if (organizationId) {
      socket.join(`org:${organizationId}`);
      socket.join(`user:${user._id}:org:${organizationId}`);
    }
    presenceService
      .addConnection(io, socket, user, organizationId)
      .catch((error) => logger.error('presence connect failed', error));

    socket.emit('session.ready', { user: toPublicUser(user), organizationId });

    socket.on('channel:join', async (channelId, ack) => {
      try {
        const channel = await channelService.findById(channelId, organizationId);
        if (!channel) {
          ack?.({ ok: false, error: 'Channel not found' });
          return;
        }
        // Throws for removed members and non-members of private channels.
        await channelService.getAccessContext(channel, user._id);
        socket.join(roomFor('channel', channelId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('channel:leave', (channelId) => socket.leave(roomFor('channel', channelId)));

    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        const conversation = await conversationService.findByIdForOrg(
          conversationId,
          organizationId,
        );
        if (!conversation || !conversationService.getParticipant(conversation, user._id)) {
          ack?.({ ok: false, error: 'Conversation not found' });
          return;
        }
        socket.join(roomFor('conversation', conversationId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('conversation:leave', (conversationId) =>
      socket.leave(roomFor('conversation', conversationId)),
    );

    socket.on('thread:join', async (messageId, ack) => {
      try {
        const message = await messageService.findByIdForOrg(messageId, organizationId);
        if (!message) {
          ack?.({ ok: false, error: 'Thread not found' });
          return;
        }
        // Re-checks channel membership/visibility or DM participation.
        await messageService.assertAccess(message, user._id);
        const rootId = message.parentMessageId ? message.parentMessageId : message._id;
        socket.join(roomFor('thread', rootId));
        // Remember which channel owns the thread so removal from the channel
        // can evict this socket from its thread rooms too.
        if (message.channel) {
          socket.data.threadChannels = {
            ...(socket.data.threadChannels || {}),
            [String(rootId)]: String(message.channel),
          };
        }
        ack?.({ ok: true, rootId: String(rootId) });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('thread:leave', (messageId) => socket.leave(roomFor('thread', messageId)));

    socket.on('typing.start', (payload) => handleTyping(io, socket, payload, true));
    socket.on('typing.stop', (payload) => handleTyping(io, socket, payload, false));

    socket.on('presence.update', async (state, ack) => {
      try {
        await presenceService.setManual(io, user, state, organizationId);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    registerHuddleHandlers(io, socket);

    // socket.rooms is still populated here (it is empty by `disconnect`), so
    // room-based cleanup (typing, huddle leave) belongs in this handler.
    socket.on('disconnecting', () => {
      clearTypingForSocket(io, socket);
      leaveHuddlesOnDisconnect(io, socket).catch((error) =>
        logger.error('huddle leave on disconnect failed', error),
      );
    });

    socket.on('disconnect', () => {
      presenceService
        .removeConnection(io, socket, organizationId)
        .catch((error) => logger.error('presence disconnect failed', error));
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = { createSocketServer };
