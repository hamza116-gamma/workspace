const mongoose = require('mongoose');
const {
  PROJECT_STATUS,
  PROJECT_UPDATES,
  PROJECT_VISIBILITY,
  STATUS_GROUP,
  DEFAULT_TASK_STATUSES,
} = require('../config/constants');

const { ObjectId } = mongoose.Schema.Types;

/**
 * A project groups tickets (tasks) under a short key: WEB-1, WEB-2, ...
 * Members are the people in its home channel plus its linked channels, so
 * access reuses channel membership (no separate roles).
 */
// A ticket status of this project. `key` never changes (tickets store it);
// name, colour, group and order can.
const statusSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 30 },
    color: { type: String, required: true },
    group: { type: String, enum: Object.values(STATUS_GROUP), required: true },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    organization: { type: ObjectId, ref: 'Organization', required: true, index: true },
    // 2-6 characters, A-Z / 0-9, starts with a letter. Unique per workspace.
    key: { type: String, required: true, uppercase: true, trim: true },
    // Keys this project had before a rename; WEB-12 links keep resolving.
    formerKeys: { type: [String], default: [] },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    // Owns membership and permissions. One active project per home channel.
    // Optional. With one, its members are project members and it gets the
    // board. Without one the project is private to its listed members.
    homeChannel: { type: ObjectId, ref: 'Channel', default: null },
    // PUBLIC = the whole workspace; PRIVATE = only `members`.
    visibility: {
      type: String,
      enum: Object.values(PROJECT_VISIBILITY),
      default: PROJECT_VISIBILITY.PRIVATE,
    },
    // People added directly (private projects; empty when public).
    members: [{ type: ObjectId, ref: 'User' }],
    // Extra channels that also see the board (and whose members are members).
    linkedChannels: [{ type: ObjectId, ref: 'Channel' }],
    // Board columns, in order. Starts as the default set.
    statuses: {
      type: [statusSchema],
      default: () => DEFAULT_TASK_STATUSES.map((status) => ({ ...status })),
    },
    // Full rights on every ticket, next to the ticket creator and moderators.
    lead: { type: ObjectId, ref: 'User', required: true },
    // Per-project ticket counter.
    seq: { type: Number, default: 0 },
    // How much reaches the home channel automatically (Phase 6). Off by default.
    updates: {
      type: String,
      enum: Object.values(PROJECT_UPDATES),
      default: PROJECT_UPDATES.OFF,
    },
    status: { type: String, enum: Object.values(PROJECT_STATUS), default: PROJECT_STATUS.ACTIVE },
    archivedAt: { type: Date, default: null },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

projectSchema.index({ organization: 1, key: 1 }, { unique: true });
projectSchema.index({ organization: 1, formerKeys: 1 });
// One active project per home channel (archived ones can be re-homed).
projectSchema.index(
  { homeChannel: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: PROJECT_STATUS.ACTIVE,
      homeChannel: { $type: 'objectId' },
    },
  },
);
projectSchema.index({ organization: 1, members: 1 });
projectSchema.index({ linkedChannels: 1 });

module.exports = mongoose.model('Project', projectSchema);
