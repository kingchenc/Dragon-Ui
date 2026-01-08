/**
 * Agent Interceptor Service for Dragon-UI
 * System prompt extraction, agent matching, model preference injection, usage logging
 *
 * @module services/agent-interceptor
 */

'use strict';

const { getAgentRegistry } = require('./agent-registry.cjs');
const { getWorkspaceDetection } = require('./workspace-detection.cjs');

/**
 * Request interception result
 */
class InterceptionResult {
  constructor(data = {}) {
    this.intercepted = data.intercepted || false;
    this.agentId = data.agentId || null;
    this.agentName = data.agentName || null;
    this.originalModel = data.originalModel || null;
    this.modifiedModel = data.modifiedModel || null;
    this.systemPromptHash = data.systemPromptHash || null;
    this.matchType = data.matchType || null; // 'exact', 'partial', 'workspace', 'none'
    this.timestamp = data.timestamp || Date.now();
    this.metadata = data.metadata || {};
  }

  /**
   * Convert to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      intercepted: this.intercepted,
      agentId: this.agentId,
      agentName: this.agentName,
      originalModel: this.originalModel,
      modifiedModel: this.modifiedModel,
      systemPromptHash: this.systemPromptHash,
      matchType: this.matchType,
      timestamp: this.timestamp,
      metadata: this.metadata
    };
  }
}

/**
 * Interception statistics
 */
class InterceptionStats {
  constructor() {
    this.totalRequests = 0;
    this.interceptedRequests = 0;
    this.modelOverrides = 0;
    this.agentMatches = new Map();
    this.matchTypes = { exact: 0, partial: 0, workspace: 0, none: 0 };
    this.startTime = Date.now();
  }

  /**
   * Record an interception
   * @param {InterceptionResult} result
   */
  record(result) {
    this.totalRequests++;

    if (result.intercepted) {
      this.interceptedRequests++;

      if (result.agentId) {
        const count = this.agentMatches.get(result.agentId) || 0;
        this.agentMatches.set(result.agentId, count + 1);
      }

      if (result.modifiedModel && result.modifiedModel !== result.originalModel) {
        this.modelOverrides++;
      }
    }

    if (result.matchType) {
      this.matchTypes[result.matchType] = (this.matchTypes[result.matchType] || 0) + 1;
    }
  }

  /**
   * Get summary
   * @returns {Object}
   */
  getSummary() {
    const agentMatchesObj = {};
    for (const [id, count] of this.agentMatches) {
      agentMatchesObj[id] = count;
    }

    return {
      totalRequests: this.totalRequests,
      interceptedRequests: this.interceptedRequests,
      interceptionRate: this.totalRequests > 0 ? this.interceptedRequests / this.totalRequests : 0,
      modelOverrides: this.modelOverrides,
      matchTypes: { ...this.matchTypes },
      agentMatches: agentMatchesObj,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.totalRequests = 0;
    this.interceptedRequests = 0;
    this.modelOverrides = 0;
    this.agentMatches.clear();
    this.matchTypes = { exact: 0, partial: 0, workspace: 0, none: 0 };
    this.startTime = Date.now();
  }
}

/**
 * System prompt extractor
 */
class SystemPromptExtractor {
  /**
   * Extract system prompt from request
   * @param {Object} request
   * @returns {string|null}
   */
  static extract(request) {
    // OpenAI format
    if (request.messages && Array.isArray(request.messages)) {
      const systemMessage = request.messages.find(m => m.role === 'system');
      if (systemMessage) {
        return typeof systemMessage.content === 'string'
          ? systemMessage.content
          : JSON.stringify(systemMessage.content);
      }
    }

    // Anthropic format
    if (request.system) {
      return typeof request.system === 'string'
        ? request.system
        : JSON.stringify(request.system);
    }

    // Claude Code format
    if (request.systemPrompt) {
      return request.systemPrompt;
    }

    return null;
  }

  /**
   * Extract model from request
   * @param {Object} request
   * @returns {string|null}
   */
  static extractModel(request) {
    return request.model || request.modelId || null;
  }

  /**
   * Hash system prompt for comparison
   * @param {string} systemPrompt
   * @returns {string}
   */
  static hashPrompt(systemPrompt) {
    if (!systemPrompt) return null;

    const crypto = require('crypto');
    return crypto.createHash('md5').update(systemPrompt).digest('hex');
  }

  /**
   * Extract key phrases from system prompt
   * @param {string} systemPrompt
   * @returns {string[]}
   */
  static extractKeyPhrases(systemPrompt) {
    if (!systemPrompt) return [];

    // Split into sentences and get unique phrases
    const sentences = systemPrompt
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // Get first few sentences as key phrases
    return sentences.slice(0, 5);
  }

  /**
   * Extract agent hints from system prompt
   * @param {string} systemPrompt
   * @returns {Object}
   */
  static extractAgentHints(systemPrompt) {
    if (!systemPrompt) return {};

    const hints = {
      name: null,
      role: null,
      capabilities: []
    };

    // Extract name patterns
    const namePatterns = [
      /You are (?:a|an|the)?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
      /I am (?:a|an|the)?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
      /Your name is\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/
    ];

    for (const pattern of namePatterns) {
      const match = systemPrompt.match(pattern);
      if (match) {
        hints.name = match[1];
        break;
      }
    }

    // Extract role patterns
    const rolePatterns = [
      /You are (?:a|an|the)?\s*(.+?)(?:\.|,|$)/i,
      /Your role is (?:to\s+)?(.+?)(?:\.|,|$)/i
    ];

    for (const pattern of rolePatterns) {
      const match = systemPrompt.match(pattern);
      if (match) {
        hints.role = match[1].trim();
        break;
      }
    }

    // Extract capabilities
    const capabilityPatterns = [
      /You can (.+?)(?:\.|,|and)/gi,
      /capable of (.+?)(?:\.|,|and)/gi,
      /ability to (.+?)(?:\.|,|and)/gi
    ];

    for (const pattern of capabilityPatterns) {
      let match;
      while ((match = pattern.exec(systemPrompt)) !== null) {
        hints.capabilities.push(match[1].trim());
      }
    }

    return hints;
  }
}

/**
 * Agent Interceptor class
 */
class AgentInterceptor {
  constructor(options = {}) {
    this.registry = options.registry || getAgentRegistry(options);
    this.workspaceDetection = options.workspaceDetection || getWorkspaceDetection(options);
    this.stats = new InterceptionStats();
    this.enabled = options.enabled !== false;
    this.logUsage = options.logUsage !== false;
    this.promptCache = new Map();
    this.promptCacheTTL = options.promptCacheTTL || 5 * 60 * 1000; // 5 minutes
    this.onIntercept = options.onIntercept || null;
    this.onAgentMatched = options.onAgentMatched || null;
    this.onModelOverride = options.onModelOverride || null;
  }

  /**
   * Intercept a request
   * @param {Object} request
   * @returns {InterceptionResult}
   */
  intercept(request) {
    const result = new InterceptionResult({
      originalModel: SystemPromptExtractor.extractModel(request)
    });

    if (!this.enabled) {
      return result;
    }

    // Extract system prompt
    const systemPrompt = SystemPromptExtractor.extract(request);

    if (!systemPrompt) {
      result.matchType = 'none';
      this.stats.record(result);
      return result;
    }

    // Hash for caching
    result.systemPromptHash = SystemPromptExtractor.hashPrompt(systemPrompt);

    // Check prompt cache
    const cachedAgent = this.getCachedMatch(result.systemPromptHash);
    if (cachedAgent) {
      return this.buildInterceptionResult(request, cachedAgent, 'cached', result);
    }

    // Try to find matching agent
    const matchResult = this.findMatchingAgent(systemPrompt);

    if (matchResult.agent) {
      // Cache the match
      this.cacheMatch(result.systemPromptHash, matchResult.agent);

      return this.buildInterceptionResult(request, matchResult.agent, matchResult.matchType, result);
    }

    // No match found
    result.matchType = 'none';
    this.stats.record(result);

    return result;
  }

  /**
   * Find matching agent for system prompt
   * @param {string} systemPrompt
   * @returns {{agent: Object|null, matchType: string}}
   */
  findMatchingAgent(systemPrompt) {
    // 1. Try exact system prompt match
    const exactMatch = this.registry.findBySystemPrompt(systemPrompt);
    if (exactMatch) {
      return { agent: exactMatch, matchType: 'exact' };
    }

    // 2. Try partial match based on key phrases
    const keyPhrases = SystemPromptExtractor.extractKeyPhrases(systemPrompt);
    const allAgents = this.registry.getEnabled();

    for (const agent of allAgents) {
      if (agent.matchesSystemPrompt(systemPrompt)) {
        return { agent, matchType: 'partial' };
      }
    }

    // 3. Try workspace-based match
    const workspace = this.workspaceDetection.getCurrentWorkspace();
    if (workspace && workspace.agents.length > 0) {
      const workspaceAgents = this.registry.getAll().filter(a =>
        a.workspace === workspace.path
      );

      if (workspaceAgents.length === 1) {
        return { agent: workspaceAgents[0], matchType: 'workspace' };
      }
    }

    // 4. Try agent hints extraction
    const hints = SystemPromptExtractor.extractAgentHints(systemPrompt);
    if (hints.name) {
      const namedAgent = this.registry.getByName(hints.name);
      if (namedAgent) {
        return { agent: namedAgent, matchType: 'partial' };
      }
    }

    return { agent: null, matchType: 'none' };
  }

  /**
   * Build interception result
   * @param {Object} request
   * @param {Object} agent
   * @param {string} matchType
   * @param {InterceptionResult} baseResult
   * @returns {InterceptionResult}
   */
  buildInterceptionResult(request, agent, matchType, baseResult) {
    const result = new InterceptionResult({
      ...baseResult.toJSON(),
      intercepted: true,
      agentId: agent.id,
      agentName: agent.name,
      matchType
    });

    // Apply model preference if agent has one
    if (agent.model && agent.model !== result.originalModel) {
      result.modifiedModel = agent.model;

      if (this.onModelOverride) {
        this.onModelOverride(result.originalModel, result.modifiedModel, agent);
      }
    }

    // Set registry active agent
    this.registry.setActiveAgent(agent.id);

    // Record usage
    if (this.logUsage) {
      this.registry.recordUsage(agent.id, {
        sessionId: request.sessionId || null,
        tokens: request.tokens || null,
        cost: request.cost || 0,
        responseTime: request.responseTime || 0
      });
    }

    // Callback
    if (this.onAgentMatched) {
      this.onAgentMatched(agent, matchType);
    }

    if (this.onIntercept) {
      this.onIntercept(result);
    }

    this.stats.record(result);

    return result;
  }

  /**
   * Apply interception to request
   * @param {Object} request
   * @returns {Object}
   */
  applyInterception(request) {
    const result = this.intercept(request);

    if (!result.intercepted) {
      return request;
    }

    const modified = { ...request };

    // Apply model override
    if (result.modifiedModel) {
      modified.model = result.modifiedModel;
    }

    // Add interception metadata
    modified._interception = result.toJSON();

    return modified;
  }

  /**
   * Get cached agent match
   * @param {string} promptHash
   * @returns {Object|null}
   */
  getCachedMatch(promptHash) {
    const cached = this.promptCache.get(promptHash);

    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() > cached.expiresAt) {
      this.promptCache.delete(promptHash);
      return null;
    }

    return cached.agent;
  }

  /**
   * Cache agent match
   * @param {string} promptHash
   * @param {Object} agent
   */
  cacheMatch(promptHash, agent) {
    this.promptCache.set(promptHash, {
      agent,
      expiresAt: Date.now() + this.promptCacheTTL
    });
  }

  /**
   * Clear prompt cache
   */
  clearCache() {
    this.promptCache.clear();
  }

  /**
   * Enable interception
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable interception
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get interception statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats.getSummary(),
      enabled: this.enabled,
      cacheSize: this.promptCache.size,
      registryStats: this.registry.getStats()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats.reset();
  }

  /**
   * Create middleware function for Express/Koa
   * @returns {Function}
   */
  createMiddleware() {
    return (req, res, next) => {
      if (req.body && typeof req.body === 'object') {
        req.body = this.applyInterception(req.body);
      }
      next();
    };
  }

  /**
   * Create request handler for proxy
   * @returns {Function}
   */
  createProxyHandler() {
    return (request) => {
      return this.applyInterception(request);
    };
  }

  /**
   * Process response and record usage
   * @param {Object} response
   * @param {InterceptionResult} interceptionResult
   */
  processResponse(response, interceptionResult) {
    if (!interceptionResult || !interceptionResult.intercepted) {
      return;
    }

    // Extract usage from response
    const usage = {
      tokens: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        cached: response.usage?.cache_read_input_tokens || 0
      },
      responseTime: response.responseTime || 0
    };

    // Record to registry
    this.registry.recordUsage(interceptionResult.agentId, usage);
  }

  /**
   * Get active agent
   * @returns {Object|null}
   */
  getActiveAgent() {
    return this.registry.getActiveAgent();
  }

  /**
   * Manually set active agent
   * @param {string} agentId
   */
  setActiveAgent(agentId) {
    this.registry.setActiveAgent(agentId);
  }

  /**
   * Get all available agents
   * @returns {Object[]}
   */
  getAvailableAgents() {
    return this.registry.getEnabled();
  }
}

// Singleton instance
let instance = null;

/**
 * Get AgentInterceptor instance
 * @param {Object} options
 * @returns {AgentInterceptor}
 */
function getAgentInterceptor(options) {
  if (!instance) {
    instance = new AgentInterceptor(options);
  }
  return instance;
}

/**
 * Reset singleton instance
 */
function resetAgentInterceptor() {
  if (instance) {
    instance.clearCache();
    instance = null;
  }
}

module.exports = {
  InterceptionResult,
  InterceptionStats,
  SystemPromptExtractor,
  AgentInterceptor,
  getAgentInterceptor,
  resetAgentInterceptor
};
