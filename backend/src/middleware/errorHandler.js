const mongoose = require('mongoose');
const { isProduction } = require('../config/env');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/AppError');

const notFoundHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Mongoose errors caused by bad client input are 400s, not server errors.
const toClientError = (error) => {
  if (error instanceof mongoose.Error.CastError) {
    return new AppError(400, 'Invalid id');
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(error.errors || {}).map((item) => item.message);
    return new AppError(400, messages.join(', ') || 'Validation failed');
  }
  return error;
};

const errorHandler = (rawError, _req, res, _next) => {
  const error = toClientError(rawError);
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = statusCode === 500 && isProduction ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    logger.error(error.message, error);
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = { notFoundHandler, errorHandler };
