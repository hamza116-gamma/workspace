const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const messageController = require('../controllers/message.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/:messageId/thread', messageController.thread);
router.post('/:messageId/follow', messageController.followThread);
router.delete('/:messageId/follow', messageController.unfollowThread);
router.patch('/:messageId', messageController.update);
router.delete('/:messageId', messageController.remove);
router.post('/:messageId/reactions', messageController.toggleReaction);

module.exports = router;
