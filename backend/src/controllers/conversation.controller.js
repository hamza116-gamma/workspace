const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const conversationService = require('../services/conversation.service');
const organizationService = require('../services/organization.service');

const list = asyncHandler(async (req, res) => {
  const conversations = await conversationService.listForUser(req.organization._id, req.user._id);
  success(res, {
    conversations: conversations.map((conversation) =>
      conversationService.toPublicConversation(conversation, req.user._id),
    ),
  });
});

const create = asyncHandler(async (req, res) => {
  const conversation = await conversationService.createConversation(
    req.organization,
    req.user,
    req.body.userIds,
  );
  await conversation.populate('participants.user');
  success(
    res,
    { conversation: conversationService.toPublicConversation(conversation, req.user._id) },
    201,
  );
});

const find = asyncHandler(async (req, res) => {
  const conversation = await conversationService.findExisting(
    req.organization,
    req.user,
    req.body.userIds || [],
  );
  if (conversation) {
    await conversation.populate('participants.user');
  }
  success(res, {
    conversation: conversation
      ? conversationService.toPublicConversation(conversation, req.user._id)
      : null,
  });
});

const get = asyncHandler(async (req, res) => {
  await req.conversation.populate('participants.user');
  success(res, {
    conversation: conversationService.toPublicConversation(req.conversation, req.user._id),
  });
});

const addParticipants = asyncHandler(async (req, res) => {
  const conversation = await conversationService.addParticipants(
    req.organization,
    req.conversation,
    req.user,
    req.body.userIds,
  );
  await conversation.populate('participants.user');
  success(res, {
    conversation: conversationService.toPublicConversation(conversation, req.user._id),
  });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const conversation = await conversationService.setMyPreferences(
    req.conversation,
    req.user._id,
    req.body,
  );
  await conversation.populate('participants.user');
  success(res, {
    conversation: conversationService.toPublicConversation(conversation, req.user._id),
  });
});

const listCandidates = asyncHandler(async (req, res) => {
  const members = await conversationService.listCandidates(req.organization._id, req.user._id);
  success(res, { candidates: members.map(organizationService.toPublicMember) });
});

module.exports = { list, create, find, get, addParticipants, updatePreferences, listCandidates };
