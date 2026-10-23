const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const channelService = require('./channel.service');
const conversationService = require('./conversation.service');
const OrganizationMember = require('../models/organizationMember.model');
const { MEMBER_STATUS } = require('../config/constants');

const idOf = (ref) => String(ref?._id ?? ref);

// Channel huddles need an ACTIVE membership in a non-archived channel; DM
// huddles need the caller to be a participant. Returns the target refs.
const resolveTarget = async (organizationId, userId, { channelId, conversationId } = {}) => {
  if (Boolean(channelId) === Boolean(conversationId)) {
    throw new AppError(400, 'Provide exactly one of channelId or conversationId');
  }
  const id = channelId || conversationId;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, channelId ? 'Channel not found' : 'Conversation not found');
  }
  if (channelId) {
    await channelService.assertCanWriteById(channelId, organizationId, userId);
    return { organization: organizationId, channel: channelId, conversation: null };
  }
  const conversation = await conversationService.findByIdForOrg(conversationId, organizationId);
  if (!conversation || !conversationService.getParticipant(conversation, userId)) {
    throw new AppError(404, 'Conversation not found');
  }
  return { organization: organizationId, channel: null, conversation: conversation._id };
};

// Throws unless userId may see / join this huddle (same rules as start).
const assertHuddleAccess = async (huddle, userId) => {
  await resolveTarget(huddle.organization, userId, {
    channelId: huddle.channel ? idOf(huddle.channel) : undefined,
    conversationId: huddle.conversation ? idOf(huddle.conversation) : undefined,
  });
};

const canAccess = async (huddle, userId) => {
  try {
    await assertHuddleAccess(huddle, userId);
    return true;
  } catch {
    return false;
  }
};

// Everyone who can see the huddle (channel members / DM participants) who is
// still an ACTIVE member of the workspace.
const audienceIds = async (huddle) => {
  let ids = [];
  if (huddle.channel) {
    const members = await channelService.listMembers(idOf(huddle.channel));
    ids = members.map((member) => idOf(member.user));
  } else {
    const conversation = await conversationService.findByIdForOrg(
      idOf(huddle.conversation),
      huddle.organization,
    );
    ids = (conversation?.participants || []).map((participant) => idOf(participant.user));
  }
  const active = await OrganizationMember.find({
    organization: huddle.organization,
    user: { $in: ids },
    status: MEMBER_STATUS.ACTIVE,
  }).select('user');
  return active.map((member) => idOf(member.user));
};

module.exports = { idOf, resolveTarget, assertHuddleAccess, canAccess, audienceIds };
