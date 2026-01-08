/**
 * Dragon UI CLI Configuration Manager
 * Handles 4-level config discovery, loading, validation, and merging
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// JSON Schema for configuration validation
const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    defaults: {
      type: 'object',
      properties: {
        databasePath: { type: 'string' },
        claudeConfigDir: { type: 'string' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'INR', 'KRW', 'BRL', 'MXN'] },
        timezone: { type: 'string' },
        locale: { type: 'string' },
        billingDay: { type: 'number', minimum: 1, maximum: 31 },
        useLiteLLM: { type: 'boolean' },
        useColors: { type: 'boolean' },
        compactMode: { type: 'boolean' },
        showHeader: { type: 'boolean' },
        tableStyle: { type: 'string', enum: ['ascii', 'minimal', 'unicode'] },
        refreshInterval: { type: 'number', minimum: 1000, maximum: 300000 },
        statusline: {
          type: 'object',
          properties: {
            style: { type: 'string', enum: ['modern', 'classic', 'minimal', 'dragon'] },
            lines: { type: 'number', minimum: 1, maximum: 3 },
            useColors: { type: 'boolean' },
            useEmojis: { type: 'boolean' },
            compact: { type: 'boolean' },
            showElements: { type: 'array', items: { type: 'string' } },
            fontFamily: { type: 'string' },
            fontSize: { type: 'number', minimum: 8, maximum: 24 }
          }
        }
      }
    },
    commands: {
      type: 'object',
      description: 'Per-command configuration overrides'
    }
  }
};

// Default configuration values
const DEFAULT_CONFIG = {
  defaults: {
    databasePath: null, // Auto-detect
    claudeConfigDir: null, // Auto-detect
    currency: 'USD',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: 'en-US',
    billingDay: 1,
    useLiteLLM: true,
    useColors: true,
    compactMode: false,
    showHeader: true,
    tableStyle: 'ascii',
    refreshInterval: 30000,
    statusline: {
      style: 'dragon',
      lines: 1,
      useColors: true,
      useEmojis: true,
      compact: false,
      showElements: ['model', 'branch', 'cwd', 'tokens', 'cost'],
      fontFamily: 'monospace',
      fontSize: 12
    }
  },
  commands: {}
};

class ConfigManager {
  constructor() {
    this.configFileName = 'dragon-ui.json';
    this.homeConfigFile = path.join(os.homedir(), '.dragon-ui.json');
    this.loadedConfigPath = null;
    this.config = null;
  }

  /**
   * Find configuration file using 4-level discovery
   * Priority: CLI arg > current dir > parent dirs > home dir
   * @param {string} cliArg - Optional path from --config CLI argument
   * @returns {string|null} - Path to config file or null if not found
   */
  findConfig(cliArg) {
    // Level 1: CLI argument (highest priority)
    if (cliArg) {
      const resolvedPath = path.resolve(cliArg);
      if (fs.existsSync(resolvedPath)) {
        console.log(`[Config] Found via --config: ${resolvedPath}`);
        return resolvedPath;
      }
      console.warn(`[Config] CLI config not found: ${cliArg}`);
    }

    // Level 2: Current directory
    const localConfig = path.join(process.cwd(), this.configFileName);
    if (fs.existsSync(localConfig)) {
      console.log(`[Config] Found in current directory: ${localConfig}`);
      return localConfig;
    }

    // Level 3: Parent directory search (up to 5 levels)
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
      const parentDir = path.dirname(dir);
      if (parentDir === dir) break; // Reached root

      dir = parentDir;
      const parentConfig = path.join(dir, this.configFileName);
      if (fs.existsSync(parentConfig)) {
        console.log(`[Config] Found in parent directory: ${parentConfig}`);
        return parentConfig;
      }
    }

    // Level 4: Home directory (lowest priority)
    if (fs.existsSync(this.homeConfigFile)) {
      console.log(`[Config] Found in home directory: ${this.homeConfigFile}`);
      return this.homeConfigFile;
    }

    console.log('[Config] No config file found, using defaults');
    return null;
  }

  /**
   * Validate configuration against schema
   * @param {object} config - Configuration object to validate
   * @returns {object} - { valid: boolean, errors: string[] }
   */
  validateConfig(config) {
    const errors = [];

    const validateType = (value, schema, path) => {
      if (schema.type === 'object' && typeof value === 'object' && value !== null) {
        if (schema.properties) {
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (value[key] !== undefined) {
              validateType(value[key], propSchema, `${path}.${key}`);
            }
          }
        }
        return true;
      }

      if (schema.type === 'string' && typeof value !== 'string') {
        errors.push(`${path}: Expected string, got ${typeof value}`);
        return false;
      }

      if (schema.type === 'number' && typeof value !== 'number') {
        errors.push(`${path}: Expected number, got ${typeof value}`);
        return false;
      }

      if (schema.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${path}: Expected boolean, got ${typeof value}`);
        return false;
      }

      if (schema.type === 'array' && !Array.isArray(value)) {
        errors.push(`${path}: Expected array, got ${typeof value}`);
        return false;
      }

      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: Value "${value}" not in allowed values: ${schema.enum.join(', ')}`);
        return false;
      }

      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: Value ${value} is below minimum ${schema.minimum}`);
        return false;
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: Value ${value} is above maximum ${schema.maximum}`);
        return false;
      }

      return true;
    };

    validateType(config, CONFIG_SCHEMA, 'config');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Deep merge objects (target values are overwritten by source)
   * @param {object} target - Target object
   * @param {object} source - Source object
   * @returns {object} - Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (source[key] !== undefined && source[key] !== null) {
        if (
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key] &&
          typeof target[key] === 'object'
        ) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Load and merge configuration
   * Priority: CLI args > command-specific > file defaults > hardcoded defaults
   * @param {object} cliArgs - Arguments from CLI
   * @returns {object} - Merged configuration
   */
  loadConfig(cliArgs = {}) {
    const configPath = this.findConfig(cliArgs.config);
    let fileConfig = { defaults: {}, commands: {} };

    if (configPath) {
      try {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        fileConfig = JSON.parse(rawConfig);
        this.loadedConfigPath = configPath;

        // Validate configuration
        const validation = this.validateConfig(fileConfig);
        if (!validation.valid) {
          console.warn('[Config] Validation warnings:');
          validation.errors.forEach(err => console.warn(`  - ${err}`));
        }
      } catch (error) {
        console.error(`[Config] Error loading config: ${error.message}`);
        fileConfig = { defaults: {}, commands: {} };
      }
    }

    // Get command name from CLI args (e.g., 'daily', 'monthly', 'statusline')
    const commandName = cliArgs._?.[0] || 'default';
    const commandConfig = fileConfig.commands?.[commandName] || {};

    // Merge in order: defaults < file.defaults < file.commands[cmd] < CLI args
    let merged = this.deepMerge(DEFAULT_CONFIG.defaults, fileConfig.defaults || {});
    merged = this.deepMerge(merged, commandConfig);

    // Apply CLI overrides (only non-undefined values)
    const cliOverrides = {};
    if (cliArgs.currency !== undefined) cliOverrides.currency = cliArgs.currency;
    if (cliArgs.color !== undefined) cliOverrides.useColors = cliArgs.color;
    if (cliArgs.compact !== undefined) cliOverrides.compactMode = cliArgs.compact;
    if (cliArgs.style !== undefined) {
      cliOverrides.statusline = { ...merged.statusline, style: cliArgs.style };
    }
    if (cliArgs.lines !== undefined) {
      cliOverrides.statusline = { ...merged.statusline, lines: parseInt(cliArgs.lines) };
    }

    merged = this.deepMerge(merged, cliOverrides);

    this.config = merged;
    return merged;
  }

  /**
   * Get loaded configuration path
   * @returns {string|null}
   */
  getLoadedConfigPath() {
    return this.loadedConfigPath;
  }

  /**
   * Get default configuration
   * @returns {object}
   */
  getDefaults() {
    return { ...DEFAULT_CONFIG.defaults };
  }

  /**
   * Generate default configuration file content
   * @param {boolean} withComments - Include inline comments
   * @returns {string} - JSON string
   */
  generateDefaultConfig(withComments = false) {
    const config = {
      '$schema': 'https://dragon-ui.dev/schema/config.json',
      ...DEFAULT_CONFIG
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Create a configuration file in the current directory
   * @param {string} targetPath - Path to create config file
   * @returns {object} - { success: boolean, path: string, error?: string }
   */
  initConfig(targetPath = null) {
    const configPath = targetPath || path.join(process.cwd(), this.configFileName);

    if (fs.existsSync(configPath)) {
      return {
        success: false,
        path: configPath,
        error: 'Configuration file already exists'
      };
    }

    try {
      const content = this.generateDefaultConfig(true);
      fs.writeFileSync(configPath, content, 'utf8');
      console.log(`[Config] Created configuration file: ${configPath}`);
      return { success: true, path: configPath };
    } catch (error) {
      return {
        success: false,
        path: configPath,
        error: error.message
      };
    }
  }

  /**
   * Get current configuration
   * @returns {object|null}
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get configuration value by path (e.g., 'statusline.style')
   * @param {string} keyPath - Dot-separated path
   * @param {any} defaultValue - Default value if not found
   * @returns {any}
   */
  get(keyPath, defaultValue = undefined) {
    if (!this.config) return defaultValue;

    const keys = keyPath.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[key];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Show configuration help
   */
  showHelp() {
    console.log(`
Dragon UI Configuration System
===============================

Config File Discovery (Priority Order):
  1. --config <path>         CLI argument (highest priority)
  2. ./dragon-ui.json        Current directory
  3. ../dragon-ui.json       Parent directories (up to 5 levels)
  4. ~/.dragon-ui.json       Home directory (lowest priority)

Configuration Merging:
  CLI args > command-specific > file defaults > hardcoded defaults

Available Settings:
  defaults.currency          Currency for cost display (USD, EUR, GBP, JPY, CNY, ...)
  defaults.timezone          Timezone for date display
  defaults.locale            Locale for number formatting
  defaults.billingDay        Day of month for billing cycle (1-31)
  defaults.useLiteLLM        Use LiteLLM for price updates (true/false)
  defaults.useColors         Enable colors in CLI output
  defaults.compactMode       Use compact display mode
  defaults.showHeader        Show header in CLI output
  defaults.tableStyle        Table style (ascii, minimal, unicode)
  defaults.refreshInterval   Auto-refresh interval in ms (1000-300000)

  defaults.statusline.style      Statusline style (modern, classic, minimal, dragon)
  defaults.statusline.lines      Number of statusline lines (1-3)
  defaults.statusline.useColors  Enable colors in statusline
  defaults.statusline.useEmojis  Enable emojis in statusline
  defaults.statusline.compact    Use compact statusline
  defaults.statusline.showElements Array of elements to show

Per-Command Overrides:
  commands.daily.currency    Override currency for 'daily' command
  commands.monthly.compact   Override compact mode for 'monthly' command

Example Configuration (dragon-ui.json):
{
  "defaults": {
    "currency": "EUR",
    "useColors": true,
    "statusline": {
      "style": "dragon",
      "lines": 2
    }
  },
  "commands": {
    "daily": {
      "compactMode": true
    }
  }
}

Commands:
  dragon-ui-claude-cli config init    Create default config in current directory
  dragon-ui-claude-cli config show    Show current configuration
  dragon-ui-claude-cli config path    Show config file path
`);
  }
}

// Export singleton and schema
const configManager = new ConfigManager();

module.exports = {
  ConfigManager,
  configManager,
  CONFIG_SCHEMA,
  DEFAULT_CONFIG
};
