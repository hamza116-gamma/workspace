const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const channelService = require('../services/channel.service');
const organizationService = require('../services/organization.service');
const auditService = require('../services/audit.service');
const userService = require('../services/user.service');
const defaultChannelService = require('../services/defaultChannel.service');
const { CHANNEL_TYPES, AUDIT_ACTIONS } = require('../config/constants');
const { leaveChannelRooms } = require('../sockets/kick');
const { emitChannelUpdated, emitMembershipChanged } = require('../sockets/channelEvents');

const toChannelWithContext = (channel, membership, memberCount) =>
  channelService.toPublicChannel(channel, { membership, memberCount });

const getIo = (req) => req.app.get('io');

const notifyMembership = (req, userId, member) =>
  emitMembershipChanged(getIo(req), req.channel, userId, member);

const audit = (req, action, channel, metadata) =>
  auditService.record(
    req.organization._id,
    req.user._id,
    action,
    auditService.channelTarget(channel),
    metadata,
  );

const list = asyncHandler(async (req, res) => {
  const joinedOnly = req.query.joined === 'true';
  const archived = req.query.archived === 'true';
  await defaultChannelService.ensureOnce(req.organization._id, req.user._id);
  const channels = await channelService.listForUser(req.organization._id, req.user._id, {
    joinedOnly,
    archived,
  });
  success(res, { channels });
});

const create = asyncHandler(async (req, res) => {
  const { channel, membership } = await channelService.createChannel(
    req.organization,
    req.user,
    req.membership,
    req.body,
  );
  await audit(req, AUDIT_ACTIONS.CHANNEL_CREATED, channel, { type: channel.type });
  success(
    res,
    {
      channel: toChannelWithContext(channel, membership, 1),
      membership: channelService.toMembership(membership),
    },
    201,
  );
});

const get = asyncHandler(async (req, res) => {
  success(res, {
    channel: toChannelWithContext(req.channel, req.channelMembership, req.channelMemberCount),
  });
});

const update = asyncHandler(async (req, res) => {
  const before = { name: req.channel.name, topic: req.channel.topic, purpose: req.channel.purpose };
  const channel = await channelService.updateChannel(req.channel, req.body);
  const changes = Object.keys(before)
    .filter((field) => before[field] !== channel[field])
    .map((field) => ({ field, from: before[field], to: channel[field] }));
  if (changes.length) {
    await audit(req, AUDIT_ACTIONS.CHANNEL_UPDATED, channel, { changes });
  }
  await emitChannelUpdated(getIo(req), channel);
  success(res, {
    channel: toChannelWithContext(channel, req.channelMembership, req.channelMemberCount),
  });
});

const archive = asyncHandler(async (req, res) => {
  const channel = await channelService.archiveChannel(req.channel);
  await emitChannelUpdated(getIo(req), channel);
  await audit(req, AUDIT_ACTIONS.CHANNEL_ARCHIVED, channel);
  success(res, {
    channel: toChannelWithContext(channel, req.channelMembership, req.channelMemberCount),
  });
});

// POST /channels/:channelId/unarchive (channel moderators, org owners/admins)
const unarchive = asyncHandler(async (req, res) => {
  const channel = await channelService.unarchiveChannel(req.channel);
  await emitChannelUpdated(getIo(req), channel);
  await audit(req, AUDIT_ACTIONS.CHANNEL_UNARCHIVED, channel);
  success(res, {
    channel: toChannelWithContext(channel, req.channelMembership, req.channelMemberCount),
  });
});

const join = asyncHandler(async (req, res) => {
  const membership = await channelService.joinChannel(req.channel, req.user);
  const memberCount = await channelService.countMembers(req.channel._id);
  notifyMembership(req, req.user._id, true);
  success(res, {
    channel: toChannelWithContext(req.channel, membership, memberCount),
    membership: channelService.toMembership(membership),
  });
});

const leave = asyncHandler(async (req, res) => {
  await channelService.leaveChannel(req.channel, req.user);
  notifyMembership(req, req.user._id, false);
  if (req.channel.type === CHANNEL_TYPES.PRIVATE) {
    await leaveChannelRooms(getIo(req), req.user._id, req.channel._id);
  }
  success(res, { message: 'Left channel' });
});

const listMembers = asyncHandler(async (req, res) => {
  const members = await channelService.listMembers(req.channel._id);
  success(res, { members: members.map(channelService.toPublicChannelMember) });
});

const listCandidates = asyncHandler(async (req, res) => {
  const candidates = await channelService.listCandidates(req.channel);
  success(res, { candidates: candidates.map(organizationService.toPublicMember) });
});

const addMembers = asyncHandler(async (req, res) => {
  const added = await channelService.addMembers(req.channel, req.body.userIds);
  (req.body.userIds || []).forEach((userId) => notifyMembership(req, userId, true));
  success(res, { added });
});

const removeMember = asyncHandler(async (req, res) => {
  await channelService.removeMember(req.channel, req.params.userId);
  notifyMembership(req, req.params.userId, false);
  if (String(req.params.userId) !== String(req.user._id)) {
    const removed = await userService.findById(req.params.userId);
    await audit(req, AUDIT_ACTIONS.CHANNEL_MEMBER_REMOVED, req.channel, {
      user: auditService.userTarget(removed || { _id: req.params.userId }),
    });
  }
  if (req.channel.type === CHANNEL_TYPES.PRIVATE) {
    await leaveChannelRooms(getIo(req), req.params.userId, req.channel._id);
  }
  success(res, { message: 'Member removed from channel' });
});

const updateMyPreference = asyncHandler(async (req, res) => {
  const membership = await channelService.setMyPreferences(req.channel, req.user._id, req.body);
  success(res, { membership: channelService.toMembership(membership) });
});

module.exports = {
  list,
  create,
  get,
  update,
  archive,
  unarchive,
  join,
  leave,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
  updateMyPreference,
};
