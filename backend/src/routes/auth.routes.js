const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  authIpLimiter: authLimiter,
  loginAccountLimiter,
  resetAccountLimiter,
  passwordChangeLimiter,
} = require('../middleware/rateLimiters');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, loginAccountLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/socket-ticket', requireAuth, authController.socketTicket);
router.post(
  '/password/reset',
  authLimiter,
  resetAccountLimiter,
  authController.requestPasswordReset,
);
router.post('/password/reset/confirm', authLimiter, authController.resetPassword);
router.post('/password/change', requireAuth, passwordChangeLimiter, authController.changePassword);

module.exports = router;
