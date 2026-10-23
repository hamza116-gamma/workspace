const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const huddleController = require('../controllers/huddle.controller');

const router = Router();

router.use(requireAuth, requireOrganization);

router.post('/', huddleController.start);
router.get('/active', huddleController.active);
router.get('/history', huddleController.history);
router.post('/:id/join', huddleController.join);
router.post('/:id/leave', huddleController.leave);
router.post('/:id/end', huddleController.end);
router.post('/:id/decline', huddleController.decline);
router.get('/:id/candidates', huddleController.candidates);
router.post('/:id/invite', huddleController.invite);

module.exports = router;
