const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../config/constants');

// target = { type: 'user' | 'channel' | 'email' | 'organization', id, label }
const targetSchema = new mongoose.Schema(
  {
    type: { type: String, default: null },
    id: { type: String, default: null },
    label: { type: String, default: '' },
  },
  { _id: false },
);

const auditLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, enum: Object.values(AUDIT_ACTIONS), required: true },
    target: { type: targetSchema, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ organization: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
