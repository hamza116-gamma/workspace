const crypto = require('crypto');
const { env, isProduction } = require('../config/env');

const parseCookies = (header = '') =>
  header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index === -1) {
      return acc;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});

const sign = (value) =>
  `${value}.${crypto.createHmac('sha256', env.session.secret).update(value).digest('base64url')}`;

const unsign = (signed) => {
  if (typeof signed !== 'string') {
    return null;
  }
  const index = signed.lastIndexOf('.');
  if (index === -1) {
    return null;
  }
  const value = signed.slice(0, index);
  const signature = Buffer.from(signed.slice(index + 1));
  const expected = Buffer.from(
    crypto.createHmac('sha256', env.session.secret).update(value).digest('base64url'),
  );

  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    return null;
  }
  return value;
};

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
};

const baseOptions = () => ({
  httpOnly: true,
  // SameSite=None is only accepted by browsers together with Secure.
  secure: isProduction || env.session.sameSite === 'None',
  sameSite: env.session.sameSite,
  path: '/',
});

const createSessionCookie = (token) =>
  serializeCookie(env.session.cookieName, sign(token), {
    ...baseOptions(),
    maxAge: env.session.ttlDays * 24 * 60 * 60 * 1000,
  });

const clearSessionCookie = () =>
  serializeCookie(env.session.cookieName, '', { ...baseOptions(), maxAge: 0 });

const readSessionCookie = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return unsign(cookies[env.session.cookieName]);
};

module.exports = { createSessionCookie, clearSessionCookie, readSessionCookie };
