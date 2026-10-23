const ChannelMember = require('../models/channelMember.model');

// Leaving / removal from a workspace drops every channel membership in it.
const removeChannelMemberships = (organizationId, userId) =>
  ChannelMember.deleteMany({ organization: organizationId, user: userId });

module.exports = { removeChannelMemberships };
