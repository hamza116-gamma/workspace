const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const scheduledService = require('../services/scheduledMessage.service');
const { sendClaimed } = require('../services/scheduler');
const { emitScheduledUpdated } = require('../sockets/scheduledEvents');
const { serializeMessage } = require('../services/serialize.service');

const getIo = (req) => req.app.get('io');

const created = async (req, res, target) => {
  const item = await scheduledService.createScheduled(
    req.organization._id,
    req.user._id,
    target,
    req.body,
  );
  const scheduled = scheduledService.toPublicScheduled(item);
  emitScheduledUpdated(getIo(req), item, scheduled);
  success(res, { scheduled }, 201);
};

// POST /channels/:channelId/scheduled (requireChannel + requireChannelWrite)
const createForChannel = asyncHandler((req, res) => created(req, res, { channel: req.channel }));

// POST /conversations/:conversationId/scheduled (requireConversation)
const createForConversation = asyncHandler((req, res) =>
  created(req, res, { conversation: req.conversation }),
);

// GET /scheduled -> the caller's pending items in the active workspace.
const list = asyncHandler(async (req, res) => {
  const items = await scheduledService.listPending(req.organization._id, req.user._id);
  success(res, { scheduled: items.map(scheduledService.toPublicScheduled) });
});

const loadOwned = (req) =>
  scheduledService.findPendingOwned(req.params.id, req.organization._id, req.user._id);

// PATCH /scheduled/:id { content?, scheduledAt? }
const update = asyncHandler(async (req, res) => {
  const item = await scheduledService.updateScheduled(await loadOwned(req), req.body);
  const scheduled = scheduledService.toPublicScheduled(item);
  emitScheduledUpdated(getIo(req), item, scheduled);
  success(res, { scheduled });
});

// DELETE /scheduled/:id (cancel)
const cancel = asyncHandler(async (req, res) => {
  const item = await scheduledService.cancelScheduled(await loadOwned(req));
  emitScheduledUpdated(getIo(req), item, null);
  success(res, { id: String(item._id) });
});

// POST /scheduled/:id/send -> send now (same access checks as the scheduler).
const sendNow = asyncHandler(async (req, res) => {
  const owned = await loadOwned(req);
  const claimed = await scheduledService.claimById(owned._id);
  if (!claimed) {
    throw new AppError(409, 'This message is already being sent');
  }
  const result = await sendClaimed(claimed, getIo(req));
  if (result.error) {
    throw result.error instanceof AppError
      ? result.error
      : new AppError(500, 'Unable to send the message');
  }
  success(res, { message: await serializeMessage(result.message, req.user._id) }, 201);
});

module.exports = { createForChannel, createForConversation, list, update, cancel, sendNow };
