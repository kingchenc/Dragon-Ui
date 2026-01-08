'use strict';

/**
 * Base Provider Interface
 * Abstract base class for all LLM providers (NanoGPT, Minimax, z.ai, OpenAI-compatible, etc.)
 */

const EventEmitter = require('events');

/**
 * Provider status enum
 */
const ProviderStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNAVAILABLE: 'unavailable',
  RATE_LIMITED: 'rate_limited',
  ERROR: 'error'
};

/**
 * Provider type enum
 */
const ProviderType = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  NANOGPT: 'nanogpt',
  MINIMAX: 'minimax',
  ZAI: 'zai',
  OPENAI_COMPATIBLE: 'openai_compatible',
  ANTHROPIC_COMPATIBLE: 'anthropic_compatible'
};

/**
 * Base Provider class - all providers must extend this
 */
class BaseProvider extends EventEmitter {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.id - Unique provider ID
   * @param {string} config.name - Display name
   * @param {string} config.type - Provider type from ProviderType enum
   * @param {string} config.baseUrl - API base URL
   * @param {string} [config.apiKey] - API key
   * @param {Object} [config.headers] - Additional headers
   * @param {Object} [config.options] - Provider-specific options
   */
  constructor(config) {
    super();

    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }

    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey || null;
    this.headers = config.headers || {};
    this.options = config.options || {};

    this.status = ProviderStatus.HEALTHY;
    this.lastError = null;
    this.lastCheck = null;
    this.rateLimitReset = null;
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalTokens = { input: 0, output: 0, cached: 0 };
    this.totalCost = 0;

    this._modelMappings = new Map();
    this._pricing = new Map();
  }

  /**
   * Get provider info
   * @returns {Object} Provider information
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      baseUrl: this.baseUrl,
      status: this.status,
      lastCheck: this.lastCheck,
      lastError: this.lastError,
      stats: {
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        totalTokens: this.totalTokens,
        totalCost: this.totalCost
      }
    };
  }

  /**
   * Check if provider supports a model
   * @param {string} modelId - Model ID to check
   * @returns {boolean}
   */
  supportsModel(modelId) {
    throw new Error('supportsModel() must be implemented by subclass');
  }

  /**
   * Get list of supported models
   * @returns {Array<Object>} Array of model info objects
   */
  getSupportedModels() {
    throw new Error('getSupportedModels() must be implemented by subclass');
  }

  /**
   * Map external model name to provider-specific model name
   * @param {string} modelId - External model ID
   * @returns {string} Provider-specific model ID
   */
  mapModel(modelId) {
    return this._modelMappings.get(modelId) || modelId;
  }

  /**
   * Add model mapping
   * @param {string} externalId - External model ID
   * @param {string} internalId - Provider-specific model ID
   */
  addModelMapping(externalId, internalId) {
    this._modelMappings.set(externalId, internalId);
  }

  /**
   * Get pricing for a model
   * @param {string} modelId - Model ID
   * @returns {Object|null} Pricing info { inputPer1M, outputPer1M, cachedPer1M }
   */
  getPricing(modelId) {
    return this._pricing.get(modelId) || null;
  }

  /**
   * Set pricing for a model
   * @param {string} modelId - Model ID
   * @param {Object} pricing - Pricing info
   */
  setPricing(modelId, pricing) {
    this._pricing.set(modelId, {
      inputPer1M: pricing.inputPer1M || 0,
      outputPer1M: pricing.outputPer1M || 0,
      cachedPer1M: pricing.cachedPer1M || pricing.inputPer1M * 0.1 || 0
    });
  }

  /**
   * Calculate cost for token usage
   * @param {string} modelId - Model ID
   * @param {Object} tokens - Token counts { input, output, cached }
   * @returns {number} Cost in USD
   */
  calculateCost(modelId, tokens) {
    const pricing = this.getPricing(modelId);
    if (!pricing) return 0;

    const inputCost = (tokens.input || 0) * (pricing.inputPer1M / 1000000);
    const outputCost = (tokens.output || 0) * (pricing.outputPer1M / 1000000);
    const cachedCost = (tokens.cached || 0) * (pricing.cachedPer1M / 1000000);

    return inputCost + outputCost + cachedCost;
  }

  /**
   * Build request headers
   * @param {Object} [additionalHeaders] - Additional headers to merge
   * @returns {Object} Complete headers object
   */
  buildHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...additionalHeaders
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Build request URL
   * @param {string} endpoint - API endpoint path
   * @returns {string} Full URL
   */
  buildUrl(endpoint) {
    const base = this.baseUrl.replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '');
    return `${base}/${path}`;
  }

  /**
   * Send a chat completion request
   * @param {Object} request - Request payload
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>} Response
   */
  async sendRequest(request, options = {}) {
    throw new Error('sendRequest() must be implemented by subclass');
  }

  /**
   * Stream a chat completion request
   * @param {Object} request - Request payload
   * @param {Object} [options] - Request options
   * @returns {AsyncGenerator} Stream of response chunks
   */
  async *streamRequest(request, options = {}) {
    throw new Error('streamRequest() must be implemented by subclass');
  }

  /**
   * Parse response to extract usage information
   * @param {Object} response - Raw API response
   * @returns {Object} Normalized usage { inputTokens, outputTokens, cachedTokens, model }
   */
  parseUsage(response) {
    throw new Error('parseUsage() must be implemented by subclass');
  }

  /**
   * Health check - verify provider is operational
   * @returns {Promise<Object>} Health status { healthy, latency, error }
   */
  async healthCheck() {
    const startTime = Date.now();

    try {
      await this._performHealthCheck();
      const latency = Date.now() - startTime;

      this.status = ProviderStatus.HEALTHY;
      this.lastCheck = new Date().toISOString();
      this.lastError = null;

      return { healthy: true, latency, error: null };
    } catch (error) {
      const latency = Date.now() - startTime;

      this.status = ProviderStatus.ERROR;
      this.lastCheck = new Date().toISOString();
      this.lastError = error.message;

      return { healthy: false, latency, error: error.message };
    }
  }

  /**
   * Perform actual health check (implemented by subclass)
   * @protected
   */
  async _performHealthCheck() {
    throw new Error('_performHealthCheck() must be implemented by subclass');
  }

  /**
   * Handle rate limit response
   * @param {Object} response - Rate limit response
   */
  handleRateLimit(response) {
    this.status = ProviderStatus.RATE_LIMITED;

    const resetHeader = response.headers?.['x-ratelimit-reset'] ||
                        response.headers?.['retry-after'];

    if (resetHeader) {
      const resetTime = parseInt(resetHeader, 10);
      if (!isNaN(resetTime)) {
        this.rateLimitReset = resetTime > 1000000000
          ? new Date(resetTime * 1000).toISOString()
          : new Date(Date.now() + resetTime * 1000).toISOString();
      }
    } else {
      this.rateLimitReset = new Date(Date.now() + 60000).toISOString();
    }

    this.emit('rateLimit', {
      provider: this.id,
      resetAt: this.rateLimitReset
    });
  }

  /**
   * Check if currently rate limited
   * @returns {boolean}
   */
  isRateLimited() {
    if (this.status !== ProviderStatus.RATE_LIMITED) return false;
    if (!this.rateLimitReset) return false;

    const resetTime = new Date(this.rateLimitReset).getTime();
    if (Date.now() >= resetTime) {
      this.status = ProviderStatus.HEALTHY;
      this.rateLimitReset = null;
      return false;
    }

    return true;
  }

  /**
   * Record successful request
   * @param {Object} usage - Token usage
   * @param {number} cost - Request cost
   */
  recordSuccess(usage, cost) {
    this.requestCount++;
    this.totalTokens.input += usage.inputTokens || 0;
    this.totalTokens.output += usage.outputTokens || 0;
    this.totalTokens.cached += usage.cachedTokens || 0;
    this.totalCost += cost;

    this.emit('request', {
      provider: this.id,
      usage,
      cost,
      success: true
    });
  }

  /**
   * Record failed request
   * @param {Error} error - Error object
   */
  recordError(error) {
    this.errorCount++;
    this.lastError = error.message;

    this.emit('error', {
      provider: this.id,
      error: error.message,
      success: false
    });
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalTokens = { input: 0, output: 0, cached: 0 };
    this.totalCost = 0;
  }

  /**
   * Serialize provider to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      baseUrl: this.baseUrl,
      status: this.status,
      options: this.options
    };
  }

  /**
   * Validate configuration
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.id) errors.push('Provider ID is required');
    if (!this.name) errors.push('Provider name is required');
    if (!this.type) errors.push('Provider type is required');
    if (!this.baseUrl) errors.push('Base URL is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Provider factory for creating provider instances
 */
class ProviderFactory {
  constructor() {
    this._factories = new Map();
  }

  /**
   * Register a provider factory
   * @param {string} type - Provider type
   * @param {Function} factory - Factory function
   */
  register(type, factory) {
    this._factories.set(type, factory);
  }

  /**
   * Create a provider instance
   * @param {string} type - Provider type
   * @param {Object} config - Provider configuration
   * @returns {BaseProvider}
   */
  create(type, config) {
    const factory = this._factories.get(type);
    if (!factory) {
      throw new Error(`Unknown provider type: ${type}`);
    }
    return factory(config);
  }

  /**
   * Get registered provider types
   * @returns {string[]}
   */
  getTypes() {
    return Array.from(this._factories.keys());
  }

  /**
   * Check if provider type is registered
   * @param {string} type
   * @returns {boolean}
   */
  hasType(type) {
    return this._factories.has(type);
  }
}

// Singleton factory instance
let _factory = null;
function getProviderFactory() {
  if (!_factory) {
    _factory = new ProviderFactory();
  }
  return _factory;
}

module.exports = {
  BaseProvider,
  ProviderFactory,
  ProviderStatus,
  ProviderType,
  getProviderFactory
};
