const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/user.controller');
const sessionController = require('../controllers/session.controller');

const router = Router();

router.use(requireAuth);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.patch('/me/dnd', userController.updateDnd);
router.get('/me/avatar/signature', userController.getAvatarSignature);
router.patch('/me/avatar', userController.updateAvatar);

router.get('/me/sessions', sessionController.list);
router.post('/me/sessions/revoke-others', sessionController.revokeOthers);
router.delete('/me/sessions/:sessionId', sessionController.revoke);

module.exports = router;
