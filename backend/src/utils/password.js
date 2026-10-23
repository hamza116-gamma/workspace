const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCHEME = 'scrypt';

const hashPassword = async (plain) => {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const derived = await scrypt(plain, salt, KEY_LENGTH);
  return `${SCHEME}:${salt}:${derived.toString('hex')}`;
};

const verifyPassword = async (plain, stored) => {
  if (typeof plain !== 'string' || typeof stored !== 'string') {
    return false;
  }

  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== SCHEME || !salt || !hash) {
    return false;
  }

  const derived = await scrypt(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');

  if (expected.length !== derived.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, derived);
};

module.exports = { hashPassword, verifyPassword };
