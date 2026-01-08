/**
 * API Key Management Service for Dragon-UI
 * Handles API key generation, storage, validation, and rate limiting
 *
 * @module services/api-key-service
 */

'use strict';

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * API Key configuration constants
 */
const CONFIG = {
  KEY_LENGTH: 32,                    // 32 bytes = 256 bits
  KEY_PREFIX: 'drg_',                // Prefix for API keys
  PREVIEW_LENGTH: 8,                 // Characters to show in preview
  BCRYPT_ROUNDS: 10,                 // Not used - using SHA-256 for performance
  RATE_LIMIT_WINDOW: 60 * 1000,      // 1 minute window
  DEFAULT_RATE_LIMIT: 100,           // 100 requests per minute
  MAX_KEYS_PER_ACCOUNT: 10,          // Maximum keys per account
  KEY_EXPIRY_DAYS: 365               // Default expiry in days
};

/**
 * Generate a secure random API key
 * @returns {{key: string, hash: string, preview: string}}
 */
function generateApiKey() {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(CONFIG.KEY_LENGTH);

  // Create base64url encoded key
  const key = CONFIG.KEY_PREFIX + randomBytes.toString('base64url');

  // Create SHA-256 hash for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');

  // Create preview (first 8 chars after prefix)
  const preview = key.slice(0, CONFIG.KEY_PREFIX.length + CONFIG.PREVIEW_LENGTH);

  return { key, hash, preview };
}

/**
 * Hash an API key for comparison
 * @param {string} key - The API key to hash
 * @returns {string} The hash
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * API Key Service Class
 */
class ApiKeyService {
  /**
   * Create a new API Key Service
   * @param {Object} options
   * @param {string} [options.dbPath] - Path to the database file
   */
  constructor(options = {}) {
    const defaultDbPath = path.join(
      os.homedir(),
      '.dragon-ui',
      'api-keys.db'
    );

    this.dbPath = options.dbPath || defaultDbPath;
    this.db = null;
    this.rateLimitCache = new Map();

    this.init();
  }

  /**
   * Initialize the database
   */
  init() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create database connection
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');

      this.createTables();
      this.prepareStatements();

    } catch (error) {
      throw new Error(`Failed to initialize API Key database: ${error.message}`);
    }
  }

  /**
   * Create database tables
   */
  createTables() {
    // API Keys table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_preview TEXT NOT NULL,
        account_id TEXT,
        enabled INTEGER DEFAULT 1,
        rate_limit INTEGER DEFAULT ${CONFIG.DEFAULT_RATE_LIMIT},
        expires_at DATETIME,
        last_used_at DATETIME,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // API Key usage log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_key_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id INTEGER NOT NULL,
        endpoint TEXT,
        method TEXT,
        status_code INTEGER,
        response_time_ms INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);
      CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON api_key_usage(key_id);
      CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at);
    `);
  }

  /**
   * Prepare SQL statements
   */
  prepareStatements() {
    this.stmts = {
      insert: this.db.prepare(`
        INSERT INTO api_keys (name, key_hash, key_preview, account_id, rate_limit, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),

      findByHash: this.db.prepare(`
        SELECT * FROM api_keys WHERE key_hash = ?
      `),

      findById: this.db.prepare(`
        SELECT * FROM api_keys WHERE id = ?
      `),

      findByAccount: this.db.prepare(`
        SELECT * FROM api_keys WHERE account_id = ? ORDER BY created_at DESC
      `),

      listAll: this.db.prepare(`
        SELECT * FROM api_keys ORDER BY created_at DESC
      `),

      listEnabled: this.db.prepare(`
        SELECT * FROM api_keys WHERE enabled = 1 ORDER BY created_at DESC
      `),

      enable: this.db.prepare(`
        UPDATE api_keys SET enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      disable: this.db.prepare(`
        UPDATE api_keys SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      delete: this.db.prepare(`
        DELETE FROM api_keys WHERE id = ?
      `),

      updateLastUsed: this.db.prepare(`
        UPDATE api_keys
        SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),

      updateRateLimit: this.db.prepare(`
        UPDATE api_keys SET rate_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      updateName: this.db.prepare(`
        UPDATE api_keys SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `),

      logUsage: this.db.prepare(`
        INSERT INTO api_key_usage (key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      getUsageStats: this.db.prepare(`
        SELECT
          COUNT(*) as total_requests,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as success_count,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
        FROM api_key_usage
        WHERE key_id = ? AND created_at >= datetime('now', '-24 hours')
      `),

      getRecentUsage: this.db.prepare(`
        SELECT * FROM api_key_usage
        WHERE key_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `),

      countByAccount: this.db.prepare(`
        SELECT COUNT(*) as count FROM api_keys WHERE account_id = ?
      `),

      cleanupExpired: this.db.prepare(`
        UPDATE api_keys
        SET enabled = 0, updated_at = CURRENT_TIMESTAMP
        WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND enabled = 1
      `),

      cleanupOldUsage: this.db.prepare(`
        DELETE FROM api_key_usage WHERE created_at < datetime('now', '-30 days')
      `)
    };
  }

  /**
   * Create a new API key
   * @param {Object} options
   * @param {string} options.name - Key name/description
   * @param {string} [options.accountId] - Associated account ID
   * @param {number} [options.rateLimit] - Requests per minute limit
   * @param {number} [options.expiresInDays] - Days until expiration
   * @returns {{id: number, key: string, preview: string, name: string, expiresAt: string|null}}
   */
  create(options = {}) {
    const { name, accountId, rateLimit = CONFIG.DEFAULT_RATE_LIMIT, expiresInDays } = options;

    if (!name || typeof name !== 'string') {
      throw new Error('API key name is required');
    }

    // Check key limit per account
    if (accountId) {
      const count = this.stmts.countByAccount.get(accountId);
      if (count && count.count >= CONFIG.MAX_KEYS_PER_ACCOUNT) {
        throw new Error(`Maximum ${CONFIG.MAX_KEYS_PER_ACCOUNT} API keys per account reached`);
      }
    }

    // Generate key
    const { key, hash, preview } = generateApiKey();

    // Calculate expiry date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiresInDays);
      expiresAt = expiryDate.toISOString();
    }

    // Insert into database
    const result = this.stmts.insert.run(
      name,
      hash,
      preview,
      accountId || null,
      rateLimit,
      expiresAt
    );

    return {
      id: result.lastInsertRowid,
      key,
      preview,
      name,
      expiresAt
    };
  }

  /**
   * Validate an API key
   * @param {string} key - The API key to validate
   * @returns {{valid: boolean, keyData?: Object, error?: string}}
   */
  validate(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Invalid key format' };
    }

    // Check prefix
    if (!key.startsWith(CONFIG.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid key prefix' };
    }

    // Hash and lookup
    const hash = hashApiKey(key);
    const keyData = this.stmts.findByHash.get(hash);

    if (!keyData) {
      return { valid: false, error: 'Key not found' };
    }

    // Check if enabled
    if (!keyData.enabled) {
      return { valid: false, error: 'Key is disabled' };
    }

    // Check expiration
    if (keyData.expires_at) {
      const expiresAt = new Date(keyData.expires_at);
      if (expiresAt < new Date()) {
        return { valid: false, error: 'Key has expired' };
      }
    }

    // Check rate limit
    const rateLimitResult = this.checkRateLimit(keyData.id, keyData.rate_limit);
    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      };
    }

    // Update last used
    this.stmts.updateLastUsed.run(keyData.id);

    return { valid: true, keyData };
  }

  /**
   * Check rate limit for a key
   * @param {number} keyId - Key ID
   * @param {number} limit - Rate limit
   * @returns {{allowed: boolean, remaining: number, retryAfter?: number}}
   */
  checkRateLimit(keyId, limit) {
    const now = Date.now();
    const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

    // Get or initialize cache entry
    let cache = this.rateLimitCache.get(keyId);
    if (!cache) {
      cache = { requests: [], lastCleanup: now };
      this.rateLimitCache.set(keyId, cache);
    }

    // Cleanup old requests
    if (now - cache.lastCleanup > CONFIG.RATE_LIMIT_WINDOW) {
      cache.requests = cache.requests.filter(t => t > windowStart);
      cache.lastCleanup = now;
    }

    // Count requests in window
    const requestsInWindow = cache.requests.filter(t => t > windowStart).length;

    if (requestsInWindow >= limit) {
      // Find oldest request in window to calculate retry time
      const oldestRequest = Math.min(...cache.requests.filter(t => t > windowStart));
      const retryAfter = Math.ceil((oldestRequest + CONFIG.RATE_LIMIT_WINDOW - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfter
      };
    }

    // Add current request
    cache.requests.push(now);

    return {
      allowed: true,
      remaining: limit - requestsInWindow - 1
    };
  }

  /**
   * Log API key usage
   * @param {number} keyId - Key ID
   * @param {Object} data - Usage data
   */
  logUsage(keyId, data = {}) {
    try {
      this.stmts.logUsage.run(
        keyId,
        data.endpoint || null,
        data.method || null,
        data.statusCode || null,
        data.responseTimeMs || null,
        data.ipAddress || null,
        data.userAgent || null
      );
    } catch (error) {
      // Log but don't throw - usage logging is non-critical
      console.error('Failed to log API key usage:', error.message);
    }
  }

  /**
   * Get API key by ID
   * @param {number} id - Key ID
   * @returns {Object|null}
   */
  getById(id) {
    const key = this.stmts.findById.get(id);
    if (key) {
      return this.formatKeyData(key);
    }
    return null;
  }

  /**
   * List all API keys
   * @param {Object} options
   * @param {boolean} [options.enabledOnly] - Only return enabled keys
   * @param {string} [options.accountId] - Filter by account ID
   * @returns {Array}
   */
  list(options = {}) {
    let keys;

    if (options.accountId) {
      keys = this.stmts.findByAccount.all(options.accountId);
    } else if (options.enabledOnly) {
      keys = this.stmts.listEnabled.all();
    } else {
      keys = this.stmts.listAll.all();
    }

    return keys.map(k => this.formatKeyData(k));
  }

  /**
   * Enable an API key
   * @param {number} id - Key ID
   * @returns {boolean}
   */
  enable(id) {
    const result = this.stmts.enable.run(id);
    return result.changes > 0;
  }

  /**
   * Disable an API key
   * @param {number} id - Key ID
   * @returns {boolean}
   */
  disable(id) {
    const result = this.stmts.disable.run(id);
    // Clear rate limit cache
    this.rateLimitCache.delete(id);
    return result.changes > 0;
  }

  /**
   * Delete an API key
   * @param {number} id - Key ID
   * @returns {boolean}
   */
  delete(id) {
    const result = this.stmts.delete.run(id);
    // Clear rate limit cache
    this.rateLimitCache.delete(id);
    return result.changes > 0;
  }

  /**
   * Update API key rate limit
   * @param {number} id - Key ID
   * @param {number} rateLimit - New rate limit
   * @returns {boolean}
   */
  updateRateLimit(id, rateLimit) {
    if (typeof rateLimit !== 'number' || rateLimit < 1) {
      throw new Error('Rate limit must be a positive number');
    }
    const result = this.stmts.updateRateLimit.run(rateLimit, id);
    return result.changes > 0;
  }

  /**
   * Update API key name
   * @param {number} id - Key ID
   * @param {string} name - New name
   * @returns {boolean}
   */
  updateName(id, name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Name is required');
    }
    const result = this.stmts.updateName.run(name, id);
    return result.changes > 0;
  }

  /**
   * Get usage statistics for a key
   * @param {number} id - Key ID
   * @returns {Object}
   */
  getUsageStats(id) {
    const stats = this.stmts.getUsageStats.get(id);
    const keyData = this.stmts.findById.get(id);

    return {
      keyId: id,
      name: keyData?.name,
      totalRequests: stats?.total_requests || 0,
      avgResponseTimeMs: Math.round(stats?.avg_response_time || 0),
      successCount: stats?.success_count || 0,
      errorCount: stats?.error_count || 0,
      successRate: stats?.total_requests > 0
        ? Math.round((stats.success_count / stats.total_requests) * 100)
        : 0,
      lifetimeUsage: keyData?.usage_count || 0,
      lastUsed: keyData?.last_used_at || null
    };
  }

  /**
   * Get recent usage for a key
   * @param {number} id - Key ID
   * @param {number} [limit=50] - Number of records
   * @returns {Array}
   */
  getRecentUsage(id, limit = 50) {
    return this.stmts.getRecentUsage.all(id, limit);
  }

  /**
   * Cleanup expired keys and old usage logs
   * @returns {{expiredKeys: number, oldUsageLogs: number}}
   */
  cleanup() {
    const expiredResult = this.stmts.cleanupExpired.run();
    const usageResult = this.stmts.cleanupOldUsage.run();

    return {
      expiredKeys: expiredResult.changes,
      oldUsageLogs: usageResult.changes
    };
  }

  /**
   * Format key data for API response (hide sensitive info)
   * @private
   */
  formatKeyData(key) {
    return {
      id: key.id,
      name: key.name,
      preview: key.key_preview,
      accountId: key.account_id,
      enabled: !!key.enabled,
      rateLimit: key.rate_limit,
      expiresAt: key.expires_at,
      lastUsedAt: key.last_used_at,
      usageCount: key.usage_count,
      createdAt: key.created_at,
      updatedAt: key.updated_at
    };
  }

  /**
   * Get database info
   * @returns {Object}
   */
  getDbInfo() {
    const keyCount = this.db.prepare('SELECT COUNT(*) as count FROM api_keys').get();
    const enabledCount = this.db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE enabled = 1').get();
    const usageCount = this.db.prepare('SELECT COUNT(*) as count FROM api_key_usage').get();

    return {
      totalKeys: keyCount?.count || 0,
      enabledKeys: enabledCount?.count || 0,
      usageLogs: usageCount?.count || 0,
      dbPath: this.dbPath
    };
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.rateLimitCache.clear();
  }
}

// Express middleware for API key authentication
function apiKeyMiddleware(apiKeyService) {
  return (req, res, next) => {
    const startTime = Date.now();

    // Get API key from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Use Authorization: Bearer <key>'
      });
    }

    const apiKey = authHeader.slice(7);

    // Validate key
    const result = apiKeyService.validate(apiKey);

    if (!result.valid) {
      const statusCode = result.error === 'Rate limit exceeded' ? 429 : 401;
      const response = {
        error: statusCode === 429 ? 'Too Many Requests' : 'Unauthorized',
        message: result.error
      };

      if (result.retryAfter) {
        res.set('Retry-After', result.retryAfter);
        response.retryAfter = result.retryAfter;
      }

      return res.status(statusCode).json(response);
    }

    // Attach key data to request
    req.apiKey = result.keyData;

    // Log usage on response finish
    res.on('finish', () => {
      apiKeyService.logUsage(result.keyData.id, {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: Date.now() - startTime,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    });

    next();
  };
}

// Singleton instance
let instance = null;

/**
 * Get or create API Key Service instance
 * @param {Object} [options]
 * @returns {ApiKeyService}
 */
function getApiKeyService(options) {
  if (!instance) {
    instance = new ApiKeyService(options);
  }
  return instance;
}

module.exports = {
  ApiKeyService,
  getApiKeyService,
  generateApiKey,
  hashApiKey,
  apiKeyMiddleware,
  CONFIG
};
