const { AppError } = require('../utils/AppError');
const { asyncHandler } = require('../utils/asyncHandler');
const { CHANNEL_ROLES, ORG_ROLES } = require('../config/constants');
const channelService = require('../services/channel.service');
const organizationService = require('../services/organization.service');

const ORG_ADMIN_ROLES = [ORG_ROLES.OWNER, ORG_ROLES.ADMIN];

const requireChannel = asyncHandler(async (req, _res, next) => {
  const { channel, membership, memberCount } = await channelService.loadWithAccess(
    req.params.channelId,
    req.organization._id,
    req.user._id,
  );
  req.channel = channel;
  req.channelMembership = membership;
  req.channelMemberCount = memberCount;
  next();
});

// Write actions (posting, reacting, pinning, following) need an active
// membership in a channel that is not archived. Reading public channels as a
// non-member stays allowed through requireChannel alone.
const requireChannelWrite = (req, _res, next) => {
  try {
    channelService.assertCanWrite(req.channel, req.channelMembership);
    next();
  } catch (error) {
    next(error);
  }
};

const isOrgAdmin = (req) => ORG_ADMIN_ROLES.includes(req.membership?.role);

const isChannelAdmin = (req) => {
  const isChannelModerator = req.channelMembership?.role === CHANNEL_ROLES.MODERATOR;
  return isChannelModerator || isOrgAdmin(req);
};

const requireChannelModerator = (req, _res, next) => {
  if (!isChannelAdmin(req)) {
    next(new AppError(403, 'You do not have permission to manage this channel'));
    return;
  }
  next();
};

const requireChannelModeratorOrSelf = asyncHandler(async (req, _res, next) => {
  const isSelf = String(req.params.userId) === String(req.user._id);
  if (isSelf) {
    next();
    return;
  }
  if (!isChannelAdmin(req)) {
    throw new AppError(403, 'You do not have permission to manage this channel');
  }
  // A channel moderator cannot remove workspace owners/admins; only another
  // workspace owner/admin can.
  if (!isOrgAdmin(req)) {
    const target = await organizationService.getMembership(req.params.userId, req.organization._id);
    if (target && ORG_ADMIN_ROLES.includes(target.role)) {
      throw new AppError(403, 'You cannot remove a workspace owner or admin from this channel');
    }
  }
  next();
});

module.exports = {
  requireChannel,
  requireChannelWrite,
  // Older name kept so existing imports keep working.
  requireChannelMember: requireChannelWrite,
  requireChannelModerator,
  requireChannelModeratorOrSelf,
};
