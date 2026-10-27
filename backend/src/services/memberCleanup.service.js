const ChannelMember = require('../models/channelMember.model');
const Task = require('../models/task.model');

// Leaving / removal from a workspace drops every channel membership in it,
// every task assignment (assignees must be able to see their tasks) and every
// project membership (projects they led get a new lead, or are archived).
const removeChannelMemberships = async (organizationId, userId) => {
  await ChannelMember.deleteMany({ organization: organizationId, user: userId });
  await Task.updateMany(
    { organization: organizationId, assignees: userId },
    { $pull: { assignees: userId } },
  );
  // Lazy: project.service loads channel/org services this module must not.
  await require('./project.service').handleUserLeftWorkspace(organizationId, userId);
};

module.exports = { removeChannelMemberships };
