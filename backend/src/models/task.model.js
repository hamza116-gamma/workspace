const mongoose = require('mongoose');
const {
  TASK_STATUS,
  TASK_PRIORITY,
  STATUS_GROUP,
  DEFAULT_TASK_STATUSES,
  TASK_TYPE,
} = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

const TASK_TITLE_MAX = 200;
const TASK_DESCRIPTION_MAX = 4000;
const TASK_LABELS_MAX = 10;

const taskSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true, index: true },
    channel: { type: ObjectId, ref: 'Channel', default: null },
    conversation: { type: ObjectId, ref: 'Conversation', default: null },
    // The task card in the chat (Message.task points back here). Its thread
    // is the task's discussion and activity history.
    message: { type: ObjectId, ref: 'Message', required: true },
    // The chat message this ticket was created from (shows a chip there).
    sourceMessage: { type: ObjectId, ref: 'Message', default: null },
    // Author of that source message (who reported it).
    reporter: { type: ObjectId, ref: 'User', default: null },
    // Project this ticket belongs to (null = a chat task, keyed TASK-n).
    project: { type: ObjectId, ref: 'Project', default: null },
    // Key prefix (project key, or TASK). The key is `${projectKey}-${number}`,
    // and `${projectKey}-${number}.${subIndex}` for a subtask (TP-2.1).
    projectKey: { type: String, required: true, default: 'TASK' },
    // Numbered per projectKey (per project, or per workspace for TASK).
    number: { type: Number, required: true },
    // Keys this ticket had before moving project (old links keep resolving).
    formerKeys: { type: [String], default: [] },
    title: { type: String, required: true, trim: true, maxlength: TASK_TITLE_MAX },
    description: { type: String, trim: true, maxlength: TASK_DESCRIPTION_MAX, default: '' },
    // Key of one of the project's statuses (or a default one for chat tasks).
    status: { type: String, required: true, default: TASK_STATUS.TODO },
    // That status's group, kept in sync: what "done" / "open" queries use.
    statusGroup: {
      type: String,
      enum: Object.values(STATUS_GROUP),
      default: STATUS_GROUP.TODO,
    },
    priority: {
      type: String,
      enum: Object.values(TASK_PRIORITY),
      default: TASK_PRIORITY.MEDIUM,
    },
    type: { type: String, enum: Object.values(TASK_TYPE), default: TASK_TYPE.TASK },
    // Optional estimate in minutes (shown as 30m / 2h / 1.5d).
    estimateMinutes: { type: Number, default: null, min: 1 },
    // Subtask of this task (one level: a subtask has no subtasks). A subtask
    // shares its parent's number and adds its own index: TP-2.1, TP-2.2.
    parent: { type: ObjectId, ref: 'Task', default: null },
    subIndex: { type: Number, default: null },
    // Last subtask index handed out (on the parent; never reused).
    subtaskSeq: { type: Number, default: 0 },
    // Kept by recountSubtasks: how many subtasks, and how many are done.
    // Channels this ticket's card was shared to (Phase 4). Each card opens
    // the ticket's own thread, so comments are one conversation everywhere.
    shares: [
      {
        _id: false,
        channel: { type: ObjectId, ref: 'Channel', required: true },
        message: { type: ObjectId, ref: 'Message', required: true },
        sharedBy: { type: ObjectId, ref: 'User', required: true },
        sharedAt: { type: Date, default: Date.now },
      },
    ],
    subtaskTotal: { type: Number, default: 0 },
    subtaskDone: { type: Number, default: 0 },
    // Always members of the task's channel / participants of its conversation.
    assignees: [{ type: ObjectId, ref: 'User' }],
    dueDate: { type: Date, default: null },
    labels: { type: [String], default: [] },
    // Board order inside a status column (ascending). New tasks go on top.
    // (Set to -Date.now() on create; older tasks default to 0, below new ones.)
    position: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: 'User', required: true },
    closedAt: { type: Date, default: null },
    // Set once the "due soon" reminder went out; cleared when dueDate changes.
    dueRemindedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.pre('validate', function ensureSingleTarget(next) {
  // Tickets of a project without a channel belong to the project only.
  if (!this.channel && !this.conversation && this.project) {
    next();
    return;
  }
  if (Boolean(this.channel) === Boolean(this.conversation)) {
    next(new Error('A task must reference exactly one channel or conversation'));
    return;
  }
  next();
});

// The group always follows the status, whatever code saved the task: it is
// looked up in the task's project (or the defaults for chat tasks), and an
// unknown status is refused. Bulk updateMany calls skip this and set both.
taskSchema.pre('validate', async function syncStatusGroup() {
  if (!this.isNew && !this.isModified('status') && !this.isModified('project')) {
    return;
  }
  let statuses = DEFAULT_TASK_STATUSES;
  if (this.project) {
    const project = await mongoose
      .model('Project')
      .findById(this.project._id ?? this.project)
      .select('statuses')
      .lean();
    if (project?.statuses?.length) {
      statuses = project.statuses;
    }
  }
  const status = statuses.find((item) => item.key === this.status);
  if (!status) {
    this.invalidate('status', 'Unknown status for this project');
    return;
  }
  this.statusGroup = status.group;
});

// A subtask's parent shows "2 / 5": recount after a subtask is added or its
// group changes (deleting one recounts in the service).
taskSchema.pre('save', function markRecount() {
  this.$locals.recount = Boolean(this.parent) && (this.isNew || this.isModified('statusGroup'));
});
taskSchema.post('save', async function recountParent() {
  if (this.$locals.recount) {
    await this.constructor.recountSubtasks(this.parent);
  }
});

taskSchema.statics.recountSubtasks = async function recountSubtasks(parentId) {
  if (!parentId) {
    return;
  }
  const id = parentId._id ?? parentId;
  const [total, done] = await Promise.all([
    this.countDocuments({ parent: id }),
    this.countDocuments({ parent: id, statusGroup: STATUS_GROUP.DONE }),
  ]);
  await this.updateOne({ _id: id }, { $set: { subtaskTotal: total, subtaskDone: done } });
};

taskSchema.index({ parent: 1 });
taskSchema.index({ 'shares.message': 1 });
taskSchema.index({ message: 1 }, { unique: true });
taskSchema.index({ sourceMessage: 1 }, { sparse: true });
// (organization, number) was the unique key before projects; the migration
// script drops that index.
// One task per key: TP-2 (no subIndex) and its subtasks TP-2.1, TP-2.2.
taskSchema.index(
  { organization: 1, projectKey: 1, number: 1, subIndex: 1 },
  { unique: true, name: 'organization_1_projectKey_1_number_1_subIndex_1' },
);
taskSchema.index({ organization: 1, formerKeys: 1 });
taskSchema.index({ project: 1, status: 1, position: 1 });
taskSchema.index({ channel: 1, status: 1, updatedAt: -1 });
taskSchema.index({ conversation: 1, status: 1, updatedAt: -1 });
taskSchema.index({ organization: 1, assignees: 1, status: 1 });
taskSchema.index({ dueRemindedAt: 1, dueDate: 1 });

/** "TP-2", or "TP-2.1" for a subtask. */
const keyOf = (task) =>
  `${task.projectKey || 'TASK'}-${task.number}${task.subIndex ? `.${task.subIndex}` : ''}`;

module.exports = mongoose.model('Task', taskSchema);
module.exports.keyOf = keyOf;
module.exports.TASK_TITLE_MAX = TASK_TITLE_MAX;
module.exports.TASK_DESCRIPTION_MAX = TASK_DESCRIPTION_MAX;
module.exports.TASK_LABELS_MAX = TASK_LABELS_MAX;
