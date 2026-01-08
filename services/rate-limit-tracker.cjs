/**
 * Rate Limit Tracker Service for Dragon-UI
 * Tracks and manages rate limits across accounts
 *
 * @module services/rate-limit-tracker
 */

'use strict';

const EventEmitter = require('events');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  defaultCooldown: 60 * 60 * 1000,    // 1 hour default cooldown
  minCooldown: 5 * 60 * 1000,          // 5 minute minimum
  maxCooldown: 24 * 60 * 60 * 1000,    // 24 hour maximum
  cleanupInterval: 5 * 60 * 1000,       // Cleanup every 5 minutes
  historyRetention: 24 * 60 * 60 * 1000 // Keep 24 hours of history
};

/**
 * Rate limit event types
 */
const RATE_LIMIT_TYPE = {
  HEADER_DETECTED: 'header_detected',
  STATUS_CODE: 'status_code',
  BODY_PATTERN: 'body_pattern',
  MANUAL: 'manual'
};

/**
 * Rate Limit Entry class
 */
class RateLimitEntry {
  /**
   * Create a rate limit entry
   * @param {Object} config
   */
  constructor(config) {
    this.accountId = config.accountId;
    this.type = config.type || RATE_LIMIT_TYPE.STATUS_CODE;
    this.detectedAt = Date.now();
    this.expiresAt = config.expiresAt || (Date.now() + DEFAULT_CONFIG.defaultCooldown);
    this.resetTime = config.resetTime || null;
    this.remaining = config.remaining || 0;
    this.limit = config.limit || null;
    this.retryAfter = config.retryAfter || null;
    this.requestId = config.requestId || null;
    this.endpoint = config.endpoint || null;
    this.message = config.message || null;
    this.source = config.source || 'unknown';
  }

  /**
   * Check if rate limit has expired
   * @returns {boolean}
   */
  isExpired() {
    return Date.now() >= this.expiresAt;
  }

  /**
   * Get time until expiry
   * @returns {number}
   */
  getTimeUntilExpiry() {
    return Math.max(0, this.expiresAt - Date.now());
  }

  /**
   * Extend the rate limit duration
   * @param {number} additionalMs
   */
  extend(additionalMs) {
    this.expiresAt += additionalMs;
  }

  /**
   * Serialize for storage
   * @returns {Object}
   */
  toJSON() {
    return {
      accountId: this.accountId,
      type: this.type,
      detectedAt: this.detectedAt,
      expiresAt: this.expiresAt,
      resetTime: this.resetTime,
      remaining: this.remaining,
      limit: this.limit,
      retryAfter: this.retryAfter,
      requestId: this.requestId,
      endpoint: this.endpoint,
      message: this.message,
      source: this.source,
      expired: this.isExpired(),
      timeUntilExpiry: this.getTimeUntilExpiry()
    };
  }
}

/**
 * Rate Limit History Entry
 */
class RateLimitHistoryEntry {
  constructor(entry) {
    this.accountId = entry.accountId;
    this.type = entry.type;
    this.detectedAt = entry.detectedAt;
    this.expiresAt = entry.expiresAt;
    this.duration = entry.expiresAt - entry.detectedAt;
    this.endpoint = entry.endpoint;
    this.source = entry.source;
  }
}

/**
 * Rate Limit Tracker class
 */
class RateLimitTracker extends EventEmitter {
  /**
   * Create a rate limit tracker
   * @param {Object} config
   */
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.activeLimits = new Map(); // accountId -> RateLimitEntry
    this.history = []; // Array of RateLimitHistoryEntry
    this.stats = {
      totalDetected: 0,
      totalExpired: 0,
      totalManual: 0,
      byType: {
        [RATE_LIMIT_TYPE.HEADER_DETECTED]: 0,
        [RATE_LIMIT_TYPE.STATUS_CODE]: 0,
        [RATE_LIMIT_TYPE.BODY_PATTERN]: 0,
        [RATE_LIMIT_TYPE.MANUAL]: 0
      },
      byAccount: new Map()
    };

    this.cleanupInterval = null;
  }

  /**
   * Start the cleanup scheduler
   */
  startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop the cleanup scheduler
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Record a rate limit
   * @param {Object} config
   * @returns {RateLimitEntry}
   */
  recordLimit(config) {
    const { accountId } = config;

    // Calculate expiry time
    let expiresAt;
    if (config.resetTime) {
      expiresAt = config.resetTime;
    } else if (config.retryAfter) {
      expiresAt = Date.now() + config.retryAfter;
    } else {
      expiresAt = Date.now() + this.config.defaultCooldown;
    }

    // Clamp to min/max
    const duration = expiresAt - Date.now();
    const clampedDuration = Math.max(
      this.config.minCooldown,
      Math.min(this.config.maxCooldown, duration)
    );
    expiresAt = Date.now() + clampedDuration;

    const entry = new RateLimitEntry({
      ...config,
      expiresAt
    });

    // Check for existing limit
    const existing = this.activeLimits.get(accountId);
    if (existing && !existing.isExpired()) {
      // Extend if new limit is longer
      if (entry.expiresAt > existing.expiresAt) {
        existing.expiresAt = entry.expiresAt;
        existing.type = entry.type;
        existing.source = entry.source;
        this.emit('limit_extended', existing);
        return existing;
      }
      return existing;
    }

    // Store new limit
    this.activeLimits.set(accountId, entry);

    // Update stats
    this.stats.totalDetected++;
    this.stats.byType[entry.type]++;

    const accountStats = this.stats.byAccount.get(accountId) || { count: 0, totalDuration: 0 };
    accountStats.count++;
    this.stats.byAccount.set(accountId, accountStats);

    this.emit('limit_recorded', entry);

    return entry;
  }

  /**
   * Record rate limit from HTTP response
   * @param {string} accountId
   * @param {Object} response - HTTP response info
   * @returns {RateLimitEntry|null}
   */
  recordFromResponse(accountId, response) {
    const { statusCode, headers, body, requestId, endpoint } = response;

    // Check status code
    if (statusCode === 429) {
      return this.recordLimit({
        accountId,
        type: RATE_LIMIT_TYPE.STATUS_CODE,
        remaining: headers['x-ratelimit-remaining'] ? parseInt(headers['x-ratelimit-remaining'], 10) : 0,
        limit: headers['x-ratelimit-limit'] ? parseInt(headers['x-ratelimit-limit'], 10) : null,
        resetTime: headers['x-ratelimit-reset'] ? parseInt(headers['x-ratelimit-reset'], 10) * 1000 : null,
        retryAfter: this.parseRetryAfter(headers['retry-after']),
        requestId,
        endpoint,
        source: 'http_response'
      });
    }

    // Check headers for low remaining
    if (headers['x-ratelimit-remaining']) {
      const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
      if (remaining === 0) {
        return this.recordLimit({
          accountId,
          type: RATE_LIMIT_TYPE.HEADER_DETECTED,
          remaining: 0,
          limit: headers['x-ratelimit-limit'] ? parseInt(headers['x-ratelimit-limit'], 10) : null,
          resetTime: headers['x-ratelimit-reset'] ? parseInt(headers['x-ratelimit-reset'], 10) * 1000 : null,
          requestId,
          endpoint,
          source: 'ratelimit_header'
        });
      }
    }

    // Check body for rate limit messages
    if (body && this.hasRateLimitPattern(body)) {
      return this.recordLimit({
        accountId,
        type: RATE_LIMIT_TYPE.BODY_PATTERN,
        message: this.extractRateLimitMessage(body),
        requestId,
        endpoint,
        source: 'response_body'
      });
    }

    return null;
  }

  /**
   * Parse Retry-After header
   * @param {string} value
   * @returns {number|null}
   */
  parseRetryAfter(value) {
    if (!value) return null;

    // Check if it's a number (seconds)
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10) * 1000;
    }

    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.getTime() - Date.now();
    }

    return null;
  }

  /**
   * Check if body contains rate limit patterns
   * @param {string} body
   * @returns {boolean}
   */
  hasRateLimitPattern(body) {
    if (!body) return false;

    const patterns = [
      /rate.?limit/i,
      /too.?many.?requests/i,
      /quota.?exceeded/i,
      /request.?limit/i,
      /throttl/i,
      /overloaded/i
    ];

    return patterns.some(p => p.test(body));
  }

  /**
   * Extract rate limit message from body
   * @param {string} body
   * @returns {string|null}
   */
  extractRateLimitMessage(body) {
    if (!body) return null;

    try {
      const parsed = JSON.parse(body);
      return parsed.error?.message || parsed.message || parsed.error || null;
    } catch {
      // Try to extract from plain text
      const match = body.match(/(?:error|message)[:\s]*["\']?([^"'\n]+)/i);
      return match ? match[1].trim() : null;
    }
  }

  /**
   * Manually record a rate limit
   * @param {string} accountId
   * @param {number} [duration] - Duration in ms
   * @param {string} [reason]
   * @returns {RateLimitEntry}
   */
  recordManual(accountId, duration = null, reason = null) {
    return this.recordLimit({
      accountId,
      type: RATE_LIMIT_TYPE.MANUAL,
      expiresAt: duration ? Date.now() + duration : undefined,
      message: reason,
      source: 'manual'
    });
  }

  /**
   * Clear rate limit for account
   * @param {string} accountId
   * @returns {boolean}
   */
  clearLimit(accountId) {
    const entry = this.activeLimits.get(accountId);
    if (entry) {
      // Move to history
      this.history.push(new RateLimitHistoryEntry(entry));
      this.activeLimits.delete(accountId);
      this.stats.totalExpired++;

      this.emit('limit_cleared', accountId);
      return true;
    }
    return false;
  }

  /**
   * Check if account is rate limited
   * @param {string} accountId
   * @returns {boolean}
   */
  isLimited(accountId) {
    const entry = this.activeLimits.get(accountId);
    if (!entry) return false;

    if (entry.isExpired()) {
      this.clearLimit(accountId);
      return false;
    }

    return true;
  }

  /**
   * Get rate limit entry for account
   * @param {string} accountId
   * @returns {RateLimitEntry|null}
   */
  getLimit(accountId) {
    const entry = this.activeLimits.get(accountId);
    if (!entry) return null;

    if (entry.isExpired()) {
      this.clearLimit(accountId);
      return null;
    }

    return entry;
  }

  /**
   * Get time until account is available
   * @param {string} accountId
   * @returns {number}
   */
  getTimeUntilAvailable(accountId) {
    const entry = this.getLimit(accountId);
    return entry ? entry.getTimeUntilExpiry() : 0;
  }

  /**
   * Get all active limits
   * @returns {RateLimitEntry[]}
   */
  getActiveLimits() {
    const active = [];
    for (const [accountId, entry] of this.activeLimits) {
      if (entry.isExpired()) {
        this.clearLimit(accountId);
      } else {
        active.push(entry);
      }
    }
    return active;
  }

  /**
   * Get all limited account IDs
   * @returns {string[]}
   */
  getLimitedAccounts() {
    return this.getActiveLimits().map(e => e.accountId);
  }

  /**
   * Get history for account
   * @param {string} accountId
   * @param {number} [limit] - Max entries
   * @returns {RateLimitHistoryEntry[]}
   */
  getAccountHistory(accountId, limit = 100) {
    return this.history
      .filter(h => h.accountId === accountId)
      .slice(-limit);
  }

  /**
   * Get recent history
   * @param {number} [hours] - Hours of history
   * @returns {RateLimitHistoryEntry[]}
   */
  getRecentHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.history.filter(h => h.detectedAt >= cutoff);
  }

  /**
   * Get tracker statistics
   * @returns {Object}
   */
  getStats() {
    // Calculate account stats summary
    const accountStats = [];
    for (const [accountId, stats] of this.stats.byAccount) {
      accountStats.push({
        accountId,
        ...stats,
        currentlyLimited: this.isLimited(accountId)
      });
    }

    return {
      activeLimits: this.activeLimits.size,
      totalDetected: this.stats.totalDetected,
      totalExpired: this.stats.totalExpired,
      totalManual: this.stats.totalManual,
      byType: { ...this.stats.byType },
      byAccount: accountStats,
      historySize: this.history.length,
      recentLimits24h: this.getRecentHistory(24).length
    };
  }

  /**
   * Cleanup expired limits and old history
   */
  cleanup() {
    // Clean expired limits
    for (const [accountId, entry] of this.activeLimits) {
      if (entry.isExpired()) {
        this.history.push(new RateLimitHistoryEntry(entry));
        this.activeLimits.delete(accountId);
        this.stats.totalExpired++;
        this.emit('limit_expired', accountId);
      }
    }

    // Clean old history
    const cutoff = Date.now() - this.config.historyRetention;
    const oldSize = this.history.length;
    this.history = this.history.filter(h => h.detectedAt >= cutoff);

    if (this.history.length < oldSize) {
      this.emit('history_cleaned', oldSize - this.history.length);
    }
  }

  /**
   * Reset all data
   */
  reset() {
    this.activeLimits.clear();
    this.history = [];
    this.stats = {
      totalDetected: 0,
      totalExpired: 0,
      totalManual: 0,
      byType: {
        [RATE_LIMIT_TYPE.HEADER_DETECTED]: 0,
        [RATE_LIMIT_TYPE.STATUS_CODE]: 0,
        [RATE_LIMIT_TYPE.BODY_PATTERN]: 0,
        [RATE_LIMIT_TYPE.MANUAL]: 0
      },
      byAccount: new Map()
    };

    this.emit('reset');
  }

  /**
   * Export data for persistence
   * @returns {Object}
   */
  export() {
    return {
      activeLimits: Array.from(this.activeLimits.entries()).map(([id, entry]) => ({
        accountId: id,
        ...entry.toJSON()
      })),
      history: this.history.slice(-1000), // Keep last 1000 entries
      stats: this.getStats()
    };
  }

  /**
   * Import data from persistence
   * @param {Object} data
   */
  import(data) {
    if (data.activeLimits) {
      for (const entryData of data.activeLimits) {
        if (!entryData.expired) {
          const entry = new RateLimitEntry(entryData);
          if (!entry.isExpired()) {
            this.activeLimits.set(entryData.accountId, entry);
          }
        }
      }
    }

    if (data.history) {
      this.history = data.history;
    }
  }

  /**
   * Close the tracker
   */
  close() {
    this.stopCleanup();
    this.removeAllListeners();
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create Rate Limit Tracker instance
 * @param {Object} [config]
 * @returns {RateLimitTracker}
 */
function getRateLimitTracker(config) {
  if (!instance) {
    instance = new RateLimitTracker(config);
    instance.startCleanup();
  }
  return instance;
}

module.exports = {
  RateLimitTracker,
  RateLimitEntry,
  RateLimitHistoryEntry,
  getRateLimitTracker,
  RATE_LIMIT_TYPE,
  DEFAULT_CONFIG
};
