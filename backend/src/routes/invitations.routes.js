const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { inviteLookupLimiter, inviteLinkJoinLimiter } = require('../middleware/rateLimiters');
const invitationController = require('../controllers/invitation.controller');
const inviteLinkController = require('../controllers/inviteLink.controller');

const router = Router();

// Shareable workspace link (must come before /:token).
router.get('/link/:token', inviteLookupLimiter, inviteLinkController.lookup);
router.post('/link/join', requireAuth, inviteLinkJoinLimiter, inviteLinkController.join);

// Public: used by the invite/register pages before the invitee has a session.
router.get('/:token', inviteLookupLimiter, invitationController.lookup);

router.post('/accept', requireAuth, invitationController.accept);

module.exports = router;
