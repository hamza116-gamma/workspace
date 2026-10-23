const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const {
  requireChannel,
  requireChannelWrite,
  requireChannelModerator,
  requireChannelModeratorOrSelf,
} = require('../middleware/channel');
const channelController = require('../controllers/channel.controller');
const messageController = require('../controllers/message.controller');
const attachmentController = require('../controllers/attachment.controller');
const pinController = require('../controllers/pin.controller');
const linkController = require('../controllers/link.controller');
const unreadController = require('../controllers/unread.controller');
const scheduledController = require('../controllers/scheduled.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', channelController.list);
router.post('/', channelController.create);

router.get('/:channelId', requireChannel, channelController.get);
router.patch('/:channelId', requireChannel, requireChannelModerator, channelController.update);
router.delete('/:channelId', requireChannel, requireChannelModerator, channelController.archive);

router.post(
  '/:channelId/unarchive',
  requireChannel,
  requireChannelModerator,
  channelController.unarchive,
);

router.post('/:channelId/join', requireChannel, channelController.join);
router.post('/:channelId/leave', requireChannel, channelController.leave);

router.get('/:channelId/messages', requireChannel, messageController.listChannel);
router.post(
  '/:channelId/messages',
  requireChannel,
  requireChannelWrite,
  messageController.createChannel,
);
router.post(
  '/:channelId/scheduled',
  requireChannel,
  requireChannelWrite,
  scheduledController.createForChannel,
);
router.post('/:channelId/read', requireChannel, unreadController.readChannel);

router.get('/:channelId/attachments', requireChannel, attachmentController.listChannel);
router.get('/:channelId/links', requireChannel, linkController.listChannel);

router.get('/:channelId/pins', requireChannel, pinController.list);
router.post('/:channelId/pins/:messageId', requireChannel, requireChannelWrite, pinController.pin);
router.delete(
  '/:channelId/pins/:messageId',
  requireChannel,
  requireChannelWrite,
  pinController.unpin,
);

router.get('/:channelId/members', requireChannel, channelController.listMembers);
router.post(
  '/:channelId/members',
  requireChannel,
  requireChannelModerator,
  channelController.addMembers,
);
router.patch('/:channelId/members/me', requireChannel, channelController.updateMyPreference);
router.get(
  '/:channelId/candidates',
  requireChannel,
  requireChannelModerator,
  channelController.listCandidates,
);
router.delete(
  '/:channelId/members/:userId',
  requireChannel,
  requireChannelModeratorOrSelf,
  channelController.removeMember,
);

module.exports = router;
