const { AppError } = require('./AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MESSAGE_MAX_LENGTH = 4000;

const assertEmail = (value) => {
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) {
    throw new AppError(400, 'A valid email address is required');
  }
  return value.trim().toLowerCase();
};

const assertPassword = (value) => {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return value;
};

const assertString = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, `${field} is required`);
  }
  return value.trim();
};

const toOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');

const assertMessageContent = (value) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, 'Message content is required');
  }
  const content = value.trim();
  if (content.length > MESSAGE_MAX_LENGTH) {
    throw new AppError(400, `Message must be at most ${MESSAGE_MAX_LENGTH} characters`);
  }
  return content;
};

// Used when a message may consist of attachments only.
const assertOptionalMessageContent = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new AppError(400, 'Message content must be text');
  }
  const content = value.trim();
  if (content.length > MESSAGE_MAX_LENGTH) {
    throw new AppError(400, `Message must be at most ${MESSAGE_MAX_LENGTH} characters`);
  }
  return content;
};

module.exports = {
  assertEmail,
  assertPassword,
  assertString,
  toOptionalString,
  assertMessageContent,
  assertOptionalMessageContent,
  MIN_PASSWORD_LENGTH,
  MESSAGE_MAX_LENGTH,
};
