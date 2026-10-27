const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { requireConversation } = require('../middleware/conversation');
const conversationController = require('../controllers/conversation.controller');
const messageController = require('../controllers/message.controller');
const attachmentController = require('../controllers/attachment.controller');
const linkController = require('../controllers/link.controller');
const unreadController = require('../controllers/unread.controller');
const scheduledController = require('../controllers/scheduled.controller');
const taskController = require('../controllers/task.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', conversationController.list);
router.post('/', conversationController.create);
router.post('/find', conversationController.find);
router.get('/candidates', conversationController.listCandidates);

router.get('/:conversationId', requireConversation, conversationController.get);
router.post(
  '/:conversationId/participants',
  requireConversation,
  conversationController.addParticipants,
);

router.get('/:conversationId/messages', requireConversation, messageController.listConversation);
router.post('/:conversationId/messages', requireConversation, messageController.createConversation);
router.post(
  '/:conversationId/scheduled',
  requireConversation,
  scheduledController.createForConversation,
);
router.get('/:conversationId/tasks', requireConversation, taskController.listConversation);
router.post('/:conversationId/tasks', requireConversation, taskController.createInConversation);
router.post('/:conversationId/read', requireConversation, unreadController.readConversation);

router.patch(
  '/:conversationId/preferences',
  requireConversation,
  conversationController.updatePreferences,
);

router.get(
  '/:conversationId/attachments',
  requireConversation,
  attachmentController.listConversation,
);

router.get('/:conversationId/links', requireConversation, linkController.listConversation);

module.exports = router;
