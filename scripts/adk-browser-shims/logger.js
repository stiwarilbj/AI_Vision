export const LogLevel = Object.freeze({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 });

const noopLogger = {
  setLogLevel() {},
  log() {},
  debug() {},
  info() {},
  warn() {},
  error() {}
};

let currentLogger = noopLogger;

export const logger = {
  setLogLevel(level) { currentLogger.setLogLevel(level); },
  log(level, ...args) { currentLogger.log(level, ...args); },
  debug(...args) { currentLogger.debug(...args); },
  info(...args) { currentLogger.info(...args); },
  warn(...args) { currentLogger.warn(...args); },
  error(...args) { currentLogger.error(...args); }
};

export function getLogger() { return currentLogger; }
export function setLogger(value) { currentLogger = value || noopLogger; }
export function resetLogger() { currentLogger = noopLogger; }
export function setLogLevel(level) { logger.setLogLevel(level); }
