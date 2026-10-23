const mongoose = require('mongoose');
const { ORG_ROLES, MEMBER_STATUS } = require('../config/constants');

const organizationMemberSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: Object.values(ORG_ROLES),
      default: ORG_ROLES.MEMBER,
    },
    status: {
      type: String,
      enum: Object.values(MEMBER_STATUS),
      default: MEMBER_STATUS.ACTIVE,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('OrganizationMember', organizationMemberSchema);
