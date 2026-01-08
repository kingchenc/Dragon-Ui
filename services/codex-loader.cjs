/**
 * Codex Data Loader Service for Dragon-UI
 * Parse and process OpenAI Codex/GPT-5 JSONL format
 *
 * @module services/codex-loader
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const EventEmitter = require('events');

/**
 * GPT-5/Codex model pricing (per 1M tokens)
 */
const CODEX_PRICING = {
  'gpt-5': {
    input: 1.25,
    output: 10.00,
    cached: 0.125
  },
  'gpt-5-mini': {
    input: 0.50,
    output: 2.00,
    cached: 0.05
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
    cached: 1.25
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
    cached: 0.075
  },
  'o1': {
    input: 15.00,
    output: 60.00,
    cached: 7.50
  },
  'o1-mini': {
    input: 3.00,
    output: 12.00,
    cached: 1.50
  },
  'o1-pro': {
    input: 150.00,
    output: 600.00,
    cached: 75.00
  },
  'codex': {
    input: 1.25,
    output: 10.00,
    cached: 0.125
  }
};

/**
 * Event types in Codex JSONL
 */
const EVENT_TYPES = {
  SESSION_START: 'session.start',
  SESSION_END: 'session.end',
  MESSAGE_CREATE: 'message.create',
  MESSAGE_DELTA: 'message.delta',
  MESSAGE_COMPLETE: 'message.complete',
  TOOL_USE: 'tool.use',
  TOOL_RESULT: 'tool.result',
  ERROR: 'error',
  USAGE: 'usage'
};

/**
 * Codex Session class
 */
class CodexSession {
  constructor(data = {}) {
    this.sessionId = data.session_id || data.id || null;
    this.model = data.model || 'codex';
    this.startTime = data.start_time ? new Date(data.start_time).getTime() : Date.now();
    this.endTime = data.end_time ? new Date(data.end_time).getTime() : null;

    this.inputTokens = 0;
    this.outputTokens = 0;
    this.cachedTokens = 0;
    this.reasoningTokens = 0;

    this.messages = [];
    this.toolUses = [];
    this.errors = [];

    this.metadata = data.metadata || {};
  }

  /**
   * Add a message to the session
   * @param {Object} message
   */
  addMessage(message) {
    this.messages.push({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || Date.now(),
      tokens: message.tokens || 0
    });
  }

  /**
   * Add tool use to the session
   * @param {Object} toolUse
   */
  addToolUse(toolUse) {
    this.toolUses.push({
      id: toolUse.id,
      name: toolUse.name,
      input: toolUse.input,
      output: toolUse.output,
      timestamp: toolUse.timestamp || Date.now(),
      duration: toolUse.duration || 0
    });
  }

  /**
   * Add usage data
   * @param {Object} usage
   */
  addUsage(usage) {
    this.inputTokens += usage.input_tokens || usage.prompt_tokens || 0;
    this.outputTokens += usage.output_tokens || usage.completion_tokens || 0;
    this.cachedTokens += usage.cached_tokens || usage.cache_read_tokens || 0;
    this.reasoningTokens += usage.reasoning_tokens || 0;
  }

  /**
   * Calculate session cost
   * @returns {number}
   */
  calculateCost() {
    const pricing = CODEX_PRICING[this.model] || CODEX_PRICING['codex'];

    const inputCost = (this.inputTokens / 1000000) * pricing.input;
    const outputCost = (this.outputTokens / 1000000) * pricing.output;
    const cachedCost = (this.cachedTokens / 1000000) * pricing.cached;

    return inputCost + outputCost + cachedCost;
  }

  /**
   * Get session duration in ms
   * @returns {number}
   */
  getDuration() {
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Get total tokens
   * @returns {number}
   */
  getTotalTokens() {
    return this.inputTokens + this.outputTokens + this.cachedTokens + this.reasoningTokens;
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      model: this.model,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedTokens: this.cachedTokens,
      reasoningTokens: this.reasoningTokens,
      totalTokens: this.getTotalTokens(),
      cost: this.calculateCost(),
      messageCount: this.messages.length,
      toolUseCount: this.toolUses.length,
      errorCount: this.errors.length,
      metadata: this.metadata
    };
  }
}

/**
 * Codex Loader class
 */
class CodexLoader extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      configDir: options.configDir || this.findConfigDir(),
      ...options
    };

    this.sessions = new Map();
    this.currentSession = null;
    this.stats = {
      totalSessions: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
      totalCost: 0,
      byModel: {}
    };
  }

  /**
   * Find Codex config directory
   * @returns {string|null}
   */
  findConfigDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const possiblePaths = [
      process.env.CODEX_CONFIG_DIR,
      path.join(homeDir, '.codex'),
      path.join(homeDir, '.config', 'codex'),
      path.join(homeDir, 'AppData', 'Roaming', 'codex')
    ].filter(Boolean);

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Find all JSONL files in config directory
   * @returns {string[]}
   */
  findJSONLFiles() {
    if (!this.options.configDir) {
      return [];
    }

    const projectsDir = path.join(this.options.configDir, 'projects');
    if (!fs.existsSync(projectsDir)) {
      return [];
    }

    const files = [];

    const walkDir = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDir(projectsDir);
    return files;
  }

  /**
   * Parse a single JSONL line
   * @param {string} line
   * @returns {Object|null}
   */
  parseLine(line) {
    try {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return null;
      }
      return JSON.parse(trimmed);
    } catch (error) {
      return null;
    }
  }

  /**
   * Process a parsed event
   * @param {Object} event
   */
  processEvent(event) {
    if (!event || !event.type) return;

    switch (event.type) {
      case EVENT_TYPES.SESSION_START:
        this.currentSession = new CodexSession({
          session_id: event.session_id || event.id,
          model: event.model,
          start_time: event.timestamp,
          metadata: event.metadata
        });
        this.sessions.set(this.currentSession.sessionId, this.currentSession);
        this.emit('session_start', this.currentSession);
        break;

      case EVENT_TYPES.SESSION_END:
        if (this.currentSession) {
          this.currentSession.endTime = event.timestamp ?
            new Date(event.timestamp).getTime() : Date.now();
          this.updateStats(this.currentSession);
          this.emit('session_end', this.currentSession);
          this.currentSession = null;
        }
        break;

      case EVENT_TYPES.MESSAGE_CREATE:
      case EVENT_TYPES.MESSAGE_COMPLETE:
        if (this.currentSession) {
          this.currentSession.addMessage({
            id: event.message?.id || event.id,
            role: event.message?.role || event.role,
            content: event.message?.content || event.content,
            timestamp: event.timestamp,
            tokens: event.usage?.total_tokens
          });
        }
        break;

      case EVENT_TYPES.USAGE:
        if (this.currentSession) {
          this.currentSession.addUsage(event.usage || event);
        }
        break;

      case EVENT_TYPES.TOOL_USE:
        if (this.currentSession) {
          this.currentSession.addToolUse({
            id: event.tool_use?.id || event.id,
            name: event.tool_use?.name || event.name,
            input: event.tool_use?.input || event.input,
            timestamp: event.timestamp
          });
        }
        break;

      case EVENT_TYPES.TOOL_RESULT:
        if (this.currentSession && this.currentSession.toolUses.length > 0) {
          const lastTool = this.currentSession.toolUses[this.currentSession.toolUses.length - 1];
          lastTool.output = event.result || event.output;
          lastTool.duration = event.timestamp ?
            new Date(event.timestamp).getTime() - lastTool.timestamp : 0;
        }
        break;

      case EVENT_TYPES.ERROR:
        if (this.currentSession) {
          this.currentSession.errors.push({
            message: event.error?.message || event.message,
            code: event.error?.code || event.code,
            timestamp: event.timestamp
          });
        }
        this.emit('error', event);
        break;

      default:
        // Handle response usage in other event types
        if (event.usage) {
          if (this.currentSession) {
            this.currentSession.addUsage(event.usage);
          }
        }
    }
  }

  /**
   * Update aggregate stats
   * @param {CodexSession} session
   */
  updateStats(session) {
    this.stats.totalSessions++;
    this.stats.totalInputTokens += session.inputTokens;
    this.stats.totalOutputTokens += session.outputTokens;
    this.stats.totalCachedTokens += session.cachedTokens;
    this.stats.totalReasoningTokens += session.reasoningTokens;
    this.stats.totalCost += session.calculateCost();

    const model = session.model;
    if (!this.stats.byModel[model]) {
      this.stats.byModel[model] = {
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0
      };
    }
    this.stats.byModel[model].sessions++;
    this.stats.byModel[model].inputTokens += session.inputTokens;
    this.stats.byModel[model].outputTokens += session.outputTokens;
    this.stats.byModel[model].cost += session.calculateCost();
  }

  /**
   * Load a single JSONL file
   * @param {string} filePath
   * @returns {Promise<CodexSession[]>}
   */
  async loadFile(filePath) {
    return new Promise((resolve, reject) => {
      const sessions = [];

      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        const event = this.parseLine(line);
        if (event) {
          this.processEvent(event);
          if (event.type === EVENT_TYPES.SESSION_END && this.sessions.size > sessions.length) {
            sessions.push(Array.from(this.sessions.values()).pop());
          }
        }
      });

      rl.on('close', () => {
        // Handle session that didn't have an end event
        if (this.currentSession) {
          this.updateStats(this.currentSession);
          sessions.push(this.currentSession);
          this.currentSession = null;
        }
        resolve(sessions);
      });

      rl.on('error', reject);
    });
  }

  /**
   * Load all JSONL files from config directory
   * @returns {Promise<Object>}
   */
  async loadAll() {
    const files = this.findJSONLFiles();
    const allSessions = [];

    for (const file of files) {
      try {
        const sessions = await this.loadFile(file);
        allSessions.push(...sessions);
        this.emit('file_loaded', { file, sessionCount: sessions.length });
      } catch (error) {
        this.emit('file_error', { file, error });
      }
    }

    return {
      sessions: allSessions,
      stats: this.getStats(),
      files: files.length
    };
  }

  /**
   * Load sessions from a date range
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {CodexSession[]}
   */
  getSessionsInRange(startDate, endDate) {
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();

    return Array.from(this.sessions.values()).filter(session =>
      session.startTime >= startTs && session.startTime <= endTs
    );
  }

  /**
   * Get daily aggregation
   * @returns {Object}
   */
  getDailyStats() {
    const daily = {};

    for (const session of this.sessions.values()) {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!daily[date]) {
        daily[date] = {
          date,
          sessions: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          cost: 0
        };
      }
      daily[date].sessions++;
      daily[date].inputTokens += session.inputTokens;
      daily[date].outputTokens += session.outputTokens;
      daily[date].cachedTokens += session.cachedTokens;
      daily[date].cost += session.calculateCost();
    }

    return Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get overall statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      sessionCount: this.sessions.size,
      averageCostPerSession: this.stats.totalSessions > 0 ?
        this.stats.totalCost / this.stats.totalSessions : 0,
      averageTokensPerSession: this.stats.totalSessions > 0 ?
        (this.stats.totalInputTokens + this.stats.totalOutputTokens) / this.stats.totalSessions : 0
    };
  }

  /**
   * Get all sessions
   * @returns {CodexSession[]}
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {CodexSession|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Clear all loaded data
   */
  clear() {
    this.sessions.clear();
    this.currentSession = null;
    this.stats = {
      totalSessions: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
      totalCost: 0,
      byModel: {}
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get Codex Loader instance
 * @param {Object} options
 * @returns {CodexLoader}
 */
function getCodexLoader(options) {
  if (!instance) {
    instance = new CodexLoader(options);
  }
  return instance;
}

module.exports = {
  CodexLoader,
  CodexSession,
  getCodexLoader,
  CODEX_PRICING,
  EVENT_TYPES
};
