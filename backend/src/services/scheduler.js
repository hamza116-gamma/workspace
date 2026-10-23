const { logger } = require('../config/logger');
const scheduledService = require('./scheduledMessage.service');
const { resolveSendContext } = require('./scheduledAccess.service');
const { emitScheduledUpdated } = require('../sockets/scheduledEvents');

const POLL_MS = 15 * 1000;
const MAX_PER_TICK = 50;

let timer = null;
let running = false;
let ioRef = null;

// Lazy: message.controller pulls in sockets/services that are not needed to
// load this module.
const postMessage = (...args) => require('../controllers/message.controller').postMessage(...args);

/**
 * Sends one already-claimed item through the normal message pipeline
 * (broadcast, notifications, unread, drafts, thread follow) after re-checking
 * access. Never throws: failures mark the item failed.
 */
const sendClaimed = async (item, io = ioRef) => {
  try {
    const { user, target } = await resolveSendContext(item);
    const message = await postMessage({
      io,
      organizationId: item.organization,
      user,
      target,
      body: {
        content: item.content,
        parentMessageId: item.parentMessageId ? String(item.parentMessageId) : undefined,
        alsoSendToChannel: item.alsoSendToChannel,
      },
    });
    const sent = await scheduledService.markSent(item, message);
    emitScheduledUpdated(io, sent || item, null);
    return { item: sent, message };
  } catch (error) {
    logger.warn(`Scheduled message ${item._id} failed: ${error.message}`);
    const failed = await scheduledService.markFailed(item, error.message).catch(() => null);
    emitScheduledUpdated(io, failed || item, null);
    return { item: failed, error };
  }
};

const tick = async () => {
  if (running) {
    return;
  }
  running = true;
  try {
    await scheduledService.releaseStaleClaims();
    for (let count = 0; count < MAX_PER_TICK; count += 1) {
      const item = await scheduledService.claimDue();
      if (!item) {
        break;
      }
      await sendClaimed(item);
    }
  } catch (error) {
    logger.error('Scheduler tick failed', error);
  } finally {
    running = false;
  }
};

// In-process poller (one backend process, see DEPLOYMENT.md). Due items that
// were missed while the server was down are sent on the first tick.
const startScheduler = (io) => {
  ioRef = io;
  if (timer) {
    return;
  }
  timer = setInterval(() => void tick(), POLL_MS);
  timer.unref?.();
  void tick();
};

const stopScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { startScheduler, stopScheduler, sendClaimed };
