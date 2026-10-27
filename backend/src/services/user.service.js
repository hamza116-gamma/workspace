const User = require('../models/user.model');
const { AppError } = require('../utils/AppError');
const { THEMES, PRESENCE_STATES } = require('../config/constants');
const { hashPassword } = require('../utils/password');
const {
  assertEmail,
  assertPassword,
  assertString,
  toOptionalString,
} = require('../utils/validation');
const { avatarFolder } = require('../utils/media');
const { assertOwnedAsset, isInFolder } = require('../utils/attachments');
const { isDndActive, resolveDndUntil } = require('../utils/dnd');

const toPublicUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  avatarUrl: user.avatarUrl,
  jobTitle: user.jobTitle,
  department: user.department,
  presence: user.presence,
  statusMessage: user.statusMessage,
  statusEmoji: user.statusEmoji,
  statusClearAt: user.statusClearAt,
  // Exposed only while active.
  dndUntil: isDndActive(user) ? user.dndUntil : null,
  theme: user.theme,
  role: user.role,
  isDisabled: user.isDisabled,
  lastLoginAt: user.lastLoginAt,
  introSeenAt: user.introSeenAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const findByEmail = (email, { withPassword = false } = {}) => {
  const query = User.findOne({ email: String(email).toLowerCase().trim() });
  if (withPassword) {
    query.select('+passwordHash');
  }
  return query;
};

const findById = (id, { withPassword = false } = {}) => {
  const query = User.findById(id);
  if (withPassword) {
    query.select('+passwordHash');
  }
  return query;
};

const createUser = async (payload) => {
  const email = assertEmail(payload.email);
  const password = assertPassword(payload.password);
  const fullName = assertString(payload.fullName, 'Full name');

  const existing = await User.exists({ email });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  return User.create({
    fullName,
    email,
    // A client-sent `role` is ignored: new accounts are always regular users.
    passwordHash: await hashPassword(password),
  });
};

const updateProfile = async (user, payload) => {
  if (payload.fullName !== undefined) {
    user.fullName = assertString(payload.fullName, 'Full name');
  }
  if (payload.jobTitle !== undefined) {
    user.jobTitle = toOptionalString(payload.jobTitle);
  }
  if (payload.department !== undefined) {
    user.department = toOptionalString(payload.department);
  }
  if (payload.statusMessage !== undefined) {
    user.statusMessage = toOptionalString(payload.statusMessage);
  }
  if (payload.statusEmoji !== undefined) {
    user.statusEmoji = toOptionalString(payload.statusEmoji);
  }
  if (payload.statusClearAt !== undefined) {
    user.statusClearAt = payload.statusClearAt ? new Date(payload.statusClearAt) : null;
  }
  if (payload.presence !== undefined) {
    if (!Object.values(PRESENCE_STATES).includes(payload.presence)) {
      throw new AppError(400, 'Unsupported presence state');
    }
    user.presence = payload.presence;
  }
  // introSeen: true after the welcome intro, false to replay it.
  if (payload.introSeen !== undefined) {
    user.introSeenAt = payload.introSeen ? new Date() : null;
  }
  if (payload.theme !== undefined) {
    if (!Object.values(THEMES).includes(payload.theme)) {
      throw new AppError(400, 'Unsupported theme');
    }
    user.theme = payload.theme;
  }

  await user.save();
  return user;
};

// The new avatar must live in the user's own signed folder. Returns the old
// publicId only when it is safe to delete (inside the same folder).
const updateAvatar = async (user, { publicId, url }) => {
  if (!publicId || !url) {
    throw new AppError(400, 'Avatar publicId and url are required');
  }
  const folder = avatarFolder(user._id);
  const ownedId = assertOwnedAsset({ url, publicId }, folder, 'Avatar does not belong to you');
  const previous = user.avatarPublicId;
  user.avatarPublicId = ownedId;
  user.avatarUrl = String(url);
  await user.save();
  const removablePublicId =
    previous && previous !== ownedId && isInFolder(previous, folder) ? previous : null;
  return { user, removablePublicId };
};

// Sets or clears Do Not Disturb. Returns the saved user.
const updateDnd = async (user, payload) => {
  user.dndUntil = resolveDndUntil(payload);
  await user.save();
  return user;
};

module.exports = {
  updateDnd,
  toPublicUser,
  findByEmail,
  findById,
  createUser,
  updateProfile,
  updateAvatar,
};
