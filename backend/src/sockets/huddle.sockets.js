const mongoose = require('mongoose');
const Huddle = require('../models/huddle.model');
const huddleService = require('../services/huddle.service');
const huddleEvents = require('../services/huddle.events');
const { clearRingTimer } = require('../services/huddleRing');
const { logger } = require('../config/logger');
const { HUDDLE_STATUS } = require('../config/constants');

const ROOM_PREFIX = 'huddle:';
const roomOf = (huddleId) => `${ROOM_PREFIX}${huddleId}`;
const SIGNAL_TYPES = new Set(['offer', 'answer', 'ice']);
const REACTIONS = new Set(['👍', '❤️', '😂', '🎉', '👏', '😮', '🙌', '🔥']);
const REACT_THROTTLE_MS = 400;
const MAX_SIGNAL_BYTES = 64 * 1024;

const loadLive = async (huddleId, organizationId) => {
  if (!mongoose.isValidObjectId(huddleId) || !organizationId) {
    return null;
  }
  return Huddle.findOne({
    _id: huddleId,
    organization: organizationId,
    status: HUDDLE_STATUS.LIVE,
  });
};

// Sockets of `userId` that are subscribed to this huddle (the tab in the call).
const subscribedSocketsOf = async (io, huddleId, userId) => {
  const sockets = await io.in(roomOf(huddleId)).fetchSockets();
  return sockets.filter((s) => String(s.data.user?._id) === String(userId));
};

const registerHuddleHandlers = (io, socket) => {
  const user = socket.data.user;
  const organizationId = socket.data.organizationId;
  let lastReactAt = 0;

  // Only ACTIVE participants subscribe (access is re-checked).
  socket.on('huddle:subscribe', async (huddleId, ack) => {
    try {
      const huddle = await huddleService.loadForUser(huddleId, organizationId, user._id);
      if (
        huddle.status !== HUDDLE_STATUS.LIVE ||
        !huddleService.activeParticipant(huddle, user._id)
      ) {
        ack?.({ ok: false, error: 'Join the huddle first' });
        return;
      }
      socket.join(roomOf(huddleId));
      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('huddle:unsubscribe', (huddleId) => socket.leave(roomOf(huddleId)));

  // Relays offer / answer / ICE between two ACTIVE participants of the same
  // LIVE huddle, only to the target's subscribed sockets.
  socket.on('huddle:signal', async (payload) => {
    try {
      const { huddleId, to, type, data } = payload || {};
      if (!SIGNAL_TYPES.has(type) || !to || !socket.rooms.has(roomOf(huddleId))) {
        return;
      }
      if (JSON.stringify(data ?? null).length > MAX_SIGNAL_BYTES) {
        return;
      }
      const huddle = await loadLive(huddleId, organizationId);
      if (
        !huddle ||
        !huddleService.activeParticipant(huddle, user._id) ||
        !huddleService.activeParticipant(huddle, to)
      ) {
        return;
      }
      const targets = await subscribedSocketsOf(io, huddleId, to);
      targets.forEach((target) =>
        target.emit('huddle:signal', {
          huddleId: String(huddleId),
          from: String(user._id),
          type,
          data,
        }),
      );
    } catch (error) {
      logger.error('huddle signal failed', error);
    }
  });

  // Media state (mic / camera / screen) to the huddle room.
  socket.on('huddle:media', async (payload) => {
    try {
      const { huddleId } = payload || {};
      if (!socket.rooms.has(roomOf(huddleId))) {
        return;
      }
      const state = {
        audio: Boolean(payload.audio),
        video: Boolean(payload.video),
        screen: Boolean(payload.screen),
      };
      socket.to(roomOf(huddleId)).emit('huddle:media', {
        huddleId: String(huddleId),
        userId: String(user._id),
        ...state,
      });
      await huddleService.noteMedia(huddleId, state);
    } catch (error) {
      logger.error('huddle media failed', error);
    }
  });

  // Live reactions: fixed emoji set, throttled, huddle room only.
  socket.on('huddle:react', (payload) => {
    const { huddleId, emoji } = payload || {};
    const now = Date.now();
    if (!REACTIONS.has(emoji) || !socket.rooms.has(roomOf(huddleId))) {
      return;
    }
    if (now - lastReactAt < REACT_THROTTLE_MS) {
      return;
    }
    lastReactAt = now;
    io.to(roomOf(huddleId)).emit('huddle:reaction', {
      huddleId: String(huddleId),
      id: `${socket.id}:${now}`,
      emoji,
      user: { id: String(user._id), fullName: user.fullName },
    });
  });
};

// Runs on `disconnecting` (socket.rooms is still filled): leaves every huddle
// this socket was in, unless the user is still in it from another tab.
const leaveHuddlesOnDisconnect = async (io, socket) => {
  const userId = String(socket.data.user._id);
  const huddleIds = [...socket.rooms]
    .filter((room) => room.startsWith(ROOM_PREFIX))
    .map((room) => room.slice(ROOM_PREFIX.length));
  await Promise.all(
    huddleIds.map(async (huddleId) => {
      const others = (await subscribedSocketsOf(io, huddleId, userId)).filter(
        (s) => s.id !== socket.id,
      );
      if (others.length) {
        return;
      }
      const huddle = await loadLive(huddleId, socket.data.organizationId);
      if (!huddle) {
        return;
      }
      const result = await huddleEvents.leaveAndBroadcast(io, huddle, userId);
      if (result.ended) {
        clearRingTimer(huddleId);
      }
    }),
  );
};

module.exports = { registerHuddleHandlers, leaveHuddlesOnDisconnect };
