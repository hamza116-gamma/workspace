const Huddle = require('../models/huddle.model');
const huddleService = require('./huddle.service');
const huddleEvents = require('./huddle.events');
const { logger } = require('../config/logger');
const { HUDDLE_STATUS } = require('../config/constants');

// One timer per huddle, armed for the next invite expiry (30s per invite).
const timers = new Map();

const clearRingTimer = (huddleId) => {
  const key = String(huddleId);
  clearTimeout(timers.get(key));
  timers.delete(key);
};

const onExpiry = async (io, huddleId) => {
  timers.delete(String(huddleId));
  const huddle = await Huddle.findById(huddleId);
  if (!huddle || huddle.status !== HUDDLE_STATUS.LIVE) {
    return;
  }
  const { expiredIds, ended } = await huddleService.expireInvites(huddle);
  huddleEvents.stopRing(io, huddle, expiredIds);
  if (ended) {
    await huddleEvents.announceEnded(io, ended);
    return;
  }
  if (expiredIds.length) {
    await huddleEvents.broadcastUpdated(io, huddle);
  }
  // eslint-disable-next-line no-use-before-define
  armRingTimer(io, huddle);
};

const armRingTimer = (io, huddle) => {
  clearRingTimer(huddle._id);
  const next = huddleService.nextRingExpiry(huddle);
  if (!next || huddle.status !== HUDDLE_STATUS.LIVE) {
    return;
  }
  const delay = Math.max(0, next - Date.now()) + 50;
  timers.set(
    String(huddle._id),
    setTimeout(() => {
      onExpiry(io, huddle._id).catch((error) => logger.error('huddle ring expiry failed', error));
    }, delay),
  );
};

module.exports = { armRingTimer, clearRingTimer };
