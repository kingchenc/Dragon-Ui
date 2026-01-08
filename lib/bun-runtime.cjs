/**
 * Bun Runtime Support for Dragon-UI
 * Bun compatibility, performance optimization, and native APIs
 *
 * @module lib/bun-runtime
 */

'use strict';

/**
 * Check if running in Bun runtime
 * @returns {boolean}
 */
function isBun() {
  return typeof globalThis.Bun !== 'undefined';
}

/**
 * Check if running in Node.js
 * @returns {boolean}
 */
function isNode() {
  return typeof process !== 'undefined' && process.versions && process.versions.node;
}

/**
 * Check if running in Deno
 * @returns {boolean}
 */
function isDeno() {
  return typeof globalThis.Deno !== 'undefined';
}

/**
 * Get current runtime name
 * @returns {string}
 */
function getRuntime() {
  if (isBun()) return 'bun';
  if (isDeno()) return 'deno';
  if (isNode()) return 'node';
  return 'unknown';
}

/**
 * Get runtime version
 * @returns {string}
 */
function getRuntimeVersion() {
  if (isBun()) {
    return globalThis.Bun.version;
  }
  if (isDeno()) {
    return globalThis.Deno.version.deno;
  }
  if (isNode()) {
    return process.versions.node;
  }
  return 'unknown';
}

/**
 * Bun-optimized file operations
 */
const BunFileOps = {
  /**
   * Read file (Bun-optimized)
   * @param {string} filePath
   * @param {string} encoding
   * @returns {Promise<string|Buffer>}
   */
  async readFile(filePath, encoding = 'utf8') {
    if (isBun()) {
      const file = globalThis.Bun.file(filePath);
      if (encoding === 'utf8') {
        return await file.text();
      }
      return await file.arrayBuffer().then(ab => Buffer.from(ab));
    }

    const fs = require('fs').promises;
    return fs.readFile(filePath, encoding);
  },

  /**
   * Write file (Bun-optimized)
   * @param {string} filePath
   * @param {string|Buffer} content
   * @returns {Promise<void>}
   */
  async writeFile(filePath, content) {
    if (isBun()) {
      await globalThis.Bun.write(filePath, content);
      return;
    }

    const fs = require('fs').promises;
    await fs.writeFile(filePath, content);
  },

  /**
   * Read file sync (Bun-optimized)
   * @param {string} filePath
   * @param {string} encoding
   * @returns {string|Buffer}
   */
  readFileSync(filePath, encoding = 'utf8') {
    if (isBun()) {
      const file = globalThis.Bun.file(filePath);
      // Bun's file.text() is sync-like fast but still returns Promise
      // For true sync, fall back to Node API
    }

    const fs = require('fs');
    return fs.readFileSync(filePath, encoding);
  },

  /**
   * Write file sync (Bun-optimized)
   * @param {string} filePath
   * @param {string|Buffer} content
   */
  writeFileSync(filePath, content) {
    if (isBun()) {
      // Bun.write returns a promise, use Node API for sync
    }

    const fs = require('fs');
    fs.writeFileSync(filePath, content);
  },

  /**
   * Check if file exists
   * @param {string} filePath
   * @returns {boolean}
   */
  exists(filePath) {
    if (isBun()) {
      const file = globalThis.Bun.file(filePath);
      // Bun.file doesn't have sync exists, use Node API
    }

    const fs = require('fs');
    return fs.existsSync(filePath);
  },

  /**
   * Get file size
   * @param {string} filePath
   * @returns {Promise<number>}
   */
  async getSize(filePath) {
    if (isBun()) {
      const file = globalThis.Bun.file(filePath);
      return file.size;
    }

    const fs = require('fs').promises;
    const stat = await fs.stat(filePath);
    return stat.size;
  }
};

/**
 * Bun-optimized hashing
 */
const BunHash = {
  /**
   * Create MD5 hash
   * @param {string|Buffer} data
   * @returns {string}
   */
  md5(data) {
    if (isBun()) {
      const hasher = new globalThis.Bun.CryptoHasher('md5');
      hasher.update(data);
      return hasher.digest('hex');
    }

    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  },

  /**
   * Create SHA256 hash
   * @param {string|Buffer} data
   * @returns {string}
   */
  sha256(data) {
    if (isBun()) {
      const hasher = new globalThis.Bun.CryptoHasher('sha256');
      hasher.update(data);
      return hasher.digest('hex');
    }

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Create SHA512 hash
   * @param {string|Buffer} data
   * @returns {string}
   */
  sha512(data) {
    if (isBun()) {
      const hasher = new globalThis.Bun.CryptoHasher('sha512');
      hasher.update(data);
      return hasher.digest('hex');
    }

    const crypto = require('crypto');
    return crypto.createHash('sha512').update(data).digest('hex');
  },

  /**
   * Create HMAC
   * @param {string} algorithm
   * @param {string|Buffer} key
   * @param {string|Buffer} data
   * @returns {string}
   */
  hmac(algorithm, key, data) {
    if (isBun() && globalThis.Bun.CryptoHasher) {
      // Bun uses different HMAC API
      const hasher = new globalThis.Bun.CryptoHasher(algorithm, key);
      hasher.update(data);
      return hasher.digest('hex');
    }

    const crypto = require('crypto');
    return crypto.createHmac(algorithm, key).update(data).digest('hex');
  }
};

/**
 * Bun-optimized HTTP client
 */
const BunHttp = {
  /**
   * Fetch with Bun optimizations
   * @param {string} url
   * @param {Object} options
   * @returns {Promise<Response>}
   */
  async fetch(url, options = {}) {
    // Both Bun and modern Node support fetch
    return globalThis.fetch(url, options);
  },

  /**
   * GET request
   * @param {string} url
   * @param {Object} headers
   * @returns {Promise<Object>}
   */
  async get(url, headers = {}) {
    const response = await this.fetch(url, {
      method: 'GET',
      headers
    });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: await response.json().catch(() => response.text())
    };
  },

  /**
   * POST request
   * @param {string} url
   * @param {Object} body
   * @param {Object} headers
   * @returns {Promise<Object>}
   */
  async post(url, body, headers = {}) {
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    });

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: await response.json().catch(() => response.text())
    };
  }
};

/**
 * Bun-optimized SQLite operations
 */
const BunSqlite = {
  /**
   * Check if Bun SQLite is available
   * @returns {boolean}
   */
  isAvailable() {
    if (!isBun()) return false;
    try {
      return typeof globalThis.Bun.SQLite !== 'undefined';
    } catch {
      return false;
    }
  },

  /**
   * Open database
   * @param {string} dbPath
   * @returns {Object}
   */
  open(dbPath) {
    if (isBun() && this.isAvailable()) {
      return new globalThis.Bun.SQLite(dbPath);
    }

    // Fall back to better-sqlite3
    const Database = require('better-sqlite3');
    return new Database(dbPath);
  },

  /**
   * Create database wrapper with unified API
   * @param {string} dbPath
   * @returns {Object}
   */
  createWrapper(dbPath) {
    const db = this.open(dbPath);
    const isBunDb = isBun() && this.isAvailable();

    return {
      db,
      isBun: isBunDb,

      prepare(sql) {
        return db.prepare(sql);
      },

      run(sql, params = []) {
        const stmt = db.prepare(sql);
        if (isBunDb) {
          return stmt.run(...params);
        }
        return stmt.run(params);
      },

      get(sql, params = []) {
        const stmt = db.prepare(sql);
        if (isBunDb) {
          return stmt.get(...params);
        }
        return stmt.get(params);
      },

      all(sql, params = []) {
        const stmt = db.prepare(sql);
        if (isBunDb) {
          return stmt.all(...params);
        }
        return stmt.all(params);
      },

      exec(sql) {
        if (isBunDb) {
          return db.exec(sql);
        }
        return db.exec(sql);
      },

      close() {
        return db.close();
      },

      transaction(fn) {
        if (isBunDb) {
          return db.transaction(fn);
        }
        return db.transaction(fn);
      }
    };
  }
};

/**
 * Bun-optimized subprocess execution
 */
const BunProcess = {
  /**
   * Spawn subprocess
   * @param {string[]} cmd
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async spawn(cmd, options = {}) {
    if (isBun()) {
      const proc = globalThis.Bun.spawn(cmd, {
        cwd: options.cwd,
        env: options.env,
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return { stdout, stderr, exitCode };
    }

    // Node fallback
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const proc = spawn(cmd[0], cmd.slice(1), {
        cwd: options.cwd,
        env: options.env,
        shell: process.platform === 'win32'
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', data => stdout += data);
      proc.stderr?.on('data', data => stderr += data);

      proc.on('close', exitCode => {
        resolve({ stdout, stderr, exitCode });
      });

      proc.on('error', reject);
    });
  },

  /**
   * Execute shell command
   * @param {string} command
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async exec(command, options = {}) {
    if (isBun()) {
      const proc = globalThis.Bun.spawn(['sh', '-c', command], {
        cwd: options.cwd,
        env: options.env,
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return { stdout, stderr, exitCode };
    }

    // Node fallback
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, options);
      return { stdout, stderr, exitCode: 0 };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }
};

/**
 * Bun-optimized performance utilities
 */
const BunPerf = {
  /**
   * Get high-resolution time
   * @returns {number}
   */
  now() {
    if (isBun()) {
      return globalThis.Bun.nanoseconds() / 1e6;
    }

    if (typeof performance !== 'undefined') {
      return performance.now();
    }

    const [sec, nsec] = process.hrtime();
    return sec * 1000 + nsec / 1e6;
  },

  /**
   * Measure execution time
   * @param {Function} fn
   * @returns {Promise<{result: any, time: number}>}
   */
  async measure(fn) {
    const start = this.now();
    const result = await fn();
    const time = this.now() - start;

    return { result, time };
  },

  /**
   * Measure sync execution time
   * @param {Function} fn
   * @returns {{result: any, time: number}}
   */
  measureSync(fn) {
    const start = this.now();
    const result = fn();
    const time = this.now() - start;

    return { result, time };
  },

  /**
   * Sleep for specified milliseconds
   * @param {number} ms
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    if (isBun()) {
      await globalThis.Bun.sleep(ms);
      return;
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Get memory usage
   * @returns {Object}
   */
  getMemoryUsage() {
    if (isBun() && globalThis.Bun.memory) {
      return {
        heapUsed: globalThis.Bun.memory(),
        heapTotal: 0,
        external: 0,
        rss: 0
      };
    }

    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    };
  }
};

/**
 * Bun-compatible environment utilities
 */
const BunEnv = {
  /**
   * Get environment variable
   * @param {string} key
   * @param {string} defaultValue
   * @returns {string}
   */
  get(key, defaultValue = '') {
    if (isBun()) {
      return globalThis.Bun.env[key] || defaultValue;
    }
    return process.env[key] || defaultValue;
  },

  /**
   * Set environment variable
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    if (isBun()) {
      globalThis.Bun.env[key] = value;
    } else {
      process.env[key] = value;
    }
  },

  /**
   * Get all environment variables
   * @returns {Object}
   */
  getAll() {
    if (isBun()) {
      return { ...globalThis.Bun.env };
    }
    return { ...process.env };
  }
};

/**
 * Runtime compatibility layer
 */
class RuntimeCompat {
  constructor() {
    this.runtime = getRuntime();
    this.version = getRuntimeVersion();
  }

  /**
   * Get best available implementation
   * @param {Object} implementations
   * @returns {any}
   */
  getBest(implementations) {
    if (this.runtime === 'bun' && implementations.bun) {
      return implementations.bun;
    }
    if (this.runtime === 'deno' && implementations.deno) {
      return implementations.deno;
    }
    return implementations.node || implementations.default;
  }

  /**
   * Check feature support
   * @param {string} feature
   * @returns {boolean}
   */
  supports(feature) {
    const features = {
      'native-fetch': true,
      'native-sqlite': isBun(),
      'native-crypto': true,
      'native-fs': true,
      'worker-threads': !isBun() || globalThis.Bun.version >= '1.0.0',
      'async-hooks': !isBun()
    };

    return features[feature] || false;
  }

  /**
   * Get runtime info
   * @returns {Object}
   */
  getInfo() {
    return {
      runtime: this.runtime,
      version: this.version,
      platform: process.platform,
      arch: process.arch,
      features: {
        nativeFetch: this.supports('native-fetch'),
        nativeSqlite: this.supports('native-sqlite'),
        nativeCrypto: this.supports('native-crypto'),
        workerThreads: this.supports('worker-threads')
      }
    };
  }
}

// Singleton compatibility instance
const compat = new RuntimeCompat();

module.exports = {
  isBun,
  isNode,
  isDeno,
  getRuntime,
  getRuntimeVersion,
  BunFileOps,
  BunHash,
  BunHttp,
  BunSqlite,
  BunProcess,
  BunPerf,
  BunEnv,
  RuntimeCompat,
  compat
};
