const Bookmark = require('../models/bookmark.model');

// A user's saved items, newest first, with the message (sender + mentions).
const listForUser = (organizationId, userId) =>
  Bookmark.find({ organization: organizationId, user: userId })
    .populate({ path: 'message', populate: ['sender', 'mentionedUserIds'] })
    .sort({ createdAt: -1 });

const findOneForUser = (organizationId, userId, messageId) =>
  Bookmark.findOne({ organization: organizationId, user: userId, message: messageId }).populate({
    path: 'message',
    populate: ['sender', 'mentionedUserIds'],
  });

const saveMessage = async (organizationId, message, user) => {
  try {
    return await Bookmark.create({
      organization: organizationId,
      user: user._id,
      message: message._id,
    });
  } catch (error) {
    if (error.code === 11000) {
      return findOneForUser(organizationId, user._id, message._id);
    }
    throw error;
  }
};

const unsaveMessage = (organizationId, userId, messageId) =>
  Bookmark.deleteOne({ organization: organizationId, user: userId, message: messageId });

const removeForMessage = (messageId) => Bookmark.deleteMany({ message: messageId });

module.exports = { listForUser, findOneForUser, saveMessage, unsaveMessage, removeForMessage };
