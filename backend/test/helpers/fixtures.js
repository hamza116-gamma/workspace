// Minimal workspace data for service-level tests.
const Organization = require('../../src/models/organization.model');
const OrganizationMember = require('../../src/models/organizationMember.model');
const User = require('../../src/models/user.model');
const Channel = require('../../src/models/channel.model');
const ChannelMember = require('../../src/models/channelMember.model');
const Message = require('../../src/models/message.model');

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter += 1)}`;

const createUser = (name = 'User') =>
  User.create({ fullName: name, email: `${unique()}@test.local`, passwordHash: 'x' });

const createWorkspace = async ({ members = 2 } = {}) => {
  const users = [];
  for (let index = 0; index < members; index += 1) {
    users.push(await createUser(`User ${index + 1}`));
  }
  const organization = await Organization.create({ name: 'Test org', slug: `org-${unique()}` });
  await OrganizationMember.insertMany(
    users.map((user, index) => ({
      organization: organization._id,
      user: user._id,
      role: index === 0 ? 'OWNER' : 'MEMBER',
    })),
  );
  return { organization, users };
};

const createChannel = async (organization, owner, memberUsers, extra = {}) => {
  const channel = await Channel.create({
    organization: organization._id,
    name: `ch-${unique()}`,
    createdBy: owner._id,
    ...extra,
  });
  await ChannelMember.insertMany(
    memberUsers.map((user) => ({
      organization: organization._id,
      channel: channel._id,
      user: user._id,
    })),
  );
  return channel;
};

const createMessage = (organization, channel, sender, content = 'hello') =>
  Message.create({
    organization: organization._id,
    channel: channel._id,
    sender: sender._id,
    content,
  });

module.exports = { createUser, createWorkspace, createChannel, createMessage };
