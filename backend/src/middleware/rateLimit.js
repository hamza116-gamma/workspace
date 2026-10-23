const { AppError } = require('../utils/AppError');

const defaultKey = (req) => `${req.ip}:${req.baseUrl}${req.path}`;

// `key(req)` picks the bucket (default: IP + route). Returning a falsy key
// skips the limiter for that request (e.g. no email in the body).
const rateLimit = ({
  windowMs = 60000,
  max = 10,
  message = 'Too many requests, please try again later',
  key: keyFor = defaultKey,
} = {}) => {
  const hits = new Map();

  const prune = (now) => {
    for (const [key, entry] of hits) {
      if (entry.expiresAt <= now) {
        hits.delete(key);
      }
    }
  };

  return (req, _res, next) => {
    const now = Date.now();
    const key = keyFor(req);
    if (!key) {
      next();
      return;
    }
    const entry = hits.get(key);

    if (!entry || entry.expiresAt <= now) {
      hits.set(key, { count: 1, expiresAt: now + windowMs });
      if (hits.size % 100 === 0) {
        prune(now);
      }
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      next(new AppError(429, message));
      return;
    }
    next();
  };
};

module.exports = { rateLimit };
