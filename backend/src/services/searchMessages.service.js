const Message = require('../models/message.model');
const Attachment = require('../models/attachment.model');
const ChannelPin = require('../models/channelPin.model');
const OrganizationMember = require('../models/organizationMember.model');
const { MEMBER_STATUS, ATTACHMENT_KINDS } = require('../config/constants');
const { termRegexes, escapeRegex } = require('../utils/searchQuery');
const { serializeMessages } = require('./serialize.service');

const idOf = (ref) => String(ref?._id ?? ref);

// Active org members whose name matches (for from: / in:@person).
const findMemberIds = async (organizationId, name) => {
  const memberships = await OrganizationMember.find({
    organization: organizationId,
    status: MEMBER_STATUS.ACTIVE,
  }).populate('user', 'fullName email');
  const regex = new RegExp(escapeRegex(name), 'i');
  return memberships
    .filter((membership) => membership.user)
    .filter(
      (membership) => regex.test(membership.user.fullName) || regex.test(membership.user.email),
    )
    .map((membership) => membership.user._id);
};

const resolveFrom = async (organizationId, userId, names) => {
  const ids = [];
  for (const name of names) {
    if (name.toLowerCase() === 'me') {
      ids.push(userId);
    } else {
      ids.push(...(await findMemberIds(organizationId, name)));
    }
  }
  return ids;
};

// Narrows the scope to in:#channel / in:@person (still inside the scope).
const resolveLocations = async (organizationId, userId, scope, parsed) => {
  if (parsed.inChannels.length === 0 && parsed.inPeople.length === 0) {
    return { channelIds: scope.channelIds, conversationIds: scope.conversationIds };
  }
  const channelIds = scope.channels
    .filter((channel) => parsed.inChannels.includes(channel.name.toLowerCase()))
    .map((channel) => channel._id);
  const people = new Set();
  for (const name of parsed.inPeople) {
    (await findMemberIds(organizationId, name)).forEach((id) => people.add(String(id)));
  }
  people.delete(String(userId));
  const conversationIds = scope.conversations
    .filter((conversation) =>
      conversation.participants.some((participant) => people.has(idOf(participant.user))),
    )
    .map((conversation) => conversation._id);
  return { channelIds, conversationIds };
};

const hasConstraints = async (organizationId, where, has) => {
  const constraints = [];
  if (has.has('link')) {
    constraints.push({ 'links.0': { $exists: true } });
  }
  if (has.has('file') || has.has('image')) {
    const query = { organization: organizationId, $or: where };
    if (has.has('image')) {
      query.kind = ATTACHMENT_KINDS.IMAGE;
    }
    constraints.push({ _id: { $in: await Attachment.distinct('message', query) } });
  }
  if (has.has('pin')) {
    const pinned = await ChannelPin.distinct('message', {
      organization: organizationId,
      channel: { $in: where[0].channel.$in },
    });
    constraints.push({ _id: { $in: pinned } });
  }
  return constraints;
};

const dateRange = (parsed) => ({
  ...(parsed.after ? { $gte: parsed.after } : {}),
  ...(parsed.before ? { $lt: parsed.before } : {}),
});

const locationOf = (message, scope) => {
  if (message.channelId) {
    const channel = scope.channels.find((item) => String(item._id) === message.channelId);
    return { kind: 'channel', id: message.channelId, name: channel ? channel.name : '' };
  }
  const conversation = scope.conversations.find(
    (item) => String(item._id) === message.conversationId,
  );
  const names = (conversation?.participants || [])
    .filter((participant) => idOf(participant.user) !== scope.viewerId)
    .map((participant) => participant.user?.fullName)
    .filter(Boolean);
  return { kind: 'conversation', id: message.conversationId, name: names.join(', ') };
};

// Messages matching every term + filter, newest first, inside the scope.
const searchMessages = async ({ organizationId, userId, scope, parsed, page, limit }) => {
  const { channelIds, conversationIds } = await resolveLocations(
    organizationId,
    userId,
    scope,
    parsed,
  );
  const where = [{ channel: { $in: channelIds } }, { conversation: { $in: conversationIds } }];
  // Ticket comments are not channel messages (found via ticket search).
  const and = [{ $or: where }, { ticketThread: { $ne: true } }];
  termRegexes(parsed.terms).forEach((regex) => and.push({ content: regex }));
  if (parsed.from.length > 0) {
    and.push({ sender: { $in: await resolveFrom(organizationId, userId, parsed.from) } });
  }
  if (parsed.before || parsed.after) {
    and.push({ createdAt: dateRange(parsed) });
  }
  and.push(...(await hasConstraints(organizationId, where, parsed.has)));

  const found = await Message.find({ organization: organizationId, deletedAt: null, $and: and })
    .sort({ createdAt: -1 })
    .skip(page * limit)
    .limit(limit + 1)
    .populate('sender')
    .populate('mentionedUserIds');
  const hasMore = found.length > limit;
  const serialized = await serializeMessages(found.slice(0, limit), userId);
  const context = { ...scope, viewerId: String(userId) };
  return {
    items: serialized.map((message) => ({ ...message, location: locationOf(message, context) })),
    hasMore,
  };
};

module.exports = { searchMessages, resolveFrom, dateRange };
