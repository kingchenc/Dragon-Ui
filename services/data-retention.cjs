/**
 * Data Retention Service for Dragon-UI
 * Configurable retention, automatic cleanup, compression, and archiving
 *
 * @module services/data-retention
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Default retention configuration
 */
const DEFAULT_CONFIG = {
  // Payload retention (request/response bodies)
  payloadRetentionDays: 7,

  // Metadata retention (stats, summaries)
  metadataRetentionDays: 365,

  // Log file retention
  logRetentionDays: 30,

  // Archive retention
  archiveRetentionDays: 730, // 2 years

  // Cleanup schedule
  cleanupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours

  // Compression settings
  compressAfterDays: 1,
  compressionLevel: 6,

  // Archive settings
  archiveEnabled: true,
  archiveDir: null, // Will be set in constructor

  // Size limits
  maxPayloadSize: 10 * 1024 * 1024, // 10MB per payload
  maxArchiveSize: 1024 * 1024 * 1024, // 1GB total archive

  // Cleanup thresholds
  cleanupThreshold: 0.9, // Start cleanup at 90% of max size
  targetAfterCleanup: 0.7 // Clean up to 70% of max size
};

/**
 * Retention policy types
 */
const RETENTION_TYPE = {
  PAYLOAD: 'payload',
  METADATA: 'metadata',
  LOG: 'log',
  ARCHIVE: 'archive'
};

/**
 * Data state types
 */
const DATA_STATE = {
  ACTIVE: 'active',
  COMPRESSED: 'compressed',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

/**
 * Data Retention Manager
 */
class DataRetentionManager {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };

    // Set archive directory
    if (!this.config.archiveDir) {
      this.config.archiveDir = path.join(
        process.cwd(),
        'archives'
      );
    }

    this.cleanupInterval = null;
    this.stats = {
      lastCleanup: null,
      totalCleaned: 0,
      totalCompressed: 0,
      totalArchived: 0,
      errors: []
    };

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    const dirs = [
      this.config.archiveDir,
      path.join(this.config.archiveDir, 'payloads'),
      path.join(this.config.archiveDir, 'metadata'),
      path.join(this.config.archiveDir, 'logs')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Start automatic cleanup scheduler
   */
  startScheduler() {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.runCleanup().catch(error => {
        console.error('[DataRetention] Scheduled cleanup error:', error.message);
        this.stats.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message
        });
      });
    }, this.config.cleanupIntervalMs);

    console.log(`[DataRetention] Scheduler started (interval: ${this.config.cleanupIntervalMs / 1000}s)`);
  }

  /**
   * Stop automatic cleanup scheduler
   */
  stopScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[DataRetention] Scheduler stopped');
    }
  }

  /**
   * Run full cleanup process
   * @returns {Object}
   */
  async runCleanup() {
    const startTime = Date.now();
    const results = {
      payloads: { cleaned: 0, compressed: 0, archived: 0 },
      metadata: { cleaned: 0, compressed: 0, archived: 0 },
      logs: { cleaned: 0, compressed: 0, archived: 0 },
      archives: { cleaned: 0 },
      duration: 0,
      errors: []
    };

    try {
      // Clean payloads
      const payloadResults = await this.cleanupPayloads();
      results.payloads = payloadResults;

      // Clean metadata
      const metadataResults = await this.cleanupMetadata();
      results.metadata = metadataResults;

      // Clean logs
      const logResults = await this.cleanupLogs();
      results.logs = logResults;

      // Clean old archives
      const archiveResults = await this.cleanupArchives();
      results.archives = archiveResults;

      // Update stats
      this.stats.lastCleanup = new Date().toISOString();
      this.stats.totalCleaned += payloadResults.cleaned + metadataResults.cleaned + logResults.cleaned;
      this.stats.totalCompressed += payloadResults.compressed + metadataResults.compressed + logResults.compressed;
      this.stats.totalArchived += payloadResults.archived + metadataResults.archived + logResults.archived;

    } catch (error) {
      results.errors.push(error.message);
      this.stats.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Cleanup payload data
   * @returns {Object}
   */
  async cleanupPayloads() {
    const results = { cleaned: 0, compressed: 0, archived: 0 };
    const payloadDir = path.join(process.cwd(), 'payloads');

    if (!fs.existsSync(payloadDir)) {
      return results;
    }

    const files = fs.readdirSync(payloadDir);
    const now = Date.now();
    const retentionMs = this.config.payloadRetentionDays * 24 * 60 * 60 * 1000;
    const compressMs = this.config.compressAfterDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(payloadDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      // Delete if beyond retention
      if (age > retentionMs) {
        if (this.config.archiveEnabled) {
          await this.archiveFile(filePath, RETENTION_TYPE.PAYLOAD);
          results.archived++;
        }
        fs.unlinkSync(filePath);
        results.cleaned++;
      }
      // Compress if old enough and not already compressed
      else if (age > compressMs && !file.endsWith('.gz')) {
        await this.compressFile(filePath);
        results.compressed++;
      }
    }

    return results;
  }

  /**
   * Cleanup metadata
   * @returns {Object}
   */
  async cleanupMetadata() {
    const results = { cleaned: 0, compressed: 0, archived: 0 };
    const metadataDir = path.join(process.cwd(), 'metadata');

    if (!fs.existsSync(metadataDir)) {
      return results;
    }

    const files = fs.readdirSync(metadataDir);
    const now = Date.now();
    const retentionMs = this.config.metadataRetentionDays * 24 * 60 * 60 * 1000;
    const compressMs = this.config.compressAfterDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(metadataDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > retentionMs) {
        if (this.config.archiveEnabled) {
          await this.archiveFile(filePath, RETENTION_TYPE.METADATA);
          results.archived++;
        }
        fs.unlinkSync(filePath);
        results.cleaned++;
      }
      else if (age > compressMs && !file.endsWith('.gz')) {
        await this.compressFile(filePath);
        results.compressed++;
      }
    }

    return results;
  }

  /**
   * Cleanup log files
   * @returns {Object}
   */
  async cleanupLogs() {
    const results = { cleaned: 0, compressed: 0, archived: 0 };
    const logDirs = [
      path.join(process.cwd(), 'logs'),
      path.join(require('os').tmpdir(), 'dragon-ui-requests')
    ];

    for (const logDir of logDirs) {
      if (!fs.existsSync(logDir)) {
        continue;
      }

      const files = fs.readdirSync(logDir);
      const now = Date.now();
      const retentionMs = this.config.logRetentionDays * 24 * 60 * 60 * 1000;
      const compressMs = this.config.compressAfterDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(logDir, file);

        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtime.getTime();

          if (age > retentionMs) {
            if (this.config.archiveEnabled) {
              await this.archiveFile(filePath, RETENTION_TYPE.LOG);
              results.archived++;
            }
            fs.unlinkSync(filePath);
            results.cleaned++;
          }
          else if (age > compressMs && !file.endsWith('.gz')) {
            await this.compressFile(filePath);
            results.compressed++;
          }
        } catch (error) {
          // Skip files that can't be processed
        }
      }
    }

    return results;
  }

  /**
   * Cleanup old archives
   * @returns {Object}
   */
  async cleanupArchives() {
    const results = { cleaned: 0 };

    if (!fs.existsSync(this.config.archiveDir)) {
      return results;
    }

    const archiveTypes = ['payloads', 'metadata', 'logs'];
    const now = Date.now();
    const retentionMs = this.config.archiveRetentionDays * 24 * 60 * 60 * 1000;

    for (const type of archiveTypes) {
      const typeDir = path.join(this.config.archiveDir, type);

      if (!fs.existsSync(typeDir)) {
        continue;
      }

      const files = fs.readdirSync(typeDir);

      for (const file of files) {
        const filePath = path.join(typeDir, file);

        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtime.getTime();

          if (age > retentionMs) {
            fs.unlinkSync(filePath);
            results.cleaned++;
          }
        } catch (error) {
          // Skip files that can't be processed
        }
      }
    }

    // Check total archive size
    const totalSize = await this.getArchiveSize();
    if (totalSize > this.config.maxArchiveSize * this.config.cleanupThreshold) {
      const cleaned = await this.pruneArchivesToSize(
        this.config.maxArchiveSize * this.config.targetAfterCleanup
      );
      results.cleaned += cleaned;
    }

    return results;
  }

  /**
   * Compress a file
   * @param {string} filePath
   * @returns {string}
   */
  async compressFile(filePath) {
    const content = fs.readFileSync(filePath);
    const compressed = await gzip(content, { level: this.config.compressionLevel });
    const compressedPath = filePath + '.gz';

    fs.writeFileSync(compressedPath, compressed);
    fs.unlinkSync(filePath);

    return compressedPath;
  }

  /**
   * Decompress a file
   * @param {string} filePath
   * @returns {Buffer}
   */
  async decompressFile(filePath) {
    const compressed = fs.readFileSync(filePath);
    return await gunzip(compressed);
  }

  /**
   * Archive a file
   * @param {string} filePath
   * @param {string} type
   * @returns {string}
   */
  async archiveFile(filePath, type) {
    const fileName = path.basename(filePath);
    const archiveDir = path.join(this.config.archiveDir, type + 's');
    const date = new Date().toISOString().split('T')[0];
    const archivePath = path.join(archiveDir, `${date}_${fileName}`);

    // Compress if not already compressed
    let content = fs.readFileSync(filePath);
    if (!filePath.endsWith('.gz')) {
      content = await gzip(content, { level: this.config.compressionLevel });
    }

    fs.writeFileSync(archivePath + (filePath.endsWith('.gz') ? '' : '.gz'), content);

    return archivePath;
  }

  /**
   * Get total archive size
   * @returns {number}
   */
  async getArchiveSize() {
    let totalSize = 0;

    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          walkDir(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    };

    walkDir(this.config.archiveDir);
    return totalSize;
  }

  /**
   * Prune archives to target size
   * @param {number} targetSize
   * @returns {number}
   */
  async pruneArchivesToSize(targetSize) {
    const files = [];

    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      const items = fs.readdirSync(dir);
      for (const item of items) {
        const filePath = path.join(dir, item);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
          walkDir(filePath);
        } else {
          files.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime.getTime()
          });
        }
      }
    };

    walkDir(this.config.archiveDir);

    // Sort by modification time (oldest first)
    files.sort((a, b) => a.mtime - b.mtime);

    let currentSize = files.reduce((sum, f) => sum + f.size, 0);
    let cleaned = 0;

    // Delete oldest files until we reach target size
    for (const file of files) {
      if (currentSize <= targetSize) {
        break;
      }

      try {
        fs.unlinkSync(file.path);
        currentSize -= file.size;
        cleaned++;
      } catch (error) {
        // Skip files that can't be deleted
      }
    }

    return cleaned;
  }

  /**
   * Get retention configuration
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update retention configuration
   * @param {Object} updates
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get retention statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      config: this.getConfig(),
      archiveSize: this.getArchiveSizeSync(),
      schedulerRunning: this.cleanupInterval !== null
    };
  }

  /**
   * Get archive size synchronously
   * @returns {number}
   */
  getArchiveSizeSync() {
    let totalSize = 0;

    const walkDir = (dir) => {
      if (!fs.existsSync(dir)) return;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);

          if (stats.isDirectory()) {
            walkDir(filePath);
          } else {
            totalSize += stats.size;
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    walkDir(this.config.archiveDir);
    return totalSize;
  }

  /**
   * List archived files
   * @param {string} type
   * @returns {Array}
   */
  listArchives(type = null) {
    const archives = [];
    const types = type ? [type] : ['payloads', 'metadata', 'logs'];

    for (const t of types) {
      const dir = path.join(this.config.archiveDir, t);

      if (!fs.existsSync(dir)) {
        continue;
      }

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        archives.push({
          type: t,
          name: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
    }

    return archives.sort((a, b) => b.modified - a.modified);
  }

  /**
   * Restore from archive
   * @param {string} archivePath
   * @param {string} destinationDir
   * @returns {string}
   */
  async restoreFromArchive(archivePath, destinationDir) {
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive not found: ${archivePath}`);
    }

    const fileName = path.basename(archivePath).replace('.gz', '').replace(/^\d{4}-\d{2}-\d{2}_/, '');
    const destPath = path.join(destinationDir, fileName);

    const content = await this.decompressFile(archivePath);
    fs.writeFileSync(destPath, content);

    return destPath;
  }

  /**
   * Export retention policy
   * @returns {Object}
   */
  exportPolicy() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: this.getConfig(),
      stats: this.getStats()
    };
  }

  /**
   * Import retention policy
   * @param {Object} policy
   */
  importPolicy(policy) {
    if (policy.config) {
      this.updateConfig(policy.config);
    }
  }

  /**
   * Format bytes for display
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get human-readable retention info
   * @returns {Object}
   */
  getRetentionInfo() {
    return {
      payloads: `${this.config.payloadRetentionDays} days`,
      metadata: `${this.config.metadataRetentionDays} days`,
      logs: `${this.config.logRetentionDays} days`,
      archives: `${this.config.archiveRetentionDays} days`,
      compression: `After ${this.config.compressAfterDays} days`,
      archiveSize: this.formatBytes(this.getArchiveSizeSync()),
      maxArchiveSize: this.formatBytes(this.config.maxArchiveSize)
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get Data Retention Manager instance
 * @param {Object} options
 * @returns {DataRetentionManager}
 */
function getDataRetentionManager(options) {
  if (!instance) {
    instance = new DataRetentionManager(options);
  }
  return instance;
}

module.exports = {
  DataRetentionManager,
  getDataRetentionManager,
  RETENTION_TYPE,
  DATA_STATE,
  DEFAULT_CONFIG
};
