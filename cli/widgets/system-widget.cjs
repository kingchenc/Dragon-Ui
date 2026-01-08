/**
 * System Widgets
 * Widgets for system information (terminal, version, cwd, etc.)
 */

'use strict';

const { Widget } = require('./widget-base.cjs');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Output Style Widget
 * Displays the current output style (markdown, text, json)
 */
class OutputStyleWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'output-style',
      name: 'Output Style',
      description: 'Displays the current output format style',
      color: config.color || { fg: 'magenta', bg: null },
      ...config
    });

    // Map style codes to display names
    this.styleMap = {
      markdown: 'MD',
      text: 'TXT',
      json: 'JSON',
      plain: 'TXT',
      rich: 'RICH',
      minimal: 'MIN'
    };
  }

  async getValue(data) {
    if (!data) return null;

    // Try to get output style from session or settings
    const style = data.outputStyle ||
                  data.session?.outputStyle ||
                  data.settings?.outputStyle ||
                  'markdown';

    return this.styleMap[style] || style.toUpperCase();
  }
}

/**
 * Current Working Directory Widget
 * Displays the current working directory
 */
class CurrentWorkingDirWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'current-working-dir',
      name: 'Current Working Directory',
      description: 'Displays the current working directory',
      color: config.color || { fg: 'blue', bg: null },
      ...config
    });

    this.showFullPath = config.showFullPath || false;
    this.maxLength = config.maxLength || 30;
    this.showIcon = config.showIcon !== false;
  }

  async getValue(data) {
    const cwd = data?.cwd || data?.session?.cwd || process.cwd();

    if (this.showFullPath) {
      return this.formatPath(cwd);
    }

    // Show only the last directory name
    const dirName = path.basename(cwd);
    const icon = this.showIcon ? ' ' : '';
    return `${icon}${dirName}`;
  }

  formatPath(fullPath) {
    // Replace home directory with ~
    const home = os.homedir();
    let displayPath = fullPath;

    if (fullPath.startsWith(home)) {
      displayPath = '~' + fullPath.slice(home.length);
    }

    // Truncate if too long
    if (displayPath.length > this.maxLength) {
      const parts = displayPath.split(path.sep);
      if (parts.length > 3) {
        // Show first and last parts with ellipsis
        displayPath = parts[0] + path.sep + '...' + path.sep + parts[parts.length - 1];
      }
    }

    const icon = this.showIcon ? ' ' : '';
    return `${icon}${displayPath}`;
  }
}

/**
 * Terminal Width Widget
 * Displays the terminal width in columns
 */
class TerminalWidthWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'terminal-width',
      name: 'Terminal Width',
      description: 'Displays the terminal width in columns',
      color: config.color || { fg: 'gray', bg: null },
      cacheTimeout: 1000, // Refresh frequently as terminal might resize
      ...config
    });
  }

  async getValue(data) {
    const width = process.stdout.columns || 80;
    return `${width}col`;
  }
}

/**
 * Version Widget
 * Displays the Claude Code version
 */
class VersionWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'version',
      name: 'Version',
      description: 'Displays the Claude Code or Dragon-UI version',
      color: config.color || { fg: 'gray', bg: null },
      cacheTimeout: 300000, // Cache for 5 minutes (version doesn't change often)
      ...config
    });

    this.showPrefix = config.showPrefix !== false;
  }

  async getValue(data) {
    // Try to get version from various sources
    let version = null;

    // 1. From data context
    if (data?.version) {
      version = data.version;
    }

    // 2. From Dragon-UI package.json
    if (!version) {
      try {
        const packagePath = path.join(__dirname, '..', '..', 'package.json');
        if (fs.existsSync(packagePath)) {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          version = pkg.version;
        }
      } catch {
        // Ignore errors
      }
    }

    // 3. Try to get Claude Code version
    if (!version) {
      try {
        const result = execSync('claude --version 2>/dev/null', {
          encoding: 'utf8',
          timeout: 2000
        }).trim();

        // Extract version number
        const match = result.match(/(\d+\.\d+\.\d+)/);
        if (match) {
          version = match[1];
        }
      } catch {
        // Ignore errors
      }
    }

    if (!version) {
      return null;
    }

    const prefix = this.showPrefix ? 'v' : '';
    return `${prefix}${version}`;
  }
}

/**
 * Custom Text Widget
 * Displays user-defined static text
 */
class CustomTextWidget extends Widget {
  constructor(config = {}) {
    super({
      id: config.id || 'custom-text',
      name: config.name || 'Custom Text',
      description: 'Displays user-defined static text',
      color: config.color || { fg: 'white', bg: null },
      cacheTimeout: 0, // No caching needed for static text
      ...config
    });

    this.text = config.text || '';
    this.placeholder = config.placeholder || '';
  }

  async getValue(data) {
    // Support template variables in text
    let result = this.text || this.placeholder;

    if (data) {
      // Replace ${var} with data values
      result = result.replace(/\${(\w+(?:\.\w+)*)}/g, (match, key) => {
        const value = this.getNestedValue(data, key);
        return value !== undefined ? String(value) : match;
      });
    }

    return result || null;
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object to search
   * @param {string} path - Dot-separated path
   * @returns {*}
   */
  getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Update the text
   * @param {string} text - New text
   */
  setText(text) {
    this.text = text;
    this.clearCache();
  }
}

/**
 * Hostname Widget
 * Displays the system hostname
 */
class HostnameWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'hostname',
      name: 'Hostname',
      description: 'Displays the system hostname',
      color: config.color || { fg: 'cyan', bg: null },
      cacheTimeout: 300000, // Cache for 5 minutes
      ...config
    });

    this.showIcon = config.showIcon !== false;
  }

  async getValue(data) {
    const hostname = os.hostname();
    const icon = this.showIcon ? ' ' : '';
    return `${icon}${hostname}`;
  }
}

/**
 * Username Widget
 * Displays the current username
 */
class UsernameWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'username',
      name: 'Username',
      description: 'Displays the current username',
      color: config.color || { fg: 'green', bg: null },
      cacheTimeout: 300000, // Cache for 5 minutes
      ...config
    });

    this.showIcon = config.showIcon !== false;
  }

  async getValue(data) {
    const username = os.userInfo().username;
    const icon = this.showIcon ? ' ' : '';
    return `${icon}${username}`;
  }
}

/**
 * Platform Widget
 * Displays the operating system platform
 */
class PlatformWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'platform',
      name: 'Platform',
      description: 'Displays the operating system platform',
      color: config.color || { fg: 'yellow', bg: null },
      cacheTimeout: 300000, // Cache for 5 minutes
      ...config
    });

    this.platformMap = {
      win32: 'Windows',
      darwin: 'macOS',
      linux: 'Linux',
      freebsd: 'FreeBSD',
      sunos: 'SunOS',
      aix: 'AIX'
    };

    this.iconMap = {
      win32: '',
      darwin: '',
      linux: ''
    };

    this.showIcon = config.showIcon !== false;
  }

  async getValue(data) {
    const platform = process.platform;
    const name = this.platformMap[platform] || platform;
    const icon = this.showIcon ? (this.iconMap[platform] || '') + ' ' : '';
    return `${icon}${name}`;
  }
}

/**
 * Node Version Widget
 * Displays the Node.js version
 */
class NodeVersionWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'node-version',
      name: 'Node Version',
      description: 'Displays the Node.js version',
      color: config.color || { fg: 'green', bg: null },
      cacheTimeout: 300000, // Cache for 5 minutes
      ...config
    });

    this.showIcon = config.showIcon !== false;
  }

  async getValue(data) {
    const version = process.version.replace('v', '');
    const icon = this.showIcon ? '⬢ ' : '';
    return `${icon}${version}`;
  }
}

/**
 * Memory Usage Widget
 * Displays current memory usage
 */
class MemoryUsageWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'memory-usage',
      name: 'Memory Usage',
      description: 'Displays current memory usage',
      color: config.color || { fg: 'yellow', bg: null },
      cacheTimeout: 5000, // Refresh every 5 seconds
      ...config
    });
  }

  async getValue(data) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = Math.round((usedMem / totalMem) * 100);

    return `${usedPercent}%`;
  }
}

/**
 * Uptime Widget
 * Displays system uptime
 */
class UptimeWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'uptime',
      name: 'Uptime',
      description: 'Displays system uptime',
      color: config.color || { fg: 'cyan', bg: null },
      cacheTimeout: 60000, // Refresh every minute
      ...config
    });
  }

  async getValue(data) {
    const uptimeSeconds = os.uptime();
    return this.formatDuration(uptimeSeconds * 1000);
  }
}

module.exports = {
  OutputStyleWidget,
  CurrentWorkingDirWidget,
  TerminalWidthWidget,
  VersionWidget,
  CustomTextWidget,
  HostnameWidget,
  UsernameWidget,
  PlatformWidget,
  NodeVersionWidget,
  MemoryUsageWidget,
  UptimeWidget
};
