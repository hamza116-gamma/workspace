const { AppError } = require('../utils/AppError');

// Projects is a per-workspace feature switch (Settings > General).
const requireProjectsEnabled = (req, _res, next) => {
  if (!req.organization?.settings?.projectsEnabled) {
    next(new AppError(403, 'Projects is not enabled for this workspace'));
    return;
  }
  next();
};

module.exports = { requireProjectsEnabled };
