const mongoose = require('mongoose');
const Channel = require('../models/channel.model');
const ChannelMember = require('../models/channelMember.model');
const OrganizationMember = require('../models/organizationMember.model');
const {
  CHANNEL_TYPES,
  CHANNEL_STATUS,
  CHANNEL_ROLES,
  CHANNEL_NOTIFY,
  CHANNEL_MEMBER_STATUS,
  ORG_ROLES,
  MEMBER_STATUS,
} = require('../config/constants');
const { AppError } = require('../utils/AppError');
const { toOptionalString } = require('../utils/validation');
const { toPublicUser } = require('./user.service');
const { assertNotDefault } = require('./defaultChannel.service');

const normalizeChannelName = (value) => {
  const name = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  if (!name) {
    throw new AppError(400, 'Channel name is required');
  }
  return name;
};

const toMembership = (membership) => ({
  id: membership._id,
  role: membership.role,
  notifyPreference: membership.notifyPreference,
  starred: Boolean(membership.starred),
  joinedAt: membership.joinedAt,
  lastReadAt: membership.lastReadAt,
});

const toPublicChannel = (channel, { membership = null, memberCount = 0 } = {}) => ({
  id: channel._id,
  name: channel.name,
  topic: channel.topic,
  purpose: channel.purpose,
  type: channel.type,
  status: channel.status,
  isDefault: Boolean(channel.isDefault),
  createdBy: channel.createdBy,
  createdAt: channel.createdAt,
  updatedAt: channel.updatedAt,
  memberCount,
  isMember: Boolean(membership),
  membership: membership ? toMembership(membership) : null,
});

const toPublicChannelMember = (membership) => ({
  ...toMembership(membership),
  user: toPublicUser(membership.user),
});

const findById = (channelId, organizationId) =>
  Channel.findOne({ _id: channelId, organization: organizationId });

const getMembership = (channelId, userId) =>
  ChannelMember.findOne({ channel: channelId, user: userId });

// "Active" means "not REMOVED". Legacy memberships created before the
// status field exist have no status and must still count as active.
const activeFilter = { status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED } };

const countMembers = (channelId) =>
  ChannelMember.countDocuments({ channel: channelId, ...activeFilter });

const isActive = (membership) =>
  Boolean(membership && membership.status !== CHANNEL_MEMBER_STATUS.REMOVED);

// Read access rules (shared by getAccessContext and loadWithAccess).
const assertReadable = (channel, membership) => {
  if (membership && membership.status === CHANNEL_MEMBER_STATUS.REMOVED) {
    throw new AppError(403, 'You no longer have access to this channel');
  }
  if (channel.type === CHANNEL_TYPES.PRIVATE && !membership) {
    throw new AppError(403, 'You do not have access to this private channel');
  }
};

const getAccessContext = async (channel, userId) => {
  const membership = await getMembership(channel._id, userId);
  assertReadable(channel, membership);
  return { membership, memberCount: await countMembers(channel._id) };
};

// requireChannel: channel, membership and member count in ONE parallel
// round trip. Invalid ids are a 404 (not a CastError 500).
const loadWithAccess = async (channelId, organizationId, userId) => {
  if (!mongoose.isValidObjectId(channelId)) {
    throw new AppError(404, 'Channel not found');
  }
  const [channel, membership, memberCount] = await Promise.all([
    findById(channelId, organizationId),
    getMembership(channelId, userId),
    countMembers(channelId),
  ]);
  if (!channel) {
    throw new AppError(404, 'Channel not found');
  }
  assertReadable(channel, membership);
  return { channel, membership, memberCount };
};

// Writes (messages, reactions, pins, follows) require an active membership
// in a channel that has not been archived.
const assertCanWrite = (channel, membership) => {
  if (channel.status !== CHANNEL_STATUS.ACTIVE) {
    throw new AppError(409, 'This channel has been archived');
  }
  if (!isActive(membership)) {
    throw new AppError(403, 'Join the channel to do this');
  }
};

// Loads the caller's membership and enforces assertCanWrite.
const assertCanWriteById = async (channelId, organizationId, userId) => {
  const channel = await findById(channelId, organizationId);
  if (!channel) {
    throw new AppError(404, 'Channel not found');
  }
  assertCanWrite(channel, await getMembership(channel._id, userId));
  return channel;
};

const assertCanCreate = (organization, organizationMembership) => {
  if (organization.settings?.allowMemberChannelCreation) {
    return;
  }
  const allowed = [ORG_ROLES.OWNER, ORG_ROLES.ADMIN];
  if (!allowed.includes(organizationMembership.role)) {
    throw new AppError(403, 'Your organization does not allow members to create channels');
  }
};

const createChannel = async (organization, actor, organizationMembership, payload) => {
  assertCanCreate(organization, organizationMembership);

  const name = normalizeChannelName(payload.name);
  const type = payload.type || organization.settings?.defaultChannelType || CHANNEL_TYPES.PUBLIC;
  if (!Object.values(CHANNEL_TYPES).includes(type)) {
    throw new AppError(400, 'Unsupported channel type');
  }

  const existing = await Channel.exists({ organization: organization._id, name });
  if (existing) {
    throw new AppError(409, 'A channel with this name already exists');
  }

  const channel = await Channel.create({
    organization: organization._id,
    name,
    topic: toOptionalString(payload.topic),
    purpose: toOptionalString(payload.purpose),
    type,
    createdBy: actor._id,
  });

  const membership = await ChannelMember.create({
    organization: organization._id,
    channel: channel._id,
    user: actor._id,
    role: CHANNEL_ROLES.MODERATOR,
    notifyPreference: CHANNEL_NOTIFY.ALL,
  });

  return { channel, membership };
};

const listForUser = async (
  organizationId,
  userId,
  { joinedOnly = false, archived = false } = {},
) => {
  const myMemberships = await ChannelMember.find({ organization: organizationId, user: userId });
  const activeByChannel = new Map();
  const activeChannelIds = [];
  const removedChannelIds = [];

  for (const membership of myMemberships) {
    if (membership.status === CHANNEL_MEMBER_STATUS.REMOVED) {
      removedChannelIds.push(membership.channel);
    } else {
      activeByChannel.set(String(membership.channel), membership);
      activeChannelIds.push(membership.channel);
    }
  }

  const query = {
    organization: organizationId,
    status: archived ? CHANNEL_STATUS.ARCHIVED : CHANNEL_STATUS.ACTIVE,
  };
  if (joinedOnly) {
    query._id = { $in: activeChannelIds };
  } else {
    // Public channels are visible unless the user was removed; private
    // channels only while the user is an active member.
    query.$or = [
      { type: CHANNEL_TYPES.PUBLIC, _id: { $nin: removedChannelIds } },
      { _id: { $in: activeChannelIds } },
    ];
  }

  const channels = await Channel.find(query).sort({ name: 1 });
  const counts = await ChannelMember.aggregate([
    {
      $match: {
        channel: { $in: channels.map((channel) => channel._id) },
        status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
      },
    },
    { $group: { _id: '$channel', count: { $sum: 1 } } },
  ]);
  const countByChannel = new Map(counts.map((row) => [String(row._id), row.count]));

  return channels.map((channel) =>
    toPublicChannel(channel, {
      membership: activeByChannel.get(String(channel._id)) || null,
      memberCount: countByChannel.get(String(channel._id)) || 0,
    }),
  );
};

const updateChannel = async (channel, payload) => {
  if (payload.name !== undefined) {
    const name = normalizeChannelName(payload.name);
    const clash = await Channel.exists({
      organization: channel.organization,
      name,
      _id: { $ne: channel._id },
    });
    if (clash) {
      throw new AppError(409, 'A channel with this name already exists');
    }
    channel.name = name;
  }
  if (payload.topic !== undefined) {
    channel.topic = toOptionalString(payload.topic);
  }
  if (payload.purpose !== undefined) {
    channel.purpose = toOptionalString(payload.purpose);
  }
  // Visibility (Slack: workspace owners/admins only; the controller checks).
  if (payload.type !== undefined && payload.type !== channel.type) {
    if (!Object.values(CHANNEL_TYPES).includes(payload.type)) {
      throw new AppError(400, 'Invalid channel visibility');
    }
    if (payload.type === CHANNEL_TYPES.PRIVATE) {
      assertNotDefault(channel, 'The default channel must stay public');
    }
    channel.type = payload.type;
  }

  await channel.save();
  return channel;
};

const archiveChannel = async (channel) => {
  assertNotDefault(channel, 'The default channel cannot be archived');
  channel.status = CHANNEL_STATUS.ARCHIVED;
  await channel.save();
  return channel;
};

const unarchiveChannel = async (channel) => {
  if (channel.status !== CHANNEL_STATUS.ARCHIVED) {
    throw new AppError(409, 'This channel is not archived');
  }
  channel.status = CHANNEL_STATUS.ACTIVE;
  await channel.save();
  return channel;
};

const joinChannel = async (channel, user) => {
  if (channel.type !== CHANNEL_TYPES.PUBLIC) {
    throw new AppError(403, 'You must be added to a private channel');
  }
  if (channel.status === CHANNEL_STATUS.ARCHIVED) {
    throw new AppError(409, 'This channel has been archived');
  }

  const existing = await getMembership(channel._id, user._id);
  if (existing && existing.status === CHANNEL_MEMBER_STATUS.ACTIVE) {
    return existing;
  }
  if (existing) {
    throw new AppError(403, 'You were removed from this channel');
  }

  return ChannelMember.create({
    organization: channel.organization,
    channel: channel._id,
    user: user._id,
    role: CHANNEL_ROLES.MEMBER,
    notifyPreference: CHANNEL_NOTIFY.ALL,
  });
};

const leaveChannel = async (channel, user) => {
  assertNotDefault(channel, 'You cannot leave the default channel');
  const membership = await getMembership(channel._id, user._id);
  if (!isActive(membership)) {
    throw new AppError(409, 'You are not a member of this channel');
  }

  // Delete first, then recount: two concurrent leaves cannot both pass a
  // pre-check and empty a private channel. Roll back if nobody remains.
  await membership.deleteOne();
  if (channel.type === CHANNEL_TYPES.PRIVATE && (await countMembers(channel._id)) === 0) {
    await ChannelMember.create(membership.toObject());
    throw new AppError(409, 'You cannot leave: you are the only member of this private channel');
  }
};

const listMembers = (channelId) =>
  ChannelMember.find({ channel: channelId, ...activeFilter })
    .populate('user')
    .sort({ joinedAt: 1 });

const listCandidates = async (channel) => {
  const members = await ChannelMember.find({
    channel: channel._id,
    ...activeFilter,
  }).select('user');
  const memberIds = members.map((member) => member.user);

  return OrganizationMember.find({
    organization: channel.organization,
    status: MEMBER_STATUS.ACTIVE,
    user: { $nin: memberIds },
  })
    .populate('user')
    .sort({ createdAt: 1 });
};

const addMembers = async (channel, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError(400, 'A list of user ids is required');
  }

  const validMembers = await OrganizationMember.find({
    organization: channel.organization,
    user: { $in: userIds },
    status: MEMBER_STATUS.ACTIVE,
  }).select('user');
  const validIds = validMembers.map((member) => member.user);
  if (validIds.length === 0) {
    throw new AppError(400, 'No valid workspace members selected');
  }

  const existing = await ChannelMember.find({
    channel: channel._id,
    user: { $in: validIds },
  });
  const activeIds = new Set(
    existing
      .filter((membership) => membership.status !== CHANNEL_MEMBER_STATUS.REMOVED)
      .map((membership) => String(membership.user)),
  );
  const removed = existing.filter(
    (membership) => membership.status === CHANNEL_MEMBER_STATUS.REMOVED,
  );
  const toAdd = validIds.filter((id) => !activeIds.has(String(id)));

  if (removed.length > 0) {
    await ChannelMember.updateMany(
      { _id: { $in: removed.map((membership) => membership._id) } },
      { status: CHANNEL_MEMBER_STATUS.ACTIVE, joinedAt: new Date() },
    );
  }

  const brandNew = toAdd.filter(
    (id) => !removed.some((membership) => String(membership.user) === String(id)),
  );
  if (brandNew.length > 0) {
    await ChannelMember.insertMany(
      brandNew.map((userId) => ({
        organization: channel.organization,
        channel: channel._id,
        user: userId,
        role: CHANNEL_ROLES.MEMBER,
        notifyPreference: CHANNEL_NOTIFY.ALL,
      })),
    );
  }

  const added = removed.length + brandNew.length;
  if (added === 0) {
    throw new AppError(409, 'The selected people are already channel members');
  }
  return added;
};

const removeMember = async (channel, userId) => {
  assertNotDefault(channel, 'Members cannot be removed from the default channel');
  const membership = await getMembership(channel._id, userId);
  if (!isActive(membership)) {
    throw new AppError(404, 'This person is not a channel member');
  }

  // Keep the row as REMOVED so the channel stays hidden from this user
  // (even for public channels) and access is denied, while an admin can
  // still re-add them later. Mark first, then recount (race-safe) and roll
  // back if a private channel would be left empty.
  const previousStatus = membership.status;
  membership.status = CHANNEL_MEMBER_STATUS.REMOVED;
  await membership.save();
  if (channel.type === CHANNEL_TYPES.PRIVATE && (await countMembers(channel._id)) === 0) {
    await ChannelMember.updateOne(
      { _id: membership._id },
      { status: previousStatus ?? CHANNEL_MEMBER_STATUS.ACTIVE },
    );
    throw new AppError(409, 'A private channel must keep at least one member');
  }
  return membership;
};

// PATCH /channels/:id/members/me { notifyPreference?, starred? }
const setMyPreferences = async (channel, userId, payload = {}) => {
  const { notifyPreference, starred } = payload;
  if (notifyPreference === undefined && starred === undefined) {
    throw new AppError(400, 'Nothing to update');
  }
  if (notifyPreference !== undefined && !Object.values(CHANNEL_NOTIFY).includes(notifyPreference)) {
    throw new AppError(400, 'Unsupported notification preference');
  }
  if (starred !== undefined && typeof starred !== 'boolean') {
    throw new AppError(400, 'starred must be a boolean');
  }

  const membership = await getMembership(channel._id, userId);
  if (!isActive(membership)) {
    throw new AppError(403, 'Join the channel to change your preferences');
  }

  if (notifyPreference !== undefined) {
    membership.notifyPreference = notifyPreference;
  }
  if (starred !== undefined) {
    membership.starred = starred;
  }
  await membership.save();
  return membership;
};

module.exports = {
  normalizeChannelName,
  toMembership,
  toPublicChannel,
  toPublicChannelMember,
  findById,
  getMembership,
  countMembers,
  isActive,
  getAccessContext,
  assertReadable,
  loadWithAccess,
  assertCanWrite,
  assertCanWriteById,
  createChannel,
  listForUser,
  updateChannel,
  archiveChannel,
  unarchiveChannel,
  joinChannel,
  leaveChannel,
  listMembers,
  listCandidates,
  addMembers,
  removeMember,
  setMyPreferences,
};
