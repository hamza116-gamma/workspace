const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog.model');
const { AUDIT_ACTIONS } = require('../config/constants');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/AppError');
const { toPublicUser } = require('./user.service');

const PAGE_SIZE = 50;

// Builds a { type, id, label } target from common documents.
const userTarget = (user) =>
  user
    ? {
        type: 'user',
        id: String(user._id ?? user.id ?? user),
        label: user.fullName || user.email || '',
      }
    : null;
const channelTarget = (channel) =>
  channel ? { type: 'channel', id: String(channel._id), label: channel.name } : null;
const emailTarget = (email) => ({ type: 'email', id: null, label: email });

// Called AFTER an action succeeded. Never throws: the audit log must not
// break the action it describes. `target` may be null.
const record = async (organizationId, actorId, action, target = null, metadata = {}) => {
  try {
    await AuditLog.create({
      organization: organizationId,
      actor: actorId || null,
      action,
      target: target || null,
      metadata: metadata || {},
    });
  } catch (error) {
    logger.error(`Audit record failed (${action}): ${error.message}`);
  }
};

const toPublicEntry = (entry) => ({
  id: entry._id,
  action: entry.action,
  actor: entry.actor && entry.actor._id ? toPublicUser(entry.actor) : null,
  target: entry.target || null,
  metadata: entry.metadata || {},
  createdAt: entry.createdAt,
});

// Newest first; `before` is the id of the last entry already shown.
const list = async (organizationId, { action, before } = {}) => {
  const filter = { organization: organizationId };
  if (action) {
    if (!Object.values(AUDIT_ACTIONS).includes(action)) {
      throw new AppError(400, 'Unknown audit action');
    }
    filter.action = action;
  }
  if (before) {
    if (!mongoose.isValidObjectId(before)) {
      throw new AppError(400, 'Invalid cursor');
    }
    filter._id = { $lt: before };
  }
  const entries = await AuditLog.find(filter)
    .sort({ _id: -1 })
    .limit(PAGE_SIZE + 1)
    .populate('actor');
  const hasMore = entries.length > PAGE_SIZE;
  const items = entries.slice(0, PAGE_SIZE).map(toPublicEntry);
  return {
    entries: items,
    hasMore,
    nextCursor: hasMore ? String(items[items.length - 1].id) : null,
  };
};

module.exports = { record, list, userTarget, channelTarget, emailTarget, PAGE_SIZE };
