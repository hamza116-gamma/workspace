const crypto = require('crypto');
const { env } = require('../config/env');

// Short-lived ticket that lets the browser open the Socket.io connection when
// the session cookie can't reach the API host (frontend on Vercel proxies
// /api, but WebSockets go straight to the API's own domain). It names the
// session id - not the secret session token - and expires in a minute, so a
// leaked ticket is close to useless.
const TICKET_TTL_MS = 60 * 1000;

const hmac = (payload) =>
  crypto.createHmac('sha256', `${env.session.secret}:socket-ticket`).update(payload).digest('base64url');

const createSocketTicket = (sessionId) => {
  const payload = Buffer.from(
    JSON.stringify({ s: String(sessionId), e: Date.now() + TICKET_TTL_MS }),
  ).toString('base64url');
  return `${payload}.${hmac(payload)}`;
};

// Returns the session id, or null when the ticket is malformed, forged or expired.
const readSocketTicket = (ticket) => {
  if (typeof ticket !== 'string' || !ticket.includes('.')) {
    return null;
  }
  const [payload, signature] = ticket.split('.');
  const expected = hmac(payload);
  if (
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const { s, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof s === 'string' && typeof e === 'number' && e > Date.now() ? s : null;
  } catch {
    return null;
  }
};

module.exports = { createSocketTicket, readSocketTicket, TICKET_TTL_MS };
