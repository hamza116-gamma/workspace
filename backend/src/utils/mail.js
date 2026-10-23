const { env } = require('../config/env');
const { logger } = require('../config/logger');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

let transporter = null;

const isEmailConfigured = () =>
  Boolean(nodemailer && env.email.host && env.email.user && env.email.password);

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: { user: env.email.user, pass: env.email.password },
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    logger.warn(`Email transport not configured; skipped message to ${to}`);
    return false;
  }
  await getTransporter().sendMail({ from: env.email.from, to, subject, text, html });
  return true;
};

module.exports = { sendMail, isEmailConfigured };
