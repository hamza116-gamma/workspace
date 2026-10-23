const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const { createAvatarSignature, destroyAsset } = require('../utils/media');
const userService = require('../services/user.service');
const presenceService = require('../services/presence.service');

const getMe = asyncHandler(async (req, res) => {
  success(res, { user: userService.toPublicUser(req.user) });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user, req.body);
  success(res, { user: userService.toPublicUser(user) });
});

const getAvatarSignature = asyncHandler(async (req, res) => {
  success(res, createAvatarSignature(String(req.user._id)));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const { user, removablePublicId } = await userService.updateAvatar(req.user, {
    publicId: req.body.publicId,
    url: req.body.url,
  });
  // Only an old avatar inside this user's own folder is ever destroyed.
  destroyAsset(removablePublicId).catch(() => {});
  success(res, { user: userService.toPublicUser(user) });
});

// PATCH /users/me/dnd { minutes } | { until } | { off: true }
const updateDnd = asyncHandler(async (req, res) => {
  const user = await userService.updateDnd(req.user, req.body || {});
  await presenceService.updateDnd(req.app.get('io'), user);
  success(res, { user: userService.toPublicUser(user) });
});

module.exports = { updateDnd, getMe, updateMe, getAvatarSignature, updateAvatar };
