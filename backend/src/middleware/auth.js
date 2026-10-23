const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { readSessionCookie } = require('../utils/cookies');
const { findActiveSession } = require('../services/session.service');

const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = readSessionCookie(req);
  if (!token) {
    throw new AppError(401, 'Authentication required');
  }

  const session = await findActiveSession(token);
  if (!session || !session.user) {
    throw new AppError(401, 'Session is invalid or has expired');
  }
  if (session.user.isDisabled) {
    throw new AppError(403, 'This account has been disabled');
  }

  req.user = session.user;
  req.session = session;
  next();
});

const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, 'You do not have permission to perform this action'));
      return;
    }
    next();
  };

module.exports = { requireAuth, requireRole };
