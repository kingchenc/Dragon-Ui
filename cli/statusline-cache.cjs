/**
 * Statusline Cache System
 * Caches rendered statusline output for improved performance
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Cache entry with TTL and metadata
 */
class CacheEntry {
  constructor(value, ttl = 1000) {
    this.value = value;
    this.createdAt = Date.now();
    this.ttl = ttl;
    this.hits = 0;
  }

  isExpired() {
    return Date.now() - this.createdAt > this.ttl;
  }

  get() {
    this.hits++;
    return this.value;
  }
}

/**
 * In-memory LRU cache for statusline data
 */
class StatuslineCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 1000; // 1 second default
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };

    // Widget-specific TTLs (in milliseconds)
    this.widgetTTLs = {
      'model': 60000,           // 1 minute - rarely changes
      'git-branch': 5000,       // 5 seconds
      'tokens-input': 500,      // 0.5 seconds - changes with each message
      'tokens-output': 500,
      'tokens-total': 500,
      'tokens-cached': 1000,
      'cost': 500,
      'daily-cost': 5000,       // 5 seconds
      'monthly-cost': 30000,    // 30 seconds
      'context-length': 500,
      'context-percent': 500,
      'context-usable': 500,
      'context-remaining': 500,
      'session-clock': 1000,    // 1 second
      'session-id': 60000,      // 1 minute
      'session-status': 2000,   // 2 seconds
      'block-timer': 60000      // 1 minute
    };

    // Persistent cache file for cross-session data
    this.cacheFile = options.cacheFile || path.join(os.homedir(), '.dragon-ui-statusline-cache.json');
    this.persistentData = {};
    this.loadPersistentCache();
  }

  /**
   * Generate cache key from widget ID and data hash
   */
  generateKey(widgetId, data) {
    const relevantData = this.extractRelevantData(widgetId, data);
    const hash = crypto.createHash('md5').update(JSON.stringify(relevantData)).digest('hex').slice(0, 8);
    return `${widgetId}:${hash}`;
  }

  /**
   * Extract only the data relevant to a specific widget
   */
  extractRelevantData(widgetId, data) {
    const relevantFields = {
      'model': ['model'],
      'git-branch': ['branch'],
      'tokens-input': ['tokensIn', 'inputTokens'],
      'tokens-output': ['tokensOut', 'outputTokens'],
      'tokens-total': ['tokensTotal', 'totalTokens', 'tokensIn', 'tokensOut'],
      'tokens-cached': ['tokensCached', 'cachedTokens'],
      'cost': ['cost', 'totalCost', 'sessionCost'],
      'daily-cost': ['dailyCost', 'todayCost'],
      'monthly-cost': ['monthlyCost', 'monthCost'],
      'context-length': ['contextUsed', 'context', 'tokensTotal', 'model'],
      'context-percent': ['contextUsed', 'context', 'tokensTotal', 'model'],
      'context-usable': ['contextUsed', 'context', 'tokensTotal', 'model'],
      'context-remaining': ['contextUsed', 'context', 'tokensTotal', 'model'],
      'session-clock': ['session', 'sessionDuration', 'sessionStart', 'startTime'],
      'session-id': ['sessionId', 'session_id'],
      'session-status': ['isActive', 'sessionActive', 'status'],
      'block-timer': [] // Uses current time, always regenerate
    };

    const fields = relevantFields[widgetId] || Object.keys(data);
    const result = {};

    for (const field of fields) {
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    }

    return result;
  }

  /**
   * Get TTL for a specific widget
   */
  getWidgetTTL(widgetId) {
    return this.widgetTTLs[widgetId] || this.defaultTTL;
  }

  /**
   * Set custom TTL for a widget
   */
  setWidgetTTL(widgetId, ttl) {
    this.widgetTTLs[widgetId] = ttl;
  }

  /**
   * Get cached value
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.isExpired()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.get();
  }

  /**
   * Set cached value with TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, new CacheEntry(value, ttl));
  }

  /**
   * Get or compute cached value
   */
  async getOrCompute(widgetId, data, computeFn) {
    const key = this.generateKey(widgetId, data);
    const cached = this.get(key);

    if (cached !== null) {
      return cached;
    }

    const value = await computeFn();
    const ttl = this.getWidgetTTL(widgetId);
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Evict oldest cache entry
   */
  evictOldest() {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  // ============ PERSISTENT CACHE ============

  /**
   * Load persistent cache from disk
   */
  loadPersistentCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        this.persistentData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      }
    } catch (error) {
      this.persistentData = {};
    }
  }

  /**
   * Save persistent cache to disk
   */
  savePersistentCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.persistentData, null, 2));
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Get persistent value (survives process restart)
   */
  getPersistent(key, defaultValue = null) {
    return this.persistentData[key] ?? defaultValue;
  }

  /**
   * Set persistent value
   */
  setPersistent(key, value, save = true) {
    this.persistentData[key] = value;
    if (save) {
      this.savePersistentCache();
    }
  }

  /**
   * Get last rendered statusline (for quick startup)
   */
  getLastStatusline() {
    return this.getPersistent('lastStatusline');
  }

  /**
   * Save last rendered statusline
   */
  saveLastStatusline(statusline) {
    this.setPersistent('lastStatusline', {
      content: statusline,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached session data
   */
  getCachedSession() {
    return this.getPersistent('lastSession');
  }

  /**
   * Cache session data for quick startup
   */
  cacheSession(sessionData) {
    this.setPersistent('lastSession', {
      data: sessionData,
      timestamp: Date.now()
    });
  }
}

/**
 * Statusline render cache
 * Caches fully rendered statusline strings
 */
class StatuslineRenderCache {
  constructor(options = {}) {
    this.cache = new StatuslineCache(options);
    this.lastRender = null;
    this.lastRenderTime = 0;
    this.minRenderInterval = options.minRenderInterval || 100; // Minimum 100ms between renders
  }

  /**
   * Check if re-render is needed
   */
  shouldRerender(data) {
    const now = Date.now();

    // Always allow first render
    if (!this.lastRender) return true;

    // Throttle renders
    if (now - this.lastRenderTime < this.minRenderInterval) {
      return false;
    }

    // Check if data changed significantly
    const newHash = this.hashData(data);
    const oldHash = this.lastDataHash;

    if (newHash !== oldHash) {
      this.lastDataHash = newHash;
      return true;
    }

    return false;
  }

  /**
   * Hash data for change detection
   */
  hashData(data) {
    const relevant = {
      model: data.model,
      tokensTotal: data.tokensTotal || data.tokensIn + data.tokensOut,
      cost: data.cost,
      contextUsed: data.contextUsed
    };
    return crypto.createHash('md5').update(JSON.stringify(relevant)).digest('hex').slice(0, 8);
  }

  /**
   * Cache rendered statusline
   */
  cacheRender(statusline) {
    this.lastRender = statusline;
    this.lastRenderTime = Date.now();
    this.cache.saveLastStatusline(statusline);
  }

  /**
   * Get last render if still valid
   */
  getLastRender() {
    return this.lastRender;
  }

  /**
   * Get widget cache
   */
  getWidgetCache() {
    return this.cache;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.cache.getStats(),
      lastRenderTime: this.lastRenderTime,
      timeSinceLastRender: Date.now() - this.lastRenderTime
    };
  }
}

// Export singleton instances
const statuslineCache = new StatuslineCache();
const renderCache = new StatuslineRenderCache();

module.exports = {
  StatuslineCache,
  StatuslineRenderCache,
  CacheEntry,
  statuslineCache,
  renderCache
};
