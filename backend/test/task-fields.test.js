const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const { createWorkspace, createChannel } = require('./helpers/fixtures');
const projectService = require('../src/services/project.service');
const taskService = require('../src/services/task.service');
const messageService = require('../src/services/message.service');
const Task = require('../src/models/task.model');
const Message = require('../src/models/message.model');

before(connect);
after(disconnect);

const OWNER = 'OWNER';

const setup = async () => {
  const { organization, users } = await createWorkspace({ members: 3, projects: true });
  const { project } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Fields',
    key: 'FLD',
    visibility: 'PUBLIC',
  });
  return { organization, users, project };
};

const ticket = async (organization, project, actor, payload = {}) => {
  const fields = await taskService.prepareFields(organization._id, {}, payload, 'Ticket', project);
  return taskService.createTicket({ organizationId: organization._id, actor, fields, project });
};

const chatTask = async (organization, users, payload = {}) => {
  const chat = await createChannel(organization, users[0], [users[0], users[1]]);
  const source = await messageService.createMessage(
    { organization: organization._id, channel: chat._id },
    users[0],
    { content: 'Chat task' },
  );
  const fields = await taskService.prepareFields(
    organization._id,
    { channel: String(chat._id) },
    payload,
    'Chat task',
  );
  return {
    chat,
    task: await taskService.createForMessage(organization._id, source, users[0], fields),
  };
};

test('estimates accept 30m / 2h / 1.5d / 1d 4h and reject nonsense', () => {
  assert.equal(taskService.parseEstimate('30m'), 30);
  assert.equal(taskService.parseEstimate('2h'), 120);
  assert.equal(taskService.parseEstimate('1.5d'), 720);
  assert.equal(taskService.parseEstimate('1d 4h'), 720);
  assert.equal(taskService.parseEstimate(''), null);
  assert.equal(taskService.parseEstimate(90), 90);
  assert.throws(() => taskService.parseEstimate('soon'), /Estimate looks like/);
  assert.throws(() => taskService.parseEstimate('2h tomorrow'), /Estimate looks like/);
  assert.throws(() => taskService.parseEstimate('2000h'), /between/);
});

test('type and estimate are set on create and change with an activity note', async () => {
  const { organization, users, project } = await setup();
  const task = await ticket(organization, project, users[0], { type: 'BUG', estimate: '2h' });
  assert.equal(task.type, 'BUG');
  assert.equal(task.estimateMinutes, 120);
  const plain = await ticket(organization, project, users[0]);
  assert.equal(plain.type, 'TASK', 'defaults to Task');
  assert.equal(plain.estimateMinutes, null);

  const { changes } = await taskService.updateTask(task, { type: 'FEATURE', estimate: '1d' });
  assert.deepEqual(changes, ['changed the type to feature', 'set the estimate to 1d']);
  const cleared = await taskService.updateTask(task, { estimate: '' });
  assert.deepEqual(cleared.changes, ['removed the estimate']);
  await assert.rejects(taskService.updateTask(task, { type: 'EPIC' }), /Invalid type/);
});

test('project subtasks get project keys, hidden threads and keep the parent count', async () => {
  const { organization, users, project } = await setup();
  const parent = await ticket(organization, project, users[0]);
  const one = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent,
    payload: { title: 'Write tests', assignees: [String(users[1]._id)] },
  });
  await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent,
    payload: { title: 'Ship it' },
  });
  assert.equal(Task.keyOf(one), 'FLD-1.1', 'subtask key follows its parent');
  assert.equal(String(one.parent), String(parent._id));
  assert.equal((await Message.findById(one.message)).ticketThread, true, 'hidden thread');

  let fresh = await Task.findById(parent._id);
  assert.deepEqual([fresh.subtaskTotal, fresh.subtaskDone], [2, 0]);
  await taskService.updateTask(one, { status: 'DONE' });
  fresh = await Task.findById(parent._id);
  assert.deepEqual([fresh.subtaskTotal, fresh.subtaskDone], [2, 1]);

  await assert.rejects(
    taskService.createSubtask({
      organizationId: organization._id,
      actor: users[0],
      parent: one,
      payload: { title: 'x' },
    }),
    /cannot have subtasks/,
  );
  assert.equal((await taskService.listSubtasks(parent)).length, 2);
});

test('chat subtasks stay in the same chat (TASK-n) without posting in it', async () => {
  const { organization, users } = await setup();
  const { chat, task } = await chatTask(organization, users);
  const before1 = await Message.countDocuments({ channel: chat._id, ticketThread: { $ne: true } });
  const sub = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent: task,
    payload: { title: 'Chat subtask', assignees: [String(users[1]._id)] },
  });
  assert.equal(sub.projectKey, 'TASK');
  assert.equal(String(sub.channel), String(chat._id));
  const after1 = await Message.countDocuments({ channel: chat._id, ticketThread: { $ne: true } });
  assert.equal(after1, before1, 'nothing new in the chat timeline');
  // Assignees still follow the chat's rules.
  await assert.rejects(
    taskService.createSubtask({
      organizationId: organization._id,
      actor: users[0],
      parent: task,
      payload: { title: 'Outsider', assignees: [String(users[2]._id)] },
    }),
  );
});

test('moving a parent into a project brings its subtasks; deleting can keep or delete them', async () => {
  const { organization, users, project } = await setup();
  const { task } = await chatTask(organization, users);
  const sub = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent: task,
    payload: { title: 'Goes along' },
  });
  await assert.rejects(taskService.moveToProject(sub, project), /Move its parent/);
  await taskService.moveToProject(task, project);
  const movedSub = await Task.findById(sub._id);
  assert.equal(String(movedSub.project), String(project._id));
  assert.equal(movedSub.projectKey, 'FLD');

  const parent = await ticket(organization, project, users[0]);
  const keep = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent,
    payload: { title: 'Kept' },
  });
  await taskService.deleteTask(await Task.findById(parent._id));
  assert.equal((await Task.findById(keep._id)).parent, null, 'kept as a separate task');

  const parent2 = await ticket(organization, project, users[0]);
  const gone = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent: parent2,
    payload: { title: 'Deleted' },
  });
  await taskService.deleteTask(await Task.findById(parent2._id), { subtasks: 'delete' });
  assert.equal(await Task.findById(gone._id), null);

  // Deleting a subtask updates its parent's count.
  const parent3 = await ticket(organization, project, users[0]);
  const lone = await taskService.createSubtask({
    organizationId: organization._id,
    actor: users[0],
    parent: parent3,
    payload: { title: 'Lone' },
  });
  await taskService.deleteTask(lone);
  assert.equal((await Task.findById(parent3._id)).subtaskTotal, 0);
});
