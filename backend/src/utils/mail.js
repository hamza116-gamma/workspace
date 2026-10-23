const { env } = require('../config/env');
const { logger } = require('../config/logger');

let nodemailer = null;
let MailComposer = null;
try {
  nodemailer = require('nodemailer');
  MailComposer = require('nodemailer/lib/mail-composer');
} catch {
  nodemailer = null;
}

// Hosts like Render's free plan block outbound SMTP ports, which made sends
// hang for ~90 s. Every attempt is capped so a request never waits on mail.
const SEND_TIMEOUT_MS = 10000;

// Gmail over HTTPS (OAuth2 refresh token, scope gmail.send). Used when the
// three GMAIL_* variables are set - works where SMTP ports are blocked.
const gmail = {
  clientId: process.env.GMAIL_CLIENT_ID || '',
  clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
  refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
};
const useGmailApi = () =>
  Boolean(MailComposer && gmail.clientId && gmail.clientSecret && gmail.refreshToken);

const useSmtp = () => Boolean(nodemailer && env.email.host && env.email.user && env.email.password);

const isEmailConfigured = () => useGmailApi() || useSmtp();

const withTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), SEND_TIMEOUT_MS),
    ),
  ]);

// --- Gmail API --------------------------------------------------------------
let accessToken = { value: null, expiresAt: 0 };

const getAccessToken = async () => {
  if (accessToken.value && Date.now() < accessToken.expiresAt - 60000) {
    return accessToken.value;
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: gmail.clientId,
      client_secret: gmail.clientSecret,
      refresh_token: gmail.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    // invalid_grant = refresh token expired/revoked (e.g. 7-day "Testing" limit).
    throw new Error(`Gmail token refresh failed: ${data.error || response.status}`);
  }
  accessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return accessToken.value;
};

const buildRawMessage = (message) =>
  new Promise((resolve, reject) => {
    new MailComposer(message).compile().build((error, raw) => (error ? reject(error) : resolve(raw)));
  });

const sendWithGmailApi = async (message) => {
  const raw = (await buildRawMessage(message)).toString('base64url');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Gmail API send failed: ${data.error?.message || response.status}`);
  }
};

// --- SMTP (local development) -----------------------------------------------
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.secure,
      auth: { user: env.email.user, pass: env.email.password },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    logger.warn(`Email transport not configured; skipped message to ${to}`);
    return false;
  }
  const message = { from: env.email.from, to, subject, text, html };
  if (useGmailApi()) {
    await withTimeout(sendWithGmailApi(message), 'Gmail API send');
  } else {
    await withTimeout(getTransporter().sendMail(message), 'SMTP send');
  }
  return true;
};

module.exports = { sendMail, isEmailConfigured };
