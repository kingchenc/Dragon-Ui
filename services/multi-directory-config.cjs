/**
 * Multi-Directory Configuration Service for Dragon-UI
 * Supports comma-separated CLAUDE_CONFIG_DIR and XDG Base Directory
 *
 * @module services/multi-directory-config
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Default configuration paths by platform
 */
const PLATFORM_DEFAULTS = {
  win32: {
    xdg: path.join(os.homedir(), '.config', 'claude', 'projects'),
    legacy: path.join(os.homedir(), '.claude', 'projects'),
    appdata: path.join(process.env.APPDATA || '', 'Claude', 'projects')
  },
  darwin: {
    xdg: path.join(os.homedir(), '.config', 'claude', 'projects'),
    legacy: path.join(os.homedir(), '.claude', 'projects'),
    library: path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'projects')
  },
  linux: {
    xdg: path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'claude', 'projects'),
    legacy: path.join(os.homedir(), '.claude', 'projects'),
    snap: path.join(os.homedir(), 'snap', 'claude', 'current', '.claude', 'projects')
  }
};

/**
 * Environment variable names
 */
const ENV_VARS = {
  CONFIG_DIR: 'CLAUDE_CONFIG_DIR',
  DATA_DIR: 'CLAUDE_DATA_DIR',
  PROJECTS_DIR: 'CLAUDE_PROJECTS_DIR',
  XDG_CONFIG_HOME: 'XDG_CONFIG_HOME'
};

/**
 * Multi-Directory Configuration class
 */
class MultiDirectoryConfig {
  constructor(options = {}) {
    this.options = {
      enableXDG: true,
      enableLegacy: true,
      enableEnvVar: true,
      validatePaths: true,
      ...options
    };

    this.platform = os.platform();
    this.directories = [];
    this.validatedPaths = new Map();
    this.initialized = false;
  }

  /**
   * Initialize and detect all directories
   * @returns {string[]}
   */
  init() {
    if (this.initialized) {
      return this.directories;
    }

    this.directories = [];

    // Priority 1: Environment variable (comma-separated)
    if (this.options.enableEnvVar) {
      const envDirs = this.parseEnvironmentDirs();
      this.directories.push(...envDirs);
    }

    // Priority 2: XDG Base Directory
    if (this.options.enableXDG) {
      const xdgDirs = this.getXDGDirectories();
      for (const dir of xdgDirs) {
        if (!this.directories.includes(dir)) {
          this.directories.push(dir);
        }
      }
    }

    // Priority 3: Legacy paths
    if (this.options.enableLegacy) {
      const legacyDirs = this.getLegacyDirectories();
      for (const dir of legacyDirs) {
        if (!this.directories.includes(dir)) {
          this.directories.push(dir);
        }
      }
    }

    // Validate all paths
    if (this.options.validatePaths) {
      this.directories = this.directories.filter(dir => this.validatePath(dir));
    }

    this.initialized = true;
    return this.directories;
  }

  /**
   * Parse CLAUDE_CONFIG_DIR environment variable
   * Supports comma-separated paths
   * @returns {string[]}
   */
  parseEnvironmentDirs() {
    const envValue = process.env[ENV_VARS.CONFIG_DIR];

    if (!envValue) {
      return [];
    }

    // Support both comma and path separator
    const separator = envValue.includes(',') ? ',' : path.delimiter;

    const dirs = envValue
      .split(separator)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => this.expandPath(p));

    if (dirs.length > 0) {
      console.log(`[CONFIG] Multi-Dir: Found ${dirs.length} directories from ${ENV_VARS.CONFIG_DIR}`);
    }

    return dirs;
  }

  /**
   * Get XDG Base Directory paths
   * @returns {string[]}
   */
  getXDGDirectories() {
    const dirs = [];
    const defaults = PLATFORM_DEFAULTS[this.platform] || PLATFORM_DEFAULTS.linux;

    // Primary XDG config path
    if (defaults.xdg) {
      dirs.push(defaults.xdg);
    }

    // Platform-specific paths
    if (defaults.library) {
      dirs.push(defaults.library);
    }
    if (defaults.appdata) {
      dirs.push(defaults.appdata);
    }
    if (defaults.snap) {
      dirs.push(defaults.snap);
    }

    return dirs.filter(d => d && d.length > 0);
  }

  /**
   * Get legacy directory paths
   * @returns {string[]}
   */
  getLegacyDirectories() {
    const defaults = PLATFORM_DEFAULTS[this.platform] || PLATFORM_DEFAULTS.linux;

    if (defaults.legacy) {
      return [defaults.legacy];
    }

    return [];
  }

  /**
   * Expand path variables (~, $HOME, %USERPROFILE%)
   * @param {string} inputPath
   * @returns {string}
   */
  expandPath(inputPath) {
    let expanded = inputPath;

    // Expand ~ to home directory
    if (expanded.startsWith('~')) {
      expanded = path.join(os.homedir(), expanded.slice(1));
    }

    // Expand $HOME (Unix)
    expanded = expanded.replace(/\$HOME/g, os.homedir());

    // Expand $XDG_CONFIG_HOME (Unix)
    if (process.env.XDG_CONFIG_HOME) {
      expanded = expanded.replace(/\$XDG_CONFIG_HOME/g, process.env.XDG_CONFIG_HOME);
    }

    // Expand %USERPROFILE% (Windows)
    expanded = expanded.replace(/%USERPROFILE%/gi, os.homedir());

    // Expand %APPDATA% (Windows)
    if (process.env.APPDATA) {
      expanded = expanded.replace(/%APPDATA%/gi, process.env.APPDATA);
    }

    // Expand %LOCALAPPDATA% (Windows)
    if (process.env.LOCALAPPDATA) {
      expanded = expanded.replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA);
    }

    return path.normalize(expanded);
  }

  /**
   * Validate that a path exists and is accessible
   * @param {string} dirPath
   * @returns {boolean}
   */
  validatePath(dirPath) {
    // Check cache first
    if (this.validatedPaths.has(dirPath)) {
      return this.validatedPaths.get(dirPath);
    }

    try {
      const stats = fs.statSync(dirPath);
      const isValid = stats.isDirectory();
      this.validatedPaths.set(dirPath, isValid);

      if (isValid) {
        console.log(`[OK] Multi-Dir: Valid directory: ${dirPath}`);
      }

      return isValid;
    } catch (error) {
      this.validatedPaths.set(dirPath, false);
      return false;
    }
  }

  /**
   * Get all validated directories
   * @returns {string[]}
   */
  getDirectories() {
    if (!this.initialized) {
      this.init();
    }
    return [...this.directories];
  }

  /**
   * Get primary directory (first validated path)
   * @returns {string|null}
   */
  getPrimaryDirectory() {
    const dirs = this.getDirectories();
    return dirs.length > 0 ? dirs[0] : null;
  }

  /**
   * Add a custom directory
   * @param {string} dirPath
   * @param {number} priority - Lower = higher priority, default append
   * @returns {boolean}
   */
  addDirectory(dirPath, priority = -1) {
    const expanded = this.expandPath(dirPath);

    if (!this.validatePath(expanded)) {
      console.log(`[WARN] Multi-Dir: Invalid directory: ${expanded}`);
      return false;
    }

    if (this.directories.includes(expanded)) {
      console.log(`[WARN] Multi-Dir: Directory already exists: ${expanded}`);
      return false;
    }

    if (priority >= 0 && priority < this.directories.length) {
      this.directories.splice(priority, 0, expanded);
    } else {
      this.directories.push(expanded);
    }

    console.log(`[OK] Multi-Dir: Added directory: ${expanded}`);
    return true;
  }

  /**
   * Remove a directory
   * @param {string} dirPath
   * @returns {boolean}
   */
  removeDirectory(dirPath) {
    const expanded = this.expandPath(dirPath);
    const index = this.directories.indexOf(expanded);

    if (index === -1) {
      return false;
    }

    this.directories.splice(index, 1);
    this.validatedPaths.delete(expanded);
    console.log(`[OK] Multi-Dir: Removed directory: ${expanded}`);
    return true;
  }

  /**
   * Find all JSONL files across all directories
   * @returns {Array<{file: string, dir: string}>}
   */
  findAllJSONLFiles() {
    const files = [];

    for (const dir of this.getDirectories()) {
      try {
        const dirFiles = this.findJSONLFilesInDir(dir);
        for (const file of dirFiles) {
          files.push({ file, dir });
        }
      } catch (error) {
        console.log(`[WARN] Multi-Dir: Error scanning ${dir}: ${error.message}`);
      }
    }

    return files;
  }

  /**
   * Find JSONL files in a specific directory (recursive)
   * @param {string} dir
   * @param {number} maxDepth
   * @returns {string[]}
   */
  findJSONLFilesInDir(dir, maxDepth = 5) {
    const files = [];

    const scan = (currentDir, depth) => {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            // Skip hidden directories except .claude
            if (entry.name.startsWith('.') && entry.name !== '.claude') {
              continue;
            }
            scan(fullPath, depth + 1);
          } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't access
      }
    };

    scan(dir, 0);
    return files;
  }

  /**
   * Get directory info and statistics
   * @returns {Object}
   */
  getInfo() {
    const dirs = this.getDirectories();

    return {
      platform: this.platform,
      envVar: process.env[ENV_VARS.CONFIG_DIR] || null,
      directoryCount: dirs.length,
      directories: dirs.map((dir, index) => ({
        path: dir,
        priority: index,
        exists: this.validatePath(dir),
        fileCount: this.countFilesInDir(dir)
      })),
      options: this.options
    };
  }

  /**
   * Count files in a directory
   * @param {string} dir
   * @returns {number}
   */
  countFilesInDir(dir) {
    try {
      const files = this.findJSONLFilesInDir(dir);
      return files.length;
    } catch {
      return 0;
    }
  }

  /**
   * Create a directory if it doesn't exist
   * @param {string} dirPath
   * @returns {boolean}
   */
  ensureDirectory(dirPath) {
    const expanded = this.expandPath(dirPath);

    try {
      if (!fs.existsSync(expanded)) {
        fs.mkdirSync(expanded, { recursive: true });
        console.log(`[OK] Multi-Dir: Created directory: ${expanded}`);
      }
      this.validatedPaths.set(expanded, true);
      return true;
    } catch (error) {
      console.log(`[ERR] Multi-Dir: Failed to create directory: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the default path for new projects
   * @returns {string}
   */
  getDefaultProjectPath() {
    const defaults = PLATFORM_DEFAULTS[this.platform] || PLATFORM_DEFAULTS.linux;
    return defaults.xdg || defaults.legacy;
  }

  /**
   * Refresh directory validation cache
   */
  refresh() {
    this.validatedPaths.clear();
    this.initialized = false;
    this.init();
  }

  /**
   * Export configuration
   * @returns {Object}
   */
  exportConfig() {
    return {
      version: 1,
      platform: this.platform,
      directories: this.directories,
      options: this.options,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import configuration
   * @param {Object} config
   */
  importConfig(config) {
    if (config.version !== 1) {
      throw new Error('Unsupported config version');
    }

    this.directories = config.directories || [];
    this.options = { ...this.options, ...config.options };
    this.validatedPaths.clear();
    this.initialized = true;
  }
}

// Singleton instance
let instance = null;

/**
 * Get Multi-Directory Config instance
 * @param {Object} options
 * @returns {MultiDirectoryConfig}
 */
function getMultiDirectoryConfig(options) {
  if (!instance) {
    instance = new MultiDirectoryConfig(options);
    instance.init();
  }
  return instance;
}

/**
 * Get all project directories (convenience function)
 * @returns {string[]}
 */
function getProjectDirectories() {
  return getMultiDirectoryConfig().getDirectories();
}

/**
 * Get primary project directory (convenience function)
 * @returns {string|null}
 */
function getPrimaryProjectDirectory() {
  return getMultiDirectoryConfig().getPrimaryDirectory();
}

/**
 * Find all JSONL files (convenience function)
 * @returns {Array<{file: string, dir: string}>}
 */
function findAllProjectFiles() {
  return getMultiDirectoryConfig().findAllJSONLFiles();
}

module.exports = {
  MultiDirectoryConfig,
  getMultiDirectoryConfig,
  getProjectDirectories,
  getPrimaryProjectDirectory,
  findAllProjectFiles,
  PLATFORM_DEFAULTS,
  ENV_VARS
};
