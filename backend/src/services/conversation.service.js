const Conversation = require('../models/conversation.model');
const OrganizationMember = require('../models/organizationMember.model');
const { CONVERSATION_TYPES, MEMBER_STATUS } = require('../config/constants');
const { AppError } = require('../utils/AppError');
const { toPublicUser } = require('./user.service');

const MAX_GROUP_PARTICIPANTS = 9;
const MIN_GROUP_PARTICIPANTS = 3;

const participantUser = (participant) =>
  participant.user && participant.user.fullName
    ? toPublicUser(participant.user)
    : { id: String(participant.user) };

// `muted` is a per-viewer preference: only the viewer's own value is exposed.
const toPublicConversation = (conversation, viewerId) => ({
  id: conversation._id,
  type: conversation.type,
  participants: (conversation.participants || []).map((participant) => ({
    user: participantUser(participant),
    joinedAt: participant.joinedAt,
    lastReadAt: participant.lastReadAt,
  })),
  muted: Boolean(viewerId && getParticipant(conversation, viewerId)?.muted),
  lastActivityAt: conversation.lastActivityAt,
  createdAt: conversation.createdAt,
});

const buildMemberKey = (organizationId, userIds) =>
  `${organizationId}:${[...userIds].map(String).sort().join(':')}`;

const assertOrgMembers = async (organizationId, userIds) => {
  const unique = [...new Set(userIds.map(String))];
  const members = await OrganizationMember.find({
    organization: organizationId,
    user: { $in: unique },
    status: MEMBER_STATUS.ACTIVE,
  }).select('user');

  if (members.length !== unique.length) {
    throw new AppError(400, 'One or more people are not members of this workspace');
  }
};

const getParticipant = (conversation, userId) =>
  (conversation.participants || []).find(
    (participant) => String(participant.user?._id ?? participant.user) === String(userId),
  );

const findOrCreateDirect = async (organization, actor, otherUserId) => {
  if (String(otherUserId) === String(actor._id)) {
    throw new AppError(400, 'You cannot start a conversation with yourself');
  }
  await assertOrgMembers(organization._id, [otherUserId]);

  const directKey = buildMemberKey(organization._id, [actor._id, otherUserId]);
  const existing = await Conversation.findOne({
    organization: organization._id,
    directKey,
  });
  if (existing) {
    return existing;
  }

  try {
    return await Conversation.create({
      organization: organization._id,
      type: CONVERSATION_TYPES.DIRECT,
      directKey,
      createdBy: actor._id,
      participants: [{ user: actor._id }, { user: otherUserId }],
    });
  } catch (error) {
    if (error.code === 11000) {
      return Conversation.findOne({ organization: organization._id, directKey });
    }
    throw error;
  }
};

const findOrCreateGroup = async (organization, actor, others) => {
  const all = [String(actor._id), ...others];

  if (all.length < MIN_GROUP_PARTICIPANTS) {
    throw new AppError(400, 'A group message needs at least 2 other people');
  }
  if (all.length > MAX_GROUP_PARTICIPANTS) {
    throw new AppError(400, `A group message can have at most ${MAX_GROUP_PARTICIPANTS} people`);
  }

  await assertOrgMembers(organization._id, others);

  const groupKey = buildMemberKey(organization._id, all);
  const existing = await Conversation.findOne({
    organization: organization._id,
    groupKey,
  });
  if (existing) {
    return existing;
  }

  try {
    return await Conversation.create({
      organization: organization._id,
      type: CONVERSATION_TYPES.GROUP,
      groupKey,
      createdBy: actor._id,
      participants: all.map((user) => ({ user })),
    });
  } catch (error) {
    if (error.code === 11000) {
      return Conversation.findOne({ organization: organization._id, groupKey });
    }
    throw error;
  }
};

// Find-only (used by the "New message" flow): never creates.
const findExisting = async (organization, actor, userIds) => {
  const others = [...new Set((userIds || []).map(String))].filter((id) => id !== String(actor._id));
  if (others.length === 0) {
    return null;
  }

  const all = [String(actor._id), ...others];
  if (all.length === 2) {
    return Conversation.findOne({
      organization: organization._id,
      directKey: buildMemberKey(organization._id, all),
    });
  }
  return Conversation.findOne({
    organization: organization._id,
    groupKey: buildMemberKey(organization._id, all),
  });
};

const createConversation = async (organization, actor, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError(400, 'Select at least one person');
  }
  const others = [...new Set(userIds.map(String))].filter((id) => id !== String(actor._id));
  if (others.length === 0) {
    throw new AppError(400, 'Select at least one other person');
  }
  if (others.length === 1) {
    return findOrCreateDirect(organization, actor, others[0]);
  }
  return findOrCreateGroup(organization, actor, others);
};

const listForUser = (organizationId, userId) =>
  Conversation.find({ organization: organizationId, 'participants.user': userId })
    .populate('participants.user')
    .sort({ lastActivityAt: -1 });

const findByIdForOrg = (id, organizationId) =>
  Conversation.findOne({ _id: id, organization: organizationId });

// "Add people" never changes an existing DM (Slack): it finds or creates the
// group DM for the combined people. Earlier history is not shared.
const addParticipants = async (organization, conversation, actor, userIds) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError(400, 'Select at least one person');
  }
  const current = conversation.participants.map((participant) =>
    String(participant.user?._id ?? participant.user),
  );
  const existing = new Set(current);
  const toAdd = [...new Set(userIds.map(String))].filter((id) => !existing.has(id));
  if (toAdd.length === 0) {
    throw new AppError(409, 'Those people are already in this conversation');
  }
  const others = [...current, ...toAdd].filter((id) => id !== String(actor._id));
  return findOrCreateGroup(organization, actor, others);
};

const touchActivity = async (conversation, at = new Date()) => {
  conversation.lastActivityAt = at;
  await conversation.save();
  return conversation;
};

// PATCH /conversations/:id/preferences { muted }
const setMyPreferences = async (conversation, userId, payload = {}) => {
  if (typeof payload.muted !== 'boolean') {
    throw new AppError(400, 'muted must be a boolean');
  }
  const participant = getParticipant(conversation, userId);
  if (!participant) {
    throw new AppError(403, 'You are not part of this conversation');
  }
  participant.muted = payload.muted;
  await conversation.save();
  return conversation;
};

const listCandidates = (organizationId, actorId) =>
  OrganizationMember.find({
    organization: organizationId,
    status: MEMBER_STATUS.ACTIVE,
    user: { $ne: actorId },
  })
    .populate('user')
    .sort({ createdAt: 1 });

module.exports = {
  MAX_GROUP_PARTICIPANTS,
  toPublicConversation,
  setMyPreferences,
  buildMemberKey,
  getParticipant,
  findExisting,
  findOrCreateDirect,
  createConversation,
  listForUser,
  findByIdForOrg,
  addParticipants,
  touchActivity,
  listCandidates,
};
