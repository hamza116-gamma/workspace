const write = (level, message, meta) => {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const target = level === 'debug' ? console.log : console[level];

  if (meta === undefined) {
    target(line);
    return;
  }
  target(line, meta);
};

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = { logger };
