const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const draftService = require('../services/draft.service');
const { emitDraftUpdated } = require('../sockets/draftEvents');

const list = asyncHandler(async (req, res) => {
  const drafts = await draftService.listForUser(req.organization._id, req.user._id);
  success(res, { drafts });
});

// PUT /drafts { channelId | conversationId | threadRootId, content }
const save = asyncHandler(async (req, res) => {
  const { key, draft } = await draftService.saveDraft(
    req.organization._id,
    req.user._id,
    req.body || {},
  );
  emitDraftUpdated(req.app.get('io'), req.organization._id, req.user._id, key, draft);
  success(res, { key, draft });
});

const remove = asyncHandler(async (req, res) => {
  const key = await draftService.removeDraft(req.organization._id, req.user._id, req.params.id);
  emitDraftUpdated(req.app.get('io'), req.organization._id, req.user._id, key, null);
  success(res, { key, draft: null });
});

module.exports = { list, save, remove };
