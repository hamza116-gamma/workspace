const mongoose = require('mongoose');
const { env } = require('./env');
const { logger } = require('./logger');

const connectDatabase = async () => {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (error) => logger.error('MongoDB connection error', error));

  await mongoose.connect(env.mongoUri);
  logger.info('MongoDB connected');
};

const isDatabaseHealthy = () => mongoose.connection.readyState === 1;

const disconnectDatabase = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

module.exports = { connectDatabase, isDatabaseHealthy, disconnectDatabase };
