const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { createSessionCookie, clearSessionCookie, readSessionCookie } = require('../utils/cookies');
const authService = require('../services/auth.service');
const { toPublicUser } = require('../services/user.service');
const { disconnectSessions, disconnectUser } = require('../sockets/kick');

const requestMeta = (req) => ({
  userAgent: req.get('user-agent') || '',
  ipAddress: req.ip,
});

const startSession = (res, token) => {
  res.setHeader('Set-Cookie', createSessionCookie(token));
};

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body, requestMeta(req));
  startSession(res, token);
  success(res, { user: toPublicUser(user) }, 201);
});

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login({
    email: req.body.email,
    password: req.body.password,
    ...requestMeta(req),
  });
  startSession(res, token);
  success(res, { user: toPublicUser(user) });
});

const logout = asyncHandler(async (req, res) => {
  const sessionId = await authService.logout(readSessionCookie(req));
  if (sessionId) {
    disconnectSessions(req.app.get('io'), [sessionId]);
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  success(res, { message: 'Logged out' });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  success(res, { message: authService.GENERIC_RESET_MESSAGE });
});

const resetPassword = asyncHandler(async (req, res) => {
  const user = await authService.resetPassword(req.body.token, req.body.newPassword);
  disconnectUser(req.app.get('io'), user._id);
  success(res, { message: 'Password has been reset' });
});

const changePassword = asyncHandler(async (req, res) => {
  const revokedSessionIds = await authService.changePassword(
    req.user._id,
    req.body.currentPassword,
    req.body.newPassword,
    req.session?._id,
  );
  disconnectSessions(req.app.get('io'), revokedSessionIds);
  success(res, { message: 'Password has been changed' });
});

module.exports = { register, login, logout, requestPasswordReset, resetPassword, changePassword };
