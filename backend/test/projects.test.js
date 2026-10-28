const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const {
  createWorkspace,
  createChannel,
  createMessage,
  setChannelRole,
  removeFromChannel,
  createConversation,
  createDmMessage,
} = require('./helpers/fixtures');
const projectService = require('../src/services/project.service');
const taskService = require('../src/services/task.service');
const Task = require('../src/models/task.model');
const Channel = require('../src/models/channel.model');

before(connect);
after(disconnect);

const OWNER = 'OWNER';
const MEMBER = 'MEMBER';

// A chat task (TASK-n) or, when `project` is given, a project ticket.
const makeTask = async (organization, channel, author, title, project = null, assignees = []) => {
  const message = await createMessage(organization, channel, author, title);
  const fields = await taskService.prepareFields(
    organization._id,
    { channel: String(channel._id) },
    { assignees: assignees.map((user) => String(user._id)) },
    title,
    project,
  );
  return taskService.createForMessage(organization._id, message, author, fields, project);
};

const setup = async ({ members = 3, type = 'PUBLIC' } = {}) => {
  const { organization, users } = await createWorkspace({ members, projects: true });
  const home = await createChannel(organization, users[0], users.slice(0, 2), { type });
  return { organization, users, home };
};

const create = (organization, actor, role, payload) =>
  projectService.createProject(organization._id, actor, role, payload);

// ---- who can create, keys --------------------------------------------------

test('only workspace admins or home-channel moderators can create a project', async () => {
  const { organization, users, home } = await setup();
  const payload = { name: 'Website', key: 'WEB', homeChannelId: String(home._id) };
  await assert.rejects(create(organization, users[1], MEMBER, payload), /admins or the channel/);

  await setChannelRole(home, users[1], 'MODERATOR');
  const { project } = await create(organization, users[1], MEMBER, payload);
  assert.equal(project.key, 'WEB');
  assert.equal(String(project.lead._id), String(users[1]._id));
});

test('project keys are validated, TASK is reserved and keys are unique', async () => {
  const { organization, users, home } = await setup();
  const other = await createChannel(organization, users[0], [users[0]]);
  const make = (key, channel = home) =>
    create(organization, users[0], OWNER, { name: 'P', key, homeChannelId: String(channel._id) });

  await assert.rejects(make('W'), /2-6 letters/);
  await assert.rejects(make('1AB'), /start with a letter/);
  await assert.rejects(make('TOOLONG'), /2-6 letters/);
  await assert.rejects(make('TASK'), /reserved/);
  const { project } = await make('web'); // lower case is upper-cased
  assert.equal(project.key, 'WEB');
  await assert.rejects(make('WEB', other), /already used/);
});

test('a channel can be the home of only one active project', async () => {
  const { organization, users, home } = await setup();
  const payload = { name: 'A', key: 'AAA', homeChannelId: String(home._id) };
  const { project } = await create(organization, users[0], OWNER, payload);
  await assert.rejects(
    create(organization, users[0], OWNER, { ...payload, key: 'BBB' }),
    /already the home/,
  );
  // Archiving frees the home channel; restoring is blocked while it's taken.
  await projectService.archiveProject(project, users[0]._id, OWNER);
  const { project: second } = await create(organization, users[0], OWNER, {
    ...payload,
    key: 'BBB',
  });
  assert.equal(second.key, 'BBB');
  await assert.rejects(
    projectService.restoreProject(project, users[0]._id, OWNER),
    /already the home/,
  );
});

test('an archived channel cannot be a home', async () => {
  const { organization, users, home } = await setup();
  await Channel.updateOne({ _id: home._id }, { $set: { status: 'ARCHIVED' } });
  await assert.rejects(
    create(organization, users[0], OWNER, {
      name: 'A',
      key: 'ARC',
      homeChannelId: String(home._id),
    }),
    /archived channel/,
  );
});

// ---- adopting existing tasks ---------------------------------------------

test('creating a project adopts only its home channel tasks, keeping TASK-n as an alias', async () => {
  const { organization, users, home } = await setup();
  const elsewhere = await createChannel(organization, users[0], users.slice(0, 2));
  const homeTask1 = await makeTask(organization, home, users[0], 'home one');
  const otherTask = await makeTask(organization, elsewhere, users[0], 'other channel');
  const homeTask2 = await makeTask(organization, home, users[0], 'home two');
  const dm = await createConversation(organization, [users[0], users[1]]);
  const dmMessage = await createDmMessage(organization, dm, users[0]);
  const dmFields = await taskService.prepareFields(
    organization._id,
    { conversation: String(dm._id) },
    {},
    'private dm task',
  );
  const dmTask = await taskService.createForMessage(
    organization._id,
    dmMessage,
    users[0],
    dmFields,
  );

  const { project, adopted } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  assert.equal(adopted, 2);

  const reload = (task) => Task.findById(task._id);
  const [a, b, other, dmAfter] = await Promise.all([
    reload(homeTask1),
    reload(homeTask2),
    reload(otherTask),
    reload(dmTask),
  ]);
  assert.deepEqual(
    [a, b].map((t) => `${t.projectKey}-${t.number}`),
    ['WEB-1', 'WEB-2'],
  );
  assert.ok(a.formerKeys.includes(`TASK-${homeTask1.number}`));
  // Other channels and DMs are never moved into a project.
  assert.equal(other.project, null);
  assert.equal(dmAfter.project, null);
  assert.equal(dmAfter.projectKey, 'TASK');

  // The old key still finds the ticket.
  const viaAlias = await projectService.resolveTaskKey(
    organization._id,
    `TASK-${homeTask1.number}`,
  );
  assert.equal(String(viaAlias._id), String(homeTask1._id));
  assert.equal(String(project.key), 'WEB');
});

// ---- numbering & keys ------------------------------------------------------

test('tickets created at the same time get distinct per-project numbers', async () => {
  const { organization, users, home } = await setup();
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  const tasks = await Promise.all(
    Array.from({ length: 8 }, (_, i) => makeTask(organization, home, users[0], `t${i}`, project)),
  );
  assert.deepEqual(
    tasks.map((t) => t.number).sort((x, y) => x - y),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  // Chat tasks keep their own TASK sequence alongside.
  const elsewhere = await createChannel(organization, users[0], [users[0]]);
  const chatTask = await makeTask(organization, elsewhere, users[0], 'chat');
  assert.equal(chatTask.projectKey, 'TASK');
});

test('renaming a project key keeps old keys working and frees nothing for others', async () => {
  const { organization, users, home } = await setup();
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  const task = await makeTask(organization, home, users[0], 'renamed', project);
  const { project: renamed } = await projectService.updateProject(project, users[0]._id, OWNER, {
    key: 'SITE',
  });
  assert.equal(renamed.key, 'SITE');
  assert.equal((await Task.findById(task._id)).projectKey, 'SITE');
  for (const key of ['SITE-1', 'WEB-1', 'web-1']) {
    const found = await projectService.resolveTaskKey(organization._id, key);
    assert.equal(String(found?._id), String(task._id), key);
  }
  // Another project cannot take the old key.
  const other = await createChannel(organization, users[0], [users[0]]);
  await assert.rejects(
    create(organization, users[0], OWNER, {
      name: 'X',
      key: 'WEB',
      homeChannelId: String(other._id),
    }),
    /already used/,
  );
});

test('text that only looks like a key does not resolve', async () => {
  const { organization } = await setup();
  for (const key of ['COVID-19', 'ISO-9001', 'WEB-', 'nonsense']) {
    assert.equal(await projectService.resolveTaskKey(organization._id, key), null, key);
  }
});

// ---- membership & access ---------------------------------------------------

test('private project: non-members cannot see it or its tickets', async () => {
  const { organization, users, home } = await setup({ type: 'PRIVATE' });
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Secret',
    key: 'SEC',
    homeChannelId: String(home._id),
  });
  const task = await makeTask(organization, home, users[0], 'secret', project);
  const outsider = users[2];
  assert.equal(await projectService.canSee(project, outsider._id), false);
  const visible = await projectService.listForUser(organization._id, outsider._id);
  assert.equal(visible.length, 0);
  await assert.rejects(taskService.loadForRead(task._id, organization._id, outsider._id));
});

test('public project: everyone can read, only members can change tickets', async () => {
  const { organization, users, home } = await setup();
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  const task = await makeTask(organization, home, users[0], 'public', project);
  const outsider = users[2];
  await assert.doesNotReject(taskService.loadForRead(task._id, organization._id, outsider._id));
  await assert.rejects(
    taskService.loadForWrite(task._id, organization._id, outsider._id),
    /Join the project/,
  );
});

test('linked channel members are project members and assignable', async () => {
  const { organization, users, home } = await setup();
  const design = await createChannel(organization, users[0], [users[0], users[2]]);
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
    linkedChannelIds: [String(design._id)],
  });
  assert.equal(await projectService.isMember(project, users[2]._id), true);
  const task = await makeTask(organization, home, users[0], 'linked', project, [users[2]]);
  assert.equal(task.assignees.length, 1);
});

test('leaving one channel keeps project assignments while still a member elsewhere', async () => {
  const { organization, users, home } = await setup();
  const design = await createChannel(organization, users[0], [users[0], users[1]]);
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
    linkedChannelIds: [String(design._id)],
  });
  const task = await makeTask(organization, home, users[0], 'stay', project, [users[1]]);

  await removeFromChannel(design, users[1]);
  await taskService.unassignFromChannel(design._id, users[1]._id);
  assert.equal((await Task.findById(task._id)).assignees.length, 1, 'still in home channel');

  await removeFromChannel(home, users[1]);
  await taskService.unassignFromChannel(home._id, users[1]._id);
  assert.equal((await Task.findById(task._id)).assignees.length, 0, 'left the project');
});

test('the project lead must be a member', async () => {
  const { organization, users, home } = await setup();
  await assert.rejects(
    create(organization, users[0], OWNER, {
      name: 'Website',
      key: 'WEB',
      homeChannelId: String(home._id),
      leadId: String(users[2]._id),
    }),
    /lead must be a member/,
  );
});

// ---- read-only, delete, feature switch ------------------------------------

test('archived projects are read-only', async () => {
  const { organization, users, home } = await setup();
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  const task = await makeTask(organization, home, users[0], 'frozen', project);
  await projectService.archiveProject(project, users[0]._id, OWNER);
  await assert.rejects(
    taskService.loadForWrite(task._id, organization._id, users[0]._id),
    /read-only/,
  );
  await assert.rejects(
    projectService.updateProject(project, users[0]._id, OWNER, { name: 'x' }),
    /Restore the project/,
  );
});

test('only admins can delete, with the key typed; tickets go back to TASK-n', async () => {
  const { organization, users, home } = await setup();
  await setChannelRole(home, users[1], 'MODERATOR');
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
  });
  const task = await makeTask(organization, home, users[0], 'kept', project);
  await assert.rejects(projectService.deleteProject(project, MEMBER, 'WEB'), /owners and admins/);
  await assert.rejects(projectService.deleteProject(project, OWNER, 'WRONG'), /Type WEB/);
  assert.deepEqual(await projectService.deleteProject(project, OWNER, 'web'), {
    released: 1,
    deleted: 0,
  });

  const after = await Task.findById(task._id);
  assert.equal(after.project, null);
  assert.equal(after.projectKey, 'TASK');
  const viaOldKey = await projectService.resolveTaskKey(organization._id, 'WEB-1');
  assert.equal(String(viaOldKey._id), String(task._id));
});

test('with Projects switched off, channels never resolve to a project', async () => {
  const { organization, users } = await createWorkspace({ members: 2, projects: false });
  const home = await createChannel(organization, users[0], users);
  assert.equal(await projectService.projectForChannel(organization._id, home._id), null);
});

test('the assignee list for a project channel is every project member', async () => {
  const { organization, users, home } = await setup({ members: 4 });
  const design = await createChannel(organization, users[0], [users[0], users[2]]);
  const { project } = await create(organization, users[0], OWNER, {
    name: 'Website',
    key: 'WEB',
    homeChannelId: String(home._id),
    linkedChannelIds: [String(design._id)],
  });
  const list = await taskService.listAssignableUsers(
    organization._id,
    { channel: String(home._id) },
    project,
  );
  const ids = list.map((user) => String(user.id)).sort();
  assert.deepEqual(ids, [users[0], users[1], users[2]].map((u) => String(u._id)).sort());
  assert.ok(!ids.includes(String(users[3]._id)), 'outsiders are not offered');
});
