const User = require('../models/user.model');
const OrganizationMember = require('../models/organizationMember.model');
const { AppError } = require('../utils/AppError');
const { PRESENCE_STATES, MEMBER_STATUS } = require('../config/constants');
const { isDndActive } = require('../utils/dnd');

// In-memory only (single instance). userId -> Set(socketId); userId -> state;
// userId -> DND expiry timer.
const connections = new Map();
const states = new Map();
const dndTimers = new Map();

const getState = (userId) => states.get(String(userId)) || PRESENCE_STATES.OFFLINE;

const isOnline = (userId) => connections.has(String(userId));

const broadcast = (io, organizationId, userId, state) => {
  if (!io || !organizationId) {
    return;
  }
  io.to(`org:${organizationId}`).emit('presence.updated', {
    userId: String(userId),
    presence: state,
  });
};

// DND shows in every workspace the user belongs to.
const broadcastToAllOrgs = async (io, userId, state) => {
  if (!io) {
    return;
  }
  const memberships = await OrganizationMember.find(
    { user: userId, status: MEMBER_STATUS.ACTIVE },
    'organization',
  );
  memberships.forEach((membership) => broadcast(io, membership.organization, userId, state));
};

const clearDndTimer = (id) => {
  clearTimeout(dndTimers.get(id));
  dndTimers.delete(id);
};

// Ends DND when dndUntil passes (timers are in-memory, so they are re-armed
// on connect after a restart).
const armDndTimer = (io, userId, dndUntil) => {
  const id = String(userId);
  clearDndTimer(id);
  const delay = new Date(dndUntil).getTime() - Date.now();
  if (delay <= 0) {
    return;
  }
  // setTimeout caps at ~24.8 days; DND is at most 7 days.
  dndTimers.set(
    id,
    setTimeout(() => {
      dndTimers.delete(id);
      // eslint-disable-next-line no-use-before-define
      expireDnd(io, id).catch(() => {});
    }, delay),
  );
};

const expireDnd = async (io, id) => {
  const user = await User.findById(id);
  if (!user || isDndActive(user)) {
    if (user) {
      armDndTimer(io, id, user.dndUntil);
    }
    return;
  }
  await User.updateOne({ _id: id }, { dndUntil: null });
  io?.to(`user:${id}`).emit('dnd.updated', { dndUntil: null });
  if (isOnline(id) && getState(id) === PRESENCE_STATES.DND) {
    states.set(id, PRESENCE_STATES.ACTIVE);
    await User.updateOne({ _id: id }, { presence: PRESENCE_STATES.ACTIVE });
    await broadcastToAllOrgs(io, id, PRESENCE_STATES.ACTIVE);
  }
};

const addConnection = async (io, socket, user, organizationId) => {
  const id = String(user._id);
  const sockets = connections.get(id) || new Set();
  sockets.add(socket.id);
  connections.set(id, sockets);

  const dnd = isDndActive(user);
  if (dnd && !dndTimers.has(id)) {
    armDndTimer(io, id, user.dndUntil);
  }

  if (sockets.size === 1) {
    const state =
      dnd || user.presence === PRESENCE_STATES.DND ? PRESENCE_STATES.DND : PRESENCE_STATES.ACTIVE;
    states.set(id, state);
    if (user.presence !== state) {
      await User.updateOne({ _id: user._id }, { presence: state });
    }
    broadcast(io, organizationId, id, state);
  }
};

const removeConnection = async (io, socket, organizationId) => {
  const id = socket.data.user ? String(socket.data.user._id) : null;
  if (!id) {
    return;
  }
  const sockets = connections.get(id);
  if (!sockets) {
    return;
  }
  sockets.delete(socket.id);
  if (sockets.size === 0) {
    connections.delete(id);
    states.set(id, PRESENCE_STATES.OFFLINE);
    await User.updateOne({ _id: id }, { presence: PRESENCE_STATES.OFFLINE });
    broadcast(io, organizationId, id, PRESENCE_STATES.OFFLINE);
  }
};

const setManual = async (io, user, state, organizationId) => {
  if (!Object.values(PRESENCE_STATES).includes(state)) {
    throw new AppError(400, 'Unsupported presence state');
  }
  const id = String(user._id);
  states.set(id, state);
  await User.updateOne({ _id: user._id }, { presence: state });
  broadcast(io, organizationId, id, state);
  return state;
};

// Called after User.dndUntil changed (PATCH /users/me/dnd). Online users show
// DND (or ACTIVE again) in all their workspaces; other tabs get dnd.updated.
const updateDnd = async (io, user) => {
  const id = String(user._id);
  const active = isDndActive(user);
  if (active) {
    armDndTimer(io, id, user.dndUntil);
  } else {
    clearDndTimer(id);
  }
  io?.to(`user:${id}`).emit('dnd.updated', { dndUntil: active ? user.dndUntil : null });

  if (!isOnline(id)) {
    return;
  }
  const next = active ? PRESENCE_STATES.DND : PRESENCE_STATES.ACTIVE;
  if (getState(id) === next) {
    return;
  }
  states.set(id, next);
  await User.updateOne({ _id: id }, { presence: next });
  await broadcastToAllOrgs(io, id, next);
};

module.exports = { getState, isOnline, addConnection, removeConnection, setManual, updateDnd };
