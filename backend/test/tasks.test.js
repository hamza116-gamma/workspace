const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const { createWorkspace, createChannel, createMessage } = require('./helpers/fixtures');
const taskService = require('../src/services/task.service');

before(connect);
after(disconnect);

test('concurrent task creation never reuses a task number', async () => {
  const { organization, users } = await createWorkspace();
  const channel = await createChannel(organization, users[0], users);
  const messages = await Promise.all(
    Array.from({ length: 10 }, (_, i) => createMessage(organization, channel, users[0], `m${i}`)),
  );
  const target = { channel: String(channel._id) };
  const tasks = await Promise.all(
    messages.map(async (message) => {
      const fields = await taskService.prepareFields(organization._id, target, {}, message.content);
      return taskService.createForMessage(organization._id, message, users[0], fields);
    }),
  );
  const numbers = tasks.map((task) => task.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('a message can only become one task', async () => {
  const { organization, users } = await createWorkspace();
  const channel = await createChannel(organization, users[0], users);
  const message = await createMessage(organization, channel, users[0]);
  const target = { channel: String(channel._id) };
  const fields = await taskService.prepareFields(organization._id, target, {}, 'once');
  const results = await Promise.allSettled([
    taskService.createForMessage(organization._id, message, users[0], fields),
    taskService.createForMessage(organization._id, message, users[0], fields),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
});

test('assignees must be members of the channel', async () => {
  const { organization, users } = await createWorkspace({ members: 3 });
  const channel = await createChannel(organization, users[0], [users[0], users[1]]);
  const target = { channel: String(channel._id) };
  await assert.doesNotReject(
    taskService.prepareFields(organization._id, target, { assignees: [String(users[1]._id)] }, 't'),
  );
  await assert.rejects(
    taskService.prepareFields(organization._id, target, { assignees: [String(users[2]._id)] }, 't'),
    /only be assigned to people in this conversation/,
  );
});

test('leaving a channel unassigns the user from its tasks', async () => {
  const { organization, users } = await createWorkspace();
  const channel = await createChannel(organization, users[0], users);
  const message = await createMessage(organization, channel, users[0]);
  const target = { channel: String(channel._id) };
  const fields = await taskService.prepareFields(
    organization._id,
    target,
    { assignees: [String(users[1]._id)] },
    'leave',
  );
  const task = await taskService.createForMessage(organization._id, message, users[0], fields);
  await taskService.unassignFromChannel(channel._id, users[1]._id);
  const reloaded = await taskService.findByIdForOrg(task._id, organization._id);
  assert.equal(reloaded.assignees.length, 0);
});
