const ThreadFollow = require('../models/threadFollow.model');

const isFollowing = async (threadRootId, userId) =>
  Boolean(await ThreadFollow.exists({ threadRoot: threadRootId, user: userId }));

const follow = async (organizationId, threadRootId, userId) => {
  try {
    await ThreadFollow.create({
      organization: organizationId,
      threadRoot: threadRootId,
      user: userId,
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
  return true;
};

const unfollow = async (threadRootId, userId) => {
  await ThreadFollow.deleteOne({ threadRoot: threadRootId, user: userId });
  return false;
};

// User ids following a thread (for thread-reply notifications).
const listFollowers = (threadRootId) =>
  ThreadFollow.find({ threadRoot: threadRootId }).select('user');

module.exports = { isFollowing, follow, unfollow, listFollowers };
