const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const messageService = require('../services/message.service');
const savedService = require('../services/saved.service');
const { serializeMessage } = require('../services/serialize.service');

const serializeBookmark = async (bookmark, viewerId) => ({
  id: bookmark._id,
  messageId: String(bookmark.message?._id ?? bookmark.message),
  createdAt: bookmark.createdAt,
  message: await serializeMessage(bookmark.message, viewerId),
});

const list = asyncHandler(async (req, res) => {
  const bookmarks = await savedService.listForUser(req.organization._id, req.user._id);
  const items = await Promise.all(
    bookmarks.map((bookmark) => serializeBookmark(bookmark, req.user._id)),
  );
  success(res, { bookmarks: items });
});

const save = asyncHandler(async (req, res) => {
  const message = await messageService.findByIdForOrg(req.params.messageId, req.organization._id);
  if (!message || message.deletedAt) {
    throw new AppError(404, 'Message not found');
  }
  await messageService.assertAccess(message, req.user._id);
  await savedService.saveMessage(req.organization._id, message, req.user);

  const bookmark = await savedService.findOneForUser(
    req.organization._id,
    req.user._id,
    message._id,
  );
  success(
    res,
    { saved: true, bookmark: bookmark ? await serializeBookmark(bookmark, req.user._id) : null },
    201,
  );
});

const remove = asyncHandler(async (req, res) => {
  await savedService.unsaveMessage(req.organization._id, req.user._id, req.params.messageId);
  success(res, { saved: false });
});

module.exports = { list, save, remove };
