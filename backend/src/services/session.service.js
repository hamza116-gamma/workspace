const mongoose = require('mongoose');
const { env } = require('../config/env');
const Session = require('../models/session.model');
const User = require('../models/user.model');
const { generateToken, hashToken } = require('../utils/token');

const createSession = async (user, meta = {}) => {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.session.ttlDays * 24 * 60 * 60 * 1000);

  await Session.create({
    user: user._id,
    activeOrganization: meta.activeOrganizationId || null,
    tokenHash: hashToken(token),
    userAgent: meta.userAgent || '',
    ipAddress: meta.ipAddress || '',
    expiresAt,
  });

  return { token, expiresAt };
};

// Hidden (select: false) user fields never leave the lookup.
const HIDDEN_USER_FIELDS = {
  passwordHash: 0,
  passwordResetTokenHash: 0,
  passwordResetExpiresAt: 0,
};

// Session + user in ONE round trip ($lookup), returned as hydrated documents
// (session.save() and req.user methods keep working).
const findActiveSessionWhere = async (match) => {
  const [row] = await Session.aggregate([
    { $match: { ...match, revokedAt: null, expiresAt: { $gt: new Date() } } },
    { $limit: 1 },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'user',
        foreignField: '_id',
        pipeline: [{ $project: HIDDEN_USER_FIELDS }],
        as: 'userDocs',
      },
    },
  ]);
  if (!row) {
    return null;
  }
  const { userDocs, ...sessionFields } = row;
  const session = Session.hydrate(sessionFields);
  if (!userDocs[0]) {
    session.user = null;
    return session;
  }
  // Mark the path populated so the assigned document is kept as-is.
  session.populated('user', userDocs[0]._id);
  // Pass the projection so Mongoose knows the hidden fields were deselected;
  // otherwise user.save() fails "passwordHash is required".
  session.user = User.hydrate(userDocs[0], HIDDEN_USER_FIELDS);
  return session;
};

const findActiveSession = (token) => findActiveSessionWhere({ tokenHash: hashToken(token) });

// Used by socket tickets (which carry the session id, not the secret token).
const findActiveSessionById = (sessionId) =>
  mongoose.isValidObjectId(sessionId)
    ? findActiveSessionWhere({ _id: new mongoose.Types.ObjectId(sessionId) })
    : Promise.resolve(null);

const setActiveOrganization = async (session, organizationId) => {
  session.activeOrganization = organizationId;
  await session.save();
  return session;
};

const revokeSession = (token) =>
  Session.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });

const findSessionId = async (token) => {
  if (!token) {
    return null;
  }
  const session = await Session.findOne({ tokenHash: hashToken(token) }).select('_id');
  return session ? String(session._id) : null;
};

// Revokes the user's live sessions (optionally keeping one) and returns the
// revoked ids so their sockets can be disconnected (sockets/kick.js).
const revokeSessionsExcept = async (userId, keepSessionId = null) => {
  const filter = { user: userId, revokedAt: null };
  if (keepSessionId) {
    filter._id = { $ne: keepSessionId };
  }
  const sessions = await Session.find(filter).select('_id');
  await Session.updateMany(filter, { revokedAt: new Date() });
  return sessions.map((session) => String(session._id));
};

const listActiveSessions = (userId) =>
  Session.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({
    updatedAt: -1,
  });

const toPublicSession = (session, currentSessionId) => ({
  id: session._id,
  userAgent: session.userAgent,
  ipAddress: session.ipAddress,
  createdAt: session.createdAt,
  lastActiveAt: session.updatedAt,
  expiresAt: session.expiresAt,
  current: String(session._id) === String(currentSessionId),
});

// Revokes one of the user's own sessions; returns false if none matched.
const revokeUserSession = async (userId, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) {
    return false;
  }
  const result = await Session.updateOne(
    { _id: sessionId, user: userId, revokedAt: null },
    { revokedAt: new Date() },
  );
  return result.modifiedCount > 0;
};

const revokeAllSessions = (userId) => revokeSessionsExcept(userId);

module.exports = {
  createSession,
  findActiveSession,
  findActiveSessionById,
  setActiveOrganization,
  revokeSession,
  revokeAllSessions,
  revokeSessionsExcept,
  findSessionId,
  listActiveSessions,
  toPublicSession,
  revokeUserSession,
};
