const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const {
  createWorkspace,
  createChannel,
  createMessage,
  createConversation,
  createDmMessage,
} = require('./helpers/fixtures');
const projectService = require('../src/services/project.service');
const taskService = require('../src/services/task.service');
const messageService = require('../src/services/message.service');
const unreadService = require('../src/services/unread.service');
const Message = require('../src/models/message.model');

before(connect);
after(disconnect);

const OWNER = 'OWNER';

// Hamza-like cast: owner (lead), member of the home channel, member of a
// linked channel only, and an outsider.
const setup = async () => {
  const { organization, users } = await createWorkspace({ members: 4, projects: true });
  const [lead, member, linkedOnly, outsider] = users;
  const home = await createChannel(organization, lead, [lead, member], { type: 'PRIVATE' });
  const design = await createChannel(organization, lead, [lead, linkedOnly]);
  const { project } = await projectService.createProject(organization._id, lead, OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
    linkedChannelIds: [String(design._id)],
  });
  return { organization, project, home, design, lead, member, linkedOnly, outsider };
};

const ticketFrom = async (ctx, source, actor) => {
  const fields = await taskService.prepareFields(
    ctx.organization._id,
    taskService.targetOf(source),
    {},
    source.content,
    ctx.project,
  );
  return taskService.createTicket({
    organizationId: ctx.organization._id,
    actor,
    fields,
    project: ctx.project,
    sourceMessage: source,
  });
};

const comment = (ctx, task, actor, content) =>
  messageService.createMessage(
    { organization: ctx.organization._id, channel: task.channel },
    actor,
    { content, parentMessageId: String(task.message) },
  );

test('a message turned into a ticket gets only a chip; the ticket thread is hidden', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Footer broken');
  const task = await ticketFrom(ctx, source, ctx.lead);

  assert.equal(`${task.projectKey}-${task.number}`, 'WEB-1');
  assert.equal(String(task.reporter._id), String(ctx.member._id), 'author is the reporter');
  assert.equal(String((await Message.findById(source._id)).taskRef), String(task._id));

  const anchor = await Message.findById(task.message);
  assert.equal(anchor.ticketThread, true);
  const timeline = await messageService.listChannelMessages(ctx.home._id);
  assert.deepEqual(
    timeline.map((m) => m.content),
    ['Footer broken'],
    'only the original message is in the chat; no card, no anchor',
  );
  const chips = await taskService.getByMessageIds([source._id]);
  assert.equal(chips.get(String(source._id))?.key, 'WEB-1', 'the chip resolves to the ticket');
});

test('a message can become only one ticket, even with two clicks at once', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Once only');
  const results = await Promise.allSettled([
    ticketFrom(ctx, source, ctx.lead),
    ticketFrom(ctx, source, ctx.member),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /already a ticket/);
});

test('comments and activity stay in the ticket thread: no chat, no unread', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Slow login');
  const task = await ticketFrom(ctx, source, ctx.lead);
  const before = await unreadService.summary(ctx.organization._id, ctx.member._id);

  const reply = await comment(ctx, task, ctx.lead, 'Looking into it');
  const note = await taskService.postActivity(task, ctx.lead._id, 'moved this to In progress');
  assert.equal(reply.ticketThread, true);
  assert.equal(note.ticketThread, true);
  assert.equal(reply.alsoSentToChannel, false);

  const timeline = await messageService.listChannelMessages(ctx.home._id);
  assert.deepEqual(
    timeline.map((m) => m.content),
    ['Slow login'],
  );
  const after = await unreadService.summary(ctx.organization._id, ctx.member._id);
  assert.deepEqual(after, before, 'ticket comments do not change unread counts');
  const thread = await messageService.listThread(task.message);
  assert.deepEqual(
    thread.map((m) => m.content),
    ['Looking into it', 'moved this to In progress'],
  );
});

test('linked-channel members can read and comment; outsiders cannot', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Dark mode');
  const task = await ticketFrom(ctx, source, ctx.lead);
  const anchor = await Message.findById(task.message);

  await assert.doesNotReject(messageService.assertAccess(anchor, ctx.linkedOnly._id));
  const reply = await comment(ctx, task, ctx.linkedOnly, 'Design ready');
  assert.equal(reply.ticketThread, true);
  await assert.doesNotReject(messageService.assertCanWrite(reply, ctx.linkedOnly._id));

  await assert.rejects(messageService.assertAccess(anchor, ctx.outsider._id));
  await assert.rejects(comment(ctx, task, ctx.outsider, 'sneaky'), /Join the project|not found/i);
});

test('@channel / @here are refused in ticket comments; mentions only reach members', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Mentions');
  const task = await ticketFrom(ctx, source, ctx.lead);
  await assert.rejects(comment(ctx, task, ctx.lead, 'hey <!channel>'), /cannot be used/);
  const reply = await comment(
    ctx,
    task,
    ctx.lead,
    `<@${ctx.linkedOnly._id}> and <@${ctx.outsider._id}>`,
  );
  assert.deepEqual(
    reply.mentionedUserIds.map((u) => String(u._id ?? u)),
    [String(ctx.linkedOnly._id)],
    'linked member mentioned, outsider dropped',
  );
});

test('a DM message can become a project ticket for a member; the DM stays private', async () => {
  const ctx = await setup();
  const dm = await createConversation(ctx.organization, [ctx.lead, ctx.outsider]);
  const source = await createDmMessage(ctx.organization, dm, ctx.outsider, 'From a DM');
  const task = await ticketFrom(ctx, source, ctx.lead);
  assert.equal(String(task.channel), String(ctx.home._id), 'lives in the project, not the DM');
  assert.equal(String(task.sourceMessage), String(source._id));
  // The outsider (DM partner) is not a project member: cannot open the ticket.
  await assert.rejects(taskService.loadForRead(task._id, ctx.organization._id, ctx.outsider._id));
});

test('deleting a ticket removes the chip and hides its thread', async () => {
  const ctx = await setup();
  const source = await createMessage(ctx.organization, ctx.home, ctx.member, 'Remove me');
  const task = await ticketFrom(ctx, source, ctx.lead);
  await taskService.deleteTask(task);
  assert.equal((await Message.findById(source._id)).taskRef, null);
  assert.ok((await Message.findById(task.message)).deletedAt, 'anchor hidden');
  const chips = await taskService.getByMessageIds([source._id]);
  assert.equal(chips.size, 0);
});

test('chat tasks outside projects keep working as before', async () => {
  const { organization, users } = await createWorkspace({ members: 2, projects: true });
  const plain = await createChannel(organization, users[0], users);
  const source = await createMessage(organization, plain, users[0], 'Plain task');
  const fields = await taskService.prepareFields(
    organization._id,
    { channel: String(plain._id) },
    {},
    'Plain task',
  );
  const task = await taskService.createForMessage(organization._id, source, users[0], fields);
  assert.equal(task.projectKey, 'TASK');
  assert.equal(String(task.message), String(source._id));
});
