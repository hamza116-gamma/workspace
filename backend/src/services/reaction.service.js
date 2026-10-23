const Reaction = require('../models/reaction.model');
const { AppError } = require('../utils/AppError');

const normalizeEmoji = (emoji) => {
  if (typeof emoji !== 'string' || emoji.trim() === '') {
    throw new AppError(400, 'A reaction emoji is required');
  }
  return emoji.trim().slice(0, 16);
};

const toggleReaction = async (message, user, emoji) => {
  const value = normalizeEmoji(emoji);
  const existing = await Reaction.findOne({
    message: message._id,
    user: user._id,
    emoji: value,
  });

  if (existing) {
    await existing.deleteOne();
    return false;
  }

  try {
    await Reaction.create({
      organization: message.organization,
      message: message._id,
      user: user._id,
      emoji: value,
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
  return true;
};

const getByMessageIds = async (messageIds, viewerId) => {
  if (!messageIds || messageIds.length === 0) {
    return new Map();
  }

  const reactions = await Reaction.find({ message: { $in: messageIds } })
    .sort({ createdAt: 1 })
    .populate('user');

  const map = new Map();

  for (const reaction of reactions) {
    const user = reaction.user;
    const userId = user ? String(user._id) : String(reaction.user);
    const key = String(reaction.message);
    const list = map.get(key) || [];
    let entry = list.find((item) => item.emoji === reaction.emoji);
    if (!entry) {
      entry = { emoji: reaction.emoji, count: 0, users: [], reactedByMe: false };
      list.push(entry);
    }
    entry.count += 1;
    entry.users.push({
      id: userId,
      fullName: user ? user.fullName : 'Unknown',
      avatarUrl: user ? user.avatarUrl : null,
    });
    if (viewerId && userId === String(viewerId)) {
      entry.reactedByMe = true;
    }
    map.set(key, list);
  }

  return map;
};

const getForMessage = async (messageId, viewerId) => {
  const map = await getByMessageIds([messageId], viewerId);
  return map.get(String(messageId)) || [];
};

module.exports = { toggleReaction, getByMessageIds, getForMessage };
