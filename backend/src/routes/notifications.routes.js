const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const notificationController = require('../controllers/notification.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', notificationController.list);
router.get('/summary', notificationController.summary);
router.patch('/:notificationId/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);
router.delete('/:notificationId', notificationController.remove);

module.exports = router;
