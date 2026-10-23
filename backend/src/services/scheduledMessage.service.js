const mongoose = require('mongoose');
const ScheduledMessage = require('../models/scheduledMessage.model');
const { AppError } = require('../utils/AppError');
const { assertMessageContent } = require('../utils/validation');

const { SCHEDULED_STATUS } = ScheduledMessage;

const MIN_AHEAD_MS = 60 * 1000; // 1 minute
const MAX_AHEAD_MS = 120 * 24 * 60 * 60 * 1000; // 120 days
const MAX_PENDING_PER_USER = 100;
const STALE_CLAIM_MS = 5 * 60 * 1000;

const toPublicScheduled = (item) => ({
  id: String(item._id),
  channelId: item.channel ? String(item.channel) : null,
  conversationId: item.conversation ? String(item.conversation) : null,
  parentMessageId: item.parentMessageId ? String(item.parentMessageId) : null,
  alsoSendToChannel: Boolean(item.alsoSendToChannel),
  content: item.content,
  scheduledAt: item.scheduledAt,
  status: item.status,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const assertScheduledAt = (value, now = Date.now()) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw new AppError(400, 'scheduledAt must be a valid date');
  }
  if (date.getTime() < now + MIN_AHEAD_MS) {
    throw new AppError(400, 'Schedule the message at least 1 minute ahead');
  }
  if (date.getTime() > now + MAX_AHEAD_MS) {
    throw new AppError(400, 'Messages can be scheduled at most 120 days ahead');
  }
  return date;
};

const assertParentId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(400, 'parentMessageId is invalid');
  }
  return value;
};

// target: { channel } | { conversation } (documents, access already checked).
const createScheduled = async (organizationId, userId, target, body = {}) => {
  const content = assertMessageContent(body.content);
  const scheduledAt = assertScheduledAt(body.scheduledAt);
  const parentMessageId = assertParentId(body.parentMessageId);

  const pending = await ScheduledMessage.countDocuments({
    user: userId,
    status: SCHEDULED_STATUS.PENDING,
  });
  if (pending >= MAX_PENDING_PER_USER) {
    throw new AppError(409, `You can have at most ${MAX_PENDING_PER_USER} scheduled messages`);
  }

  return ScheduledMessage.create({
    organization: organizationId,
    user: userId,
    channel: target.channel?._id || null,
    conversation: target.conversation?._id || null,
    parentMessageId,
    alsoSendToChannel: Boolean(parentMessageId && body.alsoSendToChannel),
    content,
    scheduledAt,
  });
};

const listPending = (organizationId, userId) =>
  ScheduledMessage.find({
    organization: organizationId,
    user: userId,
    status: SCHEDULED_STATUS.PENDING,
  }).sort({ scheduledAt: 1 });

const findPendingOwned = async (id, organizationId, userId) => {
  const item = mongoose.isValidObjectId(id)
    ? await ScheduledMessage.findOne({
        _id: id,
        organization: organizationId,
        user: userId,
        status: SCHEDULED_STATUS.PENDING,
      })
    : null;
  if (!item) {
    throw new AppError(404, 'Scheduled message not found');
  }
  return item;
};

// PATCH { content?, scheduledAt? } while still pending (atomic on status).
const updateScheduled = async (item, body = {}) => {
  const changes = {};
  if (body.content !== undefined) {
    changes.content = assertMessageContent(body.content);
  }
  if (body.scheduledAt !== undefined) {
    changes.scheduledAt = assertScheduledAt(body.scheduledAt);
  }
  if (Object.keys(changes).length === 0) {
    throw new AppError(400, 'Nothing to update');
  }
  const updated = await ScheduledMessage.findOneAndUpdate(
    { _id: item._id, status: SCHEDULED_STATUS.PENDING },
    { $set: changes },
    { new: true },
  );
  if (!updated) {
    throw new AppError(409, 'This message is already being sent');
  }
  return updated;
};

const cancelScheduled = async (item) => {
  const updated = await ScheduledMessage.findOneAndUpdate(
    { _id: item._id, status: SCHEDULED_STATUS.PENDING },
    { $set: { status: SCHEDULED_STATUS.CANCELLED } },
    { new: true },
  );
  if (!updated) {
    throw new AppError(409, 'This message is already being sent');
  }
  return updated;
};

// Atomically moves one pending item to "sending" so it is sent exactly once.
const claim = (filter, now = new Date()) =>
  ScheduledMessage.findOneAndUpdate(
    { ...filter, status: SCHEDULED_STATUS.PENDING },
    { $set: { status: SCHEDULED_STATUS.SENDING, claimedAt: now } },
    { new: true, sort: { scheduledAt: 1 } },
  );

const claimDue = (now = new Date()) => claim({ scheduledAt: { $lte: now } }, now);

const claimById = (id) => claim({ _id: id });

// After a crash/restart: items stuck in "sending" go back to pending.
const releaseStaleClaims = (now = Date.now()) =>
  ScheduledMessage.updateMany(
    { status: SCHEDULED_STATUS.SENDING, claimedAt: { $lt: new Date(now - STALE_CLAIM_MS) } },
    { $set: { status: SCHEDULED_STATUS.PENDING, claimedAt: null } },
  );

const markSent = (item, message) =>
  ScheduledMessage.findByIdAndUpdate(
    item._id,
    { $set: { status: SCHEDULED_STATUS.SENT, sentAt: new Date(), message: message._id } },
    { new: true },
  );

const markFailed = (item, reason) =>
  ScheduledMessage.findByIdAndUpdate(
    item._id,
    { $set: { status: SCHEDULED_STATUS.FAILED, error: String(reason || 'Failed').slice(0, 300) } },
    { new: true },
  );

module.exports = {
  SCHEDULED_STATUS,
  toPublicScheduled,
  createScheduled,
  listPending,
  findPendingOwned,
  updateScheduled,
  cancelScheduled,
  claimDue,
  claimById,
  releaseStaleClaims,
  markSent,
  markFailed,
};
