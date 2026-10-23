const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { AppError } = require('../utils/AppError');
const sessionService = require('../services/session.service');
const { disconnectSessions } = require('../sockets/kick');

// GET /users/me/sessions
const list = asyncHandler(async (req, res) => {
  const sessions = await sessionService.listActiveSessions(req.user._id);
  success(res, {
    sessions: sessions.map((session) => sessionService.toPublicSession(session, req.session._id)),
  });
});

// DELETE /users/me/sessions/:sessionId (use logout for the current one)
const revoke = asyncHandler(async (req, res) => {
  if (String(req.params.sessionId) === String(req.session._id)) {
    throw new AppError(400, 'Use sign out to end your current session');
  }
  const revoked = await sessionService.revokeUserSession(req.user._id, req.params.sessionId);
  if (!revoked) {
    throw new AppError(404, 'Session not found');
  }
  disconnectSessions(req.app.get('io'), [req.params.sessionId]);
  success(res, { message: 'Session signed out' });
});

// POST /users/me/sessions/revoke-others
const revokeOthers = asyncHandler(async (req, res) => {
  const ids = await sessionService.revokeSessionsExcept(req.user._id, req.session._id);
  disconnectSessions(req.app.get('io'), ids);
  success(res, { revoked: ids.length });
});

module.exports = { list, revoke, revokeOthers };
