const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const conversationService = require('../services/conversation.service');

const requireConversation = asyncHandler(async (req, _res, next) => {
  const conversation = await conversationService.findByIdForOrg(
    req.params.conversationId,
    req.organization._id,
  );
  if (!conversation) {
    throw new AppError(404, 'Conversation not found');
  }

  const participant = conversationService.getParticipant(conversation, req.user._id);
  if (!participant) {
    throw new AppError(403, 'You are not part of this conversation');
  }

  req.conversation = conversation;
  req.participant = participant;
  next();
});

module.exports = { requireConversation };
