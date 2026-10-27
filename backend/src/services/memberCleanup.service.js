const ChannelMember = require('../models/channelMember.model');
const Task = require('../models/task.model');

// Leaving / removal from a workspace drops every channel membership in it,
// and every task assignment (assignees must be able to see their tasks).
const removeChannelMemberships = async (organizationId, userId) => {
  await ChannelMember.deleteMany({ organization: organizationId, user: userId });
  await Task.updateMany(
    { organization: organizationId, assignees: userId },
    { $pull: { assignees: userId } },
  );
};

module.exports = { removeChannelMemberships };
