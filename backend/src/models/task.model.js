const mongoose = require('mongoose');
const { TASK_STATUS, TASK_PRIORITY } = require('../config/constants');

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
    // Per-workspace number shown as TASK-<number>.
    number: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: TASK_TITLE_MAX },
    description: { type: String, trim: true, maxlength: TASK_DESCRIPTION_MAX, default: '' },
    status: { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.TODO },
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
  if (Boolean(this.channel) === Boolean(this.conversation)) {
    next(new Error('A task must reference exactly one channel or conversation'));
    return;
  }
  next();
});

taskSchema.index({ message: 1 }, { unique: true });
taskSchema.index({ organization: 1, number: 1 }, { unique: true });
taskSchema.index({ channel: 1, status: 1, updatedAt: -1 });
taskSchema.index({ conversation: 1, status: 1, updatedAt: -1 });
taskSchema.index({ organization: 1, assignees: 1, status: 1 });
taskSchema.index({ dueRemindedAt: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_TITLE_MAX = TASK_TITLE_MAX;
module.exports.TASK_DESCRIPTION_MAX = TASK_DESCRIPTION_MAX;
module.exports.TASK_LABELS_MAX = TASK_LABELS_MAX;
