'use strict';

/**
 * NanoGPT Provider
 * Supports GLM models with dynamic pricing from NanoGPT API
 */

const { BaseProvider, ProviderType, ProviderStatus } = require('./base-provider.cjs');

const NANOGPT_MODELS = {
  'glm-4-plus': {
    name: 'GLM-4 Plus',
    contextWindow: 128000,
    inputPer1M: 0.5,
    outputPer1M: 0.5
  },
  'glm-4-air': {
    name: 'GLM-4 Air',
    contextWindow: 128000,
    inputPer1M: 0.1,
    outputPer1M: 0.1
  },
  'glm-4-flash': {
    name: 'GLM-4 Flash',
    contextWindow: 128000,
    inputPer1M: 0.01,
    outputPer1M: 0.01
  },
  'glm-4v-plus': {
    name: 'GLM-4V Plus (Vision)',
    contextWindow: 8192,
    inputPer1M: 1.0,
    outputPer1M: 1.0,
    vision: true
  },
  'glm-4-long': {
    name: 'GLM-4 Long',
    contextWindow: 1000000,
    inputPer1M: 0.1,
    outputPer1M: 0.1
  },
  'cogview-3-plus': {
    name: 'CogView-3 Plus',
    contextWindow: 4096,
    inputPer1M: 2.0,
    outputPer1M: 2.0,
    imageGeneration: true
  }
};

class NanoGPTProvider extends BaseProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - NanoGPT API key
   * @param {string} [config.baseUrl] - Base URL (default: https://nano-gpt.com/api/v1)
   */
  constructor(config) {
    super({
      id: config.id || 'nanogpt',
      name: config.name || 'NanoGPT',
      type: ProviderType.NANOGPT,
      baseUrl: config.baseUrl || 'https://nano-gpt.com/api/v1',
      apiKey: config.apiKey,
      headers: config.headers || {},
      options: config.options || {}
    });

    this._initializePricing();
    this._initializeModelMappings();
  }

  /**
   * Initialize model pricing
   * @private
   */
  _initializePricing() {
    for (const [modelId, info] of Object.entries(NANOGPT_MODELS)) {
      this.setPricing(modelId, {
        inputPer1M: info.inputPer1M,
        outputPer1M: info.outputPer1M,
        cachedPer1M: info.inputPer1M * 0.1
      });
    }
  }

  /**
   * Initialize model mappings
   * @private
   */
  _initializeModelMappings() {
    this.addModelMapping('glm-4', 'glm-4-plus');
    this.addModelMapping('glm4', 'glm-4-plus');
    this.addModelMapping('glm-4-vision', 'glm-4v-plus');
  }

  /**
   * Check if model is supported
   * @param {string} modelId
   * @returns {boolean}
   */
  supportsModel(modelId) {
    const mapped = this.mapModel(modelId);
    return NANOGPT_MODELS.hasOwnProperty(mapped) ||
           NANOGPT_MODELS.hasOwnProperty(modelId);
  }

  /**
   * Get supported models
   * @returns {Array<Object>}
   */
  getSupportedModels() {
    return Object.entries(NANOGPT_MODELS).map(([id, info]) => ({
      id,
      name: info.name,
      provider: this.id,
      contextWindow: info.contextWindow,
      pricing: {
        inputPer1M: info.inputPer1M,
        outputPer1M: info.outputPer1M
      },
      capabilities: {
        vision: info.vision || false,
        imageGeneration: info.imageGeneration || false
      }
    }));
  }

  /**
   * Build request headers
   * @param {Object} [additionalHeaders]
   * @returns {Object}
   */
  buildHeaders(additionalHeaders = {}) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Provider': 'NanoGPT',
      ...this.headers,
      ...additionalHeaders
    };
  }

  /**
   * Send chat completion request
   * @param {Object} request
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async sendRequest(request, options = {}) {
    const url = this.buildUrl('/chat/completions');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);
    const payload = {
      model: mappedModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens,
      stream: false
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal
      });

      if (response.status === 429) {
        this.handleRateLimit(response);
        throw new Error('Rate limited');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NanoGPT API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const usage = this.parseUsage(data);
      const cost = this.calculateCost(mappedModel, {
        input: usage.inputTokens,
        output: usage.outputTokens,
        cached: usage.cachedTokens
      });

      this.recordSuccess(usage, cost);

      return {
        ...data,
        _provider: this.id,
        _usage: usage,
        _cost: cost
      };

    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  /**
   * Stream chat completion request
   * @param {Object} request
   * @param {Object} [options]
   * @returns {AsyncGenerator}
   */
  async *streamRequest(request, options = {}) {
    const url = this.buildUrl('/chat/completions');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);
    const payload = {
      model: mappedModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens,
      stream: true
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: options.signal
      });

      if (response.status === 429) {
        this.handleRateLimit(response);
        throw new Error('Rate limited');
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NanoGPT API error: ${response.status} - ${error}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);

              if (chunk.usage) {
                totalUsage = this.parseUsage(chunk);
              }

              yield {
                ...chunk,
                _provider: this.id
              };
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      const cost = this.calculateCost(mappedModel, {
        input: totalUsage.inputTokens,
        output: totalUsage.outputTokens,
        cached: totalUsage.cachedTokens
      });

      this.recordSuccess(totalUsage, cost);

    } catch (error) {
      this.recordError(error);
      throw error;
    }
  }

  /**
   * Parse usage from response
   * @param {Object} response
   * @returns {Object}
   */
  parseUsage(response) {
    const usage = response.usage || {};
    return {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedTokens: usage.cached_tokens || 0,
      model: response.model
    };
  }

  /**
   * Perform health check
   * @protected
   */
  async _performHealthCheck() {
    const url = this.buildUrl('/models');
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  }

  /**
   * Fetch dynamic pricing from NanoGPT API
   * @returns {Promise<Object>}
   */
  async fetchDynamicPricing() {
    try {
      const url = this.buildUrl('/pricing');
      const headers = this.buildHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch pricing: ${response.status}`);
      }

      const data = await response.json();

      if (data.models) {
        for (const model of data.models) {
          if (model.id && model.pricing) {
            this.setPricing(model.id, {
              inputPer1M: model.pricing.input_per_1m || 0,
              outputPer1M: model.pricing.output_per_1m || 0,
              cachedPer1M: model.pricing.cached_per_1m || 0
            });
          }
        }
      }

      return data;

    } catch (error) {
      console.error('Failed to fetch NanoGPT pricing:', error.message);
      return null;
    }
  }
}

/**
 * Create NanoGPT provider instance
 * @param {Object} config
 * @returns {NanoGPTProvider}
 */
function createNanoGPTProvider(config) {
  return new NanoGPTProvider(config);
}

module.exports = {
  NanoGPTProvider,
  createNanoGPTProvider,
  NANOGPT_MODELS
};
