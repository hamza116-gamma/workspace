const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const notificationService = require('../services/notification.service');
const { getActivitySummary } = require('../services/activitySummary.service');

const getIo = (req) => req.app.get('io');

const list = asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const notifications = await notificationService.listForUser(req.organization._id, req.user._id, {
    unreadOnly,
    limit: req.query.limit,
  });
  success(res, {
    notifications,
    unreadCount: await notificationService.countUnread(req.organization._id, req.user._id),
  });
});

const markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markRead(
    req.params.notificationId,
    req.organization._id,
    req.user._id,
  );
  const io = getIo(req);
  if (io && result.modifiedCount > 0) {
    io.to(`user:${String(req.user._id)}`).emit('notification.read', {
      id: String(req.params.notificationId),
    });
  }
  success(res, { ok: true });
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.organization._id, req.user._id);
  const io = getIo(req);
  if (io) {
    io.to(`user:${String(req.user._id)}`).emit('notification.read_all', {});
  }
  success(res, { ok: true });
});

const remove = asyncHandler(async (req, res) => {
  await notificationService.remove(req.params.notificationId, req.user._id);
  success(res, { ok: true });
});

const summary = asyncHandler(async (req, res) => {
  success(res, { summary: await getActivitySummary(req.organization._id, req.user._id) });
});

module.exports = { list, summary, markRead, markAllRead, remove };
