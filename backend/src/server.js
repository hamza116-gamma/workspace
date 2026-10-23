const http = require('http');
const { createApp } = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const { env } = require('./config/env');
const { logger } = require('./config/logger');
const { createSocketServer } = require('./sockets');
const { startScheduler, stopScheduler } = require('./services/scheduler');

const start = async () => {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);
  app.set('io', io);

  server.listen(env.port, () => logger.info(`API listening on port ${env.port}`));
  startScheduler(io);

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down`);
    stopScheduler();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
