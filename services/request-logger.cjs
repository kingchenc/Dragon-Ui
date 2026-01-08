/**
 * Request-Level Logging Service for Dragon-UI
 * Full request/response capture with metadata tracking
 *
 * @module services/request-logger
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  enabled: true,
  logDir: path.join(os.tmpdir(), 'dragon-ui-requests'),
  maxLogSize: 50 * 1024 * 1024, // 50MB per log file
  maxLogFiles: 10,
  compressOldLogs: true,
  captureHeaders: true,
  captureBody: true,
  captureTiming: true,
  sanitizeKeys: ['authorization', 'x-api-key', 'api-key', 'cookie', 'set-cookie'],
  retentionDays: 7
};

/**
 * Request status types
 */
const REQUEST_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled'
};

/**
 * Request entry class
 */
class RequestEntry {
  constructor(options = {}) {
    this.id = options.id || crypto.randomUUID();
    this.timestamp = new Date().toISOString();
    this.method = options.method || 'GET';
    this.url = options.url || '';
    this.path = options.path || '';
    this.status = REQUEST_STATUS.PENDING;
    this.statusCode = null;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.requestHeaders = {};
    this.responseHeaders = {};
    this.requestBody = null;
    this.responseBody = null;
    this.requestSize = 0;
    this.responseSize = 0;
    this.error = null;
    this.failoverAttempts = 0;
    this.accountId = options.accountId || null;
    this.sessionId = options.sessionId || null;
    this.model = options.model || null;
    this.tokens = {
      input: 0,
      output: 0,
      cached: 0
    };
    this.cost = 0;
    this.metadata = options.metadata || {};
  }

  /**
   * Mark request as complete
   * @param {number} statusCode
   * @param {Object} responseHeaders
   * @param {any} responseBody
   */
  complete(statusCode, responseHeaders = {}, responseBody = null) {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.statusCode = statusCode;
    this.responseHeaders = responseHeaders;
    this.responseBody = responseBody;
    this.responseSize = this.calculateSize(responseBody);
    this.status = statusCode >= 200 && statusCode < 400
      ? REQUEST_STATUS.SUCCESS
      : REQUEST_STATUS.FAILED;
  }

  /**
   * Mark request as failed
   * @param {Error} error
   */
  fail(error) {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.status = REQUEST_STATUS.FAILED;
    this.error = {
      message: error.message,
      code: error.code || null,
      stack: error.stack || null
    };
  }

  /**
   * Mark request as timeout
   */
  timeout() {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.status = REQUEST_STATUS.TIMEOUT;
    this.error = { message: 'Request timeout' };
  }

  /**
   * Record failover attempt
   */
  recordFailover() {
    this.failoverAttempts++;
  }

  /**
   * Set request details
   * @param {Object} headers
   * @param {any} body
   */
  setRequest(headers = {}, body = null) {
    this.requestHeaders = headers;
    this.requestBody = body;
    this.requestSize = this.calculateSize(body);
  }

  /**
   * Set token usage
   * @param {Object} tokens
   */
  setTokens(tokens) {
    if (tokens) {
      this.tokens.input = tokens.input || tokens.input_tokens || 0;
      this.tokens.output = tokens.output || tokens.output_tokens || 0;
      this.tokens.cached = tokens.cached || tokens.cache_read_input_tokens || 0;
    }
  }

  /**
   * Calculate size of data
   * @param {any} data
   * @returns {number}
   */
  calculateSize(data) {
    if (!data) return 0;
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
    if (Buffer.isBuffer(data)) return data.length;
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  /**
   * Get timing breakdown
   * @returns {Object}
   */
  getTiming() {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      durationMs: this.duration,
      durationFormatted: this.formatDuration(this.duration)
    };
  }

  /**
   * Format duration
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    if (!ms) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      method: this.method,
      url: this.url,
      path: this.path,
      status: this.status,
      statusCode: this.statusCode,
      duration: this.duration,
      requestSize: this.requestSize,
      responseSize: this.responseSize,
      failoverAttempts: this.failoverAttempts,
      accountId: this.accountId,
      sessionId: this.sessionId,
      model: this.model,
      tokens: this.tokens,
      cost: this.cost,
      error: this.error,
      metadata: this.metadata
    };
  }

  /**
   * Serialize with full details
   * @returns {Object}
   */
  toFullJSON() {
    return {
      ...this.toJSON(),
      requestHeaders: this.requestHeaders,
      responseHeaders: this.responseHeaders,
      requestBody: this.requestBody,
      responseBody: this.responseBody,
      timing: this.getTiming()
    };
  }
}

/**
 * Request Logger class
 */
class RequestLogger {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.requests = new Map();
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      totalDuration: 0,
      totalRequestSize: 0,
      totalResponseSize: 0,
      failoverCount: 0,
      byStatus: {},
      byModel: {},
      byAccount: {}
    };
    this.currentLogFile = null;
    this.currentLogSize = 0;

    this.ensureLogDir();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDir() {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * Start tracking a request
   * @param {Object} options
   * @returns {RequestEntry}
   */
  startRequest(options = {}) {
    const entry = new RequestEntry(options);
    this.requests.set(entry.id, entry);
    this.stats.total++;
    return entry;
  }

  /**
   * Get a request by ID
   * @param {string} id
   * @returns {RequestEntry|null}
   */
  getRequest(id) {
    return this.requests.get(id) || null;
  }

  /**
   * Complete a request
   * @param {string} id
   * @param {number} statusCode
   * @param {Object} responseHeaders
   * @param {any} responseBody
   */
  completeRequest(id, statusCode, responseHeaders = {}, responseBody = null) {
    const entry = this.requests.get(id);
    if (!entry) return null;

    // Sanitize headers before storing
    const sanitizedReqHeaders = this.sanitizeHeaders(entry.requestHeaders);
    const sanitizedResHeaders = this.sanitizeHeaders(responseHeaders);

    entry.requestHeaders = sanitizedReqHeaders;
    entry.complete(statusCode, sanitizedResHeaders, responseBody);

    this.updateStats(entry);
    this.writeLog(entry);

    return entry;
  }

  /**
   * Fail a request
   * @param {string} id
   * @param {Error} error
   */
  failRequest(id, error) {
    const entry = this.requests.get(id);
    if (!entry) return null;

    entry.fail(error);
    this.stats.failed++;
    this.updateStats(entry);
    this.writeLog(entry);

    return entry;
  }

  /**
   * Record failover for a request
   * @param {string} id
   */
  recordFailover(id) {
    const entry = this.requests.get(id);
    if (entry) {
      entry.recordFailover();
      this.stats.failoverCount++;
    }
  }

  /**
   * Sanitize sensitive headers
   * @param {Object} headers
   * @returns {Object}
   */
  sanitizeHeaders(headers) {
    if (!headers) return {};

    const sanitized = { ...headers };
    const keysToSanitize = this.config.sanitizeKeys.map(k => k.toLowerCase());

    for (const key of Object.keys(sanitized)) {
      if (keysToSanitize.includes(key.toLowerCase())) {
        const value = sanitized[key];
        if (typeof value === 'string' && value.length > 8) {
          sanitized[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
        } else {
          sanitized[key] = '****';
        }
      }
    }

    return sanitized;
  }

  /**
   * Update statistics
   * @param {RequestEntry} entry
   */
  updateStats(entry) {
    // Update status counts
    if (entry.status === REQUEST_STATUS.SUCCESS) {
      this.stats.success++;
    } else if (entry.status === REQUEST_STATUS.TIMEOUT) {
      this.stats.timeout++;
    }

    // Update totals
    this.stats.totalDuration += entry.duration || 0;
    this.stats.totalRequestSize += entry.requestSize || 0;
    this.stats.totalResponseSize += entry.responseSize || 0;

    // Update by status code
    if (entry.statusCode) {
      const statusKey = String(entry.statusCode);
      this.stats.byStatus[statusKey] = (this.stats.byStatus[statusKey] || 0) + 1;
    }

    // Update by model
    if (entry.model) {
      if (!this.stats.byModel[entry.model]) {
        this.stats.byModel[entry.model] = { count: 0, duration: 0, tokens: 0 };
      }
      this.stats.byModel[entry.model].count++;
      this.stats.byModel[entry.model].duration += entry.duration || 0;
      this.stats.byModel[entry.model].tokens +=
        (entry.tokens.input || 0) + (entry.tokens.output || 0);
    }

    // Update by account
    if (entry.accountId) {
      if (!this.stats.byAccount[entry.accountId]) {
        this.stats.byAccount[entry.accountId] = { count: 0, success: 0, failed: 0 };
      }
      this.stats.byAccount[entry.accountId].count++;
      if (entry.status === REQUEST_STATUS.SUCCESS) {
        this.stats.byAccount[entry.accountId].success++;
      } else {
        this.stats.byAccount[entry.accountId].failed++;
      }
    }
  }

  /**
   * Write log entry to file
   * @param {RequestEntry} entry
   */
  writeLog(entry) {
    if (!this.config.enabled) return;

    try {
      const logLine = JSON.stringify(entry.toFullJSON()) + '\n';
      const logPath = this.getCurrentLogFile();

      fs.appendFileSync(logPath, logLine);
      this.currentLogSize += Buffer.byteLength(logLine);

      // Rotate if needed
      if (this.currentLogSize >= this.config.maxLogSize) {
        this.rotateLog();
      }
    } catch (error) {
      console.error('[RequestLogger] Write error:', error.message);
    }
  }

  /**
   * Get current log file path
   * @returns {string}
   */
  getCurrentLogFile() {
    if (!this.currentLogFile) {
      const date = new Date().toISOString().split('T')[0];
      this.currentLogFile = path.join(this.config.logDir, `requests-${date}.jsonl`);

      // Check existing file size
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        this.currentLogSize = stats.size;
      } else {
        this.currentLogSize = 0;
      }
    }
    return this.currentLogFile;
  }

  /**
   * Rotate log file
   */
  rotateLog() {
    const oldFile = this.currentLogFile;
    const timestamp = Date.now();
    const rotatedFile = oldFile.replace('.jsonl', `-${timestamp}.jsonl`);

    try {
      fs.renameSync(oldFile, rotatedFile);

      // Compress if enabled
      if (this.config.compressOldLogs) {
        this.compressFile(rotatedFile);
      }

      // Cleanup old files
      this.cleanupOldLogs();
    } catch (error) {
      console.error('[RequestLogger] Rotation error:', error.message);
    }

    this.currentLogFile = null;
    this.currentLogSize = 0;
  }

  /**
   * Compress a log file
   * @param {string} filePath
   */
  compressFile(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      const compressed = zlib.gzipSync(content);
      fs.writeFileSync(filePath + '.gz', compressed);
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('[RequestLogger] Compression error:', error.message);
    }
  }

  /**
   * Cleanup old log files
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.config.logDir)
        .filter(f => f.startsWith('requests-'))
        .map(f => ({
          name: f,
          path: path.join(this.config.logDir, f),
          mtime: fs.statSync(path.join(this.config.logDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Remove files beyond max count
      const toRemove = files.slice(this.config.maxLogFiles);
      for (const file of toRemove) {
        fs.unlinkSync(file.path);
      }

      // Remove files beyond retention period
      const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
      for (const file of files) {
        if (file.mtime.getTime() < cutoff) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('[RequestLogger] Cleanup error:', error.message);
    }
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    const avgDuration = this.stats.total > 0
      ? this.stats.totalDuration / this.stats.total
      : 0;

    return {
      ...this.stats,
      successRate: this.stats.total > 0
        ? (this.stats.success / this.stats.total * 100).toFixed(2) + '%'
        : '0%',
      avgDuration: Math.round(avgDuration),
      avgDurationFormatted: this.formatDuration(avgDuration),
      avgRequestSize: this.stats.total > 0
        ? Math.round(this.stats.totalRequestSize / this.stats.total)
        : 0,
      avgResponseSize: this.stats.total > 0
        ? Math.round(this.stats.totalResponseSize / this.stats.total)
        : 0
    };
  }

  /**
   * Format duration
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    if (!ms) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Get recent requests
   * @param {number} limit
   * @returns {RequestEntry[]}
   */
  getRecentRequests(limit = 100) {
    const entries = Array.from(this.requests.values());
    return entries
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get requests by status
   * @param {string} status
   * @returns {RequestEntry[]}
   */
  getRequestsByStatus(status) {
    return Array.from(this.requests.values())
      .filter(e => e.status === status);
  }

  /**
   * Get failed requests
   * @returns {RequestEntry[]}
   */
  getFailedRequests() {
    return this.getRequestsByStatus(REQUEST_STATUS.FAILED);
  }

  /**
   * Clear in-memory requests (keeps logs)
   */
  clearMemory() {
    this.requests.clear();
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      totalDuration: 0,
      totalRequestSize: 0,
      totalResponseSize: 0,
      failoverCount: 0,
      byStatus: {},
      byModel: {},
      byAccount: {}
    };
  }

  /**
   * Read logs from file
   * @param {string} date - YYYY-MM-DD format
   * @returns {Object[]}
   */
  readLogs(date) {
    const logFile = path.join(this.config.logDir, `requests-${date}.jsonl`);
    const gzFile = logFile + '.gz';

    let content = '';

    if (fs.existsSync(logFile)) {
      content = fs.readFileSync(logFile, 'utf8');
    } else if (fs.existsSync(gzFile)) {
      const compressed = fs.readFileSync(gzFile);
      content = zlib.gunzipSync(compressed).toString('utf8');
    } else {
      return [];
    }

    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(entry => entry !== null);
  }

  /**
   * Search logs
   * @param {Object} criteria
   * @returns {Object[]}
   */
  searchLogs(criteria = {}) {
    const results = [];
    const files = fs.readdirSync(this.config.logDir)
      .filter(f => f.startsWith('requests-') && (f.endsWith('.jsonl') || f.endsWith('.gz')));

    for (const file of files) {
      const date = file.match(/requests-(\d{4}-\d{2}-\d{2})/)?.[1];
      if (!date) continue;

      const entries = this.readLogs(date);
      for (const entry of entries) {
        if (this.matchesCriteria(entry, criteria)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * Check if entry matches search criteria
   * @param {Object} entry
   * @param {Object} criteria
   * @returns {boolean}
   */
  matchesCriteria(entry, criteria) {
    if (criteria.status && entry.status !== criteria.status) return false;
    if (criteria.statusCode && entry.statusCode !== criteria.statusCode) return false;
    if (criteria.model && entry.model !== criteria.model) return false;
    if (criteria.accountId && entry.accountId !== criteria.accountId) return false;
    if (criteria.minDuration && entry.duration < criteria.minDuration) return false;
    if (criteria.maxDuration && entry.duration > criteria.maxDuration) return false;
    if (criteria.hasError && !entry.error) return false;
    return true;
  }

  /**
   * Get log file info
   * @returns {Object}
   */
  getLogInfo() {
    const files = fs.readdirSync(this.config.logDir)
      .filter(f => f.startsWith('requests-'))
      .map(f => {
        const filePath = path.join(this.config.logDir, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime
        };
      });

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      logDir: this.config.logDir,
      fileCount: files.length,
      totalSize,
      totalSizeFormatted: this.formatBytes(totalSize),
      files
    };
  }

  /**
   * Format bytes
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
let instance = null;

/**
 * Get Request Logger instance
 * @param {Object} config
 * @returns {RequestLogger}
 */
function getRequestLogger(config) {
  if (!instance) {
    instance = new RequestLogger(config);
  }
  return instance;
}

module.exports = {
  RequestLogger,
  RequestEntry,
  getRequestLogger,
  REQUEST_STATUS,
  DEFAULT_CONFIG
};
