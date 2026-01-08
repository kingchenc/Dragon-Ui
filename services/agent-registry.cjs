/**
 * Agent Registry Service for Dragon-UI
 * Agent storage, lookup, metadata management, and model preference application
 *
 * @module services/agent-registry
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getAgentDiscovery, AgentDefinition } = require('./agent-discovery.cjs');

/**
 * Agent usage statistics
 */
class AgentUsageStats {
  constructor(agentId) {
    this.agentId = agentId;
    this.totalRequests = 0;
    this.totalTokens = { input: 0, output: 0, cached: 0 };
    this.totalCost = 0;
    this.firstUsed = null;
    this.lastUsed = null;
    this.sessions = new Set();
    this.errors = 0;
    this.averageResponseTime = 0;
    this.responseTimeCount = 0;
  }

  /**
   * Record a request
   * @param {Object} data
   */
  recordRequest(data) {
    this.totalRequests++;

    if (data.tokens) {
      this.totalTokens.input += data.tokens.input || 0;
      this.totalTokens.output += data.tokens.output || 0;
      this.totalTokens.cached += data.tokens.cached || 0;
    }

    if (data.cost) {
      this.totalCost += data.cost;
    }

    if (data.sessionId) {
      this.sessions.add(data.sessionId);
    }

    if (data.error) {
      this.errors++;
    }

    if (data.responseTime) {
      const oldTotal = this.averageResponseTime * this.responseTimeCount;
      this.responseTimeCount++;
      this.averageResponseTime = (oldTotal + data.responseTime) / this.responseTimeCount;
    }

    const now = Date.now();
    if (!this.firstUsed) {
      this.firstUsed = now;
    }
    this.lastUsed = now;
  }

  /**
   * Get summary
   * @returns {Object}
   */
  getSummary() {
    return {
      agentId: this.agentId,
      totalRequests: this.totalRequests,
      totalTokens: { ...this.totalTokens },
      totalCost: this.totalCost,
      firstUsed: this.firstUsed,
      lastUsed: this.lastUsed,
      uniqueSessions: this.sessions.size,
      errors: this.errors,
      errorRate: this.totalRequests > 0 ? this.errors / this.totalRequests : 0,
      averageResponseTime: this.averageResponseTime
    };
  }

  /**
   * Convert to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      agentId: this.agentId,
      totalRequests: this.totalRequests,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      firstUsed: this.firstUsed,
      lastUsed: this.lastUsed,
      sessions: Array.from(this.sessions),
      errors: this.errors,
      averageResponseTime: this.averageResponseTime,
      responseTimeCount: this.responseTimeCount
    };
  }

  /**
   * Create from JSON
   * @param {Object} json
   * @returns {AgentUsageStats}
   */
  static fromJSON(json) {
    const stats = new AgentUsageStats(json.agentId);
    stats.totalRequests = json.totalRequests || 0;
    stats.totalTokens = json.totalTokens || { input: 0, output: 0, cached: 0 };
    stats.totalCost = json.totalCost || 0;
    stats.firstUsed = json.firstUsed;
    stats.lastUsed = json.lastUsed;
    stats.sessions = new Set(json.sessions || []);
    stats.errors = json.errors || 0;
    stats.averageResponseTime = json.averageResponseTime || 0;
    stats.responseTimeCount = json.responseTimeCount || 0;
    return stats;
  }
}

/**
 * Agent preference entry
 */
class AgentPreference {
  constructor(data = {}) {
    this.agentId = data.agentId;
    this.preferredModel = data.preferredModel || null;
    this.color = data.color || null;
    this.icon = data.icon || null;
    this.enabled = data.enabled !== false;
    this.priority = data.priority || 50;
    this.customName = data.customName || null;
    this.maxTokens = data.maxTokens || null;
    this.temperature = data.temperature || null;
    this.systemPromptOverride = data.systemPromptOverride || null;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
  }

  /**
   * Apply preference to agent
   * @param {AgentDefinition} agent
   * @returns {AgentDefinition}
   */
  applyTo(agent) {
    const applied = new AgentDefinition(agent.toJSON());

    if (this.preferredModel) {
      applied.model = this.preferredModel;
    }
    if (this.color) {
      applied.color = this.color;
    }
    if (this.icon) {
      applied.icon = this.icon;
    }
    if (this.customName) {
      applied.name = this.customName;
    }
    if (this.systemPromptOverride) {
      applied.systemPrompt = this.systemPromptOverride;
    }

    applied.enabled = this.enabled;
    applied.priority = this.priority;

    return applied;
  }

  /**
   * Convert to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      agentId: this.agentId,
      preferredModel: this.preferredModel,
      color: this.color,
      icon: this.icon,
      enabled: this.enabled,
      priority: this.priority,
      customName: this.customName,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      systemPromptOverride: this.systemPromptOverride,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Agent Registry class
 */
class AgentRegistry {
  constructor(options = {}) {
    this.discovery = options.discovery || getAgentDiscovery(options);
    this.storagePath = options.storagePath || path.join(process.cwd(), '.dragon-ui', 'agent-registry.json');

    this.agents = new Map();
    this.preferences = new Map();
    this.usage = new Map();
    this.activeAgent = null;
    this.onAgentChange = options.onAgentChange || null;
    this.onUsageRecorded = options.onUsageRecorded || null;

    this.loadStorage();
  }

  /**
   * Load registry from storage
   */
  loadStorage() {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(this.storagePath, 'utf8');
      const data = JSON.parse(content);

      // Load preferences
      if (data.preferences) {
        for (const [id, pref] of Object.entries(data.preferences)) {
          this.preferences.set(id, new AgentPreference(pref));
        }
      }

      // Load usage stats
      if (data.usage) {
        for (const [id, stats] of Object.entries(data.usage)) {
          this.usage.set(id, AgentUsageStats.fromJSON(stats));
        }
      }
    } catch (error) {
      console.error('[AgentRegistry] Error loading storage:', error.message);
    }
  }

  /**
   * Save registry to storage
   */
  saveStorage() {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      preferences: {},
      usage: {}
    };

    for (const [id, pref] of this.preferences) {
      data.preferences[id] = pref.toJSON();
    }

    for (const [id, stats] of this.usage) {
      data.usage[id] = stats.toJSON();
    }

    fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
  }

  /**
   * Initialize registry with discovered agents
   */
  initialize() {
    const discovered = this.discovery.discover();

    for (const agent of discovered) {
      this.agents.set(agent.id, agent);
    }

    return this;
  }

  /**
   * Register an agent
   * @param {AgentDefinition|Object} agent
   * @returns {AgentDefinition}
   */
  register(agent) {
    const definition = agent instanceof AgentDefinition
      ? agent
      : new AgentDefinition(agent);

    this.agents.set(definition.id, definition);

    return definition;
  }

  /**
   * Unregister an agent
   * @param {string} agentId
   * @returns {boolean}
   */
  unregister(agentId) {
    return this.agents.delete(agentId);
  }

  /**
   * Get agent by ID
   * @param {string} agentId
   * @returns {AgentDefinition|null}
   */
  get(agentId) {
    let agent = this.agents.get(agentId);

    // Try discovery if not in registry
    if (!agent) {
      agent = this.discovery.getAgent(agentId);
      if (agent) {
        this.agents.set(agentId, agent);
      }
    }

    if (!agent) {
      return null;
    }

    // Apply preferences if any
    const preference = this.preferences.get(agentId);
    if (preference) {
      return preference.applyTo(agent);
    }

    return agent;
  }

  /**
   * Get agent by name
   * @param {string} name
   * @returns {AgentDefinition|null}
   */
  getByName(name) {
    for (const agent of this.agents.values()) {
      if (agent.name.toLowerCase() === name.toLowerCase()) {
        const preference = this.preferences.get(agent.id);
        if (preference) {
          return preference.applyTo(agent);
        }
        return agent;
      }
    }

    // Try discovery
    const discovered = this.discovery.getAgentByName(name);
    if (discovered) {
      this.agents.set(discovered.id, discovered);
      const preference = this.preferences.get(discovered.id);
      if (preference) {
        return preference.applyTo(discovered);
      }
      return discovered;
    }

    return null;
  }

  /**
   * Get all agents
   * @returns {AgentDefinition[]}
   */
  getAll() {
    // Merge discovered agents with registered
    const discovered = this.discovery.getAll();
    for (const agent of discovered) {
      if (!this.agents.has(agent.id)) {
        this.agents.set(agent.id, agent);
      }
    }

    const result = [];
    for (const agent of this.agents.values()) {
      const preference = this.preferences.get(agent.id);
      if (preference) {
        result.push(preference.applyTo(agent));
      } else {
        result.push(agent);
      }
    }

    return result.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get enabled agents
   * @returns {AgentDefinition[]}
   */
  getEnabled() {
    return this.getAll().filter(agent => agent.enabled);
  }

  /**
   * Find agent by system prompt
   * @param {string} systemPrompt
   * @returns {AgentDefinition|null}
   */
  findBySystemPrompt(systemPrompt) {
    // Check registered agents first
    for (const agent of this.agents.values()) {
      if (agent.matchesSystemPrompt(systemPrompt)) {
        const preference = this.preferences.get(agent.id);
        if (preference) {
          return preference.applyTo(agent);
        }
        return agent;
      }
    }

    // Try discovery
    const discovered = this.discovery.findBySystemPrompt(systemPrompt);
    if (discovered) {
      this.agents.set(discovered.id, discovered);
      const preference = this.preferences.get(discovered.id);
      if (preference) {
        return preference.applyTo(discovered);
      }
      return discovered;
    }

    return null;
  }

  /**
   * Set agent preference
   * @param {string} agentId
   * @param {Object} preferences
   * @returns {AgentPreference}
   */
  setPreference(agentId, preferences) {
    let existing = this.preferences.get(agentId);

    if (existing) {
      // Update existing preference
      Object.assign(existing, preferences);
      existing.updatedAt = Date.now();
    } else {
      // Create new preference
      existing = new AgentPreference({
        agentId,
        ...preferences
      });
    }

    this.preferences.set(agentId, existing);
    this.saveStorage();

    return existing;
  }

  /**
   * Get agent preference
   * @param {string} agentId
   * @returns {AgentPreference|null}
   */
  getPreference(agentId) {
    return this.preferences.get(agentId) || null;
  }

  /**
   * Remove agent preference
   * @param {string} agentId
   * @returns {boolean}
   */
  removePreference(agentId) {
    const result = this.preferences.delete(agentId);
    if (result) {
      this.saveStorage();
    }
    return result;
  }

  /**
   * Set preferred model for agent
   * @param {string} agentId
   * @param {string} model
   */
  setPreferredModel(agentId, model) {
    this.setPreference(agentId, { preferredModel: model });
  }

  /**
   * Get preferred model for agent
   * @param {string} agentId
   * @returns {string|null}
   */
  getPreferredModel(agentId) {
    const preference = this.preferences.get(agentId);
    if (preference?.preferredModel) {
      return preference.preferredModel;
    }

    const agent = this.agents.get(agentId);
    return agent?.model || null;
  }

  /**
   * Set active agent
   * @param {string} agentId
   */
  setActiveAgent(agentId) {
    const previous = this.activeAgent;
    this.activeAgent = agentId;

    if (this.onAgentChange && previous !== agentId) {
      this.onAgentChange(agentId, previous);
    }
  }

  /**
   * Get active agent
   * @returns {AgentDefinition|null}
   */
  getActiveAgent() {
    if (!this.activeAgent) {
      return null;
    }
    return this.get(this.activeAgent);
  }

  /**
   * Record agent usage
   * @param {string} agentId
   * @param {Object} data
   */
  recordUsage(agentId, data) {
    let stats = this.usage.get(agentId);

    if (!stats) {
      stats = new AgentUsageStats(agentId);
      this.usage.set(agentId, stats);
    }

    stats.recordRequest(data);

    if (this.onUsageRecorded) {
      this.onUsageRecorded(agentId, data);
    }

    // Periodic save (every 10 requests)
    if (stats.totalRequests % 10 === 0) {
      this.saveStorage();
    }
  }

  /**
   * Get agent usage stats
   * @param {string} agentId
   * @returns {Object|null}
   */
  getUsageStats(agentId) {
    const stats = this.usage.get(agentId);
    return stats ? stats.getSummary() : null;
  }

  /**
   * Get all usage stats
   * @returns {Object[]}
   */
  getAllUsageStats() {
    const result = [];
    for (const stats of this.usage.values()) {
      result.push(stats.getSummary());
    }
    return result.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * Get top agents by usage
   * @param {number} limit
   * @returns {Object[]}
   */
  getTopAgents(limit = 10) {
    return this.getAllUsageStats().slice(0, limit);
  }

  /**
   * Apply model preference to request
   * @param {Object} request
   * @param {string} agentId
   * @returns {Object}
   */
  applyModelPreference(request, agentId) {
    const preferredModel = this.getPreferredModel(agentId);

    if (!preferredModel) {
      return request;
    }

    return {
      ...request,
      model: preferredModel
    };
  }

  /**
   * Get registry statistics
   * @returns {Object}
   */
  getStats() {
    const allAgents = this.getAll();

    return {
      totalAgents: allAgents.length,
      enabledAgents: allAgents.filter(a => a.enabled).length,
      preferencesCount: this.preferences.size,
      usageRecordsCount: this.usage.size,
      activeAgent: this.activeAgent,
      discoveryStats: this.discovery.getStats()
    };
  }

  /**
   * Search agents
   * @param {string} query
   * @returns {AgentDefinition[]}
   */
  search(query) {
    const lowerQuery = query.toLowerCase();

    return this.getAll().filter(agent => {
      return (
        agent.name.toLowerCase().includes(lowerQuery) ||
        agent.description.toLowerCase().includes(lowerQuery) ||
        agent.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Export registry data
   * @returns {Object}
   */
  exportData() {
    const agents = [];
    for (const agent of this.agents.values()) {
      agents.push(agent.toJSON());
    }

    const preferences = [];
    for (const pref of this.preferences.values()) {
      preferences.push(pref.toJSON());
    }

    const usage = [];
    for (const stats of this.usage.values()) {
      usage.push(stats.toJSON());
    }

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      agents,
      preferences,
      usage
    };
  }

  /**
   * Import registry data
   * @param {Object} data
   */
  importData(data) {
    if (data.agents) {
      for (const agentData of data.agents) {
        const agent = new AgentDefinition(agentData);
        this.agents.set(agent.id, agent);
      }
    }

    if (data.preferences) {
      for (const prefData of data.preferences) {
        const pref = new AgentPreference(prefData);
        this.preferences.set(pref.agentId, pref);
      }
    }

    if (data.usage) {
      for (const statsData of data.usage) {
        const stats = AgentUsageStats.fromJSON(statsData);
        this.usage.set(stats.agentId, stats);
      }
    }

    this.saveStorage();
  }

  /**
   * Clear all data
   */
  clear() {
    this.agents.clear();
    this.preferences.clear();
    this.usage.clear();
    this.activeAgent = null;
    this.saveStorage();
  }
}

// Singleton instance
let instance = null;

/**
 * Get AgentRegistry instance
 * @param {Object} options
 * @returns {AgentRegistry}
 */
function getAgentRegistry(options) {
  if (!instance) {
    instance = new AgentRegistry(options);
    instance.initialize();
  }
  return instance;
}

/**
 * Reset singleton instance
 */
function resetAgentRegistry() {
  instance = null;
}

module.exports = {
  AgentUsageStats,
  AgentPreference,
  AgentRegistry,
  getAgentRegistry,
  resetAgentRegistry
};
