const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// One entry of a task's history: who did what and when. `changes` holds the
// fields that changed with readable before/after values ("To do" -> "Done").
const TASK_EVENT_KINDS = ['created', 'changed', 'subtask', 'moved'];

const taskEventSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true },
    task: { type: ObjectId, ref: 'Task', required: true },
    actor: { type: ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: TASK_EVENT_KINDS, required: true },
    changes: [
      {
        _id: false,
        field: { type: String, required: true },
        from: { type: String, default: '' },
        to: { type: String, default: '' },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

taskEventSchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('TaskEvent', taskEventSchema);
module.exports.TASK_EVENT_KINDS = TASK_EVENT_KINDS;
