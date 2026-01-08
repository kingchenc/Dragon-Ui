/**
 * JSON Schema Validation and Config Structure for Dragon-UI
 * IDE autocomplete, validation, and configuration management
 *
 * @module lib/config-schema
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * JSON Schema for Dragon-UI configuration
 */
const CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://dragon-ui.dev/config.schema.json',
  title: 'Dragon-UI Configuration',
  description: 'Configuration schema for Dragon-UI Claude Code Max Usage Dashboard',
  type: 'object',
  properties: {
    version: {
      type: 'string',
      description: 'Configuration version',
      default: '1.0.0'
    },
    defaults: {
      type: 'object',
      description: 'Default settings applied globally',
      properties: {
        timezone: {
          type: 'string',
          description: 'Default timezone',
          default: 'UTC'
        },
        locale: {
          type: 'string',
          description: 'Default locale',
          default: 'en-US'
        },
        currency: {
          type: 'string',
          description: 'Default currency',
          default: 'USD',
          enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']
        },
        dateFormat: {
          type: 'string',
          description: 'Date format',
          default: 'relative',
          enum: ['iso', 'relative', 'compact', 'long']
        },
        billingCycleDay: {
          type: 'integer',
          description: 'Day of month billing cycle starts',
          default: 1,
          minimum: 1,
          maximum: 28
        },
        colorLevel: {
          type: 'integer',
          description: 'Terminal color level (0-3)',
          default: 3,
          minimum: 0,
          maximum: 3
        },
        compact: {
          type: 'boolean',
          description: 'Use compact display mode',
          default: false
        },
        debug: {
          type: 'boolean',
          description: 'Enable debug mode',
          default: false
        }
      },
      additionalProperties: false
    },
    commands: {
      type: 'object',
      description: 'Per-command configuration overrides',
      properties: {
        overview: {
          $ref: '#/definitions/commandConfig'
        },
        daily: {
          $ref: '#/definitions/commandConfig'
        },
        weekly: {
          $ref: '#/definitions/commandConfig'
        },
        monthly: {
          $ref: '#/definitions/commandConfig'
        },
        sessions: {
          $ref: '#/definitions/commandConfig'
        },
        analytics: {
          type: 'object',
          properties: {
            days: {
              type: 'integer',
              description: 'Default number of days for analytics',
              default: 30
            },
            chartWidth: {
              type: 'integer',
              description: 'Chart width in characters',
              default: 60
            }
          }
        },
        statusline: {
          type: 'object',
          properties: {
            style: {
              type: 'string',
              enum: ['modern', 'classic', 'minimal', 'dragon'],
              default: 'dragon'
            },
            lines: {
              type: 'integer',
              minimum: 1,
              maximum: 3,
              default: 1
            },
            useColors: {
              type: 'boolean',
              default: true
            },
            useEmojis: {
              type: 'boolean',
              default: true
            },
            elements: {
              type: 'array',
              items: { type: 'string' },
              default: ['model', 'branch', 'cwd', 'tokens', 'cost']
            }
          }
        },
        proxy: {
          type: 'object',
          properties: {
            port: {
              type: 'integer',
              default: 8787
            },
            host: {
              type: 'string',
              default: '127.0.0.1'
            },
            strategy: {
              type: 'string',
              enum: ['session', 'round-robin', 'priority', 'random'],
              default: 'session'
            },
            sessionTimeout: {
              type: 'integer',
              description: 'Session timeout in milliseconds',
              default: 18000000
            }
          }
        },
        retention: {
          type: 'object',
          properties: {
            payloadDays: {
              type: 'integer',
              default: 7
            },
            metadataDays: {
              type: 'integer',
              default: 365
            },
            logDays: {
              type: 'integer',
              default: 30
            },
            archiveDays: {
              type: 'integer',
              default: 730
            },
            compressAfterDays: {
              type: 'integer',
              default: 1
            },
            archiveEnabled: {
              type: 'boolean',
              default: true
            }
          }
        }
      },
      additionalProperties: true
    },
    paths: {
      type: 'object',
      description: 'Path configuration',
      properties: {
        database: {
          type: 'string',
          description: 'Path to SQLite database',
          default: './usage.db'
        },
        logs: {
          type: 'string',
          description: 'Path to logs directory',
          default: './logs'
        },
        archives: {
          type: 'string',
          description: 'Path to archives directory',
          default: './archives'
        },
        configDirs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional configuration directories'
        }
      }
    },
    models: {
      type: 'object',
      description: 'Model-specific configuration',
      properties: {
        aliases: {
          type: 'object',
          description: 'Model name aliases',
          additionalProperties: { type: 'string' },
          default: {
            'claude-3': 'claude-3-5-sonnet-20241022',
            'sonnet': 'claude-3-5-sonnet-20241022',
            'haiku': 'claude-3-5-haiku-20241022',
            'opus': 'claude-3-opus-20240229'
          }
        },
        pricing: {
          type: 'object',
          description: 'Custom pricing overrides',
          additionalProperties: {
            type: 'object',
            properties: {
              input: { type: 'number' },
              output: { type: 'number' },
              cacheRead: { type: 'number' },
              cacheWrite: { type: 'number' }
            }
          }
        }
      }
    },
    accounts: {
      type: 'array',
      description: 'Proxy account configurations',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          priority: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            default: 50
          },
          enabled: {
            type: 'boolean',
            default: true
          }
        },
        required: ['id', 'name']
      }
    },
    agents: {
      type: 'array',
      description: 'Agent preference configurations',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          workspace: { type: 'string' },
          preferredModel: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' }
        },
        required: ['name']
      }
    }
  },
  definitions: {
    commandConfig: {
      type: 'object',
      properties: {
        compact: { type: 'boolean' },
        json: { type: 'boolean' },
        timezone: { type: 'string' },
        locale: { type: 'string' },
        jq: { type: 'string' }
      }
    }
  },
  additionalProperties: false
};

/**
 * Schema validation error
 */
class SchemaValidationError extends Error {
  constructor(errors) {
    super(`Configuration validation failed: ${errors.length} error(s)`);
    this.name = 'SchemaValidationError';
    this.errors = errors;
  }
}

/**
 * Schema Validator class
 */
class SchemaValidator {
  constructor(schema = CONFIG_SCHEMA) {
    this.schema = schema;
    this.errors = [];
  }

  /**
   * Validate data against schema
   * @param {Object} data
   * @param {Object} schema
   * @param {string} path
   * @returns {boolean}
   */
  validate(data, schema = this.schema, path = '') {
    this.errors = [];
    this.validateNode(data, schema, path);
    return this.errors.length === 0;
  }

  /**
   * Validate a schema node
   * @param {any} data
   * @param {Object} schema
   * @param {string} path
   */
  validateNode(data, schema, path) {
    // Handle $ref
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/definitions/', '');
      const refSchema = this.schema.definitions?.[refPath];
      if (refSchema) {
        this.validateNode(data, refSchema, path);
      }
      return;
    }

    // Type validation
    if (schema.type) {
      if (!this.validateType(data, schema.type, path)) {
        return;
      }
    }

    // Enum validation
    if (schema.enum && data !== undefined) {
      if (!schema.enum.includes(data)) {
        this.addError(path, `Value must be one of: ${schema.enum.join(', ')}`);
      }
    }

    // Number validations
    if (schema.type === 'integer' || schema.type === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        this.addError(path, `Value must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        this.addError(path, `Value must be <= ${schema.maximum}`);
      }
    }

    // String validations
    if (schema.type === 'string' && data !== undefined) {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        this.addError(path, `String must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        this.addError(path, `String must be at most ${schema.maxLength} characters`);
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          this.addError(path, `String must match pattern: ${schema.pattern}`);
        }
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        this.addError(path, `Array must have at least ${schema.minItems} items`);
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        this.addError(path, `Array must have at most ${schema.maxItems} items`);
      }
      if (schema.items) {
        data.forEach((item, index) => {
          this.validateNode(item, schema.items, `${path}[${index}]`);
        });
      }
    }

    // Object validations
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      // Required properties
      if (schema.required) {
        for (const prop of schema.required) {
          if (data[prop] === undefined) {
            this.addError(path ? `${path}.${prop}` : prop, 'Property is required');
          }
        }
      }

      // Properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (data[key] !== undefined) {
            this.validateNode(data[key], propSchema, path ? `${path}.${key}` : key);
          }
        }
      }

      // Additional properties
      if (schema.additionalProperties === false) {
        const allowedKeys = Object.keys(schema.properties || {});
        for (const key of Object.keys(data)) {
          if (!allowedKeys.includes(key)) {
            this.addError(path ? `${path}.${key}` : key, 'Additional property not allowed');
          }
        }
      }
    }
  }

  /**
   * Validate type
   * @param {any} data
   * @param {string|string[]} type
   * @param {string} path
   * @returns {boolean}
   */
  validateType(data, type, path) {
    if (data === undefined || data === null) {
      return true; // Allow undefined/null, use 'required' for mandatory fields
    }

    const types = Array.isArray(type) ? type : [type];
    const actualType = this.getType(data);

    if (!types.includes(actualType)) {
      this.addError(path, `Expected ${types.join(' or ')}, got ${actualType}`);
      return false;
    }

    return true;
  }

  /**
   * Get JavaScript type
   * @param {any} value
   * @returns {string}
   */
  getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (Number.isInteger(value)) return 'integer';
    return typeof value;
  }

  /**
   * Add validation error
   * @param {string} path
   * @param {string} message
   */
  addError(path, message) {
    this.errors.push({
      path: path || 'root',
      message
    });
  }

  /**
   * Get validation errors
   * @returns {Array}
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Throw if invalid
   * @param {Object} data
   */
  validateOrThrow(data) {
    if (!this.validate(data)) {
      throw new SchemaValidationError(this.errors);
    }
  }
}

/**
 * Configuration Manager
 */
class ConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(process.cwd(), 'dragon-ui.config.json');
    this.validator = new SchemaValidator();
    this.config = null;
    this.defaults = this.getDefaultConfig();
  }

  /**
   * Get default configuration
   * @returns {Object}
   */
  getDefaultConfig() {
    return {
      version: '1.0.0',
      defaults: {
        timezone: 'UTC',
        locale: 'en-US',
        currency: 'USD',
        dateFormat: 'relative',
        billingCycleDay: 1,
        colorLevel: 3,
        compact: false,
        debug: false
      },
      commands: {
        statusline: {
          style: 'dragon',
          lines: 1,
          useColors: true,
          useEmojis: true,
          elements: ['model', 'branch', 'cwd', 'tokens', 'cost']
        },
        analytics: {
          days: 30,
          chartWidth: 60
        },
        proxy: {
          port: 8787,
          host: '127.0.0.1',
          strategy: 'session',
          sessionTimeout: 18000000
        },
        retention: {
          payloadDays: 7,
          metadataDays: 365,
          logDays: 30,
          archiveDays: 730,
          compressAfterDays: 1,
          archiveEnabled: true
        }
      },
      paths: {
        database: './usage.db',
        logs: './logs',
        archives: './archives'
      },
      models: {
        aliases: {
          'claude-3': 'claude-3-5-sonnet-20241022',
          'sonnet': 'claude-3-5-sonnet-20241022',
          'haiku': 'claude-3-5-haiku-20241022',
          'opus': 'claude-3-opus-20240229'
        }
      },
      accounts: [],
      agents: []
    };
  }

  /**
   * Load configuration from file
   * @returns {Object}
   */
  load() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf8');
        const loaded = JSON.parse(content);

        // Validate
        this.validator.validateOrThrow(loaded);

        // Merge with defaults
        this.config = this.mergeConfigs(this.defaults, loaded);
      } catch (error) {
        if (error instanceof SchemaValidationError) {
          console.error('Configuration validation errors:');
          for (const err of error.errors) {
            console.error(`  - ${err.path}: ${err.message}`);
          }
          throw error;
        }
        throw new Error(`Failed to load config: ${error.message}`);
      }
    } else {
      this.config = { ...this.defaults };
    }

    return this.config;
  }

  /**
   * Save configuration to file
   * @param {Object} config
   */
  save(config = this.config) {
    // Validate before saving
    this.validator.validateOrThrow(config);

    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(this.configPath, content);
    this.config = config;
  }

  /**
   * Merge configurations (deep merge)
   * @param {Object} base
   * @param {Object} override
   * @returns {Object}
   */
  mergeConfigs(base, override) {
    const result = { ...base };

    for (const key of Object.keys(override)) {
      if (
        override[key] !== null &&
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        base[key] !== null &&
        typeof base[key] === 'object' &&
        !Array.isArray(base[key])
      ) {
        result[key] = this.mergeConfigs(base[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  /**
   * Get configuration value
   * @param {string} path - Dot-separated path
   * @param {any} defaultValue
   * @returns {any}
   */
  get(path, defaultValue = undefined) {
    if (!this.config) {
      this.load();
    }

    const parts = path.split('.');
    let value = this.config;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      value = value[part];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set configuration value
   * @param {string} path
   * @param {any} value
   */
  set(path, value) {
    if (!this.config) {
      this.load();
    }

    const parts = path.split('.');
    let current = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Get command configuration
   * @param {string} command
   * @returns {Object}
   */
  getCommandConfig(command) {
    if (!this.config) {
      this.load();
    }

    // Merge defaults with command-specific config
    return {
      ...this.config.defaults,
      ...(this.config.commands?.[command] || {})
    };
  }

  /**
   * Apply CLI argument overrides
   * @param {string} command
   * @param {Object} cliArgs
   * @returns {Object}
   */
  applyCliOverrides(command, cliArgs) {
    const base = this.getCommandConfig(command);
    const result = { ...base };

    for (const [key, value] of Object.entries(cliArgs)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get effective configuration for command
   * @param {string} command
   * @param {Object} cliArgs
   * @returns {Object}
   */
  getEffectiveConfig(command, cliArgs = {}) {
    return this.applyCliOverrides(command, cliArgs);
  }

  /**
   * Generate schema file
   * @param {string} outputPath
   */
  generateSchemaFile(outputPath) {
    const schemaPath = outputPath || path.join(process.cwd(), 'dragon-ui.schema.json');
    fs.writeFileSync(schemaPath, JSON.stringify(CONFIG_SCHEMA, null, 2));
    return schemaPath;
  }

  /**
   * Initialize configuration file with defaults
   * @param {boolean} force
   */
  init(force = false) {
    if (fs.existsSync(this.configPath) && !force) {
      throw new Error('Configuration file already exists. Use force=true to overwrite.');
    }

    this.save(this.defaults);
    return this.configPath;
  }

  /**
   * Validate configuration file
   * @returns {Object}
   */
  validateFile() {
    if (!fs.existsSync(this.configPath)) {
      return { valid: true, errors: [], message: 'No configuration file found, using defaults' };
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(content);

      if (this.validator.validate(config)) {
        return { valid: true, errors: [], message: 'Configuration is valid' };
      }

      return {
        valid: false,
        errors: this.validator.getErrors(),
        message: 'Configuration validation failed'
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{ path: 'root', message: error.message }],
        message: 'Failed to parse configuration file'
      };
    }
  }

  /**
   * Get schema
   * @returns {Object}
   */
  getSchema() {
    return CONFIG_SCHEMA;
  }
}

// Singleton instance
let instance = null;

/**
 * Get ConfigManager instance
 * @param {string} configPath
 * @returns {ConfigManager}
 */
function getConfigManager(configPath) {
  if (!instance) {
    instance = new ConfigManager(configPath);
  }
  return instance;
}

module.exports = {
  CONFIG_SCHEMA,
  SchemaValidator,
  SchemaValidationError,
  ConfigManager,
  getConfigManager
};
