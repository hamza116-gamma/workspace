const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const attachmentController = require('../controllers/attachment.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.post('/signature', attachmentController.getSignature);
router.get('/:attachmentId/download', attachmentController.download);

module.exports = router;
