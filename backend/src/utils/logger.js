/**
 * src/utils/logger.js
 * -------------------
 * A simple logger with timestamps. Replace with Winston/Pino if desired.
 */

const timestamp = () => new Date().toISOString();

module.exports = {
  info: (...args) => console.log(`[INFO  ${timestamp()}]`, ...args),
  error: (...args) => console.error(`[ERROR ${timestamp()}]`, ...args),
  warn: (...args) => console.warn(`[WARN  ${timestamp()}]`, ...args)
};
