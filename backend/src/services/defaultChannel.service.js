const Channel = require('../models/channel.model');
const ChannelMember = require('../models/channelMember.model');
const OrganizationMember = require('../models/organizationMember.model');
const {
  CHANNEL_TYPES,
  CHANNEL_STATUS,
  CHANNEL_ROLES,
  CHANNEL_NOTIFY,
  CHANNEL_MEMBER_STATUS,
  MEMBER_STATUS,
} = require('../config/constants');
const { AppError } = require('../utils/AppError');

// Every workspace has one default channel (#general) that all active
// members belong to. It can't be left, archived or have members removed.
const DEFAULT_CHANNEL_NAME = 'general';

const findDefaultChannel = (organizationId) =>
  Channel.findOne({ organization: organizationId, isDefault: true });

// Upserts an ACTIVE membership (also revives a REMOVED/legacy row).
const addToChannel = (channel, userId, role = CHANNEL_ROLES.MEMBER) =>
  ChannelMember.updateOne(
    { channel: channel._id, user: userId },
    {
      $set: { status: CHANNEL_MEMBER_STATUS.ACTIVE },
      $setOnInsert: {
        organization: channel.organization,
        role,
        notifyPreference: CHANNEL_NOTIFY.ALL,
        joinedAt: new Date(),
        lastReadAt: new Date(),
      },
    },
    { upsert: true },
  );

// Returns the default channel, creating "general" or promoting an existing
// PUBLIC "general" (never a private one). createdBy is required for a new
// channel; it becomes the channel moderator.
const resolveDefaultChannel = async (organizationId, createdBy) => {
  const existingDefault = await findDefaultChannel(organizationId);
  if (existingDefault) {
    return existingDefault;
  }

  const named = await Channel.findOne({ organization: organizationId, name: DEFAULT_CHANNEL_NAME });
  if (named) {
    if (named.type !== CHANNEL_TYPES.PUBLIC) {
      return null;
    }
    named.isDefault = true;
    named.status = CHANNEL_STATUS.ACTIVE;
    await named.save();
    return named;
  }
  if (!createdBy) {
    return null;
  }

  const channel = await Channel.create({
    organization: organizationId,
    name: DEFAULT_CHANNEL_NAME,
    purpose: 'Workspace-wide announcements and conversation.',
    type: CHANNEL_TYPES.PUBLIC,
    isDefault: true,
    createdBy,
  });
  await addToChannel(channel, createdBy, CHANNEL_ROLES.MODERATOR);
  return channel;
};

// Creates/promotes the default channel and adds every ACTIVE org member.
const ensureDefaultChannel = async (organizationId, createdBy) => {
  const channel = await resolveDefaultChannel(organizationId, createdBy);
  if (!channel) {
    return null;
  }
  const members = await OrganizationMember.find({
    organization: organizationId,
    status: MEMBER_STATUS.ACTIVE,
  }).select('user');
  await Promise.all(members.map((member) => addToChannel(channel, member.user)));
  return channel;
};

// Per-process memo so GET /channels backfills existing workspaces once.
const ensured = new Set();
const ensureOnce = async (organizationId, userId) => {
  const key = String(organizationId);
  if (ensured.has(key)) {
    return;
  }
  const channel = await ensureDefaultChannel(organizationId, userId);
  if (channel) {
    ensured.add(key);
  }
};

// Best effort: a new member lands in the default channel.
const joinDefaultChannel = async (organizationId, userId) => {
  const channel =
    (await findDefaultChannel(organizationId)) || (await resolveDefaultChannel(organizationId));
  if (channel) {
    await addToChannel(channel, userId);
  }
  return channel;
};

const assertNotDefault = (channel, message) => {
  if (channel.isDefault) {
    throw new AppError(409, message);
  }
};

module.exports = {
  DEFAULT_CHANNEL_NAME,
  findDefaultChannel,
  ensureDefaultChannel,
  ensureOnce,
  joinDefaultChannel,
  assertNotDefault,
};
