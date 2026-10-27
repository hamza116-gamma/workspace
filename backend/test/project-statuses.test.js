const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const { createWorkspace, createChannel } = require('./helpers/fixtures');
const projectService = require('../src/services/project.service');
const taskService = require('../src/services/task.service');
const messageService = require('../src/services/message.service');
const Task = require('../src/models/task.model');
const { DEFAULT_TASK_STATUSES } = require('../src/config/constants');

before(connect);
after(disconnect);

const OWNER = 'OWNER';
const MEMBER = 'MEMBER';

const setup = async () => {
  const { organization, users } = await createWorkspace({ members: 3, projects: true });
  const { project } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Flow',
    key: 'FLO',
  });
  return { organization, users, project };
};

const ticket = async (organization, project, actor, title, payload = {}) => {
  const fields = await taskService.prepareFields(organization._id, {}, payload, title, project);
  return taskService.createTicket({ organizationId: organization._id, actor, fields, project });
};

const plain = (statuses) =>
  statuses.map(({ key, name, color, group }) => ({ key, name, color, group }));

test('a new project starts with the default statuses; tickets start in the first to-do', async () => {
  const { organization, users, project } = await setup();
  assert.deepEqual(plain(project.statuses), DEFAULT_TASK_STATUSES);
  const task = await ticket(organization, project, users[0], 'First');
  assert.equal(task.status, 'TODO');
  assert.equal(task.statusGroup, 'TODO');
});

test('statuses can be added, renamed and reordered; tickets use them', async () => {
  const { organization, users, project } = await setup();
  const { project: next } = await projectService.updateProject(project, users[0]._id, OWNER, {
    statuses: [
      { name: 'Backlog', color: '#123456', group: 'TODO' },
      { key: 'IN_PROGRESS', name: 'Building', color: '#3b82f6', group: 'IN_PROGRESS' },
      { key: 'IN_REVIEW', name: 'QA', color: '#f59e0b', group: 'IN_PROGRESS' },
      { key: 'DONE', name: 'Shipped', color: '#22a06b', group: 'DONE' },
      { key: 'TODO', name: 'Ready', color: '#8a94a6', group: 'TODO' },
    ],
    moveStatusTo: {},
  });
  assert.deepEqual(
    next.statuses.map((s) => s.name),
    ['Backlog', 'Building', 'QA', 'Shipped', 'Ready'],
  );
  const backlog = next.statuses[0].key;
  assert.match(backlog, /^S[0-9A-F]{8}$/, 'a new status gets a key');

  const task = await ticket(organization, next, users[0], 'Starts in backlog');
  assert.equal(task.status, backlog, 'first to-do status is the first in the list');

  const { changes } = await taskService.updateTask(task, { status: 'DONE' });
  assert.deepEqual(changes, ['moved this to Shipped']);
  assert.equal(task.statusGroup, 'DONE');
  assert.ok(task.closedAt);

  await assert.rejects(taskService.updateTask(task, { status: 'NOPE' }), /Unknown status/);
});

test('a project keeps at least one to-do and one done status, with unique names', async () => {
  const { users, project } = await setup();
  const update = (statuses) =>
    projectService.updateProject(project, users[0]._id, OWNER, { statuses });
  await assert.rejects(
    update([{ key: 'TODO', name: 'To do', color: '#8a94a6', group: 'TODO' }]),
    /done/,
  );
  await assert.rejects(
    update([{ key: 'DONE', name: 'Done', color: '#22a06b', group: 'DONE' }]),
    /to do/,
  );
  await assert.rejects(
    update([
      { key: 'TODO', name: 'Same', color: '#8a94a6', group: 'TODO' },
      { key: 'DONE', name: 'same', color: '#22a06b', group: 'DONE' },
    ]),
    /Two statuses/,
  );
});

test('removing a status with tickets needs a target; tickets move there', async () => {
  const { organization, users, project } = await setup();
  const task = await ticket(organization, project, users[0], 'In review', { status: 'IN_REVIEW' });
  const withoutReview = plain(project.statuses).filter((s) => s.key !== 'IN_REVIEW');
  await assert.rejects(
    projectService.updateProject(project, users[0]._id, OWNER, { statuses: withoutReview }),
    /has 1 ticket/,
  );
  await projectService.updateProject(project, users[0]._id, OWNER, {
    statuses: withoutReview,
    moveStatusTo: { IN_REVIEW: 'DONE' },
  });
  const moved = await Task.findById(task._id);
  assert.equal(moved.status, 'DONE');
  assert.equal(moved.statusGroup, 'DONE');
  assert.ok(moved.closedAt, 'moved into a done status: closed');
});

test('changing a status group updates its tickets', async () => {
  const { organization, users, project } = await setup();
  const task = await ticket(organization, project, users[0], 'Review me', { status: 'IN_REVIEW' });
  const statuses = plain(project.statuses).map((s) =>
    s.key === 'IN_REVIEW' ? { ...s, group: 'DONE' } : s,
  );
  await projectService.updateProject(project, users[0]._id, OWNER, { statuses });
  const after1 = await Task.findById(task._id);
  assert.equal(after1.statusGroup, 'DONE');
  assert.ok(after1.closedAt);
  assert.equal(
    (await projectService.countsFor([String(project._id)])).get(String(project._id)).done,
    1,
  );
});

test('only the lead or an admin edits statuses', async () => {
  const { organization, users, project } = await setup();
  await projectService.updateProject(project, users[0]._id, OWNER, {
    visibility: 'PUBLIC',
  });
  await assert.rejects(
    projectService.updateProject(project, users[1]._id, MEMBER, {
      statuses: plain(project.statuses).slice(0, 1).concat(plain(project.statuses).slice(-1)),
    }),
    /Only the project lead/,
  );
  assert.ok(organization);
});

test('chat tasks use the defaults; moving into a project keeps the group', async () => {
  const { organization, users, project } = await setup();
  const { project: custom } = await projectService.updateProject(project, users[0]._id, OWNER, {
    statuses: [
      { key: 'TODO', name: 'To do', color: '#8a94a6', group: 'TODO' },
      { name: 'Doing', color: '#3b82f6', group: 'IN_PROGRESS' },
      { key: 'DONE', name: 'Done', color: '#22a06b', group: 'DONE' },
    ],
  });
  const chat = await createChannel(organization, users[0], [users[0]]);
  const source = await messageService.createMessage(
    { organization: organization._id, channel: chat._id },
    users[0],
    { content: 'Review copy' },
  );
  const fields = await taskService.prepareFields(
    organization._id,
    { channel: String(chat._id) },
    { status: 'IN_REVIEW' },
    'Review copy',
  );
  const task = await taskService.createForMessage(organization._id, source, users[0], fields);
  assert.equal(task.status, 'IN_REVIEW', 'default statuses for chat tasks');
  const { task: moved } = await taskService.moveToProject(task, custom);
  assert.equal(moved.status, custom.statuses[1].key, 'In review -> first in-progress status');
  assert.equal(moved.statusGroup, 'IN_PROGRESS');
});
