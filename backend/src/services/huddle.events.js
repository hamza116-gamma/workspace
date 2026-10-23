const User = require('../models/user.model');
const huddleService = require('./huddle.service');
const { audienceIds, idOf } = require('./huddleAccess.service');
const { isDndActive } = require('../utils/dnd');
const { emitCreated, emitToMessageRooms, serializeLive } = require('../sockets/messageEvents');

// Lifecycle events go to every member's user room (sidebar pills update on
// every page), not only to the open chat room.
const toAudience = async (io, huddle, event, extra = {}) => {
  if (!io) {
    return;
  }
  await huddleService.populate(huddle);
  const payload = {
    organizationId: idOf(huddle.organization),
    huddle: huddleService.toPublicHuddle(huddle),
    ...extra,
  };
  const ids = await audienceIds(huddle);
  ids.forEach((id) => io.to(`user:${id}`).emit(event, payload));
};

const broadcastStarted = (io, huddle) => toAudience(io, huddle, 'huddle.started');
const broadcastUpdated = (io, huddle) => toAudience(io, huddle, 'huddle.updated');
const broadcastEnded = (io, huddle) => toAudience(io, huddle, 'huddle.ended');

// Call-log card: created once, then rewritten when the huddle ends.
const broadcastCard = async (io, card, { created = false } = {}) => {
  if (!io || !card) {
    return;
  }
  if (created) {
    await emitCreated(io, card, card.organization);
    return;
  }
  emitToMessageRooms(io, card, 'message.updated', { message: await serializeLive(card) });
};

const stopRing = (io, huddle, userIds) => {
  if (!io) {
    return;
  }
  userIds.forEach((id) =>
    io.to(`user:${id}`).emit('huddle.ring.stopped', {
      organizationId: idOf(huddle.organization),
      huddleId: String(huddle._id),
    }),
  );
};

// Rings each user on every tab; silent (no ringtone) while in DND.
const ring = async (io, huddle, userIds, caller) => {
  if (!io || userIds.length === 0) {
    return;
  }
  await huddleService.populate(huddle);
  const users = await User.find({ _id: { $in: userIds } }).select('dndUntil');
  const snoozed = new Set(users.filter((u) => isDndActive(u)).map((u) => String(u._id)));
  const payload = {
    organizationId: idOf(huddle.organization),
    huddle: huddleService.toPublicHuddle(huddle),
    caller: {
      id: String(caller._id),
      fullName: caller.fullName,
      avatarUrl: caller.avatarUrl || null,
    },
  };
  userIds.forEach((id) =>
    io.to(`user:${id}`).emit('huddle.ring', { ...payload, silent: snoozed.has(String(id)) }),
  );
};

const ringingIds = (huddle) =>
  huddle.invites.filter((invite) => invite.status === 'RINGING').map((invite) => idOf(invite.user));

// Shared end flow: stop ringing, tell everyone, rewrite the card.
const announceEnded = async (io, result, previouslyRinging = []) => {
  if (!result) {
    return;
  }
  stopRing(io, result.huddle, previouslyRinging);
  await broadcastEnded(io, result.huddle);
  await broadcastCard(io, result.card);
};

// Shared by REST leave and socket disconnect.
const leaveAndBroadcast = async (io, huddle, userId) => {
  const ringing = ringingIds(huddle);
  const { huddle: next, ended } = await huddleService.leaveForUser(huddle, userId);
  if (ended) {
    await announceEnded(io, ended, ringing);
    return { huddle: ended.huddle, ended: true };
  }
  await broadcastUpdated(io, next);
  return { huddle: next, ended: false };
};

module.exports = {
  broadcastStarted,
  broadcastUpdated,
  broadcastEnded,
  broadcastCard,
  ring,
  stopRing,
  ringingIds,
  announceEnded,
  leaveAndBroadcast,
};
