const { AppError } = require('./AppError');

// Do Not Disturb ("Pause notifications") lasts at most 7 days.
const MAX_DND_MS = 7 * 24 * 60 * 60 * 1000;

const isDndActive = (user, now = Date.now()) =>
  Boolean(user?.dndUntil && new Date(user.dndUntil).getTime() > now);

// { minutes } | { until } | { off: true } -> Date | null
const resolveDndUntil = (payload = {}, now = Date.now()) => {
  if (payload.off === true) {
    return null;
  }
  let until = null;
  if (payload.minutes !== undefined) {
    const minutes = Number(payload.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new AppError(400, 'minutes must be a positive number');
    }
    until = new Date(now + minutes * 60 * 1000);
  } else if (payload.until !== undefined) {
    until = new Date(payload.until);
    if (Number.isNaN(until.getTime())) {
      throw new AppError(400, 'until must be a valid date');
    }
  } else {
    throw new AppError(400, 'Provide minutes, until or off');
  }
  if (until.getTime() <= now) {
    throw new AppError(400, 'The pause must end in the future');
  }
  if (until.getTime() - now > MAX_DND_MS) {
    throw new AppError(400, 'Notifications can be paused for at most 7 days');
  }
  return until;
};

module.exports = { MAX_DND_MS, isDndActive, resolveDndUntil };
