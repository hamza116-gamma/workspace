const mongoose = require('mongoose');
const { ROLES, PRESENCE_STATES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
    avatarPublicId: { type: String, default: null },
    jobTitle: { type: String, default: '' },
    department: { type: String, default: '' },
    presence: {
      type: String,
      enum: Object.values(PRESENCE_STATES),
      default: PRESENCE_STATES.OFFLINE,
    },
    statusMessage: { type: String, default: '' },
    statusEmoji: { type: String, default: '' },
    statusClearAt: { type: Date, default: null },
    // Do Not Disturb: active while in the future (utils/dnd.js).
    dndUntil: { type: Date, default: null },
    theme: { type: String, default: 'SYSTEM' },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.MEMBER },
    isDisabled: { type: Boolean, default: false },
    disabledAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Set once the welcome intro was finished or skipped (null = show it).
    introSeenAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('User', userSchema);
