const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const savedController = require('../controllers/saved.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', savedController.list);
router.post('/:messageId', savedController.save);
router.delete('/:messageId', savedController.remove);

module.exports = router;
