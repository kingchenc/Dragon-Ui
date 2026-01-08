/**
 * Claude Settings Service for Dragon-UI
 * Manage Claude Code settings.json integration
 *
 * @module services/claude-settings
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * Default settings paths by platform
 */
const DEFAULT_PATHS = {
  win32: [
    path.join(process.env.APPDATA || '', 'Claude'),
    path.join(os.homedir(), '.claude')
  ],
  darwin: [
    path.join(os.homedir(), 'Library', 'Application Support', 'Claude'),
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), '.config', 'claude')
  ],
  linux: [
    path.join(os.homedir(), '.config', 'claude'),
    path.join(os.homedir(), '.claude')
  ]
};

/**
 * Settings file name
 */
const SETTINGS_FILE = 'settings.json';

/**
 * Statusline command template
 */
const STATUSLINE_COMMAND = 'bunx dragon-ui-claude-cli statusline';

/**
 * Check if bunx is available
 * @returns {boolean}
 */
function isBunxAvailable() {
  try {
    execSync('bunx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if npx is available
 * @returns {boolean}
 */
function isNpxAvailable() {
  try {
    execSync('npx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the appropriate package runner
 * @returns {string}
 */
function getPackageRunner() {
  if (isBunxAvailable()) {
    return 'bunx';
  }
  if (isNpxAvailable()) {
    return 'npx';
  }
  return 'node';
}

/**
 * Claude Settings Manager class
 */
class ClaudeSettingsManager {
  constructor(options = {}) {
    this.options = options;
    this.configDir = null;
    this.settingsPath = null;
    this.settings = null;

    this.detectConfigDir();
  }

  /**
   * Detect Claude config directory
   */
  detectConfigDir() {
    // Check environment variable first
    if (process.env.CLAUDE_CONFIG_DIR) {
      const envPath = process.env.CLAUDE_CONFIG_DIR;
      if (fs.existsSync(envPath)) {
        this.configDir = envPath;
        this.settingsPath = path.join(envPath, SETTINGS_FILE);
        return;
      }
    }

    // Check platform-specific paths
    const platform = process.platform;
    const paths = DEFAULT_PATHS[platform] || DEFAULT_PATHS.linux;

    for (const p of paths) {
      if (fs.existsSync(p)) {
        this.configDir = p;
        this.settingsPath = path.join(p, SETTINGS_FILE);
        return;
      }
    }

    // Create default directory if none exists
    const defaultPath = paths[0];
    try {
      fs.mkdirSync(defaultPath, { recursive: true });
      this.configDir = defaultPath;
      this.settingsPath = path.join(defaultPath, SETTINGS_FILE);
    } catch {
      // Could not create directory
    }
  }

  /**
   * Get config directory path
   * @returns {string|null}
   */
  getConfigDir() {
    return this.configDir;
  }

  /**
   * Get settings file path
   * @returns {string|null}
   */
  getSettingsPath() {
    return this.settingsPath;
  }

  /**
   * Load settings from file
   * @returns {Object}
   */
  loadSettings() {
    if (!this.settingsPath) {
      return {};
    }

    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf8');
        this.settings = JSON.parse(content);
        return this.settings;
      }
    } catch (error) {
      // Return empty settings on error
    }

    this.settings = {};
    return this.settings;
  }

  /**
   * Save settings to file
   * @param {Object} settings
   * @returns {boolean}
   */
  saveSettings(settings) {
    if (!this.settingsPath) {
      return false;
    }

    try {
      // Create backup
      if (fs.existsSync(this.settingsPath)) {
        const backupPath = this.settingsPath + '.backup';
        fs.copyFileSync(this.settingsPath, backupPath);
      }

      // Write new settings
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(settings, null, 2),
        'utf8'
      );

      this.settings = settings;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current statusLine setting
   * @returns {string|null}
   */
  getStatusLine() {
    const settings = this.loadSettings();
    return settings.statusLine || null;
  }

  /**
   * Check if statusLine is installed
   * @returns {boolean}
   */
  isInstalled() {
    const statusLine = this.getStatusLine();
    if (!statusLine) return false;

    // Check if it's our statusline
    return statusLine.includes('dragon-ui') ||
           statusLine.includes('dragon-ui-claude-cli');
  }

  /**
   * Install statusLine command
   * @param {Object} options
   * @returns {Object}
   */
  installStatusLine(options = {}) {
    const settings = this.loadSettings();

    // Build command
    const runner = options.runner || getPackageRunner();
    let command;

    if (runner === 'node') {
      // Use direct path if installed globally
      command = 'dragon-ui-claude-cli statusline';
    } else {
      command = `${runner} dragon-ui-claude-cli statusline`;
    }

    // Add options
    if (options.style) {
      command += ` --style ${options.style}`;
    }
    if (options.elements) {
      command += ` --elements ${options.elements}`;
    }
    if (options.compact) {
      command += ' --compact';
    }

    // Store previous statusLine for potential restoration
    const previous = settings.statusLine;

    // Update settings
    settings.statusLine = command;

    const success = this.saveSettings(settings);

    return {
      success,
      command,
      previous,
      settingsPath: this.settingsPath
    };
  }

  /**
   * Uninstall statusLine command
   * @returns {Object}
   */
  uninstallStatusLine() {
    const settings = this.loadSettings();
    const previous = settings.statusLine;

    if (!previous) {
      return {
        success: true,
        wasInstalled: false
      };
    }

    // Remove statusLine
    delete settings.statusLine;

    const success = this.saveSettings(settings);

    return {
      success,
      wasInstalled: true,
      previous
    };
  }

  /**
   * Update statusLine options
   * @param {Object} options
   * @returns {Object}
   */
  updateStatusLine(options) {
    if (!this.isInstalled()) {
      return this.installStatusLine(options);
    }

    const settings = this.loadSettings();
    let command = settings.statusLine;

    // Parse existing command
    const parts = command.split(' ');
    const baseCmd = parts.slice(0, 3).join(' '); // runner + pkg + cmd

    // Rebuild with new options
    command = baseCmd;

    if (options.style) {
      command += ` --style ${options.style}`;
    }
    if (options.elements) {
      command += ` --elements ${options.elements}`;
    }
    if (options.compact) {
      command += ' --compact';
    }
    if (options.lines) {
      command += ` --lines ${options.lines}`;
    }

    settings.statusLine = command;

    const success = this.saveSettings(settings);

    return {
      success,
      command
    };
  }

  /**
   * Get all settings
   * @returns {Object}
   */
  getAllSettings() {
    return this.loadSettings();
  }

  /**
   * Get a specific setting
   * @param {string} key
   * @returns {any}
   */
  getSetting(key) {
    const settings = this.loadSettings();
    return settings[key];
  }

  /**
   * Set a specific setting
   * @param {string} key
   * @param {any} value
   * @returns {boolean}
   */
  setSetting(key, value) {
    const settings = this.loadSettings();
    settings[key] = value;
    return this.saveSettings(settings);
  }

  /**
   * Remove a specific setting
   * @param {string} key
   * @returns {boolean}
   */
  removeSetting(key) {
    const settings = this.loadSettings();
    if (key in settings) {
      delete settings[key];
      return this.saveSettings(settings);
    }
    return true;
  }

  /**
   * Get installation info
   * @returns {Object}
   */
  getInfo() {
    return {
      configDir: this.configDir,
      settingsPath: this.settingsPath,
      settingsExist: this.settingsPath ? fs.existsSync(this.settingsPath) : false,
      isInstalled: this.isInstalled(),
      statusLine: this.getStatusLine(),
      bunxAvailable: isBunxAvailable(),
      npxAvailable: isNpxAvailable(),
      recommendedRunner: getPackageRunner()
    };
  }

  /**
   * Validate settings file
   * @returns {Object}
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.configDir) {
      errors.push('Claude config directory not found');
    }

    if (!this.settingsPath) {
      errors.push('Settings path not determined');
    } else if (!fs.existsSync(this.settingsPath)) {
      warnings.push('Settings file does not exist (will be created on save)');
    } else {
      try {
        const content = fs.readFileSync(this.settingsPath, 'utf8');
        JSON.parse(content);
      } catch (error) {
        errors.push(`Invalid JSON in settings file: ${error.message}`);
      }
    }

    const statusLine = this.getStatusLine();
    if (statusLine && statusLine.includes('bunx') && !isBunxAvailable()) {
      warnings.push('StatusLine uses bunx but bunx is not available');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Reset settings to default
   * @returns {boolean}
   */
  reset() {
    return this.saveSettings({});
  }

  /**
   * Export settings
   * @returns {string}
   */
  export() {
    return JSON.stringify(this.loadSettings(), null, 2);
  }

  /**
   * Import settings
   * @param {string} json
   * @returns {boolean}
   */
  import(json) {
    try {
      const settings = JSON.parse(json);
      return this.saveSettings(settings);
    } catch {
      return false;
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get Claude Settings Manager instance
 * @param {Object} options
 * @returns {ClaudeSettingsManager}
 */
function getClaudeSettings(options) {
  if (!instance) {
    instance = new ClaudeSettingsManager(options);
  }
  return instance;
}

module.exports = {
  ClaudeSettingsManager,
  getClaudeSettings,
  isBunxAvailable,
  isNpxAvailable,
  getPackageRunner,
  DEFAULT_PATHS,
  SETTINGS_FILE,
  STATUSLINE_COMMAND
};
