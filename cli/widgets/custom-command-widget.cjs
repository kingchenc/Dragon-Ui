/**
 * Custom Command Widget
 * Executes shell commands and displays output in the statusline
 */

const { Widget } = require('./widget-base.cjs');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Command execution options
 * @typedef {Object} CommandOptions
 * @property {string} command - Shell command to execute
 * @property {string} shell - Shell to use (bash, sh, cmd, powershell)
 * @property {number} timeout - Execution timeout in ms
 * @property {string} cwd - Working directory
 * @property {Object} env - Environment variables
 * @property {boolean} async - Run asynchronously
 * @property {string} transform - Output transformation: 'trim', 'first-line', 'last-line', 'json-field'
 * @property {string} jsonField - JSON field to extract if transform is 'json-field'
 * @property {string} regex - Regex to match and extract
 * @property {string} prefix - Prefix to add to output
 * @property {string} suffix - Suffix to add to output
 * @property {number} maxLength - Maximum output length
 * @property {string} fallback - Fallback value on error
 * @property {boolean} cache - Enable caching
 * @property {number} cacheTimeout - Cache timeout in ms
 */

/**
 * Predefined command templates
 */
const COMMAND_TEMPLATES = {
  'git-branch': {
    command: 'git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A"',
    transform: 'trim',
    prefix: ' ',
    fallback: 'N/A',
    cacheTimeout: 5000
  },
  'git-status': {
    command: 'git status --porcelain 2>/dev/null | wc -l | tr -d " "',
    transform: 'trim',
    prefix: '±',
    fallback: '0',
    cacheTimeout: 5000
  },
  'git-commit': {
    command: 'git rev-parse --short HEAD 2>/dev/null || echo "N/A"',
    transform: 'trim',
    prefix: '@',
    fallback: 'N/A',
    cacheTimeout: 10000
  },
  'node-version': {
    command: 'node -v 2>/dev/null | tr -d "v"',
    transform: 'trim',
    prefix: '⬢ ',
    fallback: 'N/A',
    cacheTimeout: 60000
  },
  'python-version': {
    command: 'python3 --version 2>/dev/null | cut -d" " -f2',
    transform: 'trim',
    prefix: '🐍 ',
    fallback: 'N/A',
    cacheTimeout: 60000
  },
  'hostname': {
    command: 'hostname',
    transform: 'trim',
    prefix: '🖥️ ',
    cacheTimeout: 300000
  },
  'username': {
    command: process.platform === 'win32' ? 'echo %USERNAME%' : 'whoami',
    transform: 'trim',
    prefix: '👤 ',
    cacheTimeout: 300000
  },
  'cpu-usage': {
    command: process.platform === 'win32'
      ? 'wmic cpu get loadpercentage | findstr /r "[0-9]"'
      : "top -l 1 | grep 'CPU usage' | awk '{print $3}' 2>/dev/null || mpstat 1 1 2>/dev/null | tail -1 | awk '{print 100-$NF}' || echo 'N/A'",
    transform: 'trim',
    prefix: 'CPU: ',
    suffix: '%',
    fallback: 'N/A',
    cacheTimeout: 2000
  },
  'memory-usage': {
    command: process.platform === 'win32'
      ? 'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value'
      : "free -m 2>/dev/null | awk 'NR==2{printf \"%.0f\", $3*100/$2}' || vm_stat 2>/dev/null | awk '/Pages active/ {print $3}' || echo 'N/A'",
    transform: 'trim',
    prefix: 'MEM: ',
    suffix: '%',
    fallback: 'N/A',
    cacheTimeout: 5000
  },
  'disk-usage': {
    command: process.platform === 'win32'
      ? 'wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /Value'
      : "df -h / | awk 'NR==2 {print $5}' | tr -d '%'",
    transform: 'trim',
    prefix: 'DISK: ',
    suffix: '%',
    fallback: 'N/A',
    cacheTimeout: 30000
  },
  'date': {
    command: 'date +"%Y-%m-%d"',
    transform: 'trim',
    prefix: '📅 ',
    cacheTimeout: 60000
  },
  'time': {
    command: 'date +"%H:%M"',
    transform: 'trim',
    prefix: '🕐 ',
    cacheTimeout: 1000
  },
  'uptime': {
    command: process.platform === 'win32'
      ? 'net statistics workstation | findstr /i "Statistics since"'
      : "uptime -p 2>/dev/null || uptime | awk -F'up' '{print $2}' | awk -F',' '{print $1}'",
    transform: 'trim',
    prefix: '⏱️ ',
    fallback: 'N/A',
    cacheTimeout: 60000
  },
  'load-average': {
    command: process.platform === 'win32'
      ? 'echo N/A'
      : "uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ','",
    transform: 'trim',
    prefix: 'LOAD: ',
    fallback: 'N/A',
    cacheTimeout: 5000
  },
  'docker-containers': {
    command: 'docker ps -q 2>/dev/null | wc -l | tr -d " "',
    transform: 'trim',
    prefix: '🐳 ',
    fallback: '0',
    cacheTimeout: 10000
  },
  'npm-outdated': {
    command: 'npm outdated 2>/dev/null | wc -l | tr -d " "',
    transform: 'trim',
    prefix: '📦 ',
    suffix: ' outdated',
    fallback: '0',
    cacheTimeout: 60000
  },
  'aws-profile': {
    command: 'echo $AWS_PROFILE',
    transform: 'trim',
    prefix: 'AWS: ',
    fallback: 'default',
    cacheTimeout: 30000
  },
  'kubectl-context': {
    command: 'kubectl config current-context 2>/dev/null',
    transform: 'trim',
    prefix: '☸️ ',
    fallback: 'N/A',
    cacheTimeout: 10000
  }
};

/**
 * Output transformers
 */
const TRANSFORMERS = {
  trim: (output) => output.trim(),
  'first-line': (output) => output.split('\n')[0].trim(),
  'last-line': (output) => {
    const lines = output.trim().split('\n');
    return lines[lines.length - 1].trim();
  },
  'json-field': (output, field) => {
    try {
      const json = JSON.parse(output);
      return getNestedField(json, field);
    } catch {
      return output.trim();
    }
  },
  'word-count': (output) => output.split(/\s+/).length.toString(),
  'line-count': (output) => output.split('\n').length.toString(),
  'char-count': (output) => output.length.toString(),
  uppercase: (output) => output.toUpperCase(),
  lowercase: (output) => output.toLowerCase(),
  'base64-decode': (output) => Buffer.from(output.trim(), 'base64').toString('utf8'),
  'url-decode': (output) => decodeURIComponent(output.trim())
};

/**
 * Get nested field from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Dot-separated path
 * @returns {string}
 */
function getNestedField(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return '';
    current = current[part];
  }
  return String(current);
}

/**
 * Custom Command Widget
 */
class CustomCommandWidget extends Widget {
  /**
   * Create a custom command widget
   * @param {Object} config - Widget configuration
   */
  constructor(config = {}) {
    super({
      id: config.id || 'custom-command',
      name: config.name || 'Custom Command',
      description: config.description || 'Executes a shell command and displays output',
      color: config.color || { fg: 'cyan', bg: null },
      cacheTimeout: config.cacheTimeout || 5000,
      ...config
    });

    // Command configuration
    this.command = config.command || 'echo "Configure me"';
    this.shell = config.shell || this.detectShell();
    this.timeout = config.timeout || 5000;
    this.cwd = config.cwd || process.cwd();
    this.env = config.env || {};
    this.async = config.async || false;
    this.transform = config.transform || 'trim';
    this.jsonField = config.jsonField || null;
    this.regex = config.regex || null;
    this.prefix = config.prefix || '';
    this.suffix = config.suffix || '';
    this.maxLength = config.maxLength || 50;
    this.fallback = config.fallback || '';
    this.errorIcon = config.errorIcon || '⚠️';
    this.loadingIcon = config.loadingIcon || '⏳';

    // Internal state
    this._lastOutput = null;
    this._lastError = null;
    this._isRunning = false;
  }

  /**
   * Detect the appropriate shell for the platform
   * @returns {string}
   */
  detectShell() {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
  }

  /**
   * Get shell execution options
   * @returns {Object}
   */
  getExecOptions() {
    const options = {
      timeout: this.timeout,
      cwd: this.cwd,
      encoding: 'utf8',
      env: { ...process.env, ...this.env },
      maxBuffer: 1024 * 1024, // 1MB
      windowsHide: true
    };

    if (process.platform === 'win32') {
      options.shell = this.shell;
    } else {
      options.shell = this.shell;
    }

    return options;
  }

  /**
   * Execute the command synchronously
   * @returns {string}
   */
  executeSync() {
    try {
      const output = execSync(this.command, this.getExecOptions());
      return this.processOutput(output.toString());
    } catch (error) {
      this._lastError = error;
      if (error.stdout) {
        return this.processOutput(error.stdout.toString());
      }
      return this.fallback || `${this.errorIcon}`;
    }
  }

  /**
   * Execute the command asynchronously
   * @returns {Promise<string>}
   */
  executeAsync() {
    return new Promise((resolve) => {
      if (this._isRunning) {
        resolve(this._lastOutput || this.loadingIcon);
        return;
      }

      this._isRunning = true;

      exec(this.command, this.getExecOptions(), (error, stdout, stderr) => {
        this._isRunning = false;

        if (error) {
          this._lastError = error;
          if (stdout) {
            this._lastOutput = this.processOutput(stdout);
          } else {
            this._lastOutput = this.fallback || `${this.errorIcon}`;
          }
        } else {
          this._lastOutput = this.processOutput(stdout);
        }

        resolve(this._lastOutput);
      });

      // Return cached value immediately
      if (this._lastOutput !== null) {
        resolve(this._lastOutput);
      }
    });
  }

  /**
   * Process command output
   * @param {string} output - Raw command output
   * @returns {string}
   */
  processOutput(output) {
    if (!output) return this.fallback || '';

    let result = output;

    // Apply transformer
    const transformer = TRANSFORMERS[this.transform];
    if (transformer) {
      result = transformer(result, this.jsonField);
    }

    // Apply regex extraction
    if (this.regex) {
      try {
        const match = result.match(new RegExp(this.regex));
        if (match) {
          result = match[1] || match[0];
        }
      } catch {
        // Invalid regex, ignore
      }
    }

    // Truncate if needed
    if (this.maxLength && result.length > this.maxLength) {
      result = result.substring(0, this.maxLength - 1) + '…';
    }

    // Add prefix and suffix
    result = this.prefix + result + this.suffix;

    return result;
  }

  /**
   * Get the widget value
   * @param {Object} data - Data context
   * @returns {Promise<string>}
   */
  async getValue(data) {
    if (this.async) {
      return this.executeAsync();
    }
    return this.executeSync();
  }

  /**
   * Load a predefined command template
   * @param {string} templateName - Template name
   * @returns {boolean}
   */
  loadTemplate(templateName) {
    const template = COMMAND_TEMPLATES[templateName];
    if (!template) return false;

    if (template.command) this.command = template.command;
    if (template.transform) this.transform = template.transform;
    if (template.prefix !== undefined) this.prefix = template.prefix;
    if (template.suffix !== undefined) this.suffix = template.suffix;
    if (template.fallback !== undefined) this.fallback = template.fallback;
    if (template.cacheTimeout) this.cacheTimeout = template.cacheTimeout;

    this.clearCache();
    return true;
  }

  /**
   * Get widget info with command details
   * @returns {Object}
   */
  getInfo() {
    return {
      ...super.getInfo(),
      command: this.command,
      shell: this.shell,
      timeout: this.timeout,
      transform: this.transform,
      async: this.async,
      lastOutput: this._lastOutput,
      lastError: this._lastError ? this._lastError.message : null
    };
  }
}

/**
 * Custom Command Widget Factory
 */
class CustomCommandWidgetFactory {
  /**
   * Create a widget from a template
   * @param {string} templateName - Template name
   * @param {Object} overrides - Configuration overrides
   * @returns {CustomCommandWidget}
   */
  static fromTemplate(templateName, overrides = {}) {
    const template = COMMAND_TEMPLATES[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    return new CustomCommandWidget({
      id: `cmd-${templateName}`,
      name: templateName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      ...template,
      ...overrides
    });
  }

  /**
   * Create a widget from a command string
   * @param {string} command - Shell command
   * @param {Object} options - Configuration options
   * @returns {CustomCommandWidget}
   */
  static fromCommand(command, options = {}) {
    return new CustomCommandWidget({
      id: options.id || `cmd-${Date.now()}`,
      name: options.name || 'Custom Command',
      command,
      ...options
    });
  }

  /**
   * Create multiple widgets from configuration
   * @param {Object[]} configs - Array of configurations
   * @returns {CustomCommandWidget[]}
   */
  static createBatch(configs) {
    return configs.map(config => {
      if (config.template) {
        return CustomCommandWidgetFactory.fromTemplate(config.template, config);
      }
      return new CustomCommandWidget(config);
    });
  }

  /**
   * List available templates
   * @returns {Object[]}
   */
  static listTemplates() {
    return Object.entries(COMMAND_TEMPLATES).map(([name, config]) => ({
      name,
      command: config.command,
      description: `${config.prefix || ''}[output]${config.suffix || ''}`,
      cacheTimeout: config.cacheTimeout
    }));
  }

  /**
   * List available transformers
   * @returns {string[]}
   */
  static listTransformers() {
    return Object.keys(TRANSFORMERS);
  }
}

/**
 * Custom Commands Manager
 * Manages saved custom command widgets
 */
class CustomCommandsManager {
  constructor() {
    this.configFile = path.join(os.homedir(), '.dragon-ui-custom-commands.json');
    this.commands = this.load();
  }

  /**
   * Load saved commands
   * @returns {Object}
   */
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      }
    } catch {
      // Return empty on error
    }
    return { commands: {} };
  }

  /**
   * Save commands to file
   * @returns {boolean}
   */
  save() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.commands, null, 2));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a custom command
   * @param {string} id - Command ID
   * @param {Object} config - Command configuration
   * @returns {boolean}
   */
  add(id, config) {
    this.commands.commands[id] = {
      ...config,
      createdAt: new Date().toISOString()
    };
    return this.save();
  }

  /**
   * Remove a custom command
   * @param {string} id - Command ID
   * @returns {boolean}
   */
  remove(id) {
    if (this.commands.commands[id]) {
      delete this.commands.commands[id];
      return this.save();
    }
    return false;
  }

  /**
   * Get a custom command configuration
   * @param {string} id - Command ID
   * @returns {Object|null}
   */
  get(id) {
    return this.commands.commands[id] || null;
  }

  /**
   * List all custom commands
   * @returns {Object[]}
   */
  list() {
    return Object.entries(this.commands.commands).map(([id, config]) => ({
      id,
      ...config
    }));
  }

  /**
   * Create widget instances from saved commands
   * @returns {CustomCommandWidget[]}
   */
  createWidgets() {
    return Object.entries(this.commands.commands).map(([id, config]) =>
      new CustomCommandWidget({ id, ...config })
    );
  }

  /**
   * Import commands from another file
   * @param {string} filePath - Path to import file
   * @returns {number} - Number of imported commands
   */
  import(filePath) {
    try {
      const imported = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let count = 0;
      for (const [id, config] of Object.entries(imported.commands || {})) {
        this.commands.commands[id] = config;
        count++;
      }
      this.save();
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Export commands to a file
   * @param {string} filePath - Path to export file
   * @returns {boolean}
   */
  export(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.commands, null, 2));
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton manager instance
const customCommandsManager = new CustomCommandsManager();

module.exports = {
  CustomCommandWidget,
  CustomCommandWidgetFactory,
  CustomCommandsManager,
  customCommandsManager,
  COMMAND_TEMPLATES,
  TRANSFORMERS
};
