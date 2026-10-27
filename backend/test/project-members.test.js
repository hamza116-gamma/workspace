const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connect, disconnect } = require('./helpers/db');
const { createWorkspace, createChannel, removeFromChannel } = require('./helpers/fixtures');
const projectService = require('../src/services/project.service');
const taskService = require('../src/services/task.service');
const messageService = require('../src/services/message.service');
const searchService = require('../src/services/search.service');
const { removeChannelMemberships } = require('../src/services/memberCleanup.service');
const OrganizationMember = require('../src/models/organizationMember.model');
const Task = require('../src/models/task.model');

before(connect);
after(disconnect);

const OWNER = 'OWNER';
const MEMBER = 'MEMBER';
const ids = (users) => users.map((u) => String(u._id));

// users[0] owner, the rest members.
const setup = async (count = 5) => createWorkspace({ members: count, projects: true });

const ticket = async (organization, project, actor, title, assignees = []) => {
  const fields = await taskService.prepareFields(
    organization._id,
    {},
    { assignees: ids(assignees) },
    title,
    project,
  );
  return taskService.createTicket({ organizationId: organization._id, actor, fields, project });
};

const channelFree = async (organization, owner, members, extra = {}) =>
  (
    await projectService.createProject(organization._id, owner, OWNER, {
      name: 'Secret',
      key: 'SEC',
      memberIds: ids(members),
      ...extra,
    })
  ).project;

// ---- projects without a channel ------------------------------------------

test('only owners, admins or moderators create a project without a channel', async () => {
  const { organization, users } = await setup();
  await assert.rejects(
    projectService.createProject(organization._id, users[1], MEMBER, { name: 'X', key: 'XX' }),
    /without a channel/,
  );
  const { project } = await projectService.createProject(organization._id, users[1], 'MODERATOR', {
    name: 'Mod project',
    key: 'MOD',
  });
  assert.equal(project.homeChannel, null);
  assert.deepEqual(project.members.map(String), [String(users[1]._id)], 'creator is a member');
});

test('a project without a channel is private to its listed members', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[1]]);
  assert.equal(await projectService.canSee(project, users[1]._id), true);
  assert.equal(await projectService.canSee(project, users[2]._id), false);
  const listed = await projectService.listForUser(organization._id, users[2]._id);
  assert.equal(listed.length, 0);
});

test('tickets, comments and search work without a channel; outsiders see nothing', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[1]]);
  const task = await ticket(organization, project, users[0], 'Rotate API keys', [users[1]]);
  assert.equal(task.channel, null);
  assert.equal(task.key ?? `${task.projectKey}-${task.number}`, 'SEC-1');

  const comment = await messageService.createMessage({ organization: organization._id }, users[1], {
    content: 'Done for staging',
    parentMessageId: String(task.message),
  });
  assert.equal(comment.ticketThread, true);
  assert.equal(String(comment.project), String(project._id));
  const note = await taskService.postActivity(task, users[0]._id, 'moved this to Done');
  assert.equal(String(note.project), String(project._id));

  await assert.rejects(taskService.loadForRead(task._id, organization._id, users[2]._id));
  await assert.rejects(
    messageService.createMessage({ organization: organization._id }, users[2], {
      content: 'sneaky',
      parentMessageId: String(task.message),
    }),
  );

  const find = (user) =>
    searchService.search({
      organizationId: organization._id,
      userId: user._id,
      q: 'Rotate',
      type: 'tasks',
    });
  assert.equal((await find(users[1])).tasks.items.length, 1, 'member finds it');
  assert.equal((await find(users[2])).tasks.items.length, 0, 'outsider does not');
});

// ---- people + channel ------------------------------------------------------

test('people added directly are members even when not in the channel', async () => {
  const { organization, users } = await setup();
  const home = await createChannel(organization, users[0], [users[0], users[1]], {
    type: 'PRIVATE',
  });
  const { project } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Both',
    key: 'BTH',
    homeChannelId: String(home._id),
    memberIds: ids([users[3]]),
  });
  assert.equal(await projectService.isMember(project, users[3]._id), true);
  const task = await ticket(organization, project, users[0], 'Shared', [users[3]]);
  assert.equal(task.assignees.length, 1, 'a direct member can be assigned');

  // A direct member who is ALSO in the channel keeps tickets after leaving it.
  await removeFromChannel(home, users[1]);
  await taskService.unassignFromChannel(home._id, users[1]._id);
  assert.equal(await projectService.isMember(project, users[1]._id), false);
});

test('removing someone from the people list reports them so they get unassigned', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[1], users[2]]);
  const task = await ticket(organization, project, users[0], 'Audit', [users[2]]);
  const { lostMemberIds } = await projectService.updateProject(project, users[0]._id, OWNER, {
    memberIds: ids([users[0], users[1]]),
  });
  assert.deepEqual(lostMemberIds, [String(users[2]._id)]);
  await taskService.unassignFromProject(project._id, users[2]._id);
  assert.equal((await Task.findById(task._id)).assignees.length, 0);
});

test('the lead cannot be removed by accident; handing over first works', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[1]]);
  await assert.rejects(
    projectService.updateProject(project, users[0]._id, OWNER, { memberIds: ids([users[1]]) }),
    /Hand the lead/,
  );
  const { project: next } = await projectService.updateProject(project, users[0]._id, OWNER, {
    memberIds: ids([users[1]]),
    leadId: String(users[1]._id),
  });
  assert.equal(String(next.lead._id), String(users[1]._id));
});

test('a project is never left with nobody in it', async () => {
  const { organization, users } = await setup();
  const home = await createChannel(organization, users[0], [users[0], users[1]]);
  const { project } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Home only',
    key: 'HOM',
    homeChannelId: String(home._id),
  });
  // Removing the only source of members (the channel) is refused.
  await assert.rejects(
    projectService.updateProject(project, users[0]._id, OWNER, { homeChannelId: '' }),
    /at least one member|Hand the lead/,
  );
  // With people added first, the channel can go; channel-only people are lost.
  const { lostMemberIds, project: next } = await projectService.updateProject(
    project,
    users[0]._id,
    OWNER,
    { homeChannelId: '', memberIds: ids([users[0]]) },
  );
  assert.equal(next.homeChannel, null);
  assert.deepEqual(lostMemberIds, [String(users[1]._id)]);
});

test('changing the home channel needs rights on the new channel and frees the old one', async () => {
  const { organization, users } = await setup();
  const a = await createChannel(organization, users[0], [users[0], users[1]]);
  const b = await createChannel(organization, users[0], [users[0], users[2]]);
  const { project } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Move',
    key: 'MOV',
    homeChannelId: String(a._id),
  });
  // A plain member cannot make another channel the home.
  await assert.rejects(
    projectService.updateProject(project, users[1]._id, MEMBER, { homeChannelId: String(b._id) }),
  );
  const { project: moved, lostMemberIds } = await projectService.updateProject(
    project,
    users[0]._id,
    OWNER,
    { homeChannelId: String(b._id) },
  );
  assert.equal(String(moved.homeChannel), String(b._id));
  assert.deepEqual(lostMemberIds, [String(users[1]._id)]);
  // The old channel can host another project now.
  await assert.doesNotReject(
    projectService.createProject(organization._id, users[0], OWNER, {
      name: 'Next',
      key: 'NXT',
      homeChannelId: String(a._id),
    }),
  );
});

// ---- leaving the workspace -------------------------------------------------

test('when the lead leaves the workspace another member becomes lead', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[1]], {
    leadId: String(users[1]._id),
  });
  await OrganizationMember.deleteOne({ organization: organization._id, user: users[1]._id });
  await removeChannelMemberships(organization._id, users[1]._id);
  const after = await projectService.findById(organization._id, project._id);
  assert.equal(String(after.lead._id), String(users[0]._id));
  assert.ok(!after.members.map(String).includes(String(users[1]._id)));
  assert.equal(after.status, 'ACTIVE');
});

test('when the only member leaves, the project is archived, not orphaned', async () => {
  const { organization, users } = await setup();
  const { project } = await projectService.createProject(organization._id, users[1], 'MODERATOR', {
    name: 'Solo',
    key: 'SOL',
  });
  await OrganizationMember.deleteOne({ organization: organization._id, user: users[1]._id });
  await removeChannelMemberships(organization._id, users[1]._id);
  const after = await projectService.findById(organization._id, project._id);
  assert.equal(after.status, 'ARCHIVED');
  await assert.rejects(
    projectService.restoreProject(after, users[0]._id, OWNER),
    /no members left/,
  );
});

test('deactivated people stop counting as direct members', async () => {
  const { organization, users } = await setup();
  const project = await channelFree(organization, users[0], [users[2]]);
  await OrganizationMember.updateOne(
    { organization: organization._id, user: users[2]._id },
    { $set: { status: 'DISABLED' } },
  );
  assert.equal(await projectService.isMember(project, users[2]._id), false);
});

// ---- delete ----------------------------------------------------------------

test('deleting a channel-free project deletes its tickets; with a channel they are kept', async () => {
  const { organization, users } = await setup();
  const free = await channelFree(organization, users[0], [users[1]]);
  await ticket(organization, free, users[0], 'one');
  await ticket(organization, free, users[0], 'two');
  assert.equal(await projectService.countChannelFreeTickets(free), 2);
  assert.deepEqual(await projectService.deleteProject(free, OWNER, 'SEC'), {
    released: 0,
    deleted: 2,
  });
  assert.equal(await Task.countDocuments({ project: free._id }), 0);

  const home = await createChannel(organization, users[0], [users[0]]);
  const { project: homed } = await projectService.createProject(organization._id, users[0], OWNER, {
    name: 'Kept',
    key: 'KEP',
    homeChannelId: String(home._id),
  });
  await ticket(organization, homed, users[0], 'kept');
  assert.deepEqual(await projectService.deleteProject(homed, OWNER, 'KEP'), {
    released: 1,
    deleted: 0,
  });
});
