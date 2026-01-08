/**
 * Debug Logger for Dragon-UI
 * Verbose logging and cost validation for debugging
 *
 * @module cli/utils/debug-logger
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Debug log levels
 */
const LOG_LEVEL = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  NONE: 5
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  enabled: false,
  level: LOG_LEVEL.DEBUG,
  logToFile: false,
  logFile: path.join(os.tmpdir(), 'dragon-ui-debug.log'),
  maxLogSize: 10 * 1024 * 1024, // 10MB
  colorOutput: true,
  showTimestamp: true,
  showLevel: true,
  showSource: true
};

/**
 * ANSI color codes
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * Format log level with color
 * @param {number} level
 * @param {boolean} useColor
 * @returns {string}
 */
function formatLevel(level, useColor = true) {
  const levelNames = {
    [LOG_LEVEL.TRACE]: { name: 'TRACE', color: COLORS.gray },
    [LOG_LEVEL.DEBUG]: { name: 'DEBUG', color: COLORS.cyan },
    [LOG_LEVEL.INFO]: { name: 'INFO ', color: COLORS.green },
    [LOG_LEVEL.WARN]: { name: 'WARN ', color: COLORS.yellow },
    [LOG_LEVEL.ERROR]: { name: 'ERROR', color: COLORS.red }
  };

  const info = levelNames[level] || { name: 'UNKN ', color: COLORS.reset };

  if (useColor) {
    return `${info.color}${info.name}${COLORS.reset}`;
  }
  return info.name;
}

/**
 * Format timestamp
 * @returns {string}
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Get caller info from stack trace
 * @returns {Object}
 */
function getCallerInfo() {
  const stack = new Error().stack;
  const lines = stack.split('\n');

  // Skip Error, getCallerInfo, and debug method
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
    if (match) {
      return {
        function: match[1] || 'anonymous',
        file: path.basename(match[2]),
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10)
      };
    }
  }

  return { function: 'unknown', file: 'unknown', line: 0, column: 0 };
}

/**
 * Debug Logger class
 */
class DebugLogger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logs = [];
    this.maxBufferSize = 1000;
    this.validationResults = [];
  }

  /**
   * Enable debug mode
   */
  enable() {
    this.config.enabled = true;
  }

  /**
   * Disable debug mode
   */
  disable() {
    this.config.enabled = false;
  }

  /**
   * Set log level
   * @param {number} level
   */
  setLevel(level) {
    this.config.level = level;
  }

  /**
   * Check if level should be logged
   * @param {number} level
   * @returns {boolean}
   */
  shouldLog(level) {
    return this.config.enabled && level >= this.config.level;
  }

  /**
   * Format log message
   * @param {number} level
   * @param {string} message
   * @param {Object} data
   * @returns {string}
   */
  formatMessage(level, message, data = null) {
    const parts = [];

    if (this.config.showTimestamp) {
      parts.push(
        this.config.colorOutput ?
          `${COLORS.dim}${formatTimestamp()}${COLORS.reset}` :
          formatTimestamp()
      );
    }

    if (this.config.showLevel) {
      parts.push(`[${formatLevel(level, this.config.colorOutput)}]`);
    }

    if (this.config.showSource) {
      const caller = getCallerInfo();
      const source = `${caller.file}:${caller.line}`;
      parts.push(
        this.config.colorOutput ?
          `${COLORS.dim}(${source})${COLORS.reset}` :
          `(${source})`
      );
    }

    parts.push(message);

    if (data !== null && data !== undefined) {
      const dataStr = typeof data === 'object' ?
        JSON.stringify(data, null, 2) :
        String(data);
      parts.push('\n' + dataStr);
    }

    return parts.join(' ');
  }

  /**
   * Write log entry
   * @param {number} level
   * @param {string} message
   * @param {Object} data
   */
  write(level, message, data = null) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, data);

    // Output to console
    if (level === LOG_LEVEL.ERROR) {
      console.error(formatted);
    } else if (level === LOG_LEVEL.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // Store in buffer
    this.logs.push({
      level,
      message,
      data,
      timestamp: Date.now()
    });

    if (this.logs.length > this.maxBufferSize) {
      this.logs.shift();
    }

    // Write to file if enabled
    if (this.config.logToFile) {
      this.writeToFile(formatted);
    }
  }

  /**
   * Write to log file
   * @param {string} message
   */
  writeToFile(message) {
    try {
      // Check file size
      if (fs.existsSync(this.config.logFile)) {
        const stats = fs.statSync(this.config.logFile);
        if (stats.size > this.config.maxLogSize) {
          // Rotate log
          const backupPath = this.config.logFile + '.1';
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          fs.renameSync(this.config.logFile, backupPath);
        }
      }

      // Strip ANSI codes for file output
      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
      fs.appendFileSync(this.config.logFile, cleanMessage + '\n');
    } catch {
      // Ignore file write errors
    }
  }

  // Convenience methods
  trace(message, data = null) {
    this.write(LOG_LEVEL.TRACE, message, data);
  }

  debug(message, data = null) {
    this.write(LOG_LEVEL.DEBUG, message, data);
  }

  info(message, data = null) {
    this.write(LOG_LEVEL.INFO, message, data);
  }

  warn(message, data = null) {
    this.write(LOG_LEVEL.WARN, message, data);
  }

  error(message, data = null) {
    this.write(LOG_LEVEL.ERROR, message, data);
  }

  /**
   * Validate cost calculation
   * @param {Object} session - Session data
   * @param {Object} pricing - Pricing data
   * @returns {Object}
   */
  validateCost(session, pricing) {
    const validation = {
      valid: true,
      warnings: [],
      errors: [],
      calculated: {},
      reported: {}
    };

    if (!session || !pricing) {
      validation.errors.push('Missing session or pricing data');
      validation.valid = false;
      return validation;
    }

    // Calculate expected cost
    const inputCost = (session.inputTokens || 0) / 1000000 * (pricing.input || 0);
    const outputCost = (session.outputTokens || 0) / 1000000 * (pricing.output || 0);
    const cachedCost = (session.cachedTokens || 0) / 1000000 * (pricing.cached || pricing.input * 0.1 || 0);

    const calculatedTotal = inputCost + outputCost + cachedCost;

    validation.calculated = {
      inputCost,
      outputCost,
      cachedCost,
      total: calculatedTotal
    };

    validation.reported = {
      total: session.cost || 0
    };

    // Check for mismatch
    const reportedCost = session.cost || 0;
    const diff = Math.abs(calculatedTotal - reportedCost);
    const percentDiff = reportedCost > 0 ? (diff / reportedCost) * 100 : 0;

    if (percentDiff > 10) {
      validation.warnings.push(
        `Cost mismatch: calculated $${calculatedTotal.toFixed(4)} vs reported $${reportedCost.toFixed(4)} (${percentDiff.toFixed(1)}% difference)`
      );
    }

    if (percentDiff > 50) {
      validation.errors.push('Significant cost mismatch detected');
      validation.valid = false;
    }

    // Check for missing data
    if (!session.inputTokens && !session.outputTokens) {
      validation.warnings.push('No token data available');
    }

    this.validationResults.push(validation);
    return validation;
  }

  /**
   * Log sample output for debugging
   * @param {string} label
   * @param {any} data
   */
  sample(label, data) {
    if (!this.config.enabled) return;

    const sample = typeof data === 'object' ?
      JSON.stringify(data, null, 2).slice(0, 500) :
      String(data).slice(0, 500);

    this.debug(`[SAMPLE] ${label}:`, sample + (sample.length >= 500 ? '...' : ''));
  }

  /**
   * Time a function execution
   * @param {string} label
   * @param {Function} fn
   * @returns {any}
   */
  async time(label, fn) {
    if (!this.config.enabled) {
      return fn();
    }

    const start = process.hrtime.bigint();

    try {
      const result = await fn();
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;

      this.debug(`[TIMING] ${label}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;

      this.error(`[TIMING] ${label}: ${duration.toFixed(2)}ms (failed)`, error.message);
      throw error;
    }
  }

  /**
   * Get debug summary
   * @returns {Object}
   */
  getSummary() {
    const levelCounts = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };

    for (const log of this.logs) {
      switch (log.level) {
        case LOG_LEVEL.TRACE: levelCounts.trace++; break;
        case LOG_LEVEL.DEBUG: levelCounts.debug++; break;
        case LOG_LEVEL.INFO: levelCounts.info++; break;
        case LOG_LEVEL.WARN: levelCounts.warn++; break;
        case LOG_LEVEL.ERROR: levelCounts.error++; break;
      }
    }

    return {
      enabled: this.config.enabled,
      level: this.config.level,
      totalLogs: this.logs.length,
      byLevel: levelCounts,
      validations: this.validationResults.length,
      validationsPassed: this.validationResults.filter(v => v.valid).length
    };
  }

  /**
   * Clear logs
   */
  clear() {
    this.logs = [];
    this.validationResults = [];
  }

  /**
   * Export logs
   * @returns {Object[]}
   */
  export() {
    return this.logs.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp).toISOString()
    }));
  }
}

// Singleton instance
let instance = null;

/**
 * Get Debug Logger instance
 * @param {Object} config
 * @returns {DebugLogger}
 */
function getDebugLogger(config) {
  if (!instance) {
    instance = new DebugLogger(config);
  }
  return instance;
}

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
function isDebugEnabled() {
  return instance ? instance.config.enabled : false;
}

/**
 * Enable debug mode globally
 */
function enableDebug() {
  getDebugLogger().enable();
}

/**
 * Disable debug mode globally
 */
function disableDebug() {
  getDebugLogger().disable();
}

module.exports = {
  DebugLogger,
  getDebugLogger,
  isDebugEnabled,
  enableDebug,
  disableDebug,
  LOG_LEVEL,
  DEFAULT_CONFIG
};
