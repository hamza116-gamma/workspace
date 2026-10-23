require('dotenv').config();

const required = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const parseTrustProxy = (value) => {
  if (!value || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
};

// CLIENT_URL may list several origins, comma-separated (e.g. the Vercel URL
// plus http://localhost:3000). The first one is used for links in emails.
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);

// SameSite for the session cookie. "None" is needed when the frontend and
// API are on different sites (e.g. *.vercel.app + *.onrender.com) and is
// always sent with Secure.
const parseSameSite = (value) => {
  const normalized = String(value || 'Lax').toLowerCase();
  if (normalized === 'none') return 'None';
  if (normalized === 'strict') return 'Strict';
  return 'Lax';
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: clientUrls[0],
  clientUrls,
  mongoUri: required('MONGO_URI'),
  // Express 'trust proxy' (e.g. "1" behind one reverse proxy) so req.ip and
  // the rate limiters see the real client IP. Unset = trust nothing.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 26214400),
  session: {
    secret: required('SESSION_SECRET'),
    cookieName: process.env.COOKIE_NAME || 'sid',
    sameSite: parseSameSite(process.env.COOKIE_SAMESITE),
    ttlDays: Number(process.env.SESSION_TTL_DAYS || 7),
  },
  email: {
    host: process.env.EMAIL_HOST || '',
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  },
  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME'),
    apiKey: required('CLOUDINARY_API_KEY'),
    apiSecret: required('CLOUDINARY_API_SECRET'),
  },
};

const isProduction = env.nodeEnv === 'production';

module.exports = { env, isProduction };
