'use strict';

/**
 * Data Loader Worker
 * Runs file scanning in a separate thread to avoid blocking Electron UI
 */
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const glob = require('glob');
const DatabaseService = require('./database.cjs');

class DataLoaderWorker {
  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Validate and sanitize file path to prevent path traversal attacks
   * @param {string} filePath - The file path to validate
   * @param {string} basePath - The base path that filePath should be within
   * @returns {boolean} - True if path is valid and safe
   */
  isValidPath(filePath, basePath) {
    try {
      // Normalize both paths
      const normalizedFile = path.normalize(filePath);
      const normalizedBase = path.normalize(basePath);

      // Resolve to absolute paths
      const resolvedFile = path.resolve(normalizedFile);
      const resolvedBase = path.resolve(normalizedBase);

      // Check if the file path starts with the base path
      if (!resolvedFile.startsWith(resolvedBase)) {
        console.warn(`[WORKER-SCAN] Path traversal attempt blocked: ${filePath}`);
        return false;
      }

      // Check for suspicious patterns
      if (filePath.includes('..') || filePath.includes('\0')) {
        console.warn(`[WORKER-SCAN] Suspicious path pattern blocked: ${filePath}`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`[WORKER-SCAN] Path validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate base path before scanning
   * @param {string} basePath - The base path to validate
   * @returns {boolean} - True if base path is valid
   */
  isValidBasePath(basePath) {
    try {
      if (!basePath || typeof basePath !== 'string') {
        return false;
      }

      // Check for null bytes
      if (basePath.includes('\0')) {
        console.warn(`[WORKER-SCAN] Invalid base path (null byte): ${basePath}`);
        return false;
      }

      // Normalize and check if path exists
      const normalized = path.normalize(basePath);

      // Allow WSL paths
      if (normalized.startsWith('\\\\wsl$')) {
        return true;
      }

      // Check if path exists and is a directory
      if (fs.existsSync(normalized)) {
        const stats = fs.statSync(normalized);
        return stats.isDirectory();
      }

      return false;
    } catch (error) {
      console.warn(`[WORKER-SCAN] Base path validation error: ${error.message}`);
      return false;
    }
  }

  async scanAndLoadFiles(activePaths) {
    const startTime = performance.now();
    console.log('[WORKER-SCAN] Starting file scan in worker thread...');

    const lastTimestamp = this.db.getLastTimestamp();
    console.log(`[WORKER-SCAN] Last DB timestamp: ${lastTimestamp}`);

    let newEntriesProcessed = 0;
    let totalFiles = 0;

    for (const basePath of activePaths) {
      // Validate base path before scanning
      if (!this.isValidBasePath(basePath)) {
        console.warn(`[WORKER-SCAN] Skipping invalid base path: ${basePath}`);
        continue;
      }

      console.log(`[WORKER-SCAN] Scanning path: ${basePath}`);

      let jsonlFiles = [];
      if (basePath.startsWith('\\\\wsl$')) {
        jsonlFiles = this.findJsonlFilesWSL(basePath);
      } else {
        const pattern = path.join(basePath, '**/*.jsonl').replace(/\\/g, '/');
        jsonlFiles = glob.sync(pattern);
      }

      // Filter out invalid paths
      jsonlFiles = jsonlFiles.filter(file => this.isValidPath(file, basePath));

      console.log(`[WORKER-SCAN] Found ${jsonlFiles.length} JSONL files`);
      totalFiles += jsonlFiles.length;

      for (let i = 0; i < jsonlFiles.length; i++) {
        const file = jsonlFiles[i];
        try {
          const newEntries = this.processJsonlFileIncremental(file, lastTimestamp);
          newEntriesProcessed += newEntries;
        } catch (fileErr) {
          console.error(`[WORKER-SCAN] Error processing ${file}:`, fileErr.message);
        }

        // Report progress every 100 files
        if ((i + 1) % 100 === 0 || i === jsonlFiles.length - 1) {
          try {
            parentPort.postMessage({
              type: 'progress',
              processed: i + 1,
              total: jsonlFiles.length,
              newEntries: newEntriesProcessed
            });
          } catch (err) {
            // Parent may have closed - ignore EPIPE errors
            if (err.code !== 'EPIPE') console.error('[WORKER] postMessage error:', err.message);
          }
        }
      }
    }

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    console.log(`[WORKER-SCAN] Completed: ${newEntriesProcessed} new entries from ${totalFiles} files in ${loadTime.toFixed(0)}ms`);

    // Get updated entries from DB
    const allEntries = this.db.getAllEntries();

    return {
      newEntriesProcessed,
      totalFiles,
      totalEntries: allEntries.length,
      loadTimeMs: loadTime
    };
  }

  processJsonlFileIncremental(file, lastTimestamp) {
    let newEntriesCount = 0;
    const newEntries = [];
    const processedHashes = new Set();

    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line);

          if (!entry.timestamp || entry.type !== 'assistant') continue;
          if (!entry.message?.usage) continue;
          if (typeof entry.message.usage.input_tokens !== 'number') continue;
          if (typeof entry.message.usage.output_tokens !== 'number') continue;

          if (lastTimestamp && entry.timestamp <= lastTimestamp) continue;

          const uniqueHash = this.createUniqueHash(entry);
          if (uniqueHash && processedHashes.has(uniqueHash)) continue;
          if (uniqueHash) processedHashes.add(uniqueHash);

          const usageEntry = this.createUsageEntry(entry, file);
          newEntries.push(usageEntry);
          newEntriesCount++;
        } catch (parseError) {
          continue;
        }
      }

      if (newEntries.length > 0) {
        this.db.insertBatch(newEntries);
      }
    } catch (fileError) {
      // Silent fail for file read errors
    }

    return newEntriesCount;
  }

  createUniqueHash(entry) {
    const messageId = entry.message?.id || entry.messageId;
    const requestId = entry.requestId;

    if (messageId && requestId) return `${messageId}-${requestId}`;
    if (messageId) return messageId;
    if (requestId) return requestId;

    return `${entry.timestamp}-${entry.sessionId}-${entry.message?.usage?.input_tokens}-${entry.message?.usage?.output_tokens}`;
  }

  createUsageEntry(entry, file) {
    const projectName = this.extractProjectName(file, entry);
    const sessionId = this.truncateSessionId(entry.sessionId);

    let validatedTimestamp = entry.timestamp;
    if (!entry.timestamp || typeof entry.timestamp !== 'string') {
      validatedTimestamp = new Date().toISOString();
    } else {
      const date = new Date(entry.timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
        validatedTimestamp = new Date().toISOString();
      }
    }

    const usageEntry = {
      timestamp: validatedTimestamp,
      sessionId: sessionId,
      fullSessionId: entry.sessionId,
      model: entry.message.model || 'unknown',
      project: projectName,
      input_tokens: entry.message.usage.input_tokens || 0,
      output_tokens: entry.message.usage.output_tokens || 0,
      cache_creation_input_tokens: entry.message.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: entry.message.usage.cache_read_input_tokens || 0,
      cost: this.calculateCost(entry.message.usage, entry.message.model),
      file: file,
      uuid: entry.uuid,
      cwd: entry.cwd
    };

    usageEntry.total_tokens = usageEntry.input_tokens + usageEntry.output_tokens +
      usageEntry.cache_creation_input_tokens + usageEntry.cache_read_input_tokens;

    return usageEntry;
  }

  truncateSessionId(fullSessionId) {
    if (!fullSessionId || typeof fullSessionId !== 'string') return 'unknown';
    const parts = fullSessionId.split('-');
    if (parts.length >= 2) {
      const secondLast = parts[parts.length - 2];
      const last = parts[parts.length - 1].substring(0, 3);
      return `${secondLast}-${last}`;
    }
    return fullSessionId.substring(0, 10);
  }

  extractProjectName(filePath, entry) {
    if (entry.cwd && typeof entry.cwd === 'string') {
      const cwdParts = entry.cwd.split(path.sep);
      const projectName = cwdParts[cwdParts.length - 1];
      if (projectName && projectName !== '.' && projectName !== '') {
        return projectName;
      }
    }
    const pathParts = filePath.split(path.sep);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      if (part && part !== 'projects' && !part.endsWith('.jsonl')) {
        return part;
      }
    }
    return 'unknown';
  }

  calculateCost(usage, model = 'unknown') {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreateTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    // Default Claude pricing (fallback)
    const pricing = {
      'claude-sonnet-4-20250514': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
      'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
      'claude-opus-4-20250514': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
      'claude-3-opus-20240229': { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
      'claude-3-5-haiku-20241022': { input: 0.80, output: 4.0, cacheWrite: 1.0, cacheRead: 0.08 },
      'default': { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 }
    };

    const modelPricing = pricing[model] || pricing['default'];

    const inputCost = (inputTokens / 1000000) * modelPricing.input;
    const outputCost = (outputTokens / 1000000) * modelPricing.output;
    const cacheCost = (cacheCreateTokens / 1000000) * modelPricing.cacheWrite;
    const cacheReadCost = (cacheReadTokens / 1000000) * modelPricing.cacheRead;

    return inputCost + outputCost + cacheCost + cacheReadCost;
  }

  findJsonlFilesWSL(basePath) {
    const jsonlFiles = [];

    const scanDirectory = (dir) => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scanDirectory(fullPath);
            } else if (entry.endsWith('.jsonl')) {
              jsonlFiles.push(fullPath);
            }
          } catch (statError) {
            continue;
          }
        }
      } catch (error) {
        // Silent fail
      }
    };

    scanDirectory(basePath);
    return jsonlFiles;
  }
}

// Worker message handling
if (parentPort) {
  const worker = new DataLoaderWorker();

  // Safely post message to parent (handles EPIPE if parent closed)
  const safePostMessage = (msg) => {
    try {
      parentPort.postMessage(msg);
    } catch (err) {
      // Parent may have closed - ignore EPIPE errors
      if (err.code !== 'EPIPE' && err.code !== 'ERR_IPC_CHANNEL_CLOSED') {
        console.error('[WORKER] postMessage error:', err.message);
      }
    }
  };

  parentPort.on('message', async (data) => {
    try {
      if (data.type === 'scan') {
        const result = await worker.scanAndLoadFiles(data.activePaths);
        safePostMessage({ type: 'result', data: result });
      }
    } catch (error) {
      console.error('[WORKER-SCAN] Error:', error);
      safePostMessage({ type: 'error', error: error.message });
    }
  });
}

module.exports = DataLoaderWorker;
