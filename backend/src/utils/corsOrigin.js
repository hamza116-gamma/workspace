const { env, isProduction } = require('../config/env');

// CORS origin policy shared by Express and Socket.io.
// - Production: only the origins listed in CLIENT_URL (comma-separated).
// - Development: any origin (the app is opened by LAN IP from other devices,
//   e.g. http://10.10.99.94:3000). The request's origin is reflected so
//   credentialed (cookie) requests keep working.
const corsOrigin = isProduction ? env.clientUrls : (origin, callback) => callback(null, true);

module.exports = { corsOrigin };
