const User = require('../models/user.model');
const taskService = require('../services/task.service');
const messageService = require('../services/message.service');
const notificationService = require('../services/notification.service');
const { NOTIFICATION_TYPES } = require('../models/notification.model');
const { chatRoomFor, emitCreated, emitToMessageRooms, serializeLive } = require('./messageEvents');

const idOf = (value) => String(value?._id ?? value);

// task.updated / task.deleted reach the chat, the task thread and every
// assignee's user room (their "My tasks" list updates on any page).
const emitTask = (io, task, event, extraUserIds = []) => {
  if (!io) {
    return;
  }
  const payload = {
    organizationId: idOf(task.organization),
    task: taskService.toPublicTask(task),
  };
  const rooms = [`thread:${idOf(task.message)}`];
  // Project tickets stay out of chat rooms (not everyone there is a member).
  if ((task.channel || task.conversation) && !task.project) {
    rooms.push(chatRoomFor(task));
  }
  // Project boards (see project:join) and the project's previous board when
  // a ticket leaves a project are kept in sync too.
  if (task.project) {
    rooms.push(`project:${idOf(task.project)}`);
  }
  const userIds = new Set([...(task.assignees || []).map(idOf), ...extraUserIds.map(String)]);
  userIds.forEach((id) => rooms.push(`user:${id}`));
  io.to(rooms).emit(event, payload);
};

// The task card (root message) re-renders with the new task state.
const emitCard = async (io, task) => {
  if (!io) {
    return;
  }
  // The ticket's own thread root (a hidden anchor only reaches its thread
  // room) and the chat message it was made from, whose chip shows the status.
  for (const id of [task.message, task.sourceMessage].filter(Boolean)) {
    const message = await messageService.findByIdForOrg(id, task.organization);
    if (message) {
      emitToMessageRooms(io, message, 'message.updated', {
        message: await serializeLive(message),
      });
    }
  }
};

const emitActivity = (io, reply) => emitCreated(io, reply, reply.organization);

// Activity notification about a task (assigned / due) for these users.
const notifyUsers = async (io, task, actor, userIds, type) => {
  const recipients = userIds.map((id) => ({ id: String(id), type }));
  if (recipients.length === 0) {
    return;
  }
  const root = await messageService.findByIdForOrg(task.message, task.organization);
  if (!root) {
    return;
  }
  const created = await notificationService.createForRecipients(
    task.organization,
    root,
    actor,
    recipients,
  );
  if (!io) {
    return;
  }
  created.forEach((notification) => {
    io.to(`user:${notification.recipientId}`).emit('notification.created', {
      organizationId: idOf(task.organization),
      silent: false,
      notification: { ...notification, recipientId: undefined, taskId: idOf(task._id) },
    });
  });
};

// Someone left / was removed from a channel: unassign them from its tasks
// and note it in each task thread ("was unassigned (left the channel)").
const releaseChannelAssignee = async (io, channelId, userId, note) => {
  const tasks = await taskService.unassignFromChannel(channelId, userId);
  for (const stale of tasks) {
    const task = await taskService.findByIdForOrg(stale._id, stale.organization);
    if (!task) {
      continue;
    }
    const reply = await taskService.postActivity(task, userId, note);
    await emitActivity(io, reply);
    await emitCard(io, task);
    emitTask(io, task, 'task.updated', [userId]);
  }
};

// Newly assigned people are notified (never for self-assign).
const notifyAssigned = (io, task, actor, userIds) =>
  notifyUsers(
    io,
    task,
    actor,
    userIds.map(String).filter((id) => id !== String(actor._id)),
    NOTIFICATION_TYPES.TASK_ASSIGNED,
  );

// "Due soon" reminder to every assignee (sent by the scheduler).
const notifyDue = async (io, task) => {
  const creator = await User.findById(task.createdBy);
  if (!creator) {
    return;
  }
  await notifyUsers(
    io,
    task,
    creator,
    (task.assignees || []).map(idOf),
    NOTIFICATION_TYPES.TASK_DUE,
  );
};

// Lost project membership: unassign from its tickets with a note on each.
const releaseProjectAssignee = async (io, projectId, userId, note) => {
  const tasks = await taskService.unassignFromProject(projectId, userId);
  for (const stale of tasks) {
    const task = await taskService.findByIdForOrg(stale._id, stale.organization);
    if (!task) {
      continue;
    }
    const reply = await taskService.postActivity(task, userId, note);
    await emitActivity(io, reply);
    await emitCard(io, task);
    emitTask(io, task, 'task.updated', [userId]);
  }
};

module.exports = {
  releaseProjectAssignee,
  emitTask,
  emitCard,
  emitActivity,
  notifyAssigned,
  notifyDue,
  releaseChannelAssignee,
};
