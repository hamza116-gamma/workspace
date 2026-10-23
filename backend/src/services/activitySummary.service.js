const Message = require('../models/message.model');
const ThreadFollow = require('../models/threadFollow.model');
const { loadSearchScope } = require('./searchScope.service');

const startOfDay = (offsetDays = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
};

// Numbers for the Activity page KPI row, limited to what the user may read
// in this organization (same scope as search).
const getActivitySummary = async (organizationId, userId) => {
  const scope = await loadSearchScope(organizationId, userId);
  const visible = {
    organization: organizationId,
    deletedAt: null,
    $or: [{ channel: { $in: scope.channelIds } }, { conversation: { $in: scope.conversationIds } }],
  };
  const today = startOfDay(0);
  const yesterday = startOfDay(-1);

  const [follows, messagesToday, messagesYesterday] = await Promise.all([
    ThreadFollow.find({ organization: organizationId, user: userId }, 'threadRoot lastReadAt'),
    Message.countDocuments({ ...visible, createdAt: { $gte: today } }),
    Message.countDocuments({ ...visible, createdAt: { $gte: yesterday, $lt: today } }),
  ]);

  const roots = await Message.find(
    { ...visible, _id: { $in: follows.map((follow) => follow.threadRoot) } },
    'lastReplyAt',
  );
  const lastReply = new Map(roots.map((root) => [String(root._id), root.lastReplyAt]));
  const withNewReplies = follows.filter((follow) => {
    const at = lastReply.get(String(follow.threadRoot));
    return at && (!follow.lastReadAt || at > follow.lastReadAt);
  }).length;

  return {
    threadsFollowed: roots.length,
    threadsWithNewReplies: withNewReplies,
    messagesToday,
    messagesYesterday,
  };
};

module.exports = { getActivitySummary };
