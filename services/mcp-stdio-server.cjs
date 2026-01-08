'use strict';

/**
 * MCP Stdio Server - Model Context Protocol Server for Claude Desktop
 * Implements JSON-RPC 2.0 over stdio transport
 * Provides tools for: daily, monthly, session, blocks usage data
 */

const { EventEmitter } = require('events');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'dragon-ui';
const SERVER_VERSION = '1.0.0';

/**
 * JSON-RPC 2.0 Error Codes
 */
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

/**
 * MCP Tool Definitions
 */
const MCP_TOOLS = {
  daily: {
    name: 'daily',
    description: 'Get daily Claude usage statistics including cost, tokens, and sessions for today or a specific date',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (default: today)'
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'json'],
          description: 'Output format (default: summary)'
        }
      }
    }
  },
  monthly: {
    name: 'monthly',
    description: 'Get monthly Claude usage statistics including cost breakdown, projections, and trends',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'Month in YYYY-MM format (default: current month)'
        },
        includeProjections: {
          type: 'boolean',
          description: 'Include end-of-month projections (default: true)'
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'json'],
          description: 'Output format (default: summary)'
        }
      }
    }
  },
  session: {
    name: 'session',
    description: 'Get current or specific session usage data including duration, cost, and token breakdown',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to query (default: current active session)'
        },
        includeBreakdown: {
          type: 'boolean',
          description: 'Include model-by-model breakdown (default: false)'
        }
      }
    }
  },
  blocks: {
    name: 'blocks',
    description: 'Get 5-hour usage block statistics for Claude Max subscription tracking',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Number of recent blocks to return (default: 5, max: 20)'
        },
        includeActive: {
          type: 'boolean',
          description: 'Include currently active block (default: true)'
        }
      }
    }
  },
  overview: {
    name: 'overview',
    description: 'Get overall Claude usage overview with key metrics and trends',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'all'],
          description: 'Time period for overview (default: all)'
        }
      }
    }
  },
  projects: {
    name: 'projects',
    description: 'Get usage breakdown by project/workspace',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of top projects to return (default: 10)'
        },
        sortBy: {
          type: 'string',
          enum: ['cost', 'tokens', 'sessions', 'recent'],
          description: 'Sort criteria (default: cost)'
        }
      }
    }
  }
};

/**
 * MCP Resource Definitions
 */
const MCP_RESOURCES = {
  'dragon-ui://usage/daily': {
    uri: 'dragon-ui://usage/daily',
    name: 'Daily Usage',
    description: 'Daily usage statistics',
    mimeType: 'application/json'
  },
  'dragon-ui://usage/monthly': {
    uri: 'dragon-ui://usage/monthly',
    name: 'Monthly Usage',
    description: 'Monthly usage statistics',
    mimeType: 'application/json'
  },
  'dragon-ui://usage/session': {
    uri: 'dragon-ui://usage/session',
    name: 'Session Usage',
    description: 'Current session statistics',
    mimeType: 'application/json'
  },
  'dragon-ui://config': {
    uri: 'dragon-ui://config',
    name: 'Configuration',
    description: 'Dragon UI configuration',
    mimeType: 'application/json'
  }
};

/**
 * MCP Stdio Server Class
 */
class MCPStdioServer extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};

    this.coreDataService = options.coreDataService || null;
    this.database = options.database || null;
    this.running = false;
    this.initialized = false;
    this.clientCapabilities = {};
    this.requestId = 0;
    this.pendingRequests = new Map();

    this.rl = null;
    this.messageBuffer = '';
  }

  /**
   * Start the stdio server
   */
  start() {
    if (this.running) return;

    this.running = true;

    // Set up readline for line-by-line input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    // Handle incoming lines
    this.rl.on('line', (line) => {
      this._handleLine(line);
    });

    this.rl.on('close', () => {
      this.running = false;
      this.emit('closed');
    });

    process.stdin.on('error', (err) => {
      this._logError('stdin error', err);
    });

    this.emit('started');
    this._log('MCP Stdio Server started');
  }

  /**
   * Handle incoming line (JSON-RPC message)
   */
  _handleLine(line) {
    if (!line.trim()) return;

    try {
      const message = JSON.parse(line);
      this._handleMessage(message);
    } catch (error) {
      this._sendError(null, JSON_RPC_ERRORS.PARSE_ERROR, 'Parse error: ' + error.message);
    }
  }

  /**
   * Handle parsed JSON-RPC message
   */
  async _handleMessage(message) {
    // Validate JSON-RPC 2.0 format
    if (message.jsonrpc !== '2.0') {
      this._sendError(message.id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC version');
      return;
    }

    // Handle response to our requests
    if (message.result !== undefined || message.error !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle method calls
    if (!message.method) {
      this._sendError(message.id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Method required');
      return;
    }

    try {
      const result = await this._handleMethod(message.method, message.params || {});
      if (message.id !== undefined) {
        this._sendResult(message.id, result);
      }
    } catch (error) {
      this._sendError(message.id, JSON_RPC_ERRORS.INTERNAL_ERROR, error.message);
    }
  }

  /**
   * Handle MCP method calls
   */
  async _handleMethod(method, params) {
    switch (method) {
      case 'initialize':
        return this._handleInitialize(params);

      case 'initialized':
        this.initialized = true;
        this.emit('initialized');
        return null;

      case 'ping':
        return {};

      case 'tools/list':
        return this._handleToolsList();

      case 'tools/call':
        return this._handleToolCall(params);

      case 'resources/list':
        return this._handleResourcesList();

      case 'resources/read':
        return this._handleResourceRead(params);

      case 'prompts/list':
        return { prompts: [] };

      case 'logging/setLevel':
        return {};

      case 'completion/complete':
        return { completion: { values: [] } };

      default:
        throw new Error('Method not found: ' + method);
    }
  }

  /**
   * Handle initialize request
   */
  _handleInitialize(params) {
    this.clientCapabilities = params.capabilities || {};

    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: false },
        logging: {}
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      }
    };
  }

  /**
   * Handle tools/list request
   */
  _handleToolsList() {
    const tools = Object.values(MCP_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return { tools };
  }

  /**
   * Handle tools/call request
   */
  async _handleToolCall(params) {
    const { name, arguments: args } = params;

    if (!MCP_TOOLS[name]) {
      throw new Error('Unknown tool: ' + name);
    }

    let result;

    switch (name) {
      case 'daily':
        result = await this._executeDailyTool(args || {});
        break;
      case 'monthly':
        result = await this._executeMonthlyTool(args || {});
        break;
      case 'session':
        result = await this._executeSessionTool(args || {});
        break;
      case 'blocks':
        result = await this._executeBlocksTool(args || {});
        break;
      case 'overview':
        result = await this._executeOverviewTool(args || {});
        break;
      case 'projects':
        result = await this._executeProjectsTool(args || {});
        break;
      default:
        throw new Error('Tool not implemented: ' + name);
    }

    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Execute daily tool
   */
  async _executeDailyTool(args) {
    const date = args.date || new Date().toISOString().split('T')[0];
    const format = args.format || 'summary';

    let data;
    if (this.coreDataService) {
      const dailyData = await this.coreDataService.getTabData('daily');
      const dayEntry = (dailyData.dailyData || []).find(d => d.date === date);
      data = dayEntry || { date, totalCost: 0, totalTokens: 0, sessions: 0 };
    } else if (this.database) {
      data = this._getDailyFromDatabase(date);
    } else {
      data = { date, totalCost: 0, totalTokens: 0, sessions: 0, note: 'No data source configured' };
    }

    if (format === 'json') {
      return data;
    }

    if (format === 'detailed') {
      return this._formatDetailedDaily(data);
    }

    // Summary format
    return this._formatSummaryDaily(data);
  }

  _formatSummaryDaily(data) {
    const cost = (data.totalCost || 0).toFixed(4);
    const tokens = this._formatNumber(data.totalTokens || 0);
    const sessions = data.sessions || 0;

    return `Daily Usage (${data.date}):\n` +
           `  Cost: $${cost}\n` +
           `  Tokens: ${tokens}\n` +
           `  Sessions: ${sessions}`;
  }

  _formatDetailedDaily(data) {
    const lines = [
      `=== Daily Usage Report: ${data.date} ===`,
      '',
      `Total Cost: $${(data.totalCost || 0).toFixed(4)}`,
      `Total Tokens: ${this._formatNumber(data.totalTokens || 0)}`,
      `Sessions: ${data.sessions || 0}`,
      ''
    ];

    if (data.models && data.models.length > 0) {
      lines.push('Models Used:');
      data.models.forEach(m => lines.push(`  - ${m}`));
    }

    if (data.inputTokens !== undefined) {
      lines.push('');
      lines.push('Token Breakdown:');
      lines.push(`  Input: ${this._formatNumber(data.inputTokens || 0)}`);
      lines.push(`  Output: ${this._formatNumber(data.outputTokens || 0)}`);
      if (data.cachedTokens) {
        lines.push(`  Cached: ${this._formatNumber(data.cachedTokens)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Execute monthly tool
   */
  async _executeMonthlyTool(args) {
    const month = args.month || new Date().toISOString().slice(0, 7);
    const includeProjections = args.includeProjections !== false;
    const format = args.format || 'summary';

    let data;
    if (this.coreDataService) {
      const monthlyData = await this.coreDataService.getTabData('monthly');
      const monthEntry = (monthlyData.monthlyData || []).find(m => m.month === month);
      data = {
        ...monthEntry,
        projectedMonthly: monthlyData.projectedMonthly,
        dailyAverage: monthlyData.dailyAverage,
        growthTrend: monthlyData.growthTrend
      };
    } else {
      data = { month, totalCost: 0, totalTokens: 0, sessions: 0 };
    }

    if (format === 'json') {
      return data;
    }

    if (format === 'detailed') {
      return this._formatDetailedMonthly(data, includeProjections);
    }

    return this._formatSummaryMonthly(data, includeProjections);
  }

  _formatSummaryMonthly(data, includeProjections) {
    const cost = (data.totalCost || 0).toFixed(2);
    const tokens = this._formatNumber(data.totalTokens || 0);

    let result = `Monthly Usage (${data.month || data.monthName}):\n` +
                 `  Cost: $${cost}\n` +
                 `  Tokens: ${tokens}\n` +
                 `  Sessions: ${data.sessions || 0}`;

    if (includeProjections && data.projectedMonthly) {
      result += `\n  Projected: $${data.projectedMonthly.toFixed(2)}`;
    }

    return result;
  }

  _formatDetailedMonthly(data, includeProjections) {
    const lines = [
      `=== Monthly Usage Report: ${data.month || data.monthName} ===`,
      '',
      `Total Cost: $${(data.totalCost || 0).toFixed(2)}`,
      `Total Tokens: ${this._formatNumber(data.totalTokens || 0)}`,
      `Sessions: ${data.sessions || 0}`,
      `Days Active: ${data.daysActive || 0}`,
      ''
    ];

    if (includeProjections) {
      lines.push('Projections:');
      lines.push(`  End of Month: $${(data.projectedMonthly || 0).toFixed(2)}`);
      lines.push(`  Daily Average: $${(data.dailyAverage || 0).toFixed(2)}`);
      if (data.growthTrend !== undefined) {
        const trend = data.growthTrend > 0 ? '+' : '';
        lines.push(`  Trend: ${trend}${(data.growthTrend || 0).toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Execute session tool
   */
  async _executeSessionTool(args) {
    const sessionId = args.sessionId;
    const includeBreakdown = args.includeBreakdown === true;

    let data;
    if (this.coreDataService) {
      const activeData = await this.coreDataService.getTabData('active');

      if (sessionId) {
        // Find specific session
        const sessionsData = await this.coreDataService.getTabData('sessions');
        const session = (sessionsData.sessionsData || []).find(s => s.sessionId === sessionId);
        data = session || { error: 'Session not found' };
      } else {
        // Current session
        data = {
          sessionId: activeData.sessionId,
          status: activeData.status,
          cost: activeData.currentCost,
          tokens: activeData.tokensUsed,
          duration: activeData.duration,
          timeLeft: activeData.timeLeft,
          started: activeData.started,
          entries: activeData.entries
        };
      }
    } else {
      data = { status: 'idle', cost: 0, tokens: 0, note: 'No data source configured' };
    }

    if (args.format === 'json') {
      return data;
    }

    return this._formatSession(data, includeBreakdown);
  }

  _formatSession(data, includeBreakdown) {
    if (data.error) {
      return `Error: ${data.error}`;
    }

    const lines = [
      `Session: ${data.sessionId || 'N/A'}`,
      `Status: ${data.status || 'unknown'}`,
      `Cost: $${(data.cost || 0).toFixed(4)}`,
      `Tokens: ${this._formatNumber(data.tokens || 0)}`,
      `Duration: ${data.duration || 0} minutes`,
      `Time Left: ${data.timeLeft || 0} minutes`
    ];

    if (data.started) {
      lines.push(`Started: ${data.started}`);
    }

    if (data.entries) {
      lines.push(`Entries: ${data.entries}`);
    }

    if (includeBreakdown && data.modelBreakdown) {
      lines.push('');
      lines.push('Model Breakdown:');
      data.modelBreakdown.forEach(m => {
        lines.push(`  ${m.model}: $${m.cost.toFixed(4)} (${this._formatNumber(m.tokens)} tokens)`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Execute blocks tool
   */
  async _executeBlocksTool(args) {
    const count = Math.min(args.count || 5, 20);
    const includeActive = args.includeActive !== false;

    let blocks = [];

    if (this.coreDataService) {
      const dailyData = await this.coreDataService.getTabData('daily');
      const activeData = await this.coreDataService.getTabData('active');

      // Calculate 5-hour blocks from daily data
      blocks = this._calculateBlocks(dailyData, activeData, count, includeActive);
    }

    if (args.format === 'json') {
      return { blocks };
    }

    return this._formatBlocks(blocks);
  }

  _calculateBlocks(dailyData, activeData, count, includeActive) {
    const BLOCK_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours
    const blocks = [];

    // Create current block if active
    if (includeActive && activeData.sessionActive) {
      const startTime = new Date(activeData.started);
      const now = new Date();
      const blockStart = new Date(Math.floor(startTime.getTime() / BLOCK_DURATION_MS) * BLOCK_DURATION_MS);

      blocks.push({
        blockNumber: 1,
        startTime: blockStart.toISOString(),
        endTime: new Date(blockStart.getTime() + BLOCK_DURATION_MS).toISOString(),
        cost: activeData.currentCost || 0,
        tokens: activeData.tokensUsed || 0,
        entries: activeData.entries || 0,
        isActive: true,
        timeRemaining: Math.max(0, Math.floor((blockStart.getTime() + BLOCK_DURATION_MS - now.getTime()) / 60000))
      });
    }

    // Add historical blocks from daily data
    if (dailyData.blocks && Array.isArray(dailyData.blocks)) {
      dailyData.blocks.slice(0, count - blocks.length).forEach((block, idx) => {
        blocks.push({
          blockNumber: blocks.length + 1,
          startTime: block.startTime,
          endTime: block.endTime,
          cost: block.cost || 0,
          tokens: block.tokens || 0,
          entries: block.entries || 0,
          isActive: false
        });
      });
    }

    return blocks.slice(0, count);
  }

  _formatBlocks(blocks) {
    if (blocks.length === 0) {
      return 'No usage blocks found.';
    }

    const lines = ['=== 5-Hour Usage Blocks ===', ''];

    blocks.forEach(block => {
      const status = block.isActive ? ' [ACTIVE]' : '';
      lines.push(`Block #${block.blockNumber}${status}`);
      lines.push(`  Time: ${this._formatTime(block.startTime)} - ${this._formatTime(block.endTime)}`);
      lines.push(`  Cost: $${(block.cost || 0).toFixed(4)}`);
      lines.push(`  Tokens: ${this._formatNumber(block.tokens || 0)}`);
      if (block.isActive && block.timeRemaining !== undefined) {
        lines.push(`  Time Remaining: ${block.timeRemaining} minutes`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Execute overview tool
   */
  async _executeOverviewTool(args) {
    const period = args.period || 'all';

    let data;
    if (this.coreDataService) {
      data = await this.coreDataService.getTabData('overview');
    } else {
      data = { totalCost: 0, totalSessions: 0, totalTokens: 0 };
    }

    if (args.format === 'json') {
      return data;
    }

    return this._formatOverview(data, period);
  }

  _formatOverview(data, period) {
    const lines = [
      '=== Claude Usage Overview ===',
      '',
      `Total Cost: $${(data.totalCost || 0).toFixed(2)}`,
      `Total Sessions: ${data.totalSessions || 0}`,
      `Total Tokens: ${this._formatNumber(data.totalTokens || 0)}`,
      `Average Cost/Session: $${(data.averageCostPerSession || 0).toFixed(4)}`,
      `Active Days: ${data.activeDays || 0}`,
      ''
    ];

    if (data.last7DaysTotal !== undefined) {
      lines.push(`Last 7 Days: $${(data.last7DaysTotal || 0).toFixed(2)}`);
    }

    if (data.status) {
      lines.push(`Status: ${data.status}`);
    }

    return lines.join('\n');
  }

  /**
   * Execute projects tool
   */
  async _executeProjectsTool(args) {
    const limit = args.limit || 10;
    const sortBy = args.sortBy || 'cost';

    let projects = [];
    if (this.coreDataService) {
      const projectsData = await this.coreDataService.getTabData('projects');
      projects = (projectsData.projectsData || []).slice(0, limit);

      // Sort by specified criteria
      if (sortBy === 'tokens') {
        projects.sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
      } else if (sortBy === 'sessions') {
        projects.sort((a, b) => (b.sessions || 0) - (a.sessions || 0));
      } else if (sortBy === 'recent') {
        projects.sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
      }
      // Default is already sorted by cost
    }

    if (args.format === 'json') {
      return { projects };
    }

    return this._formatProjects(projects);
  }

  _formatProjects(projects) {
    if (projects.length === 0) {
      return 'No projects found.';
    }

    const lines = ['=== Projects by Usage ===', ''];

    projects.forEach((project, idx) => {
      const name = project.project || project.name || 'Unknown';
      const shortName = name.length > 40 ? '...' + name.slice(-37) : name;
      lines.push(`${idx + 1}. ${shortName}`);
      lines.push(`   Cost: $${(project.cost || 0).toFixed(4)}`);
      lines.push(`   Tokens: ${this._formatNumber(project.tokens || 0)}`);
      lines.push(`   Sessions: ${project.sessions || 0}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Handle resources/list request
   */
  _handleResourcesList() {
    const resources = Object.values(MCP_RESOURCES).map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType
    }));

    return { resources };
  }

  /**
   * Handle resources/read request
   */
  async _handleResourceRead(params) {
    const { uri } = params;

    if (!MCP_RESOURCES[uri]) {
      throw new Error('Resource not found: ' + uri);
    }

    let data;

    switch (uri) {
      case 'dragon-ui://usage/daily':
        data = this.coreDataService ? await this.coreDataService.getTabData('daily') : {};
        break;
      case 'dragon-ui://usage/monthly':
        data = this.coreDataService ? await this.coreDataService.getTabData('monthly') : {};
        break;
      case 'dragon-ui://usage/session':
        data = this.coreDataService ? await this.coreDataService.getTabData('active') : {};
        break;
      case 'dragon-ui://config':
        data = this._getConfig();
        break;
      default:
        throw new Error('Resource not implemented: ' + uri);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  /**
   * Get configuration info
   */
  _getConfig() {
    return {
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      tools: Object.keys(MCP_TOOLS),
      resources: Object.keys(MCP_RESOURCES)
    };
  }

  /**
   * Get daily data from database directly
   */
  _getDailyFromDatabase(date) {
    if (!this.database) {
      return { date, totalCost: 0, totalTokens: 0, sessions: 0 };
    }

    try {
      const entries = this.database.getEntriesByDate(date);
      const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
      const totalTokens = entries.reduce((sum, e) => sum + (e.total_tokens || 0), 0);
      const sessions = new Set(entries.map(e => e.session_id)).size;
      const models = [...new Set(entries.map(e => e.model).filter(Boolean))];

      return {
        date,
        totalCost,
        totalTokens,
        sessions,
        models,
        entries: entries.length
      };
    } catch (error) {
      return { date, totalCost: 0, totalTokens: 0, sessions: 0, error: error.message };
    }
  }

  /**
   * Send JSON-RPC result
   */
  _sendResult(id, result) {
    this._send({
      jsonrpc: '2.0',
      id,
      result
    });
  }

  /**
   * Send JSON-RPC error
   */
  _sendError(id, code, message, data) {
    const error = { code, message };
    if (data !== undefined) {
      error.data = data;
    }

    this._send({
      jsonrpc: '2.0',
      id,
      error
    });
  }

  /**
   * Send notification
   */
  _sendNotification(method, params) {
    this._send({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  /**
   * Send JSON-RPC message
   */
  _send(message) {
    try {
      const json = JSON.stringify(message);
      process.stdout.write(json + '\n');
    } catch (error) {
      this._logError('Failed to send message', error);
    }
  }

  /**
   * Format number with commas
   */
  _formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format time from ISO string
   */
  _formatTime(isoString) {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  /**
   * Log message (to stderr to not interfere with stdio)
   */
  _log(message) {
    process.stderr.write('[MCP] ' + message + '\n');
  }

  /**
   * Log error
   */
  _logError(context, error) {
    process.stderr.write('[MCP ERROR] ' + context + ': ' + (error.message || error) + '\n');
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.rl) {
      this.rl.close();
    }
    this.running = false;
    this.emit('stopped');
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.running,
      initialized: this.initialized,
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverName: SERVER_NAME,
      serverVersion: SERVER_VERSION,
      tools: Object.keys(MCP_TOOLS).length,
      resources: Object.keys(MCP_RESOURCES).length
    };
  }
}

/**
 * Generate Claude Desktop configuration
 */
function generateClaudeDesktopConfig(options) {
  options = options || {};

  const npxPath = options.npxPath || 'npx';
  const nodePath = options.nodePath || 'node';
  const packageName = options.packageName || 'dragon-ui';
  const useNpx = options.useNpx !== false;

  const config = {
    mcpServers: {}
  };

  if (useNpx) {
    config.mcpServers[SERVER_NAME] = {
      command: npxPath,
      args: [packageName, 'mcp', 'serve']
    };
  } else {
    const scriptPath = options.scriptPath || path.join(__dirname, '..', 'cli', 'index.cjs');
    config.mcpServers[SERVER_NAME] = {
      command: nodePath,
      args: [scriptPath, 'mcp', 'serve']
    };
  }

  return config;
}

/**
 * Get Claude Desktop config path
 */
function getClaudeDesktopConfigPath() {
  const platform = process.platform;
  const homeDir = os.homedir();

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Install MCP server to Claude Desktop config
 */
function installToClaudeDesktop(options) {
  const configPath = getClaudeDesktopConfigPath();
  const newConfig = generateClaudeDesktopConfig(options);

  let existingConfig = { mcpServers: {} };

  // Read existing config if it exists
  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!existingConfig.mcpServers) {
        existingConfig.mcpServers = {};
      }
    } catch (error) {
      // Start fresh if config is invalid
      existingConfig = { mcpServers: {} };
    }
  } else {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  // Merge configs
  existingConfig.mcpServers[SERVER_NAME] = newConfig.mcpServers[SERVER_NAME];

  // Write config
  fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf8');

  return {
    configPath,
    serverName: SERVER_NAME,
    config: existingConfig.mcpServers[SERVER_NAME]
  };
}

/**
 * Uninstall MCP server from Claude Desktop config
 */
function uninstallFromClaudeDesktop() {
  const configPath = getClaudeDesktopConfigPath();

  if (!fs.existsSync(configPath)) {
    return { removed: false, reason: 'Config file does not exist' };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (config.mcpServers && config.mcpServers[SERVER_NAME]) {
      delete config.mcpServers[SERVER_NAME];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return { removed: true, configPath };
    }

    return { removed: false, reason: 'Server not found in config' };
  } catch (error) {
    return { removed: false, reason: error.message };
  }
}

/**
 * Check if MCP server is installed in Claude Desktop
 */
function isInstalledInClaudeDesktop() {
  const configPath = getClaudeDesktopConfigPath();

  if (!fs.existsSync(configPath)) {
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return !!(config.mcpServers && config.mcpServers[SERVER_NAME]);
  } catch {
    return false;
  }
}

// Singleton instance
var _instance = null;
function getMCPStdioServer(opts) {
  if (!_instance) _instance = new MCPStdioServer(opts || {});
  return _instance;
}

module.exports = {
  MCPStdioServer,
  getMCPStdioServer,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROTOCOL_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
  generateClaudeDesktopConfig,
  getClaudeDesktopConfigPath,
  installToClaudeDesktop,
  uninstallFromClaudeDesktop,
  isInstalledInClaudeDesktop
};
