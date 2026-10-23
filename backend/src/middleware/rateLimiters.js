const { rateLimit } = require('./rateLimit');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const emailKey = (prefix) => (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email ? `${prefix}:${email}` : null;
};

// Per IP: every auth endpoint.
const authIpLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  message: 'Too many authentication attempts, please try again later',
});

// Per account email: slows credential stuffing spread across many IPs.
const loginAccountLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  key: emailKey('login'),
  message: 'Too many sign-in attempts for this account, please try again later',
});

const resetAccountLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  key: emailKey('reset'),
  message: 'Too many reset requests for this account, please try again later',
});

// Per signed-in user.
const passwordChangeLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  key: (req) => (req.user ? `password-change:${req.user._id}` : null),
  message: 'Too many password change attempts, please try again later',
});

// Per IP: public invitation token lookups.
const inviteLookupLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 60,
  key: (req) => `invite-lookup:${req.ip}`,
});

// Per user: joining through a shareable invite link.
const inviteLinkJoinLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  key: (req) => (req.user ? `invite-link-join:${req.user._id}` : null),
  message: 'Too many join attempts, please try again later',
});

// Per user: workspace search (GET /search).
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  key: (req) => (req.user ? `search:${req.user._id}` : null),
  message: 'Too many searches, please slow down',
});

module.exports = {
  inviteLinkJoinLimiter,
  searchLimiter,
  authIpLimiter,
  loginAccountLimiter,
  resetAccountLimiter,
  passwordChangeLimiter,
  inviteLookupLimiter,
};
