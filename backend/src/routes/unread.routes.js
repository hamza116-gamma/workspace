const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const unreadController = require('../controllers/unread.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', unreadController.getSummary);

module.exports = router;
