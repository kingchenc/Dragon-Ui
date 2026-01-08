'use strict';

/**
 * Provider Registry
 * Central registry for managing multiple LLM providers
 * Supports NanoGPT, Minimax, z.ai, OpenAI-compatible, and Anthropic-compatible providers
 */

const EventEmitter = require('events');
const { BaseProvider, ProviderStatus, ProviderType, getProviderFactory } = require('./providers/base-provider.cjs');

/**
 * Selection strategy enum
 */
const SelectionStrategy = {
  PRIORITY: 'priority',
  ROUND_ROBIN: 'round_robin',
  LEAST_COST: 'least_cost',
  LEAST_ERRORS: 'least_errors',
  RANDOM: 'random'
};

/**
 * Provider Registry - manages multiple providers and selection
 */
class ProviderRegistry extends EventEmitter {
  constructor(options = {}) {
    super();

    this._providers = new Map();
    this._priorities = new Map();
    this._roundRobinIndex = 0;
    this._defaultStrategy = options.defaultStrategy || SelectionStrategy.PRIORITY;
    this._healthCheckInterval = options.healthCheckInterval || 300000; // 5 min
    this._healthCheckTimer = null;
    this._modelProviderCache = new Map();
  }

  /**
   * Register a provider
   * @param {BaseProvider} provider - Provider instance
   * @param {number} [priority=50] - Priority (0-100, higher = preferred)
   */
  register(provider, priority = 50) {
    if (!(provider instanceof BaseProvider)) {
      throw new Error('Provider must extend BaseProvider');
    }

    const validation = provider.validate();
    if (!validation.valid) {
      throw new Error(`Invalid provider: ${validation.errors.join(', ')}`);
    }

    this._providers.set(provider.id, provider);
    this._priorities.set(provider.id, Math.max(0, Math.min(100, priority)));

    this._invalidateModelCache();

    provider.on('rateLimit', (data) => {
      this.emit('providerRateLimit', data);
    });

    provider.on('error', (data) => {
      this.emit('providerError', data);
    });

    this.emit('providerRegistered', { id: provider.id, name: provider.name });
  }

  /**
   * Unregister a provider
   * @param {string} providerId - Provider ID
   * @returns {boolean} True if removed
   */
  unregister(providerId) {
    const provider = this._providers.get(providerId);
    if (!provider) return false;

    provider.removeAllListeners();
    this._providers.delete(providerId);
    this._priorities.delete(providerId);
    this._invalidateModelCache();

    this.emit('providerUnregistered', { id: providerId });
    return true;
  }

  /**
   * Get a provider by ID
   * @param {string} providerId - Provider ID
   * @returns {BaseProvider|null}
   */
  get(providerId) {
    return this._providers.get(providerId) || null;
  }

  /**
   * Get all providers
   * @returns {BaseProvider[]}
   */
  getAll() {
    return Array.from(this._providers.values());
  }

  /**
   * Get all provider IDs
   * @returns {string[]}
   */
  getIds() {
    return Array.from(this._providers.keys());
  }

  /**
   * Get provider count
   * @returns {number}
   */
  get size() {
    return this._providers.size;
  }

  /**
   * Check if provider exists
   * @param {string} providerId
   * @returns {boolean}
   */
  has(providerId) {
    return this._providers.has(providerId);
  }

  /**
   * Get available providers (healthy and not rate-limited)
   * @returns {BaseProvider[]}
   */
  getAvailable() {
    return this.getAll().filter(p =>
      p.status === ProviderStatus.HEALTHY && !p.isRateLimited()
    );
  }

  /**
   * Get providers that support a specific model
   * @param {string} modelId - Model ID
   * @returns {BaseProvider[]}
   */
  getProvidersForModel(modelId) {
    const cached = this._modelProviderCache.get(modelId);
    if (cached) return cached;

    const providers = this.getAll().filter(p => p.supportsModel(modelId));
    this._modelProviderCache.set(modelId, providers);
    return providers;
  }

  /**
   * Select best provider for a model using strategy
   * @param {string} modelId - Model ID
   * @param {string} [strategy] - Selection strategy
   * @returns {BaseProvider|null}
   */
  selectProvider(modelId, strategy) {
    const strat = strategy || this._defaultStrategy;
    const available = this.getProvidersForModel(modelId)
      .filter(p => p.status === ProviderStatus.HEALTHY && !p.isRateLimited());

    if (available.length === 0) return null;
    if (available.length === 1) return available[0];

    switch (strat) {
      case SelectionStrategy.PRIORITY:
        return this._selectByPriority(available);

      case SelectionStrategy.ROUND_ROBIN:
        return this._selectRoundRobin(available);

      case SelectionStrategy.LEAST_COST:
        return this._selectLeastCost(available, modelId);

      case SelectionStrategy.LEAST_ERRORS:
        return this._selectLeastErrors(available);

      case SelectionStrategy.RANDOM:
        return this._selectRandom(available);

      default:
        return this._selectByPriority(available);
    }
  }

  /**
   * Select by priority
   * @private
   */
  _selectByPriority(providers) {
    let best = providers[0];
    let bestPriority = this._priorities.get(best.id) || 0;

    for (let i = 1; i < providers.length; i++) {
      const priority = this._priorities.get(providers[i].id) || 0;
      if (priority > bestPriority) {
        best = providers[i];
        bestPriority = priority;
      }
    }

    return best;
  }

  /**
   * Select round-robin
   * @private
   */
  _selectRoundRobin(providers) {
    const index = this._roundRobinIndex % providers.length;
    this._roundRobinIndex++;
    return providers[index];
  }

  /**
   * Select by least cost
   * @private
   */
  _selectLeastCost(providers, modelId) {
    let best = providers[0];
    let bestCost = this._getEstimatedCost(best, modelId);

    for (let i = 1; i < providers.length; i++) {
      const cost = this._getEstimatedCost(providers[i], modelId);
      if (cost < bestCost) {
        best = providers[i];
        bestCost = cost;
      }
    }

    return best;
  }

  /**
   * Get estimated cost for provider/model
   * @private
   */
  _getEstimatedCost(provider, modelId) {
    const pricing = provider.getPricing(modelId);
    if (!pricing) return Infinity;
    return (pricing.inputPer1M + pricing.outputPer1M) / 2;
  }

  /**
   * Select by least errors
   * @private
   */
  _selectLeastErrors(providers) {
    let best = providers[0];
    let bestRatio = this._getErrorRatio(best);

    for (let i = 1; i < providers.length; i++) {
      const ratio = this._getErrorRatio(providers[i]);
      if (ratio < bestRatio) {
        best = providers[i];
        bestRatio = ratio;
      }
    }

    return best;
  }

  /**
   * Get error ratio
   * @private
   */
  _getErrorRatio(provider) {
    if (provider.requestCount === 0) return 0;
    return provider.errorCount / provider.requestCount;
  }

  /**
   * Select random
   * @private
   */
  _selectRandom(providers) {
    const index = Math.floor(Math.random() * providers.length);
    return providers[index];
  }

  /**
   * Set provider priority
   * @param {string} providerId - Provider ID
   * @param {number} priority - Priority (0-100)
   */
  setPriority(providerId, priority) {
    if (!this._providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    this._priorities.set(providerId, Math.max(0, Math.min(100, priority)));
  }

  /**
   * Get provider priority
   * @param {string} providerId - Provider ID
   * @returns {number}
   */
  getPriority(providerId) {
    return this._priorities.get(providerId) || 0;
  }

  /**
   * Set default selection strategy
   * @param {string} strategy - Strategy from SelectionStrategy
   */
  setDefaultStrategy(strategy) {
    if (!Object.values(SelectionStrategy).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    this._defaultStrategy = strategy;
  }

  /**
   * Invalidate model-provider cache
   * @private
   */
  _invalidateModelCache() {
    this._modelProviderCache.clear();
  }

  /**
   * Run health check on all providers
   * @returns {Promise<Object>} Health check results
   */
  async healthCheckAll() {
    const results = {};

    const checks = this.getAll().map(async (provider) => {
      const result = await provider.healthCheck();
      results[provider.id] = result;
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * Start automatic health checks
   */
  startHealthChecks() {
    if (this._healthCheckTimer) return;

    this._healthCheckTimer = setInterval(async () => {
      const results = await this.healthCheckAll();
      this.emit('healthCheck', results);
    }, this._healthCheckInterval);
  }

  /**
   * Stop automatic health checks
   */
  stopHealthChecks() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
  }

  /**
   * Get registry status
   * @returns {Object}
   */
  getStatus() {
    const providers = this.getAll();
    const healthy = providers.filter(p => p.status === ProviderStatus.HEALTHY);
    const rateLimited = providers.filter(p => p.isRateLimited());
    const errored = providers.filter(p => p.status === ProviderStatus.ERROR);

    return {
      total: providers.length,
      healthy: healthy.length,
      rateLimited: rateLimited.length,
      errored: errored.length,
      strategy: this._defaultStrategy,
      providers: providers.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        priority: this._priorities.get(p.id) || 0,
        requestCount: p.requestCount,
        errorCount: p.errorCount
      }))
    };
  }

  /**
   * Get aggregated statistics
   * @returns {Object}
   */
  getStats() {
    const providers = this.getAll();

    let totalRequests = 0;
    let totalErrors = 0;
    let totalCost = 0;
    const totalTokens = { input: 0, output: 0, cached: 0 };

    for (const provider of providers) {
      totalRequests += provider.requestCount;
      totalErrors += provider.errorCount;
      totalCost += provider.totalCost;
      totalTokens.input += provider.totalTokens.input;
      totalTokens.output += provider.totalTokens.output;
      totalTokens.cached += provider.totalTokens.cached;
    }

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      totalCost,
      totalTokens,
      byProvider: Object.fromEntries(
        providers.map(p => [p.id, {
          requests: p.requestCount,
          errors: p.errorCount,
          cost: p.totalCost,
          tokens: p.totalTokens
        }])
      )
    };
  }

  /**
   * Reset all provider statistics
   */
  resetStats() {
    for (const provider of this.getAll()) {
      provider.resetStats();
    }
  }

  /**
   * Export registry configuration
   * @returns {Object}
   */
  export() {
    return {
      defaultStrategy: this._defaultStrategy,
      healthCheckInterval: this._healthCheckInterval,
      providers: this.getAll().map(p => ({
        ...p.toJSON(),
        priority: this._priorities.get(p.id) || 50
      }))
    };
  }

  /**
   * Clear all providers
   */
  clear() {
    this.stopHealthChecks();
    for (const provider of this.getAll()) {
      provider.removeAllListeners();
    }
    this._providers.clear();
    this._priorities.clear();
    this._invalidateModelCache();
  }

  /**
   * Dispose registry
   */
  dispose() {
    this.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
let _registry = null;

/**
 * Get singleton registry instance
 * @param {Object} [options] - Options for new instance
 * @returns {ProviderRegistry}
 */
function getProviderRegistry(options) {
  if (!_registry) {
    _registry = new ProviderRegistry(options);
  }
  return _registry;
}

/**
 * Reset singleton (for testing)
 */
function resetProviderRegistry() {
  if (_registry) {
    _registry.dispose();
    _registry = null;
  }
}

module.exports = {
  ProviderRegistry,
  SelectionStrategy,
  getProviderRegistry,
  resetProviderRegistry
};
