const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const scheduledController = require('../controllers/scheduled.controller');

// Creating lives under /channels/:id/scheduled and /conversations/:id/scheduled.
const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', scheduledController.list);
router.patch('/:id', scheduledController.update);
router.delete('/:id', scheduledController.cancel);
router.post('/:id/send', scheduledController.sendNow);

module.exports = router;
