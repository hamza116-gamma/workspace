const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A project goal with a due date ("v1.0 launch"). Tickets point to it via
// Task.milestone; progress is counted from them.
const MILESTONE_STATUS = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

const milestoneSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true },
    project: { type: ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(MILESTONE_STATUS),
      default: MILESTONE_STATUS.OPEN,
    },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

milestoneSchema.index({ project: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
module.exports.MILESTONE_STATUS = MILESTONE_STATUS;
