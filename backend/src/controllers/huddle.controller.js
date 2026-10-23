const User = require('../models/user.model');
const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const huddleService = require('../services/huddle.service');
const huddleEvents = require('../services/huddle.events');
const { armRingTimer, clearRingTimer } = require('../services/huddleRing');
const { audienceIds } = require('../services/huddleAccess.service');
const { toPublicUser } = require('../services/user.service');

const getIo = (req) => req.app.get('io');

const respond = async (res, huddle, status = 200) => {
  await huddleService.populate(huddle);
  success(res, { huddle: huddleService.toPublicHuddle(huddle) }, status);
};

const load = (req) => huddleService.loadForUser(req.params.id, req.organization._id, req.user._id);

// POST /huddles { channelId | conversationId } -> starts, or joins the LIVE one.
const start = asyncHandler(async (req, res) => {
  const io = getIo(req);
  const { huddle, created, card } = await huddleService.startHuddle(
    req.organization._id,
    req.user,
    req.body,
  );
  if (created) {
    await huddleEvents.broadcastStarted(io, huddle);
    await huddleEvents.broadcastCard(io, card, { created: true });
    await huddleEvents.ring(io, huddle, huddleEvents.ringingIds(huddle), req.user);
    armRingTimer(io, huddle);
  } else {
    huddleEvents.stopRing(io, huddle, [String(req.user._id)]);
    await huddleEvents.broadcastUpdated(io, huddle);
  }
  await respond(res, huddle, created ? 201 : 200);
});

// GET /huddles/active
const active = asyncHandler(async (req, res) => {
  const huddles = await huddleService.listActiveForUser(req.organization._id, req.user._id);
  success(res, { huddles: huddles.map(huddleService.toPublicHuddle) });
});

// GET /huddles/history?channelId= | ?conversationId=
const history = asyncHandler(async (req, res) => {
  const huddles = await huddleService.listHistory(req.organization._id, req.user._id, req.query);
  success(res, { huddles: huddles.map(huddleService.toPublicHuddle) });
});

// POST /huddles/:id/join
const join = asyncHandler(async (req, res) => {
  const huddle = await huddleService.addParticipant(await load(req), req.user._id);
  huddleEvents.stopRing(getIo(req), huddle, [String(req.user._id)]);
  await huddleEvents.broadcastUpdated(getIo(req), huddle);
  await respond(res, huddle);
});

// POST /huddles/:id/leave
const leave = asyncHandler(async (req, res) => {
  const result = await huddleEvents.leaveAndBroadcast(getIo(req), await load(req), req.user._id);
  if (result.ended) {
    clearRingTimer(result.huddle._id);
  }
  await respond(res, result.huddle);
});

// POST /huddles/:id/end (starter only)
const end = asyncHandler(async (req, res) => {
  const huddle = await load(req);
  const ringing = huddleEvents.ringingIds(huddle);
  const ended = await huddleService.endForUser(huddle, req.user._id);
  clearRingTimer(huddle._id);
  await huddleEvents.announceEnded(getIo(req), ended, ringing);
  await respond(res, ended ? ended.huddle : huddle);
});

// POST /huddles/:id/decline
const decline = asyncHandler(async (req, res) => {
  const io = getIo(req);
  const huddle = await load(req);
  const ringing = huddleEvents.ringingIds(huddle);
  const { ended } = await huddleService.declineForUser(huddle, req.user._id);
  huddleEvents.stopRing(io, huddle, [String(req.user._id)]);
  if (ended) {
    clearRingTimer(huddle._id);
    await huddleEvents.announceEnded(io, ended, ringing);
    await respond(res, ended.huddle);
    return;
  }
  await huddleEvents.broadcastUpdated(io, huddle);
  await respond(res, huddle);
});

// GET /huddles/:id/candidates -> chat members not in the huddle.
const candidates = asyncHandler(async (req, res) => {
  const huddle = await load(req);
  const ids = await huddleService.listCandidates(huddle, await audienceIds(huddle));
  const users = await User.find({ _id: { $in: ids }, isDisabled: { $ne: true } }).sort({
    fullName: 1,
  });
  success(res, { users: users.map(toPublicUser) });
});

// POST /huddles/:id/invite { userIds } -> rings them (also "Ring again").
const invite = asyncHandler(async (req, res) => {
  const io = getIo(req);
  const huddle = await load(req);
  const ids = await huddleService.inviteUsers(
    huddle,
    req.user._id,
    req.body?.userIds,
    await audienceIds(huddle),
  );
  await huddleEvents.ring(io, huddle, ids, req.user);
  await huddleEvents.broadcastUpdated(io, huddle);
  armRingTimer(io, huddle);
  await respond(res, huddle);
});

module.exports = { start, active, history, join, leave, end, decline, candidates, invite };
