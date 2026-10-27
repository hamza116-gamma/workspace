const mongoose = require('mongoose');
const Task = require('../models/task.model');
const Message = require('../models/message.model');
const Organization = require('../models/organization.model');
const ChannelMember = require('../models/channelMember.model');
const Conversation = require('../models/conversation.model');
const { TASK_TITLE_MAX, TASK_DESCRIPTION_MAX, TASK_LABELS_MAX } = require('../models/task.model');
const { AppError } = require('../utils/AppError');
const { TASK_STATUS, TASK_PRIORITY, CHANNEL_MEMBER_STATUS } = require('../config/constants');
const { toPublicUser } = require('./user.service');
const channelService = require('./channel.service');
const conversationService = require('./conversation.service');
const projectService = require('./project.service');
const Project = require('../models/project.model');
const User = require('../models/user.model');

const LABEL_MAX = 30;
const LIST_LIMIT = 200;

const STATUS_LABELS = {
  [TASK_STATUS.TODO]: 'To do',
  [TASK_STATUS.IN_PROGRESS]: 'In progress',
  [TASK_STATUS.IN_REVIEW]: 'In review',
  [TASK_STATUS.DONE]: 'Done',
};

const idOf = (value) => String(value?._id ?? value);

const toPublicTask = (task) => ({
  id: String(task._id),
  key: `${task.projectKey || 'TASK'}-${task.number}`,
  number: task.number,
  projectId: task.project ? idOf(task.project) : null,
  projectKey: task.projectKey || 'TASK',
  channelId: task.channel ? idOf(task.channel) : null,
  conversationId: task.conversation ? idOf(task.conversation) : null,
  messageId: idOf(task.message),
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  assignees: (task.assignees || []).map((user) =>
    user && user.fullName ? toPublicUser(user) : { id: idOf(user) },
  ),
  dueDate: task.dueDate,
  labels: task.labels || [],
  position: task.position || 0,
  createdBy:
    task.createdBy && task.createdBy.fullName
      ? toPublicUser(task.createdBy)
      : { id: idOf(task.createdBy) },
  closedAt: task.closedAt,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

const populate = (query) => query.populate('assignees').populate('createdBy');

// ---- validation -----------------------------------------------------------

const assertTitle = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, 'Task title is required');
  }
  const title = value.trim();
  if (title.length > TASK_TITLE_MAX) {
    throw new AppError(400, `Task title must be at most ${TASK_TITLE_MAX} characters`);
  }
  return title;
};

const assertDescription = (value) => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new AppError(400, 'Task description must be text');
  }
  const description = value.trim();
  if (description.length > TASK_DESCRIPTION_MAX) {
    throw new AppError(400, `Description must be at most ${TASK_DESCRIPTION_MAX} characters`);
  }
  return description;
};

const assertEnum = (value, allowed, field) => {
  if (!Object.values(allowed).includes(value)) {
    throw new AppError(400, `Invalid ${field}`);
  }
  return value;
};

const assertDueDate = (value) => {
  if (value === null || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'Invalid due date');
  }
  return date;
};

const assertLabels = (value) => {
  if (!Array.isArray(value)) {
    throw new AppError(400, 'Labels must be a list');
  }
  const labels = [
    ...new Set(
      value
        .filter((label) => typeof label === 'string')
        .map((label) => label.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (labels.length > TASK_LABELS_MAX) {
    throw new AppError(400, `A task can have at most ${TASK_LABELS_MAX} labels`);
  }
  if (labels.some((label) => label.length > LABEL_MAX)) {
    throw new AppError(400, `Labels must be at most ${LABEL_MAX} characters`);
  }
  return labels;
};

// A title from the message text when converting a message without one.
const titleFromContent = (content) => {
  const firstLine = String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return '';
  }
  return firstLine.length > TASK_TITLE_MAX
    ? `${firstLine.slice(0, TASK_TITLE_MAX - 1)}…`
    : firstLine;
};

// ---- access ---------------------------------------------------------------

const targetOf = (doc) =>
  doc.channel ? { channel: idOf(doc.channel) } : { conversation: idOf(doc.conversation) };

// Same rule as writing a message there: active channel membership in a
// non-archived channel, or being a participant of the conversation.
const assertCanWriteTarget = async (organizationId, target, userId) => {
  if (target.channel) {
    await channelService.assertCanWriteById(target.channel, organizationId, userId);
    return;
  }
  const conversation = await conversationService.findByIdForOrg(
    target.conversation,
    organizationId,
  );
  if (!conversation || !conversationService.getParticipant(conversation, userId)) {
    throw new AppError(403, 'You are not part of this conversation');
  }
};

const assertCanReadTarget = async (organizationId, target, userId) => {
  if (target.channel) {
    await channelService.loadWithAccess(target.channel, organizationId, userId);
    return;
  }
  await assertCanWriteTarget(organizationId, target, userId);
};

// Assignees must already be in the chat: active channel members, or
// participants of the conversation. Anyone else is rejected (no leaks).
// Project tickets: members of the project (home + linked channels).
const assertAssignable = async (organizationId, target, value, project = null) => {
  if (!Array.isArray(value)) {
    throw new AppError(400, 'Assignees must be a list');
  }
  const ids = [...new Set(value.map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) {
    throw new AppError(400, 'Invalid assignee');
  }
  if (ids.length === 0) {
    return [];
  }
  let allowed;
  if (project) {
    allowed = await projectService.memberIds(project);
  } else if (target.channel) {
    const rows = await ChannelMember.find({
      channel: target.channel,
      user: { $in: ids },
      status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
    }).select('user');
    allowed = new Set(rows.map((row) => String(row.user)));
  } else {
    const conversation = await conversationService.findByIdForOrg(
      target.conversation,
      organizationId,
    );
    allowed = new Set(
      (conversation?.participants || []).map((participant) => idOf(participant.user)),
    );
  }
  if (ids.some((id) => !allowed.has(id))) {
    throw new AppError(
      400,
      project
        ? 'Tickets can only be assigned to members of the project'
        : 'Tasks can only be assigned to people in this conversation',
    );
  }
  return ids;
};

// Project tickets follow project membership (home + linked channels);
// chat tasks follow their channel / conversation.
const projectOf = (task) => (task.project ? Project.findById(task.project) : null);

const assertCanReadTask = async (task, userId) => {
  const project = await projectOf(task);
  if (project) {
    await projectService.assertCanRead(project, userId);
    return;
  }
  await assertCanReadTarget(task.organization, targetOf(task), userId);
};

const assertCanWriteTask = async (task, userId) => {
  const project = await projectOf(task);
  if (project) {
    await projectService.assertCanWrite(project, userId);
    return;
  }
  await assertCanWriteTarget(task.organization, targetOf(task), userId);
};

const findByIdForOrg = (id, organizationId) => {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  return populate(Task.findOne({ _id: id, organization: organizationId }));
};

const loadForRead = async (id, organizationId, userId) => {
  const task = await findByIdForOrg(id, organizationId);
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  await assertCanReadTask(task, userId);
  return task;
};

const loadForWrite = async (id, organizationId, userId) => {
  const task = await findByIdForOrg(id, organizationId);
  if (!task) {
    throw new AppError(404, 'Task not found');
  }
  await assertCanWriteTask(task, userId);
  return task;
};

// ---- create / update ------------------------------------------------------

// Per project (WEB-1, WEB-2...) or per workspace for chat tasks (TASK-n).
const nextNumber = async (organizationId, project = null) => {
  if (project) {
    const numbered = await Project.findByIdAndUpdate(
      project._id,
      { $inc: { seq: 1 } },
      { new: true, projection: { seq: 1 } },
    );
    return numbered.seq;
  }
  const organization = await Organization.findByIdAndUpdate(
    organizationId,
    { $inc: { taskSeq: 1 } },
    { new: true, projection: { taskSeq: 1 } },
  );
  if (!organization) {
    throw new AppError(404, 'Workspace not found');
  }
  return organization.taskSeq;
};

// The message must be a live top-level message in this workspace that is not
// already a task or a huddle card. Access is checked by the caller.
const assertConvertible = (message, organizationId) => {
  if (!message || message.deletedAt || idOf(message.organization) !== String(organizationId)) {
    throw new AppError(404, 'Message not found');
  }
  if (message.parentMessageId) {
    throw new AppError(400, 'Thread replies cannot become tasks');
  }
  if (message.huddle) {
    throw new AppError(400, 'Huddle cards cannot become tasks');
  }
  if (message.task) {
    throw new AppError(409, 'This message is already a task');
  }
};

// Validates create input up front, so a new task's card message is only
// posted once everything is known to be valid.
const prepareFields = async (
  organizationId,
  target,
  payload = {},
  fallbackTitle = '',
  project = null,
) => ({
  title: assertTitle(payload.title || fallbackTitle),
  description: assertDescription(payload.description),
  status: payload.status ? assertEnum(payload.status, TASK_STATUS, 'status') : TASK_STATUS.TODO,
  priority: payload.priority
    ? assertEnum(payload.priority, TASK_PRIORITY, 'priority')
    : TASK_PRIORITY.MEDIUM,
  assignees: await assertAssignable(organizationId, target, payload.assignees || [], project),
  dueDate: payload.dueDate ? assertDueDate(payload.dueDate) : null,
  labels: payload.labels ? assertLabels(payload.labels) : [],
});

/**
 * Turns a message into a task card (fields from prepareFields). The message
 * link is claimed atomically so two concurrent converts cannot both succeed.
 */
const createForMessage = async (organizationId, message, actor, fields, project = null) => {
  assertConvertible(message, organizationId);
  const target = targetOf(message);

  const taskId = new mongoose.Types.ObjectId();
  const claimed = await Message.updateOne(
    { _id: message._id, task: null, deletedAt: null },
    { $set: { task: taskId } },
  );
  if (claimed.modifiedCount === 0) {
    throw new AppError(409, 'This message is already a task');
  }

  try {
    const task = await Task.create({
      _id: taskId,
      organization: organizationId,
      ...target,
      message: message._id,
      project: project ? project._id : null,
      projectKey: project ? project.key : 'TASK',
      number: await nextNumber(organizationId, project),
      position: -Date.now(),
      ...fields,
      createdBy: actor._id,
      closedAt: fields.status === TASK_STATUS.DONE ? new Date() : null,
    });
    message.task = taskId;
    return populate(Task.findById(task._id));
  } catch (error) {
    await Message.updateOne({ _id: message._id, task: taskId }, { $set: { task: null } });
    throw error;
  }
};

// Server-written activity reply in the task thread ("moved this to Done").
// Like huddle cards it skips the send pipeline: no access re-check (cleanup
// notes are written for people who just lost access), mentions or drafts.
const postActivity = async (task, actorId, content) => {
  const rootId = idOf(task.message);
  const reply = await Message.create({
    organization: task.organization,
    ...targetOf(task),
    sender: actorId,
    content,
    parentMessageId: rootId,
  });
  await Message.updateOne(
    { _id: rootId },
    {
      $inc: { replyCount: 1 },
      $set: { lastReplyAt: reply.createdAt },
      $addToSet: { replyUserIds: actorId },
    },
  );
  await reply.populate('sender');
  return reply;
};

const nameList = (users) => users.map((user) => user.fullName || 'someone').join(', ');

/**
 * Applies a partial update. Returns { task, changes, addedAssigneeIds } where
 * `changes` are human sentences for the activity reply in the task thread.
 */
const updateTask = async (task, payload = {}) => {
  const target = targetOf(task);
  const changes = [];
  let addedAssigneeIds = [];
  // Board reordering is silent (no activity note).
  let moved = false;
  if (payload.position !== undefined) {
    const position = Number(payload.position);
    if (!Number.isFinite(position)) {
      throw new AppError(400, 'Invalid position');
    }
    if (position !== task.position) {
      task.position = position;
      moved = true;
    }
  }

  if (payload.title !== undefined) {
    const title = assertTitle(payload.title);
    if (title !== task.title) {
      task.title = title;
      changes.push(`renamed the task to "${title}"`);
    }
  }
  if (payload.description !== undefined) {
    const description = assertDescription(payload.description);
    if (description !== task.description) {
      task.description = description;
      changes.push('updated the description');
    }
  }
  if (payload.status !== undefined) {
    const status = assertEnum(payload.status, TASK_STATUS, 'status');
    if (status !== task.status) {
      task.status = status;
      task.closedAt = status === TASK_STATUS.DONE ? new Date() : null;
      changes.push(`moved this to ${STATUS_LABELS[status]}`);
    }
  }
  if (payload.priority !== undefined) {
    const priority = assertEnum(payload.priority, TASK_PRIORITY, 'priority');
    if (priority !== task.priority) {
      task.priority = priority;
      changes.push(`set priority to ${priority.toLowerCase()}`);
    }
  }
  if (payload.dueDate !== undefined) {
    const dueDate = assertDueDate(payload.dueDate);
    const before = task.dueDate ? task.dueDate.getTime() : null;
    const after = dueDate ? dueDate.getTime() : null;
    if (before !== after) {
      task.dueDate = dueDate;
      task.dueRemindedAt = null;
      changes.push(
        dueDate ? `set the due date to ${dueDate.toDateString()}` : 'removed the due date',
      );
    }
  }
  if (payload.labels !== undefined) {
    const labels = assertLabels(payload.labels);
    if (labels.join('\n') !== (task.labels || []).join('\n')) {
      task.labels = labels;
      changes.push(labels.length ? `set labels: ${labels.join(', ')}` : 'cleared the labels');
    }
  }
  if (payload.assignees !== undefined) {
    const next = await assertAssignable(
      task.organization,
      target,
      payload.assignees,
      await projectOf(task),
    );
    const current = new Set((task.assignees || []).map(idOf));
    const nextSet = new Set(next);
    addedAssigneeIds = next.filter((id) => !current.has(id));
    const removedIds = [...current].filter((id) => !nextSet.has(id));
    if (addedAssigneeIds.length || removedIds.length) {
      task.assignees = next;
      await task.populate('assignees');
      const byId = new Map(task.assignees.map((user) => [idOf(user), user]));
      if (addedAssigneeIds.length) {
        changes.push(`assigned ${nameList(addedAssigneeIds.map((id) => byId.get(id) || {}))}`);
      }
      if (removedIds.length) {
        changes.push(
          `unassigned ${removedIds.length === 1 ? 'one person' : `${removedIds.length} people`}`,
        );
      }
    }
  }

  if (changes.length || moved) {
    await task.save();
    await task.populate('assignees');
  }
  return { task, changes, addedAssigneeIds, moved };
};

const deleteTask = async (task) => {
  await Message.updateOne({ _id: task.message, task: task._id }, { $set: { task: null } });
  await task.deleteOne();
};

// ---- listing --------------------------------------------------------------

const buildFilter = ({ status, priority, label }) => {
  const filter = {};
  if (status) {
    const statuses = String(status).split(',');
    statuses.forEach((value) => assertEnum(value, TASK_STATUS, 'status'));
    filter.status = { $in: statuses };
  }
  if (priority) {
    filter.priority = assertEnum(priority, TASK_PRIORITY, 'priority');
  }
  if (label) {
    filter.labels = String(label).trim().toLowerCase();
  }
  return filter;
};

// People who can be assigned (same rule as assertAssignable).
const listAssignableUsers = async (organizationId, target, project = null) => {
  let ids;
  if (project) {
    ids = [...(await projectService.memberIds(project))];
  } else if (target.channel) {
    const rows = await ChannelMember.find({
      channel: target.channel,
      status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
    }).select('user');
    ids = rows.map((row) => String(row.user));
  } else {
    const conversation = await conversationService.findByIdForOrg(
      target.conversation,
      organizationId,
    );
    ids = (conversation?.participants || []).map((participant) => idOf(participant.user));
  }
  const users = await User.find({ _id: { $in: ids } }).sort({ fullName: 1 });
  return users.map(toPublicUser);
};

const listForProject = (project, query = {}) =>
  populate(
    Task.find({ project: project._id, ...buildFilter(query) })
      .sort({ position: 1, updatedAt: -1 })
      .limit(LIST_LIMIT),
  );

const listForTarget = (organizationId, target, query = {}) =>
  populate(
    Task.find({ organization: organizationId, ...target, ...buildFilter(query) })
      .sort({ position: 1, updatedAt: -1 })
      .limit(LIST_LIMIT),
  );

// "My tasks": everything assigned to the user, limited to chats they can
// still see (defence in depth: assignees are removed when they leave).
const listAssignedTo = async (organizationId, userId, query = {}) => {
  const tasks = await populate(
    Task.find({ organization: organizationId, assignees: userId, ...buildFilter(query) })
      .sort({ position: 1, updatedAt: -1 })
      .limit(LIST_LIMIT),
  );
  const channelIds = [...new Set(tasks.filter((t) => t.channel).map((t) => idOf(t.channel)))];
  const conversationIds = [
    ...new Set(tasks.filter((t) => t.conversation).map((t) => idOf(t.conversation))),
  ];
  const [memberships, conversations] = await Promise.all([
    ChannelMember.find({
      channel: { $in: channelIds },
      user: userId,
      status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED },
    }).select('channel'),
    Conversation.find({
      _id: { $in: conversationIds },
      organization: organizationId,
      'participants.user': userId,
    }).select('_id'),
  ]);
  const visible = new Set([
    ...memberships.map((row) => String(row.channel)),
    ...conversations.map((row) => String(row._id)),
  ]);
  const projectVisible = new Map();
  for (const projectId of new Set(tasks.filter((t) => t.project).map((t) => idOf(t.project)))) {
    const project = await Project.findById(projectId);
    projectVisible.set(
      projectId,
      Boolean(project && (await projectService.isMember(project, userId))),
    );
  }
  return tasks.filter((task) =>
    task.project
      ? projectVisible.get(idOf(task.project))
      : visible.has(idOf(task.channel || task.conversation)),
  );
};

// Message serialization: task cards keyed by message id.
const getByMessageIds = async (messageIds) => {
  const map = new Map();
  if (!messageIds.length) {
    return map;
  }
  const tasks = await populate(Task.find({ message: { $in: messageIds } }));
  tasks.forEach((task) => map.set(idOf(task.message), toPublicTask(task)));
  return map;
};

// ---- membership cleanup ---------------------------------------------------

// Someone left / was removed from a channel: drop them from its tasks.
// Returns the affected tasks so the caller can post activity notes.
// Project tickets: only once they are no longer a member of the project at
// all (leaving one linked channel while still in the home channel keeps them).
const unassignFromChannel = async (channelId, userId) => {
  const projects = await Project.find({
    $or: [{ homeChannel: channelId }, { linkedChannels: channelId }],
  });
  const lostProjects = [];
  for (const project of projects) {
    if (!(await projectService.isMember(project, userId))) {
      lostProjects.push(project._id);
    }
  }
  const filter = {
    assignees: userId,
    $or: [{ channel: channelId, project: null }, { project: { $in: lostProjects } }],
  };
  const tasks = await Task.find(filter);
  if (tasks.length) {
    await Task.updateMany(filter, { $pull: { assignees: userId } });
  }
  return tasks;
};

// Reminder sweep: claims (atomically) open tasks due within `windowMs` that
// have assignees and were not reminded yet. Returns the claimed tasks.
const claimDueReminders = async (windowMs, limit = 50) => {
  const claimed = [];
  for (let count = 0; count < limit; count += 1) {
    const task = await Task.findOneAndUpdate(
      {
        dueRemindedAt: null,
        dueDate: { $ne: null, $lte: new Date(Date.now() + windowMs) },
        status: { $ne: TASK_STATUS.DONE },
        'assignees.0': { $exists: true },
      },
      { $set: { dueRemindedAt: new Date() } },
      { new: true },
    );
    if (!task) {
      break;
    }
    claimed.push(task);
  }
  return claimed;
};

module.exports = {
  listAssignableUsers,
  listForProject,
  assertCanReadTask,
  assertCanWriteTask,
  projectOf,
  claimDueReminders,
  STATUS_LABELS,
  toPublicTask,
  targetOf,
  titleFromContent,
  prepareFields,
  postActivity,
  findByIdForOrg,
  loadForRead,
  loadForWrite,
  assertCanReadTarget,
  assertCanWriteTarget,
  createForMessage,
  updateTask,
  deleteTask,
  listForTarget,
  listAssignedTo,
  getByMessageIds,
  unassignFromChannel,
};
