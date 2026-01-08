/**
 * Semaphore-Based Cache Service for Dragon-UI
 * Process-level locking with concurrent update prevention
 *
 * @module services/semaphore-cache
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  cacheDir: path.join(os.tmpdir(), 'dragon-ui-cache'),
  lockDir: path.join(os.tmpdir(), 'dragon-ui-semaphore'),
  lockTimeout: 5000,          // Max lock wait time in ms
  lockStaleTimeout: 30000,    // Consider lock stale after this time
  cacheTTL: 60000,            // Cache entry TTL in ms
  cleanupInterval: 300000,    // Cleanup every 5 minutes
  maxCacheSize: 100,          // Maximum cache entries
  compressionThreshold: 1024  // Compress entries larger than this
};

/**
 * Lock status
 */
const LOCK_STATUS = {
  ACQUIRED: 'acquired',
  FAILED: 'failed',
  STALE: 'stale',
  TIMEOUT: 'timeout'
};

/**
 * Cache entry class
 */
class CacheEntry {
  constructor(key, value, options = {}) {
    this.key = key;
    this.value = value;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.accessCount = 0;
    this.ttl = options.ttl || DEFAULT_CONFIG.cacheTTL;
    this.compressed = false;
    this.size = this.calculateSize();
  }

  /**
   * Calculate entry size
   * @returns {number}
   */
  calculateSize() {
    if (typeof this.value === 'string') {
      return this.value.length;
    }
    return JSON.stringify(this.value).length;
  }

  /**
   * Check if entry is expired
   * @returns {boolean}
   */
  isExpired() {
    return Date.now() - this.createdAt > this.ttl;
  }

  /**
   * Record access
   */
  touch() {
    this.lastAccessed = Date.now();
    this.accessCount++;
  }

  /**
   * Get age in ms
   * @returns {number}
   */
  getAge() {
    return Date.now() - this.createdAt;
  }

  /**
   * Serialize for storage
   * @returns {Object}
   */
  toJSON() {
    return {
      key: this.key,
      value: this.value,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      accessCount: this.accessCount,
      ttl: this.ttl,
      compressed: this.compressed,
      size: this.size
    };
  }

  /**
   * Create from JSON
   * @param {Object} data
   * @returns {CacheEntry}
   */
  static fromJSON(data) {
    const entry = new CacheEntry(data.key, data.value, { ttl: data.ttl });
    entry.createdAt = data.createdAt;
    entry.lastAccessed = data.lastAccessed;
    entry.accessCount = data.accessCount;
    entry.compressed = data.compressed;
    entry.size = data.size;
    return entry;
  }
}

/**
 * Semaphore lock class
 */
class Semaphore {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lockFile = path.join(this.config.lockDir, `${name}.lock`);
    this.acquired = false;
    this.pid = process.pid;
  }

  /**
   * Ensure lock directory exists
   */
  ensureLockDir() {
    if (!fs.existsSync(this.config.lockDir)) {
      fs.mkdirSync(this.config.lockDir, { recursive: true });
    }
  }

  /**
   * Acquire the lock
   * @returns {Promise<string>}
   */
  async acquire() {
    this.ensureLockDir();

    const startTime = Date.now();

    while (Date.now() - startTime < this.config.lockTimeout) {
      // Check for stale lock
      if (fs.existsSync(this.lockFile)) {
        const lockInfo = this.readLockInfo();
        if (lockInfo && this.isLockStale(lockInfo)) {
          // Remove stale lock
          this.forceRelease();
        } else if (lockInfo) {
          // Lock is held by another process
          await this.sleep(10);
          continue;
        }
      }

      // Try to acquire
      try {
        const lockInfo = {
          pid: this.pid,
          timestamp: Date.now(),
          hostname: os.hostname()
        };

        fs.writeFileSync(this.lockFile, JSON.stringify(lockInfo), {
          flag: 'wx' // Exclusive write, fail if exists
        });

        this.acquired = true;
        return LOCK_STATUS.ACQUIRED;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock file was created by another process
          await this.sleep(10);
          continue;
        }
        throw error;
      }
    }

    return LOCK_STATUS.TIMEOUT;
  }

  /**
   * Release the lock
   * @returns {boolean}
   */
  release() {
    if (!this.acquired) {
      return false;
    }

    try {
      // Verify we own the lock
      const lockInfo = this.readLockInfo();
      if (lockInfo && lockInfo.pid === this.pid) {
        fs.unlinkSync(this.lockFile);
        this.acquired = false;
        return true;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    this.acquired = false;
    return false;
  }

  /**
   * Force release the lock (for stale locks)
   * @returns {boolean}
   */
  forceRelease() {
    try {
      fs.unlinkSync(this.lockFile);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true;
      }
      return false;
    }
  }

  /**
   * Read lock file info
   * @returns {Object|null}
   */
  readLockInfo() {
    try {
      const content = fs.readFileSync(this.lockFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Check if lock is stale
   * @param {Object} lockInfo
   * @returns {boolean}
   */
  isLockStale(lockInfo) {
    if (!lockInfo || !lockInfo.timestamp) {
      return true;
    }

    // Check timestamp
    if (Date.now() - lockInfo.timestamp > this.config.lockStaleTimeout) {
      return true;
    }

    // Check if PID is still running (Unix only)
    if (process.platform !== 'win32' && lockInfo.pid) {
      try {
        process.kill(lockInfo.pid, 0);
        return false;
      } catch {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleep helper
   * @param {number} ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if lock is held
   * @returns {boolean}
   */
  isLocked() {
    return this.acquired;
  }
}

/**
 * Semaphore Cache class
 */
class SemaphoreCache {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.semaphores = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      lockAcquired: 0,
      lockFailed: 0,
      lockTimeout: 0,
      evictions: 0
    };

    this.cleanupInterval = null;
    this.ensureDirectories();
  }

  /**
   * Ensure cache directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.lockDir)) {
      fs.mkdirSync(this.config.lockDir, { recursive: true });
    }
  }

  /**
   * Generate cache key hash
   * @param {string} key
   * @returns {string}
   */
  hashKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Get semaphore for key
   * @param {string} key
   * @returns {Semaphore}
   */
  getSemaphore(key) {
    const hash = this.hashKey(key);
    if (!this.semaphores.has(hash)) {
      this.semaphores.set(hash, new Semaphore(hash, this.config));
    }
    return this.semaphores.get(hash);
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(key) {
    const startTime = Date.now();

    // Check memory cache first
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (!entry.isExpired()) {
        entry.touch();
        this.stats.hits++;
        return entry.value;
      }
      this.cache.delete(key);
    }

    // Check file cache
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        const entry = CacheEntry.fromJSON(data);

        if (!entry.isExpired()) {
          entry.touch();
          this.cache.set(key, entry);
          this.stats.hits++;
          return entry.value;
        }

        // Expired - delete file
        fs.unlinkSync(filePath);
      } catch {
        // Invalid cache file
      }
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * Set value in cache with locking
   * @param {string} key
   * @param {any} value
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  async set(key, value, options = {}) {
    const semaphore = this.getSemaphore(key);

    const lockStatus = await semaphore.acquire();

    if (lockStatus !== LOCK_STATUS.ACQUIRED) {
      if (lockStatus === LOCK_STATUS.TIMEOUT) {
        this.stats.lockTimeout++;
      } else {
        this.stats.lockFailed++;
      }
      return false;
    }

    this.stats.lockAcquired++;

    try {
      const entry = new CacheEntry(key, value, {
        ttl: options.ttl || this.config.cacheTTL
      });

      // Evict if at max size
      if (this.cache.size >= this.config.maxCacheSize) {
        this.evictLRU();
      }

      // Store in memory
      this.cache.set(key, entry);

      // Persist to file
      const filePath = this.getFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(entry.toJSON()));

      this.stats.writes++;
      return true;
    } finally {
      semaphore.release();
    }
  }

  /**
   * Delete from cache
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    const semaphore = this.getSemaphore(key);
    const lockStatus = await semaphore.acquire();

    if (lockStatus !== LOCK_STATUS.ACQUIRED) {
      return false;
    }

    try {
      this.cache.delete(key);

      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return true;
    } finally {
      semaphore.release();
    }
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      if (!entry.isExpired()) {
        return true;
      }
    }

    const filePath = this.getFilePath(key);
    return fs.existsSync(filePath);
  }

  /**
   * Get file path for key
   * @param {string} key
   * @returns {string}
   */
  getFilePath(key) {
    const hash = this.hashKey(key);
    return path.join(this.config.cacheDir, `${hash}.cache`);
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    let oldest = null;
    let oldestKey = null;

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<number>}
   */
  async clear() {
    const count = this.cache.size;
    this.cache.clear();

    // Clear cache files
    try {
      const files = fs.readdirSync(this.config.cacheDir);
      for (const file of files) {
        if (file.endsWith('.cache')) {
          fs.unlinkSync(path.join(this.config.cacheDir, file));
        }
      }
    } catch {
      // Ignore errors
    }

    return count;
  }

  /**
   * Start cleanup scheduler
   */
  startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup scheduler
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Cleanup expired entries
   * @returns {number}
   */
  cleanup() {
    let cleaned = 0;

    // Clean memory cache
    for (const [key, entry] of this.cache) {
      if (entry.isExpired()) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    // Clean file cache
    try {
      const files = fs.readdirSync(this.config.cacheDir);
      for (const file of files) {
        if (!file.endsWith('.cache')) continue;

        const filePath = path.join(this.config.cacheDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);

          if (Date.now() - data.createdAt > data.ttl) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch {
          // Invalid file - delete it
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
    } catch {
      // Ignore errors
    }

    // Clean stale locks
    try {
      const locks = fs.readdirSync(this.config.lockDir);
      for (const lock of locks) {
        if (!lock.endsWith('.lock')) continue;

        const lockPath = path.join(this.config.lockDir, lock);
        try {
          const content = fs.readFileSync(lockPath, 'utf8');
          const lockInfo = JSON.parse(content);

          if (Date.now() - lockInfo.timestamp > this.config.lockStaleTimeout) {
            fs.unlinkSync(lockPath);
          }
        } catch {
          // Invalid lock - delete it
          fs.unlinkSync(lockPath);
        }
      }
    } catch {
      // Ignore errors
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 ?
      this.stats.hits / (this.stats.hits + this.stats.misses) : 0;

    return {
      ...this.stats,
      hitRate,
      memoryEntries: this.cache.size,
      memorySize: Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.size, 0)
    };
  }

  /**
   * Get cache info
   * @returns {Object}
   */
  getInfo() {
    return {
      cacheDir: this.config.cacheDir,
      lockDir: this.config.lockDir,
      cacheTTL: this.config.cacheTTL,
      maxCacheSize: this.config.maxCacheSize,
      currentSize: this.cache.size
    };
  }

  /**
   * Close cache
   */
  close() {
    this.stopCleanup();
    this.semaphores.clear();
  }
}

// Singleton instance
let instance = null;

/**
 * Get Semaphore Cache instance
 * @param {Object} config
 * @returns {SemaphoreCache}
 */
function getSemaphoreCache(config) {
  if (!instance) {
    instance = new SemaphoreCache(config);
    instance.startCleanup();
  }
  return instance;
}

module.exports = {
  SemaphoreCache,
  Semaphore,
  CacheEntry,
  getSemaphoreCache,
  LOCK_STATUS,
  DEFAULT_CONFIG
};
