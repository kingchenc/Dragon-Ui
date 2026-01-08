/**
 * Agent Detector Service
 * Detects and tracks agent/tool usage in AI interactions
 * Parses JSONL logs to identify tool calls, agent patterns, and MCP usage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Tool call patterns for detection
 */
const TOOL_PATTERNS = {
  // Claude tool use patterns
  claudeToolUse: /tool_use|tool_result|function_call|function_result/i,

  // MCP tool patterns
  mcpTool: /mcp_tool|mcp__|dragon_/i,

  // Common tool names
  commonTools: /bash|read|write|edit|glob|grep|search|fetch|execute|run|create|delete|update/i,

  // Agent patterns
  agentPatterns: /agent|assistant|autonomous|task|sub_?agent|delegate/i,

  // Code execution
  codeExecution: /exec|eval|run_code|execute_code|python|javascript|shell/i
};

/**
 * Agent types
 */
const AGENT_TYPES = {
  TOOL_USE: 'tool_use',
  MCP: 'mcp',
  CODE_EXECUTION: 'code_execution',
  FILE_OPERATION: 'file_operation',
  WEB_OPERATION: 'web_operation',
  SYSTEM_OPERATION: 'system_operation',
  UNKNOWN: 'unknown'
};

/**
 * Tool categories
 */
const TOOL_CATEGORIES = {
  // File operations
  file: ['read', 'write', 'edit', 'glob', 'grep', 'create_file', 'delete_file', 'move_file', 'copy_file'],

  // Code execution
  code: ['bash', 'python', 'node', 'execute', 'run', 'eval', 'shell'],

  // Web operations
  web: ['fetch', 'http', 'request', 'download', 'upload', 'websearch', 'webfetch'],

  // Database operations
  database: ['query', 'insert', 'update', 'delete', 'select', 'db_', 'sql'],

  // MCP tools
  mcp: ['mcp__', 'dragon_', 'serena__'],

  // System operations
  system: ['mkdir', 'rm', 'cp', 'mv', 'chmod', 'chown', 'kill', 'process'],

  // Git operations
  git: ['git_', 'commit', 'push', 'pull', 'branch', 'merge', 'checkout'],

  // Search operations
  search: ['search', 'find', 'grep', 'locate', 'which']
};

/**
 * Agent Detection Result
 * @typedef {Object} AgentDetectionResult
 * @property {boolean} isAgentCall - Whether this is an agent/tool call
 * @property {string} agentType - Type of agent detected
 * @property {string[]} tools - List of tools detected
 * @property {string[]} categories - Tool categories
 * @property {Object} metadata - Additional detection metadata
 */

/**
 * Agent Detector Class
 */
class AgentDetector {
  constructor() {
    this.statsFile = path.join(os.homedir(), '.dragon-ui-agent-stats.json');
    this.stats = this.loadStats();
    this.detectionCache = new Map();
    this.cacheMaxSize = 1000;
  }

  /**
   * Load saved statistics
   */
  loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        return JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
      }
    } catch (error) {
      console.error('[AgentDetector] Error loading stats:', error.message);
    }

    return {
      totalDetections: 0,
      byType: {},
      byTool: {},
      byCategory: {},
      sessions: {},
      lastUpdated: null
    };
  }

  /**
   * Save statistics to file
   */
  saveStats() {
    try {
      this.stats.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2));
      return true;
    } catch (error) {
      console.error('[AgentDetector] Error saving stats:', error.message);
      return false;
    }
  }

  /**
   * Detect agent/tool usage in a message or log entry
   * @param {Object|string} entry - Message or log entry to analyze
   * @returns {AgentDetectionResult}
   */
  detect(entry) {
    const content = typeof entry === 'string' ? entry : JSON.stringify(entry);

    // Check cache
    const cacheKey = this.hashContent(content);
    if (this.detectionCache.has(cacheKey)) {
      return this.detectionCache.get(cacheKey);
    }

    const result = {
      isAgentCall: false,
      agentType: AGENT_TYPES.UNKNOWN,
      tools: [],
      categories: [],
      metadata: {
        patterns: [],
        confidence: 0
      }
    };

    // Parse if JSON
    let parsed = null;
    try {
      parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
    } catch {
      parsed = null;
    }

    // Detect from parsed structure
    if (parsed) {
      this.detectFromStructure(parsed, result);
    }

    // Detect from content patterns
    this.detectFromPatterns(content, result);

    // Calculate confidence
    result.metadata.confidence = this.calculateConfidence(result);

    // Determine if this is an agent call
    result.isAgentCall = result.metadata.confidence >= 50;

    // Determine primary agent type
    if (result.isAgentCall) {
      result.agentType = this.determineAgentType(result);
    }

    // Cache result
    this.cacheResult(cacheKey, result);

    // Update stats
    if (result.isAgentCall) {
      this.updateStats(result);
    }

    return result;
  }

  /**
   * Detect agent usage from parsed structure
   */
  detectFromStructure(parsed, result) {
    // Check for tool_use in Claude API format
    if (parsed.type === 'tool_use' || parsed.content_block?.type === 'tool_use') {
      result.metadata.patterns.push('claude_tool_use');
      const toolName = parsed.name || parsed.content_block?.name;
      if (toolName) {
        result.tools.push(toolName);
      }
    }

    // Check for tool_result
    if (parsed.type === 'tool_result' || parsed.content_block?.type === 'tool_result') {
      result.metadata.patterns.push('claude_tool_result');
    }

    // Check for content array with tool use
    if (Array.isArray(parsed.content)) {
      for (const block of parsed.content) {
        if (block.type === 'tool_use') {
          result.metadata.patterns.push('tool_use_block');
          if (block.name) {
            result.tools.push(block.name);
          }
        }
        if (block.type === 'tool_result') {
          result.metadata.patterns.push('tool_result_block');
        }
      }
    }

    // Check for function calls (OpenAI format)
    if (parsed.function_call || parsed.tool_calls) {
      result.metadata.patterns.push('function_call');
      if (parsed.function_call?.name) {
        result.tools.push(parsed.function_call.name);
      }
      if (Array.isArray(parsed.tool_calls)) {
        for (const call of parsed.tool_calls) {
          if (call.function?.name) {
            result.tools.push(call.function.name);
          }
        }
      }
    }

    // Check for MCP tool patterns
    if (parsed.tool?.includes('mcp__') || parsed.name?.includes('mcp__')) {
      result.metadata.patterns.push('mcp_tool');
      result.tools.push(parsed.tool || parsed.name);
    }

    // Check for Dragon UI MCP tools
    if (parsed.tool?.includes('dragon_') || parsed.name?.includes('dragon_')) {
      result.metadata.patterns.push('dragon_mcp');
      result.tools.push(parsed.tool || parsed.name);
    }
  }

  /**
   * Detect agent usage from content patterns
   */
  detectFromPatterns(content, result) {
    const contentLower = content.toLowerCase();

    // Check for tool use patterns
    if (TOOL_PATTERNS.claudeToolUse.test(content)) {
      result.metadata.patterns.push('tool_use_pattern');
    }

    // Check for MCP patterns
    if (TOOL_PATTERNS.mcpTool.test(content)) {
      result.metadata.patterns.push('mcp_pattern');
    }

    // Check for common tools
    if (TOOL_PATTERNS.commonTools.test(content)) {
      result.metadata.patterns.push('common_tool');
    }

    // Check for agent patterns
    if (TOOL_PATTERNS.agentPatterns.test(content)) {
      result.metadata.patterns.push('agent_pattern');
    }

    // Check for code execution
    if (TOOL_PATTERNS.codeExecution.test(content)) {
      result.metadata.patterns.push('code_execution');
    }

    // Extract tool names from content
    this.extractToolNames(content, result);

    // Determine categories from detected tools
    this.categorizeTools(result);
  }

  /**
   * Extract tool names from content
   */
  extractToolNames(content, result) {
    // Pattern for tool names in various formats
    const toolPatterns = [
      /"name"\s*:\s*"([^"]+)"/g,
      /"tool"\s*:\s*"([^"]+)"/g,
      /tool_use\s*:\s*(\w+)/g,
      /mcp__(\w+)/g,
      /dragon_(\w+)/g
    ];

    for (const pattern of toolPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const toolName = match[1];
        if (toolName && !result.tools.includes(toolName)) {
          result.tools.push(toolName);
        }
      }
    }
  }

  /**
   * Categorize detected tools
   */
  categorizeTools(result) {
    for (const tool of result.tools) {
      const toolLower = tool.toLowerCase();

      for (const [category, patterns] of Object.entries(TOOL_CATEGORIES)) {
        for (const pattern of patterns) {
          if (toolLower.includes(pattern)) {
            if (!result.categories.includes(category)) {
              result.categories.push(category);
            }
            break;
          }
        }
      }
    }
  }

  /**
   * Calculate detection confidence (0-100)
   */
  calculateConfidence(result) {
    let confidence = 0;

    // Pattern-based confidence
    const patternWeights = {
      'claude_tool_use': 40,
      'claude_tool_result': 30,
      'tool_use_block': 40,
      'tool_result_block': 30,
      'function_call': 40,
      'mcp_tool': 50,
      'dragon_mcp': 50,
      'tool_use_pattern': 20,
      'mcp_pattern': 30,
      'common_tool': 15,
      'agent_pattern': 10,
      'code_execution': 20
    };

    for (const pattern of result.metadata.patterns) {
      confidence += patternWeights[pattern] || 5;
    }

    // Tool-based confidence
    confidence += result.tools.length * 10;

    // Category-based confidence
    confidence += result.categories.length * 5;

    return Math.min(100, confidence);
  }

  /**
   * Determine the primary agent type
   */
  determineAgentType(result) {
    // Check categories first
    if (result.categories.includes('mcp')) {
      return AGENT_TYPES.MCP;
    }
    if (result.categories.includes('code')) {
      return AGENT_TYPES.CODE_EXECUTION;
    }
    if (result.categories.includes('file')) {
      return AGENT_TYPES.FILE_OPERATION;
    }
    if (result.categories.includes('web')) {
      return AGENT_TYPES.WEB_OPERATION;
    }
    if (result.categories.includes('system') || result.categories.includes('git')) {
      return AGENT_TYPES.SYSTEM_OPERATION;
    }

    // Check patterns
    if (result.metadata.patterns.includes('mcp_pattern') || result.metadata.patterns.includes('mcp_tool')) {
      return AGENT_TYPES.MCP;
    }
    if (result.metadata.patterns.includes('claude_tool_use') || result.metadata.patterns.includes('function_call')) {
      return AGENT_TYPES.TOOL_USE;
    }

    return AGENT_TYPES.UNKNOWN;
  }

  /**
   * Update statistics
   */
  updateStats(result) {
    this.stats.totalDetections++;

    // By type
    if (!this.stats.byType[result.agentType]) {
      this.stats.byType[result.agentType] = 0;
    }
    this.stats.byType[result.agentType]++;

    // By tool
    for (const tool of result.tools) {
      if (!this.stats.byTool[tool]) {
        this.stats.byTool[tool] = 0;
      }
      this.stats.byTool[tool]++;
    }

    // By category
    for (const category of result.categories) {
      if (!this.stats.byCategory[category]) {
        this.stats.byCategory[category] = 0;
      }
      this.stats.byCategory[category]++;
    }
  }

  /**
   * Hash content for caching
   */
  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Cache detection result
   */
  cacheResult(key, result) {
    if (this.detectionCache.size >= this.cacheMaxSize) {
      // Remove oldest entries
      const keysToRemove = Array.from(this.detectionCache.keys()).slice(0, 100);
      for (const k of keysToRemove) {
        this.detectionCache.delete(k);
      }
    }
    this.detectionCache.set(key, result);
  }

  /**
   * Analyze a JSONL file for agent usage
   */
  async analyzeFile(filePath) {
    const results = {
      totalEntries: 0,
      agentCalls: 0,
      byType: {},
      byTool: {},
      byCategory: {},
      entries: []
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        results.totalEntries++;
        const detection = this.detect(line);

        if (detection.isAgentCall) {
          results.agentCalls++;
          results.entries.push({
            line: results.totalEntries,
            ...detection
          });

          // Aggregate stats
          if (!results.byType[detection.agentType]) {
            results.byType[detection.agentType] = 0;
          }
          results.byType[detection.agentType]++;

          for (const tool of detection.tools) {
            if (!results.byTool[tool]) {
              results.byTool[tool] = 0;
            }
            results.byTool[tool]++;
          }

          for (const category of detection.categories) {
            if (!results.byCategory[category]) {
              results.byCategory[category] = 0;
            }
            results.byCategory[category]++;
          }
        }
      }
    } catch (error) {
      console.error('[AgentDetector] Error analyzing file:', error.message);
    }

    return results;
  }

  /**
   * Track agent usage for a session
   */
  trackSession(sessionId, detection) {
    if (!this.stats.sessions[sessionId]) {
      this.stats.sessions[sessionId] = {
        totalCalls: 0,
        byType: {},
        byTool: {},
        startTime: new Date().toISOString()
      };
    }

    const session = this.stats.sessions[sessionId];
    session.totalCalls++;
    session.lastCall = new Date().toISOString();

    if (!session.byType[detection.agentType]) {
      session.byType[detection.agentType] = 0;
    }
    session.byType[detection.agentType]++;

    for (const tool of detection.tools) {
      if (!session.byTool[tool]) {
        session.byTool[tool] = 0;
      }
      session.byTool[tool]++;
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId) {
    return this.stats.sessions[sessionId] || null;
  }

  /**
   * Get overall statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.detectionCache.size
    };
  }

  /**
   * Get top tools by usage
   */
  getTopTools(limit = 10) {
    return Object.entries(this.stats.byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tool, count]) => ({ tool, count }));
  }

  /**
   * Get type distribution
   */
  getTypeDistribution() {
    const total = this.stats.totalDetections || 1;
    return Object.entries(this.stats.byType).map(([type, count]) => ({
      type,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    }));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.detectionCache.clear();
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalDetections: 0,
      byType: {},
      byTool: {},
      byCategory: {},
      sessions: {},
      lastUpdated: null
    };
    this.saveStats();
  }
}

// Export singleton instance
const agentDetector = new AgentDetector();

module.exports = {
  AgentDetector,
  agentDetector,
  AGENT_TYPES,
  TOOL_CATEGORIES,
  TOOL_PATTERNS
};
