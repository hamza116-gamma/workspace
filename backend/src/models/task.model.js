const mongoose = require('mongoose');
const {
  TASK_STATUS,
  TASK_PRIORITY,
  STATUS_GROUP,
  DEFAULT_TASK_STATUSES,
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
    // Key prefix (project key, or TASK); the key is `${projectKey}-${number}`.
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

taskSchema.index({ message: 1 }, { unique: true });
taskSchema.index({ sourceMessage: 1 }, { sparse: true });
// (organization, number) was the unique key before projects; the migration
// script drops that index.
taskSchema.index({ organization: 1, projectKey: 1, number: 1 }, { unique: true });
taskSchema.index({ organization: 1, formerKeys: 1 });
taskSchema.index({ project: 1, status: 1, position: 1 });
taskSchema.index({ channel: 1, status: 1, updatedAt: -1 });
taskSchema.index({ conversation: 1, status: 1, updatedAt: -1 });
taskSchema.index({ organization: 1, assignees: 1, status: 1 });
taskSchema.index({ dueRemindedAt: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_TITLE_MAX = TASK_TITLE_MAX;
module.exports.TASK_DESCRIPTION_MAX = TASK_DESCRIPTION_MAX;
module.exports.TASK_LABELS_MAX = TASK_LABELS_MAX;
