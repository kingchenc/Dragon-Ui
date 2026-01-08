/**
 * Pricing Cache System for Dragon-UI
 * Cache invalidation, offline mode, fallback chain, and cache warming
 *
 * @module lib/pricing-cache
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(data, options = {}) {
    this.data = data;
    this.createdAt = Date.now();
    this.expiresAt = options.ttl ? Date.now() + options.ttl : null;
    this.version = options.version || '1.0.0';
    this.source = options.source || 'unknown';
    this.hits = 0;
    this.lastAccessed = Date.now();
  }

  /**
   * Check if entry is expired
   * @returns {boolean}
   */
  isExpired() {
    if (!this.expiresAt) return false;
    return Date.now() > this.expiresAt;
  }

  /**
   * Touch entry (update access time and hit count)
   */
  touch() {
    this.lastAccessed = Date.now();
    this.hits++;
  }

  /**
   * Get remaining TTL in milliseconds
   * @returns {number|null}
   */
  getRemainingTTL() {
    if (!this.expiresAt) return null;
    const remaining = this.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Convert to serializable object
   * @returns {Object}
   */
  toJSON() {
    return {
      data: this.data,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
      version: this.version,
      source: this.source,
      hits: this.hits,
      lastAccessed: this.lastAccessed
    };
  }

  /**
   * Create from serialized object
   * @param {Object} json
   * @returns {CacheEntry}
   */
  static fromJSON(json) {
    const entry = new CacheEntry(json.data, {
      version: json.version,
      source: json.source
    });
    entry.createdAt = json.createdAt;
    entry.expiresAt = json.expiresAt;
    entry.hits = json.hits || 0;
    entry.lastAccessed = json.lastAccessed || Date.now();
    return entry;
  }
}

/**
 * Cache statistics tracker
 */
class CacheStats {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.warmings = 0;
    this.invalidations = 0;
    this.fallbacks = 0;
    this.startTime = Date.now();
  }

  /**
   * Record a cache hit
   */
  recordHit() {
    this.hits++;
  }

  /**
   * Record a cache miss
   */
  recordMiss() {
    this.misses++;
  }

  /**
   * Record an eviction
   */
  recordEviction() {
    this.evictions++;
  }

  /**
   * Record a warming
   */
  recordWarming() {
    this.warmings++;
  }

  /**
   * Record an invalidation
   */
  recordInvalidation() {
    this.invalidations++;
  }

  /**
   * Record a fallback use
   */
  recordFallback() {
    this.fallbacks++;
  }

  /**
   * Get hit rate
   * @returns {number}
   */
  getHitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return this.hits / total;
  }

  /**
   * Get statistics summary
   * @returns {Object}
   */
  getSummary() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      evictions: this.evictions,
      warmings: this.warmings,
      invalidations: this.invalidations,
      fallbacks: this.fallbacks,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.warmings = 0;
    this.invalidations = 0;
    this.fallbacks = 0;
    this.startTime = Date.now();
  }
}

/**
 * Fallback chain for pricing sources
 */
class FallbackChain {
  constructor() {
    this.sources = [];
  }

  /**
   * Add a fallback source
   * @param {Object} source
   */
  addSource(source) {
    this.sources.push({
      name: source.name,
      priority: source.priority || this.sources.length,
      fetch: source.fetch,
      validate: source.validate || (() => true)
    });

    // Sort by priority
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute fallback chain
   * @param {string} key
   * @returns {Promise<{data: any, source: string}>}
   */
  async execute(key) {
    for (const source of this.sources) {
      try {
        const data = await source.fetch(key);
        if (data && source.validate(data)) {
          return { data, source: source.name };
        }
      } catch (error) {
        // Continue to next source
      }
    }

    throw new Error('All fallback sources failed');
  }

  /**
   * Get source names in order
   * @returns {string[]}
   */
  getSourceOrder() {
    return this.sources.map(s => s.name);
  }
}

/**
 * Pricing Cache class
 */
class PricingCache {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || path.join(os.tmpdir(), 'dragon-ui-pricing-cache');
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours
    this.version = options.version || this.getCurrentVersion();
    this.offlineMode = false;

    this.memory = new Map();
    this.stats = new CacheStats();
    this.fallbackChain = new FallbackChain();

    this.ensureCacheDir();
    this.setupDefaultFallbacks();
  }

  /**
   * Get current version from package.json
   * @returns {string}
   */
  getCurrentVersion() {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return pkg.version || '1.0.0';
      }
    } catch (error) {
      // Ignore
    }
    return '1.0.0';
  }

  /**
   * Ensure cache directory exists
   */
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Setup default fallback sources
   */
  setupDefaultFallbacks() {
    const { getCompiledPricing, DEFAULT_PRICING } = require('./pricing-compiler.cjs');

    // 1. Compiled pricing (fastest)
    this.fallbackChain.addSource({
      name: 'compiled',
      priority: 0,
      fetch: () => {
        const compiled = getCompiledPricing();
        return compiled.MODEL_PRICING;
      },
      validate: (data) => Object.keys(data).length > 0
    });

    // 2. File cache
    this.fallbackChain.addSource({
      name: 'file-cache',
      priority: 1,
      fetch: (key) => {
        const entry = this.loadFromFile(key);
        return entry?.data;
      },
      validate: (data) => data !== null && data !== undefined
    });

    // 3. Memory cache
    this.fallbackChain.addSource({
      name: 'memory-cache',
      priority: 2,
      fetch: (key) => {
        const entry = this.memory.get(key);
        if (entry && !entry.isExpired()) {
          return entry.data;
        }
        return null;
      },
      validate: (data) => data !== null && data !== undefined
    });

    // 4. Default pricing (always available)
    this.fallbackChain.addSource({
      name: 'default',
      priority: 100,
      fetch: () => DEFAULT_PRICING,
      validate: (data) => Object.keys(data).length > 0
    });
  }

  /**
   * Generate cache key hash
   * @param {string} key
   * @returns {string}
   */
  getCacheKeyHash(key) {
    return crypto.createHash('md5').update(key).digest('hex').slice(0, 16);
  }

  /**
   * Get cache file path
   * @param {string} key
   * @returns {string}
   */
  getCacheFilePath(key) {
    const hash = this.getCacheKeyHash(key);
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * Load entry from file
   * @param {string} key
   * @returns {CacheEntry|null}
   */
  loadFromFile(key) {
    const filePath = this.getCacheFilePath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const json = JSON.parse(content);
      const entry = CacheEntry.fromJSON(json);

      // Version check - invalidate on version bump
      if (entry.version !== this.version) {
        this.stats.recordInvalidation();
        fs.unlinkSync(filePath);
        return null;
      }

      // Expiration check
      if (entry.isExpired()) {
        fs.unlinkSync(filePath);
        return null;
      }

      return entry;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save entry to file
   * @param {string} key
   * @param {CacheEntry} entry
   */
  saveToFile(key, entry) {
    const filePath = this.getCacheFilePath(key);

    try {
      fs.writeFileSync(filePath, JSON.stringify(entry.toJSON(), null, 2));
    } catch (error) {
      // Ignore write errors
    }
  }

  /**
   * Get item from cache
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    // 1. Check memory cache
    if (this.memory.has(key)) {
      const entry = this.memory.get(key);

      // Version check
      if (entry.version !== this.version) {
        this.invalidate(key);
        this.stats.recordMiss();
        return null;
      }

      if (!entry.isExpired()) {
        entry.touch();
        this.stats.recordHit();
        return entry.data;
      }

      // Expired, remove from memory
      this.memory.delete(key);
    }

    // 2. Check file cache
    const fileEntry = this.loadFromFile(key);
    if (fileEntry) {
      // Promote to memory cache
      this.memory.set(key, fileEntry);
      fileEntry.touch();
      this.stats.recordHit();
      return fileEntry.data;
    }

    this.stats.recordMiss();
    return null;
  }

  /**
   * Set item in cache
   * @param {string} key
   * @param {any} data
   * @param {Object} options
   */
  set(key, data, options = {}) {
    const entry = new CacheEntry(data, {
      ttl: options.ttl || this.defaultTTL,
      version: this.version,
      source: options.source || 'manual'
    });

    // Check memory limit
    if (this.memory.size >= this.maxSize) {
      this.evictLRU();
    }

    // Store in memory
    this.memory.set(key, entry);

    // Persist to file
    this.saveToFile(key, entry);
  }

  /**
   * Get with fallback chain
   * @param {string} key
   * @returns {Promise<any>}
   */
  async getWithFallback(key) {
    // Try cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute fallback chain
    try {
      const result = await this.fallbackChain.execute(key);
      this.stats.recordFallback();

      // Cache the result
      this.set(key, result.data, { source: result.source });

      return result.data;
    } catch (error) {
      // All fallbacks failed
      throw new Error(`Failed to get pricing for ${key}: ${error.message}`);
    }
  }

  /**
   * Invalidate cache entry
   * @param {string} key
   */
  invalidate(key) {
    this.memory.delete(key);

    const filePath = this.getCacheFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.stats.recordInvalidation();
  }

  /**
   * Invalidate all entries on version change
   */
  invalidateOnVersionChange() {
    const currentVersion = this.getCurrentVersion();

    if (currentVersion !== this.version) {
      this.clear();
      this.version = currentVersion;
    }
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memory) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }

    if (oldest) {
      this.memory.delete(oldest);
      this.stats.recordEviction();
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.memory.clear();

    // Clear file cache
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
          } catch (error) {
            // Ignore
          }
        }
      }
    }

    this.stats.recordInvalidation();
  }

  /**
   * Enable offline mode
   */
  enableOfflineMode() {
    this.offlineMode = true;
  }

  /**
   * Disable offline mode
   */
  disableOfflineMode() {
    this.offlineMode = false;
  }

  /**
   * Check if offline mode is enabled
   * @returns {boolean}
   */
  isOfflineMode() {
    return this.offlineMode;
  }

  /**
   * Warm cache with pricing data
   * @param {Object} data
   */
  async warmCache(data) {
    if (!data || typeof data !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(data)) {
      this.set(`pricing:${key}`, value, { source: 'warm' });
    }

    this.stats.recordWarming();
  }

  /**
   * Warm cache from compiled pricing
   */
  async warmFromCompiled() {
    const { getCompiledPricing } = require('./pricing-compiler.cjs');
    const compiled = getCompiledPricing();

    await this.warmCache(compiled.MODEL_PRICING);
  }

  /**
   * Pre-warm cache with all models
   */
  async preWarm() {
    await this.warmFromCompiled();
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats.getSummary(),
      memorySize: this.memory.size,
      maxSize: this.maxSize,
      version: this.version,
      offlineMode: this.offlineMode,
      cacheDir: this.cacheDir
    };
  }

  /**
   * Get all cached keys
   * @returns {string[]}
   */
  getKeys() {
    const keys = new Set(this.memory.keys());

    // Add file cache keys
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          keys.add(file.replace('.json', ''));
        }
      }
    }

    return Array.from(keys);
  }

  /**
   * Cleanup expired entries
   * @returns {number}
   */
  cleanup() {
    let cleaned = 0;

    // Cleanup memory
    for (const [key, entry] of this.memory) {
      if (entry.isExpired() || entry.version !== this.version) {
        this.memory.delete(key);
        cleaned++;
      }
    }

    // Cleanup files
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const entry = CacheEntry.fromJSON(JSON.parse(content));

            if (entry.isExpired() || entry.version !== this.version) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          } catch (error) {
            // Invalid file, remove it
            try {
              fs.unlinkSync(filePath);
              cleaned++;
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * Export cache to file
   * @param {string} outputPath
   */
  exportCache(outputPath) {
    const data = {
      version: this.version,
      exportedAt: new Date().toISOString(),
      entries: {}
    };

    for (const [key, entry] of this.memory) {
      data.entries[key] = entry.toJSON();
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    return outputPath;
  }

  /**
   * Import cache from file
   * @param {string} inputPath
   */
  importCache(inputPath) {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Cache file not found: ${inputPath}`);
    }

    const content = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(content);

    for (const [key, json] of Object.entries(data.entries)) {
      const entry = CacheEntry.fromJSON(json);

      // Update version to current
      entry.version = this.version;

      // Don't import expired entries
      if (!entry.isExpired()) {
        this.memory.set(key, entry);
        this.saveToFile(key, entry);
      }
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get PricingCache instance
 * @param {Object} options
 * @returns {PricingCache}
 */
function getPricingCache(options) {
  if (!instance) {
    instance = new PricingCache(options);
  }
  return instance;
}

/**
 * Reset singleton instance
 */
function resetPricingCache() {
  if (instance) {
    instance.clear();
    instance = null;
  }
}

module.exports = {
  CacheEntry,
  CacheStats,
  FallbackChain,
  PricingCache,
  getPricingCache,
  resetPricingCache
};
