const mongoose = require('mongoose');
const Project = require('../models/project.model');
const Task = require('../models/task.model');
const Message = require('../models/message.model');
const Channel = require('../models/channel.model');
const ChannelMember = require('../models/channelMember.model');
const Organization = require('../models/organization.model');
const OrganizationMember = require('../models/organizationMember.model');
const { AppError } = require('../utils/AppError');
const { assertString, toOptionalString } = require('../utils/validation');
const {
  PROJECT_STATUS,
  PROJECT_UPDATES,
  CHAT_TASK_KEY,
  CHANNEL_STATUS,
  CHANNEL_TYPES,
  CHANNEL_ROLES,
  CHANNEL_MEMBER_STATUS,
  ORG_ROLES,
  MEMBER_STATUS,
  PROJECT_VISIBILITY,
} = require('../config/constants');
const { toPublicUser } = require('./user.service');

const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;
const NAME_MAX = 80;
const ADMIN_ROLES = [ORG_ROLES.OWNER, ORG_ROLES.ADMIN];
const activeMember = { status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED } };

const idOf = (value) => String(value?._id ?? value);
const isAdmin = (orgRole) => ADMIN_ROLES.includes(orgRole);

const toPublicProject = (project, extra = {}) => ({
  id: String(project._id),
  key: project.key,
  name: project.name,
  description: project.description,
  homeChannelId: project.homeChannel ? idOf(project.homeChannel) : null,
  visibility: project.visibility || PROJECT_VISIBILITY.PRIVATE,
  // People added directly (private projects; empty for public ones).
  memberIds: (project.members || []).map(idOf),
  linkedChannelIds: (project.linkedChannels || []).map(idOf),
  lead:
    project.lead && project.lead.fullName ? toPublicUser(project.lead) : { id: idOf(project.lead) },
  updates: project.updates,
  status: project.status,
  archivedAt: project.archivedAt,
  createdAt: project.createdAt,
  ...extra,
});

// ---- validation -----------------------------------------------------------

const assertKey = (value) => {
  const key = String(value || '')
    .trim()
    .toUpperCase();
  if (!KEY_PATTERN.test(key)) {
    throw new AppError(400, 'Project key must be 2-6 letters or digits and start with a letter');
  }
  if (key === CHAT_TASK_KEY) {
    throw new AppError(400, `${CHAT_TASK_KEY} is reserved`);
  }
  return key;
};

const assertName = (value) => {
  const name = assertString(value, 'Project name');
  if (name.length > NAME_MAX) {
    throw new AppError(400, `Project name must be at most ${NAME_MAX} characters`);
  }
  return name;
};

// A key is taken if any project in the workspace uses it now or used it
// before a rename (old WEB-12 links must keep pointing at the right ticket).
const assertKeyFree = async (organizationId, key, exceptProjectId = null) => {
  const clash = await Project.exists({
    organization: organizationId,
    _id: { $ne: exceptProjectId },
    $or: [{ key }, { formerKeys: key }],
  });
  if (clash) {
    throw new AppError(409, `The key ${key} is already used in this workspace`);
  }
};

const loadChannel = async (organizationId, channelId) => {
  if (!mongoose.isValidObjectId(channelId)) {
    throw new AppError(400, 'Invalid channel');
  }
  const channel = await Channel.findOne({ _id: channelId, organization: organizationId });
  if (!channel) {
    throw new AppError(404, 'Channel not found');
  }
  return channel;
};

// ---- membership & permissions ---------------------------------------------

const channelIdsOf = (project) =>
  [project.homeChannel, ...(project.linkedChannels || [])].filter(Boolean).map(idOf);

const directIds = (project) => (project.members || []).map(idOf);

// Direct members only count while they are active in the workspace.
const activeInWorkspace = async (organizationId, userIds) => {
  if (!userIds.length) {
    return new Set();
  }
  const rows = await OrganizationMember.find({
    organization: organizationId,
    user: { $in: userIds },
    status: MEMBER_STATUS.ACTIVE,
  }).select('user');
  return new Set(rows.map((row) => String(row.user)));
};

/**
 * Member = added directly (and still active in the workspace), or an active
 * member of the home channel / a linked channel. Either way is enough.
 */
const isPublic = (project) => project.visibility === PROJECT_VISIBILITY.PUBLIC;

const isMember = async (project, userId) => {
  if (isPublic(project)) {
    return (await activeInWorkspace(project.organization, [String(userId)])).size > 0;
  }
  if (directIds(project).includes(String(userId))) {
    const active = await activeInWorkspace(project.organization, [String(userId)]);
    if (active.size) {
      return true;
    }
  }
  const channels = channelIdsOf(project);
  return Boolean(
    channels.length &&
    (await ChannelMember.exists({ channel: { $in: channels }, user: userId, ...activeMember })),
  );
};

const memberIds = async (project) => {
  if (isPublic(project)) {
    const rows = await OrganizationMember.find({
      organization: project.organization,
      status: MEMBER_STATUS.ACTIVE,
    }).select('user');
    return new Set(rows.map((row) => String(row.user)));
  }
  const channels = channelIdsOf(project);
  const rows = channels.length
    ? await ChannelMember.find({ channel: { $in: channels }, ...activeMember }).select('user')
    : [];
  const direct = await activeInWorkspace(project.organization, directIds(project));
  return new Set([...rows.map((row) => String(row.user)), ...direct]);
};

const isHomeModerator = async (project, userId) =>
  Boolean(
    project.homeChannel &&
    (await ChannelMember.exists({
      channel: project.homeChannel,
      user: userId,
      role: CHANNEL_ROLES.MODERATOR,
      ...activeMember,
    })),
  );

/** Lead, workspace owners/admins and home-channel moderators manage a project. */
const canManage = async (project, userId, orgRole) =>
  idOf(project.lead) === String(userId) ||
  isAdmin(orgRole) ||
  (await isHomeModerator(project, userId));

const assertCanManage = async (project, userId, orgRole) => {
  if (!(await canManage(project, userId, orgRole))) {
    throw new AppError(
      403,
      'Only the project lead, a moderator or an admin can change this project',
    );
  }
};

// Read-only when archived, or when its home channel was archived.
const isReadOnly = async (project) => {
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    return true;
  }
  if (!project.homeChannel) {
    return false;
  }
  const home = await Channel.findById(project.homeChannel).select('status');
  return !home || home.status === CHANNEL_STATUS.ARCHIVED;
};

/**
 * Visible = member, or the home channel is public (public channels are
 * readable by every workspace member anyway). A project without a channel is
 * private to its members. Private projects never leak.
 */
const canSee = async (project, userId) => {
  if (await isMember(project, userId)) {
    return true;
  }
  if (!project.homeChannel) {
    return false;
  }
  const home = await Channel.findById(project.homeChannel).select('type');
  return Boolean(home && home.type === CHANNEL_TYPES.PUBLIC);
};

const assertCanRead = async (project, userId) => {
  if (!(await canSee(project, userId))) {
    throw new AppError(404, 'Project not found');
  }
};

const assertCanWrite = async (project, userId) => {
  if (!(await isMember(project, userId))) {
    throw new AppError(
      403,
      project.homeChannel
        ? 'Join the project’s channel to change its tickets'
        : 'Only project members can change its tickets',
    );
  }
  if (await isReadOnly(project)) {
    throw new AppError(409, 'This project is read-only (archived)');
  }
};

// ---- lookup ---------------------------------------------------------------

const projectsEnabled = async (organizationId) => {
  const organization = await Organization.findById(organizationId).select('settings');
  return Boolean(organization?.settings?.projectsEnabled);
};

/** The active project a channel belongs to (home or linked), if Projects is on. */
const projectForChannel = async (organizationId, channelId) => {
  if (!channelId || !(await projectsEnabled(organizationId))) {
    return null;
  }
  const projects = await Project.find({
    organization: organizationId,
    status: PROJECT_STATUS.ACTIVE,
    $or: [{ homeChannel: channelId }, { linkedChannels: channelId }],
  });
  // Home wins over linked when a channel is both.
  return projects.find((p) => idOf(p.homeChannel) === String(channelId)) || projects[0] || null;
};

const findById = (organizationId, id) =>
  mongoose.isValidObjectId(id)
    ? Project.findOne({ _id: id, organization: organizationId }).populate('lead')
    : null;

/** By current key, or by a key the project had before a rename. */
const findByKey = (organizationId, key) => {
  const upper = String(key || '').toUpperCase();
  return Project.findOne({
    organization: organizationId,
    $or: [{ key: upper }, { formerKeys: upper }],
  }).populate('lead');
};

const listForUser = async (organizationId, userId, { archived = false } = {}) => {
  const projects = await Project.find({
    organization: organizationId,
    status: archived ? PROJECT_STATUS.ARCHIVED : PROJECT_STATUS.ACTIVE,
  })
    .populate('lead')
    .sort({ name: 1 });
  const visible = [];
  for (const project of projects) {
    if (await canSee(project, userId)) {
      visible.push(project);
    }
  }
  return visible;
};

const countsFor = async (projectIds) => {
  const rows = await Task.aggregate([
    { $match: { project: { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    {
      $group: {
        _id: '$project',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), { total: row.total, done: row.done }]));
};

// ---- create / update ------------------------------------------------------

const assertHomeAvailable = async (organizationId, channel, exceptProjectId = null) => {
  if (channel.status === CHANNEL_STATUS.ARCHIVED) {
    throw new AppError(409, 'An archived channel cannot be a project’s home');
  }
  const taken = await Project.exists({
    organization: organizationId,
    homeChannel: channel._id,
    status: PROJECT_STATUS.ACTIVE,
    _id: { $ne: exceptProjectId },
  });
  if (taken) {
    throw new AppError(409, `#${channel.name} is already the home of another project`);
  }
};

const assertLinked = async (organizationId, value, homeChannelId) => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, 'Linked channels must be a list');
  }
  const ids = [...new Set(value.map(String))].filter((id) => id !== String(homeChannelId));
  for (const id of ids) {
    const channel = await loadChannel(organizationId, id);
    if (channel.status === CHANNEL_STATUS.ARCHIVED) {
      throw new AppError(409, `#${channel.name} is archived`);
    }
  }
  return ids;
};

const assertVisibility = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (!Object.values(PROJECT_VISIBILITY).includes(value)) {
    throw new AppError(400, 'Visibility must be PUBLIC or PRIVATE');
  }
  return value;
};

// People added directly must be active members of the workspace.
const assertMembers = async (organizationId, value) => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AppError(400, 'Members must be a list');
  }
  const ids = [...new Set(value.map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw new AppError(400, 'Invalid member');
  }
  const active = await activeInWorkspace(organizationId, ids);
  if (ids.some((id) => !active.has(id))) {
    throw new AppError(400, 'Members must be active people in this workspace');
  }
  return ids;
};

// Who may make a channel the home: workspace admins, or its moderators.
const assertCanUseAsHome = async (channel, userId, orgRole) => {
  if (isAdmin(orgRole)) {
    return;
  }
  const moderator = await ChannelMember.exists({
    channel: channel._id,
    user: userId,
    role: CHANNEL_ROLES.MODERATOR,
    ...activeMember,
  });
  if (!moderator) {
    throw new AppError(
      403,
      'Only workspace admins or the channel’s moderators can make it a project’s home',
    );
  }
};

const assertLead = async (project, leadId) => {
  if (!mongoose.isValidObjectId(leadId)) {
    throw new AppError(400, 'Invalid project lead');
  }
  if (!(await isMember(project, leadId))) {
    throw new AppError(400, 'The project lead must be a member of the project');
  }
  return leadId;
};

/**
 * Renumbers the home channel's chat tasks (TASK-n) into the project
 * (WEB-1, WEB-2, ...). The old key is kept as an alias. Only that channel's
 * tasks move: DM tasks and other channels' tasks are never touched.
 */
const adoptChannelTasks = async (project) => {
  if (!project.homeChannel) {
    return 0;
  }
  const tasks = await Task.find({
    organization: project.organization,
    channel: project.homeChannel,
    project: null,
  }).sort({ number: 1 });
  for (const task of tasks) {
    const numbered = await Project.findByIdAndUpdate(
      project._id,
      { $inc: { seq: 1 } },
      { new: true, projection: { seq: 1 } },
    );
    await Task.updateOne(
      { _id: task._id, project: null },
      {
        $set: { project: project._id, projectKey: project.key, number: numbered.seq },
        $addToSet: { formerKeys: `${task.projectKey}-${task.number}` },
      },
    );
  }
  return tasks.length;
};

/**
 * Members come from a home channel, people added directly, or both.
 *   With a channel: workspace admins or that channel's moderators create it.
 *   Without one (private to its members): anyone in the workspace; the
 *   creator is always a member.
 * Returns { project, adopted } (number of the channel's tasks moved in).
 */
const createProject = async (organizationId, actor, orgRole, payload = {}) => {
  const name = assertName(payload.name);
  const key = assertKey(payload.key);
  const home = payload.homeChannelId
    ? await loadChannel(organizationId, payload.homeChannelId)
    : null;

  if (home) {
    await assertCanUseAsHome(home, actor._id, orgRole);
    await assertHomeAvailable(organizationId, home);
  }
  await assertKeyFree(organizationId, key);
  const linkedChannels =
    (await assertLinked(organizationId, payload.linkedChannelIds, home?._id)) || [];
  const visibility = assertVisibility(payload.visibility) || PROJECT_VISIBILITY.PRIVATE;
  const listed = (await assertMembers(organizationId, payload.memberIds)) || [];
  // Public: the whole workspace, no list. Private without a channel: the
  // creator must be on the list, or nobody could open it.
  const members =
    visibility === PROJECT_VISIBILITY.PUBLIC
      ? []
      : home
        ? listed
        : [...new Set([String(actor._id), ...listed])];

  const draft = {
    organization: organizationId,
    homeChannel: home ? home._id : null,
    linkedChannels,
    visibility,
    members,
  };
  const lead = await assertLead(draft, payload.leadId || actor._id);

  let project;
  try {
    project = await Project.create({
      ...draft,
      key,
      name,
      description: toOptionalString(payload.description),
      lead,
      createdBy: actor._id,
    });
  } catch (error) {
    // Unique indexes catch two people creating the same key / home at once.
    if (error.code === 11000) {
      throw new AppError(409, 'That key or home channel was just taken, try another');
    }
    throw error;
  }
  const adopted = payload.adoptTasks === false ? 0 : await adoptChannelTasks(project);
  await project.populate('lead');
  return { project, adopted };
};

/**
 * Settings. Membership can change through the people list, linked channels
 * and the home channel (set, change or remove). Returns lostMemberIds: people
 * who are no longer members at all, so the caller unassigns them.
 * Guards: the lead must stay a member (hand the lead over first), and a
 * project can't be left with nobody in it.
 */
const updateProject = async (current, actorId, orgRole, payload = {}) => {
  // Work on a fresh copy: a refused change must never leave a half-edited
  // document behind for a later attempt to build on.
  const project = await Project.findById(current._id);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  await assertCanManage(project, actorId, orgRole);
  if (project.status === PROJECT_STATUS.ARCHIVED) {
    throw new AppError(409, 'Restore the project before changing it');
  }
  const changes = [];
  const before = await memberIds(project);

  if (payload.name !== undefined) {
    project.name = assertName(payload.name);
    changes.push('name');
  }
  if (payload.description !== undefined) {
    project.description = toOptionalString(payload.description);
  }
  if (payload.updates !== undefined) {
    if (!Object.values(PROJECT_UPDATES).includes(payload.updates)) {
      throw new AppError(400, 'Invalid updates setting');
    }
    project.updates = payload.updates;
  }
  if (payload.homeChannelId !== undefined) {
    const nextHome = payload.homeChannelId || null;
    if (String(nextHome || '') !== String(project.homeChannel || '')) {
      if (nextHome) {
        const channel = await loadChannel(project.organization, nextHome);
        await assertCanUseAsHome(channel, actorId, orgRole);
        await assertHomeAvailable(project.organization, channel, project._id);
        project.homeChannel = channel._id;
      } else {
        project.homeChannel = null;
      }
      changes.push('home');
    }
  }
  if (payload.linkedChannelIds !== undefined) {
    project.linkedChannels = await assertLinked(
      project.organization,
      payload.linkedChannelIds,
      project.homeChannel,
    );
  }
  const visibility = assertVisibility(payload.visibility);
  if (visibility && visibility !== (project.visibility || PROJECT_VISIBILITY.PRIVATE)) {
    // Going private needs the people to keep; going public drops the list.
    if (visibility === PROJECT_VISIBILITY.PRIVATE && payload.memberIds === undefined) {
      throw new AppError(400, 'Pick the people who stay in the private project');
    }
    project.visibility = visibility;
    changes.push('visibility');
  }
  if (isPublic(project)) {
    project.members = [];
  } else if (payload.memberIds !== undefined) {
    project.members = await assertMembers(project.organization, payload.memberIds);
  }
  // A linked channel can't also be the home.
  project.linkedChannels = (project.linkedChannels || []).filter(
    (id) => String(id) !== String(project.homeChannel || ''),
  );

  const after = await memberIds(project);
  if (after.size === 0) {
    throw new AppError(400, 'A project needs at least one member');
  }
  if (payload.leadId !== undefined) {
    project.lead = await assertLead(project, payload.leadId);
  } else if (!after.has(idOf(project.lead))) {
    throw new AppError(
      400,
      'This change removes the project lead. Hand the lead to someone else first',
    );
  }

  let renamedFrom = null;
  if (payload.key !== undefined) {
    const key = assertKey(payload.key);
    if (key !== project.key) {
      // Reusing one of its own former keys is fine; other projects' are not.
      await assertKeyFree(project.organization, key, project._id);
      renamedFrom = project.key;
      project.formerKeys = [...new Set([...project.formerKeys, project.key])].filter(
        (k) => k !== key,
      );
      project.key = key;
    }
  }

  try {
    await project.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'That channel is already the home of another project');
    }
    throw error;
  }
  if (renamedFrom) {
    await Task.updateMany({ project: project._id }, { $set: { projectKey: project.key } });
  }
  await project.populate('lead');
  const lostMemberIds = [...before].filter((id) => !after.has(id));
  return { project, renamedFrom, changes, lostMemberIds };
};

const archiveProject = async (project, actorId, orgRole) => {
  await assertCanManage(project, actorId, orgRole);
  project.status = PROJECT_STATUS.ARCHIVED;
  project.archivedAt = new Date();
  await project.save();
  return project;
};

const restoreProject = async (project, actorId, orgRole) => {
  await assertCanManage(project, actorId, orgRole);
  if (project.homeChannel) {
    const home = await Channel.findById(project.homeChannel);
    if (!home) {
      throw new AppError(409, 'The home channel no longer exists. Remove or change it first');
    }
    await assertHomeAvailable(project.organization, home, project._id);
  }
  if ((await memberIds(project)).size === 0) {
    throw new AppError(409, 'The project has no members left. Add people first');
  }
  project.status = PROJECT_STATUS.ACTIVE;
  project.archivedAt = null;
  await project.save();
  return project;
};

/**
 * Admins only; the key must be typed to confirm.
 *   Tickets that live in a channel go back to it as chat tasks (TASK-n), the
 *   project key kept as an alias.
 *   Tickets of a project without a channel have nowhere to go: they are
 *   deleted with it (the UI says how many).
 * Returns { released, deleted }.
 */
const deleteProject = async (project, orgRole, confirmKey) => {
  if (!isAdmin(orgRole)) {
    throw new AppError(403, 'Only workspace owners and admins can delete a project');
  }
  if (String(confirmKey || '').toUpperCase() !== project.key) {
    throw new AppError(400, `Type ${project.key} to confirm`);
  }
  const tasks = await Task.find({ project: project._id }).sort({ number: 1 });
  let released = 0;
  let deleted = 0;
  for (const task of tasks) {
    if (!task.channel && !task.conversation) {
      await Message.updateMany(
        { $or: [{ _id: task.message }, { parentMessageId: task.message }] },
        { $set: { deletedAt: new Date() } },
      );
      if (task.sourceMessage) {
        await Message.updateOne({ _id: task.sourceMessage }, { $set: { taskRef: null } });
      }
      await task.deleteOne();
      deleted += 1;
      continue;
    }
    const organization = await Organization.findByIdAndUpdate(
      project.organization,
      { $inc: { taskSeq: 1 } },
      { new: true, projection: { taskSeq: 1 } },
    );
    await Task.updateOne(
      { _id: task._id },
      {
        $set: { project: null, projectKey: CHAT_TASK_KEY, number: organization.taskSeq },
        $addToSet: { formerKeys: `${task.projectKey}-${task.number}` },
      },
    );
    released += 1;
  }
  await project.deleteOne();
  return { released, deleted };
};

const countChannelFreeTickets = (project) =>
  Task.countDocuments({ project: project._id, channel: null, conversation: null });

/**
 * Someone left / was removed from the workspace: drop them from every
 * project's people list. Projects they led get another member as lead, or
 * are archived when nobody is left (never left without an owner).
 */
const handleUserLeftWorkspace = async (organizationId, userId) => {
  await Project.updateMany(
    { organization: organizationId, members: userId },
    { $pull: { members: userId } },
  );
  const led = await Project.find({ organization: organizationId, lead: userId });
  for (const project of led) {
    const others = [...(await memberIds(project))].filter((id) => id !== String(userId));
    if (others.length) {
      project.lead = others[0];
    } else {
      project.status = PROJECT_STATUS.ARCHIVED;
      project.archivedAt = new Date();
    }
    await project.save();
  }
};

/** Projects the user is a member of (for search and similar lookups). */
const projectIdsForUser = async (organizationId, userId) => {
  const memberships = await ChannelMember.find({ user: userId, ...activeMember }).select('channel');
  const channelIds = memberships.map((row) => row.channel);
  const projects = await Project.find({
    organization: organizationId,
    $or: [
      { visibility: PROJECT_VISIBILITY.PUBLIC },
      { members: userId },
      { homeChannel: { $in: channelIds } },
      { linkedChannels: { $in: channelIds } },
    ],
  }).select('_id');
  return projects.map((project) => project._id);
};

// ---- ticket keys ----------------------------------------------------------

/**
 * Resolves "WEB-12" to a task (or null). Checks, in order: the project's
 * current key, a project's former key (rename), then any ticket's former key
 * (moved between projects / adopted from TASK-n). Access is the caller's job.
 */
const resolveTaskKey = async (organizationId, rawKey) => {
  const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d+)$/.exec(String(rawKey || '').trim());
  if (!match) {
    return null;
  }
  const prefix = match[1].toUpperCase();
  const number = Number(match[2]);
  const key = `${prefix}-${number}`;

  if (prefix === CHAT_TASK_KEY) {
    const task = await Task.findOne({ organization: organizationId, projectKey: prefix, number });
    if (task) {
      return task;
    }
  } else {
    const project = await findByKey(organizationId, prefix);
    if (project) {
      const task = await Task.findOne({ project: project._id, number });
      if (task) {
        return task;
      }
    }
  }
  return Task.findOne({ organization: organizationId, formerKeys: key });
};

module.exports = {
  KEY_PATTERN,
  toPublicProject,
  assertKey,
  isMember,
  memberIds,
  isPublic,
  canManage,
  canSee,
  isReadOnly,
  assertCanRead,
  assertCanWrite,
  projectsEnabled,
  projectForChannel,
  findById,
  findByKey,
  listForUser,
  countsFor,
  createProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject,
  adoptChannelTasks,
  resolveTaskKey,
  handleUserLeftWorkspace,
  projectIdsForUser,
  countChannelFreeTickets,
};
