const mongoose = require('mongoose');
const Huddle = require('../models/huddle.model');
const ChannelMember = require('../models/channelMember.model');
const Conversation = require('../models/conversation.model');
const { AppError } = require('../utils/AppError');
const {
  HUDDLE_STATUS,
  HUDDLE_INVITE_STATUS,
  CHANNEL_MEMBER_STATUS,
} = require('../config/constants');
const { idOf, resolveTarget, assertHuddleAccess } = require('./huddleAccess.service');
const messageService = require('./message.service');

// P2P mesh: keep rooms small.
const MAX_PARTICIPANTS = 8;
const RING_MS = 30 * 1000;
const HISTORY_LIMIT = 20;

const POPULATE = ['startedBy', 'participants.user', 'invites.user'];

const miniUser = (user) =>
  user && user.fullName
    ? { id: String(user._id), fullName: user.fullName, avatarUrl: user.avatarUrl || null }
    : { id: idOf(user), fullName: '', avatarUrl: null };

const toPublicHuddle = (huddle) => ({
  id: String(huddle._id),
  organizationId: idOf(huddle.organization),
  channelId: huddle.channel ? idOf(huddle.channel) : null,
  conversationId: huddle.conversation ? idOf(huddle.conversation) : null,
  startedBy: miniUser(huddle.startedBy),
  status: huddle.status,
  participants: huddle.participants
    .filter((participant) => !participant.leftAt)
    .map((participant) => ({ user: miniUser(participant.user), joinedAt: participant.joinedAt })),
  invites: huddle.invites
    .filter((invite) => invite.status !== HUDDLE_INVITE_STATUS.JOINED)
    .map((invite) => ({
      user: miniUser(invite.user),
      status: invite.status,
      expiresAt: invite.expiresAt,
    })),
  hadVideo: huddle.hadVideo,
  hadScreenShare: huddle.hadScreenShare,
  messageId: huddle.message ? idOf(huddle.message) : null,
  outcome: huddle.outcome,
  startedAt: huddle.createdAt,
  endedAt: huddle.endedAt,
  durationSeconds: huddle.durationSeconds,
});

const populate = (huddle) => huddle.populate(POPULATE);

const activeParticipant = (huddle, userId) =>
  huddle.participants.find((p) => !p.leftAt && idOf(p.user) === String(userId));

const activeCount = (huddle) => huddle.participants.filter((p) => !p.leftAt).length;

const everJoinedIds = (huddle) => [...new Set(huddle.participants.map((p) => idOf(p.user)))];

const findInvite = (huddle, userId) => huddle.invites.find((i) => idOf(i.user) === String(userId));

const assertLive = (huddle) => {
  if (huddle.status !== HUDDLE_STATUS.LIVE) {
    throw new AppError(409, 'This huddle has ended');
  }
};

const loadForUser = async (huddleId, organizationId, userId) => {
  if (!mongoose.isValidObjectId(huddleId)) {
    throw new AppError(404, 'Huddle not found');
  }
  const huddle = await Huddle.findOne({ _id: huddleId, organization: organizationId });
  if (!huddle) {
    throw new AppError(404, 'Huddle not found');
  }
  await assertHuddleAccess(huddle, userId);
  return huddle;
};

const addParticipant = async (huddle, userId) => {
  assertLive(huddle);
  if (activeParticipant(huddle, userId)) {
    return huddle;
  }
  if (activeCount(huddle) >= MAX_PARTICIPANTS) {
    throw new AppError(409, `Huddles are limited to ${MAX_PARTICIPANTS} people`);
  }
  huddle.participants.push({ user: userId, joinedAt: new Date(), leftAt: null });
  const invite = findInvite(huddle, userId);
  if (invite) {
    invite.status = HUDDLE_INVITE_STATUS.JOINED;
  }
  await huddle.save();
  return huddle;
};

const ringInvites = (huddle, userIds, invitedBy) => {
  const now = Date.now();
  userIds.forEach((userId) => {
    const existing = findInvite(huddle, userId);
    const fields = {
      status: HUDDLE_INVITE_STATUS.RINGING,
      invitedBy,
      invitedAt: new Date(now),
      expiresAt: new Date(now + RING_MS),
    };
    if (existing) {
      Object.assign(existing, fields);
    } else {
      huddle.invites.push({ user: userId, ...fields });
    }
  });
};

// Starts a huddle (or joins the LIVE one in that chat). Returns
// { huddle, created, card } - card is the new call-log message, if any.
const startHuddle = async (organizationId, user, body = {}) => {
  const target = await resolveTarget(organizationId, user._id, body);
  const filter = target.channel
    ? { channel: target.channel, status: HUDDLE_STATUS.LIVE }
    : { conversation: target.conversation, status: HUDDLE_STATUS.LIVE };
  const existing = await Huddle.findOne(filter);
  if (existing) {
    return { huddle: await addParticipant(existing, user._id), created: false, card: null };
  }
  let huddle;
  try {
    huddle = new Huddle({
      ...target,
      startedBy: user._id,
      participants: [{ user: user._id, joinedAt: new Date() }],
    });
    if (target.conversation) {
      const conversation = await Conversation.findById(target.conversation).select('participants');
      const others = conversation.participants
        .map((participant) => idOf(participant.user))
        .filter((id) => id !== String(user._id));
      ringInvites(huddle, others, user._id);
    }
    await huddle.save();
  } catch (error) {
    if (error?.code === 11000) {
      const live = await Huddle.findOne(filter);
      if (live) {
        return { huddle: await addParticipant(live, user._id), created: false, card: null };
      }
    }
    throw error;
  }
  const card = await messageService.attachHuddle(target, user._id, huddle._id, 'Huddle started');
  huddle.message = card._id;
  await huddle.save();
  return { huddle, created: true, card };
};

const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
};

const cardText = (huddle) => {
  if (huddle.outcome === 'MISSED') {
    return 'Missed huddle';
  }
  if (huddle.outcome === 'DECLINED') {
    return 'Huddle declined';
  }
  const people = everJoinedIds(huddle).length;
  return `Huddle ended · ${formatDuration(huddle.durationSeconds)} · ${people} ${
    people === 1 ? 'person' : 'people'
  }`;
};

// Ends a LIVE huddle and rewrites its card. Returns { huddle, card } or null
// when it had already ended.
const endHuddle = async (huddle, endedBy, outcome = null) => {
  const now = new Date();
  const ended = await Huddle.findOneAndUpdate(
    { _id: huddle._id, status: HUDDLE_STATUS.LIVE },
    {
      $set: {
        status: HUDDLE_STATUS.ENDED,
        endedAt: now,
        endedBy: endedBy || null,
        outcome,
        durationSeconds: Math.round((now - huddle.createdAt) / 1000),
        'participants.$[open].leftAt': now,
      },
    },
    { new: true, arrayFilters: [{ 'open.leftAt': null }] },
  );
  if (!ended) {
    return null;
  }
  ended.invites.forEach((invite) => {
    if (invite.status === HUDDLE_INVITE_STATUS.RINGING) {
      invite.status = HUDDLE_INVITE_STATUS.MISSED;
    }
  });
  await ended.save();
  const card = ended.message
    ? await messageService.rewriteHuddleCard(ended.message, cardText(ended))
    : null;
  return { huddle: ended, card };
};

// Unanswered DM call: only the caller ever joined and nobody is still ringing.
const isUnansweredDm = (huddle) =>
  Boolean(huddle.conversation) &&
  everJoinedIds(huddle).length <= 1 &&
  !huddle.invites.some((invite) => invite.status === HUDDLE_INVITE_STATUS.RINGING);

const unansweredOutcome = (huddle) =>
  huddle.invites.some((invite) => invite.status === HUDDLE_INVITE_STATUS.DECLINED)
    ? 'DECLINED'
    : 'MISSED';

// Returns { huddle, ended: { huddle, card } | null }.
const leaveForUser = async (huddle, userId) => {
  const participant = activeParticipant(huddle, userId);
  if (!participant || huddle.status !== HUDDLE_STATUS.LIVE) {
    return { huddle, ended: null };
  }
  participant.leftAt = new Date();
  await huddle.save();
  if (activeCount(huddle) > 0) {
    return { huddle, ended: null };
  }
  // The caller hung up before anyone answered -> missed / declined card.
  const outcome =
    huddle.conversation && everJoinedIds(huddle).length <= 1 ? unansweredOutcome(huddle) : null;
  return { huddle, ended: await endHuddle(huddle, userId, outcome) };
};

const endForUser = async (huddle, userId) => {
  assertLive(huddle);
  if (idOf(huddle.startedBy) !== String(userId)) {
    throw new AppError(403, 'Only the person who started the huddle can end it for everyone');
  }
  return endHuddle(huddle, userId);
};

// Returns { huddle, ended } (DM calls end when nobody is left to answer).
const declineForUser = async (huddle, userId) => {
  assertLive(huddle);
  const invite = findInvite(huddle, userId);
  if (!invite || invite.status !== HUDDLE_INVITE_STATUS.RINGING) {
    return { huddle, ended: null };
  }
  invite.status = HUDDLE_INVITE_STATUS.DECLINED;
  await huddle.save();
  if (isUnansweredDm(huddle)) {
    return { huddle, ended: await endHuddle(huddle, null, unansweredOutcome(huddle)) };
  }
  return { huddle, ended: null };
};

// Marks expired RINGING invites MISSED. Returns { expiredIds, ended }.
const expireInvites = async (huddle, now = Date.now()) => {
  const expiredIds = [];
  huddle.invites.forEach((invite) => {
    if (invite.status === HUDDLE_INVITE_STATUS.RINGING && invite.expiresAt.getTime() <= now) {
      invite.status = HUDDLE_INVITE_STATUS.MISSED;
      expiredIds.push(idOf(invite.user));
    }
  });
  if (expiredIds.length === 0) {
    return { expiredIds, ended: null };
  }
  await huddle.save();
  const ended = isUnansweredDm(huddle)
    ? await endHuddle(huddle, null, unansweredOutcome(huddle))
    : null;
  return { expiredIds, ended };
};

const nextRingExpiry = (huddle) =>
  huddle.invites
    .filter((invite) => invite.status === HUDDLE_INVITE_STATUS.RINGING)
    .map((invite) => invite.expiresAt.getTime())
    .sort((a, b) => a - b)[0] || null;

// "Add people" candidates: chat members active in the org, not in the huddle.
const listCandidates = async (huddle, audience) => {
  const inside = new Set(huddle.participants.filter((p) => !p.leftAt).map((p) => idOf(p.user)));
  return audience.filter((id) => !inside.has(id));
};

const inviteUsers = async (huddle, actorId, userIds, audience) => {
  assertLive(huddle);
  if (!activeParticipant(huddle, actorId)) {
    throw new AppError(403, 'Join the huddle to add people');
  }
  const allowed = new Set(await listCandidates(huddle, audience));
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter(
    (id) => allowed.has(id) && id !== String(actorId),
  );
  if (ids.length === 0) {
    throw new AppError(400, 'Nobody to add');
  }
  ringInvites(huddle, ids, actorId);
  await huddle.save();
  return ids;
};

// Sticky flags for the call log.
const noteMedia = async (huddleId, { video, screen }) => {
  const set = {};
  if (video) set.hadVideo = true;
  if (screen) set.hadScreenShare = true;
  if (Object.keys(set).length) {
    await Huddle.updateOne({ _id: huddleId }, { $set: set });
  }
};

// LIVE huddles the user can see (sidebar pills, ringing after reload).
const listActiveForUser = async (organizationId, userId) => {
  const [memberships, conversations] = await Promise.all([
    ChannelMember.find({ user: userId, status: { $ne: CHANNEL_MEMBER_STATUS.REMOVED } }).select(
      'channel',
    ),
    Conversation.find({ organization: organizationId, 'participants.user': userId }).select('_id'),
  ]);
  return Huddle.find({
    organization: organizationId,
    status: HUDDLE_STATUS.LIVE,
    $or: [
      { channel: { $in: memberships.map((m) => m.channel) } },
      { conversation: { $in: conversations.map((c) => c._id) } },
    ],
  }).populate(POPULATE);
};

const listHistory = async (organizationId, userId, query = {}) => {
  const target = await resolveTarget(organizationId, userId, query);
  const filter = { status: HUDDLE_STATUS.ENDED };
  if (target.channel) filter.channel = target.channel;
  else filter.conversation = target.conversation;
  return Huddle.find(filter).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).populate(POPULATE);
};

module.exports = {
  MAX_PARTICIPANTS,
  toPublicHuddle,
  populate,
  activeParticipant,
  loadForUser,
  startHuddle,
  addParticipant,
  leaveForUser,
  endForUser,
  endHuddle,
  declineForUser,
  expireInvites,
  nextRingExpiry,
  listCandidates,
  inviteUsers,
  noteMedia,
  listActiveForUser,
  listHistory,
};
