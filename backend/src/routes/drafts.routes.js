const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const draftController = require('../controllers/draft.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.get('/', draftController.list);
router.put('/', draftController.save);
router.delete('/:id', draftController.remove);

module.exports = router;
