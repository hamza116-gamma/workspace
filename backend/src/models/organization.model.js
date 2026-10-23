const mongoose = require('mongoose');
const { ORGANIZATION_STATUS } = require('../config/constants');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String, default: null },
    logoPublicId: { type: String, default: null },
    settings: {
      allowMemberChannelCreation: { type: Boolean, default: true },
      defaultChannelType: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC' },
    },
    // Shareable join link; only owners/admins can read the token.
    inviteLink: {
      token: { type: String, default: null, select: false },
      expiresAt: { type: Date, default: null },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    status: {
      type: String,
      enum: Object.values(ORGANIZATION_STATUS),
      default: ORGANIZATION_STATUS.ACTIVE,
    },
  },
  { timestamps: true },
);

organizationSchema.index({ 'inviteLink.token': 1 }, { sparse: true });

module.exports = mongoose.model('Organization', organizationSchema);
