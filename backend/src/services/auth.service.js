const { env, isProduction } = require('../config/env');
const { logger } = require('../config/logger');
const { PRESENCE_STATES, MEMBER_STATUS } = require('../config/constants');
const User = require('../models/user.model');
const OrganizationMember = require('../models/organizationMember.model');
const { AppError } = require('../utils/AppError');
const { hashPassword, verifyPassword } = require('../utils/password');
const { assertEmail, assertPassword } = require('../utils/validation');
const { generateToken, hashToken } = require('../utils/token');
const { sendMail, isEmailConfigured } = require('../utils/mail');
const { passwordResetEmail } = require('../utils/emailTemplates');
const userService = require('./user.service');
const sessionService = require('./session.service');
const organizationService = require('./organization.service');

const RESET_TTL_MS = 1000 * 60 * 60;
// Verified for unknown emails so a miss costs the same scrypt work as a hit.
const DUMMY_HASH_PROMISE = hashPassword('timing-equalizer-password');
const GENERIC_RESET_MESSAGE = 'If the account exists, a reset link has been sent';

const login = async ({ email, password, userAgent, ipAddress }) => {
  const normalizedEmail = assertEmail(email);
  if (typeof password !== 'string' || password === '') {
    throw new AppError(400, 'Password is required');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  const valid = await verifyPassword(password, user ? user.passwordHash : await DUMMY_HASH_PROMISE);
  if (!user || !valid) {
    throw new AppError(401, 'Invalid email or password');
  }
  if (user.isDisabled) {
    throw new AppError(403, 'This account has been disabled');
  }

  // Land in the oldest workspace the user is still an ACTIVE member of.
  const membership = await OrganizationMember.findOne({
    user: user._id,
    status: MEMBER_STATUS.ACTIVE,
  }).sort({ createdAt: 1 });

  const { token, expiresAt } = await sessionService.createSession(user, {
    userAgent,
    ipAddress,
    activeOrganizationId: membership ? membership.organization : null,
  });

  user.lastLoginAt = new Date();
  user.presence = PRESENCE_STATES.ACTIVE;
  await user.save();

  return { user, token, expiresAt };
};

const register = async (payload, meta = {}) => {
  const user = await userService.createUser(payload);

  let activeOrganizationId = null;
  if (payload.organizationName) {
    const { organization } = await organizationService.createOrganization(user, {
      name: payload.organizationName,
    });
    activeOrganizationId = organization._id;
  }

  const { token, expiresAt } = await sessionService.createSession(user, {
    ...meta,
    activeOrganizationId,
  });

  return { user, token, expiresAt };
};

// Returns the logged-out session id so its sockets can be disconnected.
const logout = async (token) => {
  if (!token) {
    return null;
  }
  const sessionId = await sessionService.findSessionId(token);
  await sessionService.revokeSession(token);
  return sessionId;
};

const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: assertEmail(email) }).select(
    '+passwordResetTokenHash +passwordResetExpiresAt',
  );

  if (!user) {
    return;
  }

  const token = generateToken();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  const resetLink = `${env.clientUrl}/reset-password?token=${token}`;

  if (isEmailConfigured()) {
    const { subject, text, html } = passwordResetEmail({ resetLink });
    // Same response whether or not delivery works (no account enumeration);
    // failures are logged for the operator.
    await sendMail({ to: user.email, subject, text, html }).catch((error) =>
      logger.error(`Password reset email failed: ${error.message}`),
    );
    return;
  }

  if (!isProduction) {
    logger.info(`Password reset link for ${user.email}: ${resetLink}`);
  }
};

const resetPassword = async (token, newPassword) => {
  if (typeof token !== 'string' || token === '') {
    throw new AppError(400, 'Reset token is required');
  }
  const password = assertPassword(newPassword);

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    throw new AppError(400, 'Reset token is invalid or has expired');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  await sessionService.revokeAllSessions(user._id);
  return user;
};

// Every OTHER session is revoked; returns their ids for socket disconnects.
const changePassword = async (userId, currentPassword, newPassword, currentSessionId) => {
  const password = assertPassword(newPassword);
  const user = await userService.findById(userId, { withPassword: true });

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  await user.save();

  return sessionService.revokeSessionsExcept(user._id, currentSessionId);
};

module.exports = {
  login,
  register,
  logout,
  requestPasswordReset,
  resetPassword,
  changePassword,
  GENERIC_RESET_MESSAGE,
};
