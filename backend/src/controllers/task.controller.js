const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const taskService = require('../services/task.service');
const messageService = require('../services/message.service');
const projectService = require('../services/project.service');
const threadService = require('../services/thread.service');
const channelService = require('../services/channel.service');
const { postMessage } = require('./message.controller');
const { serializeMessage } = require('../services/serialize.service');
const { emitTask, emitCard, emitActivity, notifyAssigned } = require('../sockets/taskEvents');
const { emitToMessageRooms, serializeLive } = require('../sockets/messageEvents');

const getIo = (req) => req.app.get('io');
const idOf = (value) => String(value?._id ?? value);

const respond = (res, task, status = 200) =>
  success(res, { task: taskService.toPublicTask(task) }, status);

// Shared tail of every create: activity note, card refresh, notifications.
const announceCreated = async (req, task) => {
  const io = getIo(req);
  const reply = await taskService.postActivity(
    task,
    req.user._id,
    `created ${task.projectKey || 'TASK'}-${task.number}`,
  );
  await emitActivity(io, reply);
  await emitCard(io, task);
  emitTask(io, task, 'task.created');
  await notifyAssigned(io, task, req.user, task.assignees.map(idOf));
};

// Creator, reporter and assignees follow the ticket's thread, so they hear
// about its comments (nobody else in the channel does).
const followTicket = (req, task, userIds) =>
  Promise.all(
    [...new Set(userIds.filter(Boolean).map(String))].map((userId) =>
      threadService.follow(req.organization._id, task.message, userId),
    ),
  );

// Creates a project ticket for a card just posted in chat. If that fails
// (bad assignee, ...) the card is taken back, so no orphan card is left.
const ticketForCard = async (req, card, args) => {
  try {
    return await taskService.createTicket({ ...args, ...(card ? { sourceMessage: card } : {}) });
  } catch (error) {
    if (card) {
      const deleted = await messageService.deleteMessage(card, req.user._id);
      emitToMessageRooms(getIo(req), deleted, 'message.deleted', {
        message: await serializeLive(deleted),
      });
    }
    throw error;
  }
};

// Explicit project from the request ("" = none, a chat task), else the
// channel's project. The user must be able to add tickets to it.
const chooseProject = async (req, channelId) => {
  const { projectId } = req.body || {};
  if (projectId === '' || projectId === null) {
    return null;
  }
  const project = projectId
    ? await projectService.findById(req.organization._id, projectId)
    : await projectService.projectForChannel(req.organization._id, channelId);
  if (projectId && !project) {
    throw new AppError(404, 'Project not found');
  }
  if (project) {
    if (!req.organization.settings?.projectsEnabled) {
      throw new AppError(403, 'Projects is not enabled for this workspace');
    }
    await projectService.assertCanWrite(project, req.user._id);
  }
  return project;
};

// POST /messages/:messageId/task: turn an existing message into a task.
const createFromMessage = asyncHandler(async (req, res) => {
  const message = await messageService.findByIdForOrg(req.params.messageId, req.organization._id);
  if (!message || message.deletedAt) {
    throw new AppError(404, 'Message not found');
  }
  await messageService.assertAccess(message, req.user._id);
  await messageService.assertCanWrite(message, req.user._id);
  // Project ticket (picked, or the channel's project): own hidden thread and
  // a chip on this message. Otherwise a chat task as before.
  const project = await chooseProject(req, message.channel);
  const fields = await taskService.prepareFields(
    req.organization._id,
    taskService.targetOf(message),
    req.body,
    taskService.titleFromContent(message.content),
    project,
  );
  const task = project
    ? await taskService.createTicket({
        organizationId: req.organization._id,
        actor: req.user,
        fields,
        project,
        sourceMessage: message,
      })
    : await taskService.createForMessage(req.organization._id, message, req.user, fields);
  await followTicket(req, task, [req.user._id, idOf(message.sender), ...task.assignees.map(idOf)]);
  await announceCreated(req, task);
  respond(res, task, 201);
});

// POST /channels/:channelId/tasks and /conversations/:conversationId/tasks:
// posts the task card message (content = title), then attaches the task.
const createInTarget = (targetKey) =>
  asyncHandler(async (req, res) => {
    const doc = targetKey === 'channel' ? req.channel : req.conversation;
    // Picked project (any chat, DMs too); none = a plain chat task.
    const project = req.body?.projectId ? await chooseProject(req, null) : null;
    const fields = await taskService.prepareFields(
      req.organization._id,
      { [targetKey]: idOf(doc) },
      req.body,
      '',
      project,
    );
    if (project) {
      // The card goes in this chat; the ticket (details, comments) lives on
      // the board and only project members can open it.
      const card = await postMessage({
        io: getIo(req),
        organizationId: req.organization._id,
        user: req.user,
        target: { [targetKey]: doc },
        body: { content: fields.title },
      });
      const ticket = await ticketForCard(req, card, {
        organizationId: req.organization._id,
        actor: req.user,
        fields,
        project,
      });
      await followTicket(req, ticket, [req.user._id, ...ticket.assignees.map(idOf)]);
      await announceCreated(req, ticket);
      respond(res, ticket, 201);
      return;
    }
    const message = await postMessage({
      io: getIo(req),
      organizationId: req.organization._id,
      user: req.user,
      target: { [targetKey]: doc },
      body: { content: fields.title },
    });
    const task = await taskService.createForMessage(
      req.organization._id,
      message,
      req.user,
      fields,
      project,
    );
    await announceCreated(req, task);
    respond(res, task, 201);
  });

// GET /channels/:channelId/tasks, /conversations/:conversationId/tasks
const listInTarget = (targetKey) =>
  asyncHandler(async (req, res) => {
    const doc = targetKey === 'channel' ? req.channel : req.conversation;
    const project =
      targetKey === 'channel'
        ? await projectService.projectForChannel(req.organization._id, doc._id)
        : null;
    if (project) {
      const tasks = await taskService.listForProject(project, req.query);
      success(res, {
        tasks: tasks.map(taskService.toPublicTask),
        project: projectService.toPublicProject(project),
      });
      return;
    }
    const tasks = await taskService.listForTarget(
      req.organization._id,
      { [targetKey]: doc._id },
      req.query,
    );
    success(res, { tasks: tasks.map(taskService.toPublicTask) });
  });

// GET /tasks: the caller's assigned tasks ("My tasks").
// GET /tasks/unassigned: the "Unassigned" board.
const listUnassigned = asyncHandler(async (req, res) => {
  const tasks = await taskService.listUnassigned(req.organization._id, req.user._id, req.query);
  success(res, { tasks: tasks.map(taskService.toPublicTask) });
});

// POST /tasks/:taskId/project { projectId }: move an unassigned task into a
// project the user is a member of.
const moveToProject = asyncHandler(async (req, res) => {
  const task = await taskService.loadForWrite(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  const project = await chooseProject(req, null);
  if (!project) {
    throw new AppError(400, 'Pick a project');
  }
  const io = getIo(req);
  const { task: moved, dropped } = await taskService.moveToProject(task, project);
  const reply = await taskService.postActivity(
    moved,
    req.user._id,
    `moved this to ${project.name} (${moved.projectKey}-${moved.number})`,
  );
  await emitActivity(io, reply);
  await emitCard(io, moved);
  // The chat's live board drops it; the project board and assignees get it.
  io?.to(
    `${moved.channel ? 'channel' : 'conversation'}:${idOf(moved.channel || moved.conversation)}`,
  ).emit('task.updated', {
    organizationId: String(req.organization._id),
    task: taskService.lockedTask(moved),
  });
  emitTask(io, moved, 'task.updated', dropped);
  respond(res, moved);
});

// GET /tasks/:taskId/subtasks
const listSubtasks = asyncHandler(async (req, res) => {
  const parent = await taskService.loadForRead(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  const tasks = await taskService.listSubtasks(parent);
  success(res, { tasks: tasks.map(taskService.toPublicTask) });
});

// POST /tasks/:taskId/subtasks: anyone who can work on the parent.
const createSubtask = asyncHandler(async (req, res) => {
  const parent = await taskService.loadForWrite(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  const project = await taskService.projectOf(parent);
  if (project) {
    await projectService.assertCanWrite(project, req.user._id);
  }
  const subtask = await taskService.createSubtask({
    organizationId: req.organization._id,
    actor: req.user,
    parent,
    payload: req.body,
  });
  await followTicket(req, subtask, [req.user._id, ...subtask.assignees.map(idOf)]);
  const io = getIo(req);
  emitTask(io, subtask, 'task.created');
  await notifyAssigned(io, subtask, req.user, subtask.assignees.map(idOf));
  const reply = await taskService.postActivity(
    parent,
    req.user._id,
    `added subtask ${subtask.projectKey}-${subtask.number}`,
  );
  await emitActivity(io, reply);
  await emitParent(req, subtask);
  respond(res, subtask, 201);
});

// A subtask changed: its parent's "2 / 5" changed too.
const emitParent = async (req, task) => {
  if (!task.parent) {
    return;
  }
  const parent = await taskService.findByIdForOrg(idOf(task.parent), req.organization._id);
  if (parent) {
    emitTask(getIo(req), parent, 'task.updated');
    await emitCard(getIo(req), parent);
  }
};

const listMine = asyncHandler(async (req, res) => {
  const tasks = await taskService.listAssignedTo(req.organization._id, req.user._id, req.query);
  success(res, { tasks: tasks.map(taskService.toPublicTask) });
});

// POST /projects/:key/tasks: a ticket created on the project board (works
// with or without a home channel); nothing is posted to any chat.
const createInProject = asyncHandler(async (req, res) => {
  const project = await projectService.findByKey(req.organization._id, req.params.key);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }
  await projectService.assertCanRead(project, req.user._id);
  await projectService.assertCanWrite(project, req.user._id);
  // Optional channel: the card is also posted there (the user must be able to
  // post in it). Without one the ticket lives only on the board.
  const channel = req.body?.channelId
    ? await channelService.assertCanWriteById(
        req.body.channelId,
        req.organization._id,
        req.user._id,
      )
    : null;
  const fields = await taskService.prepareFields(req.organization._id, {}, req.body, '', project);
  if (channel) {
    // Posted in a channel: assignees must be in that channel too.
    await taskService.assertAssignable(
      req.organization._id,
      { channel: String(channel._id) },
      fields.assignees.map(idOf),
    );
  }
  const card = channel
    ? await postMessage({
        io: getIo(req),
        organizationId: req.organization._id,
        user: req.user,
        target: { channel },
        body: { content: fields.title },
      })
    : null;
  const ticket = await ticketForCard(req, card, {
    organizationId: req.organization._id,
    actor: req.user,
    fields,
    project,
  });
  await followTicket(req, ticket, [req.user._id, ...ticket.assignees.map(idOf)]);
  await announceCreated(req, ticket);
  respond(res, ticket, 201);
});

// POST /tasks/:taskId/comments: a comment in the ticket's own thread. Works
// for every project member (incl. linked channels); posts nothing to chat.
const addComment = asyncHandler(async (req, res) => {
  const task = await taskService.loadForWrite(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  const message = await postMessage({
    io: getIo(req),
    organizationId: req.organization._id,
    user: req.user,
    // Channel-free project tickets: the comment belongs to the project.
    target: task.channel ? { channel: { _id: task.channel } } : {},
    body: {
      content: req.body?.content,
      attachments: req.body?.attachments,
      parentMessageId: idOf(task.message),
    },
  });
  success(res, { message: await serializeMessage(message, req.user._id) }, 201);
});

// GET /tasks/assignable?channelId= | conversationId= | taskId= | projectKey=
// Exactly the people the server accepts as assignees there: project members
// for a project channel / ticket, else channel members / DM participants.
const listAssignable = asyncHandler(async (req, res) => {
  const { channelId, conversationId, taskId, projectKey } = req.query;
  const orgId = req.organization._id;
  let project = null;
  let target = null;
  if (projectKey) {
    project = await projectService.findByKey(orgId, projectKey);
    if (!project) {
      throw new AppError(404, 'Project not found');
    }
    await projectService.assertCanRead(project, req.user._id);
    target = {};
  } else if (taskId) {
    const task = await taskService.loadForRead(taskId, orgId, req.user._id);
    project = await taskService.projectOf(task);
    target = taskService.targetOf(task);
  } else if (channelId) {
    target = { channel: String(channelId) };
    await taskService.assertCanReadTarget(orgId, target, req.user._id);
    project = await projectService.projectForChannel(orgId, channelId);
  } else if (conversationId) {
    target = { conversation: String(conversationId) };
    await taskService.assertCanReadTarget(orgId, target, req.user._id);
  } else {
    throw new AppError(400, 'channelId, conversationId or taskId is required');
  }
  const users = await taskService.listAssignableUsers(orgId, target, project);
  success(res, { users, projectKey: project ? project.key : null });
});

// GET /tasks/by-key/:key: WEB-12, an old TASK-n, or a pre-rename key.
// Unknown and not-visible keys are the same 404 (no existence leak).
const getByKey = asyncHandler(async (req, res) => {
  const found = await projectService.resolveTaskKey(req.organization._id, req.params.key);
  if (!found) {
    throw new AppError(404, 'Ticket not found');
  }
  try {
    const task = await taskService.loadForRead(found._id, req.organization._id, req.user._id);
    respond(res, task);
  } catch {
    throw new AppError(404, 'Ticket not found');
  }
});

const get = asyncHandler(async (req, res) => {
  const task = await taskService.loadForRead(req.params.taskId, req.organization._id, req.user._id);
  respond(res, task);
});

// Assignees, the creator and channel moderators / workspace admins manage a
// task. An unassigned task is open to anyone in the chat (to pick it up).
//
// Two levels:
//   full:     the creator, channel moderators, workspace admins: every field.
//   progress: assignees: status and description only (scope, deadline,
//             priority and who does it stay with whoever assigned it).
// On an unassigned task anyone in the chat gets "progress" and may also pick
// it up by assigning themselves.
// position = board order; anyone who can move the card may reorder it.
const PROGRESS_FIELDS = ['status', 'description', 'position'];
const FULL_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
  'labels',
  'assignees',
];

const accessLevel = async (req, task) => {
  const userId = String(req.user._id);
  if (idOf(task.createdBy) === userId) {
    return 'full';
  }
  const root = await messageService.findByIdForOrg(task.message, req.organization._id);
  if (root && (await messageService.canModerate(root, req.user._id, req.membership?.role))) {
    return 'full';
  }
  const project = await taskService.projectOf(task);
  if (project && (await projectService.canManage(project, req.user._id, req.membership?.role))) {
    return 'full';
  }
  const assignees = task.assignees.map(idOf);
  if (assignees.length === 0) {
    return 'unassigned';
  }
  return assignees.includes(userId) ? 'progress' : 'none';
};

const assertCanEdit = async (req, task) => {
  const level = await accessLevel(req, task);
  const fields = Object.keys(req.body || {}).filter((key) => FULL_FIELDS.includes(key));
  if (level === 'full') {
    return;
  }
  if (level === 'none') {
    throw new AppError(403, 'Only assignees, the creator or a moderator can change this task');
  }
  const pickUp =
    level === 'unassigned' &&
    Array.isArray(req.body.assignees) &&
    req.body.assignees.length === 1 &&
    String(req.body.assignees[0]) === String(req.user._id);
  const blocked = fields.filter(
    (key) => !PROGRESS_FIELDS.includes(key) && !(key === 'assignees' && pickUp),
  );
  if (blocked.length) {
    throw new AppError(
      403,
      'Only the task creator or a moderator can change the title, priority, due date or assignees',
    );
  }
};

// Each change is noted in the task thread.
const update = asyncHandler(async (req, res) => {
  const task = await taskService.loadForWrite(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  await assertCanEdit(req, task);
  const previousAssignees = task.assignees.map(idOf);
  const { changes, addedAssigneeIds, moved } = await taskService.updateTask(task, req.body);
  if (moved && !changes.length) {
    emitTask(getIo(req), task, 'task.updated');
  }
  if (changes.length) {
    const io = getIo(req);
    const reply = await taskService.postActivity(task, req.user._id, changes.join(' · '));
    await emitActivity(io, reply);
    await emitCard(io, task);
    // Unassigned people still get the event so it leaves their "My tasks".
    emitTask(io, task, 'task.updated', previousAssignees);
    await notifyAssigned(io, task, req.user, addedAssigneeIds);
    await followTicket(req, task, addedAssigneeIds);
    await emitParent(req, task);
  }
  respond(res, task);
});

// The creator, the card's author, or a channel moderator / workspace admin.
const remove = asyncHandler(async (req, res) => {
  const task = await taskService.loadForWrite(
    req.params.taskId,
    req.organization._id,
    req.user._id,
  );
  const root = await messageService.findByIdForOrg(task.message, req.organization._id);
  const isCreator = idOf(task.createdBy) === String(req.user._id);
  const isAuthor = root && idOf(root.sender) === String(req.user._id);
  const isModerator =
    root && (await messageService.canModerate(root, req.user._id, req.membership?.role));
  const project = await taskService.projectOf(task);
  const isManager =
    project && (await projectService.canManage(project, req.user._id, req.membership?.role));
  if (!isCreator && !isAuthor && !isModerator && !isManager) {
    throw new AppError(403, 'You can only delete tasks you created');
  }
  // ?subtasks=delete also deletes its subtasks; otherwise they are kept.
  const children = await taskService.deleteTask(task, {
    subtasks: req.query.subtasks === 'delete' ? 'delete' : 'keep',
  });
  const io = getIo(req);
  emitTask(io, task, 'task.deleted');
  await emitCard(io, task);
  for (const child of children) {
    if (req.query.subtasks === 'delete') {
      emitTask(io, child, 'task.deleted');
    } else {
      const kept = await taskService.findByIdForOrg(child._id, req.organization._id);
      if (kept) emitTask(io, kept, 'task.updated');
    }
  }
  await emitParent(req, task);
  success(res, { id: idOf(task._id) });
});

module.exports = {
  listSubtasks,
  createSubtask,
  listUnassigned,
  moveToProject,
  createInProject,
  addComment,
  listAssignable,
  getByKey,
  createFromMessage,
  createInChannel: createInTarget('channel'),
  createInConversation: createInTarget('conversation'),
  listChannel: listInTarget('channel'),
  listConversation: listInTarget('conversation'),
  listMine,
  get,
  update,
  remove,
};
