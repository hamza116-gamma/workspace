const cors = require('cors');
const { corsOrigin } = require('./utils/corsOrigin');
const express = require('express');
const helmet = require('helmet');
const { env } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const createApp = () => {
  const app = express();
  app.set('trust proxy', env.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
