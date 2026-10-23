const { Router } = require('express');
const { isDatabaseHealthy } = require('../config/db');

const router = Router();

router.get('/', (_req, res) => {
  const databaseUp = isDatabaseHealthy();

  res.status(databaseUp ? 200 : 503).json({
    success: databaseUp,
    status: databaseUp ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: databaseUp ? 'up' : 'down',
    },
  });
});

module.exports = router;
