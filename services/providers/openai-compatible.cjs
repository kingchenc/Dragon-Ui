'use strict';

/**
 * OpenAI-Compatible Provider
 * Supports OpenRouter, Together AI, Groq, and other OpenAI-compatible APIs
 */

const { BaseProvider, ProviderType, ProviderStatus } = require('./base-provider.cjs');

/**
 * Common models across OpenAI-compatible providers
 */
const COMMON_MODELS = {
  // OpenAI
  'gpt-4o': { name: 'GPT-4o', contextWindow: 128000, inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-mini': { name: 'GPT-4o Mini', contextWindow: 128000, inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4-turbo': { name: 'GPT-4 Turbo', contextWindow: 128000, inputPer1M: 10.0, outputPer1M: 30.0 },
  'gpt-3.5-turbo': { name: 'GPT-3.5 Turbo', contextWindow: 16385, inputPer1M: 0.5, outputPer1M: 1.5 },
  'o1': { name: 'o1', contextWindow: 200000, inputPer1M: 15.0, outputPer1M: 60.0 },
  'o1-mini': { name: 'o1-mini', contextWindow: 128000, inputPer1M: 3.0, outputPer1M: 12.0 },

  // Llama
  'llama-3.3-70b': { name: 'Llama 3.3 70B', contextWindow: 128000, inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama-3.1-405b': { name: 'Llama 3.1 405B', contextWindow: 128000, inputPer1M: 3.0, outputPer1M: 3.0 },
  'llama-3.1-70b': { name: 'Llama 3.1 70B', contextWindow: 128000, inputPer1M: 0.52, outputPer1M: 0.75 },
  'llama-3.1-8b': { name: 'Llama 3.1 8B', contextWindow: 128000, inputPer1M: 0.05, outputPer1M: 0.08 },

  // Mistral
  'mistral-large': { name: 'Mistral Large', contextWindow: 128000, inputPer1M: 2.0, outputPer1M: 6.0 },
  'mistral-medium': { name: 'Mistral Medium', contextWindow: 32000, inputPer1M: 2.7, outputPer1M: 8.1 },
  'mistral-small': { name: 'Mistral Small', contextWindow: 32000, inputPer1M: 0.2, outputPer1M: 0.6 },
  'mixtral-8x7b': { name: 'Mixtral 8x7B', contextWindow: 32000, inputPer1M: 0.24, outputPer1M: 0.24 },
  'mixtral-8x22b': { name: 'Mixtral 8x22B', contextWindow: 65536, inputPer1M: 0.65, outputPer1M: 0.65 },

  // Google
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPer1M: 0.1, outputPer1M: 0.4 },
  'gemini-1.5-pro': { name: 'Gemini 1.5 Pro', contextWindow: 2000000, inputPer1M: 1.25, outputPer1M: 5.0 },
  'gemini-1.5-flash': { name: 'Gemini 1.5 Flash', contextWindow: 1000000, inputPer1M: 0.075, outputPer1M: 0.3 },

  // DeepSeek
  'deepseek-chat': { name: 'DeepSeek Chat', contextWindow: 64000, inputPer1M: 0.14, outputPer1M: 0.28 },
  'deepseek-coder': { name: 'DeepSeek Coder', contextWindow: 64000, inputPer1M: 0.14, outputPer1M: 0.28 },

  // Qwen
  'qwen-2.5-72b': { name: 'Qwen 2.5 72B', contextWindow: 128000, inputPer1M: 0.35, outputPer1M: 0.40 },
  'qwen-2.5-coder-32b': { name: 'Qwen 2.5 Coder 32B', contextWindow: 128000, inputPer1M: 0.18, outputPer1M: 0.18 }
};

/**
 * Known provider presets
 */
const PROVIDER_PRESETS = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    headerPrefix: 'HTTP-Referer',
    name: 'OpenRouter'
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    name: 'Together AI'
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    name: 'Groq'
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    name: 'Fireworks AI'
  },
  deepinfra: {
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    name: 'DeepInfra'
  },
  anyscale: {
    baseUrl: 'https://api.endpoints.anyscale.com/v1',
    name: 'Anyscale'
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
    name: 'Perplexity'
  }
};

class OpenAICompatibleProvider extends BaseProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - API key
   * @param {string} [config.baseUrl] - Base URL
   * @param {string} [config.preset] - Provider preset (openrouter, together, etc.)
   * @param {Object} [config.models] - Custom model definitions
   */
  constructor(config) {
    const preset = config.preset ? PROVIDER_PRESETS[config.preset] : null;

    super({
      id: config.id || config.preset || 'openai-compatible',
      name: config.name || preset?.name || 'OpenAI Compatible',
      type: ProviderType.OPENAI_COMPATIBLE,
      baseUrl: config.baseUrl || preset?.baseUrl || 'https://api.openai.com/v1',
      apiKey: config.apiKey,
      headers: config.headers || {},
      options: {
        preset: config.preset,
        ...config.options
      }
    });

    this._customModels = config.models || {};
    this._allModels = { ...COMMON_MODELS, ...this._customModels };
    this._initializePricing();
    this._initializeModelMappings();
  }

  /**
   * Initialize model pricing
   * @private
   */
  _initializePricing() {
    for (const [modelId, info] of Object.entries(this._allModels)) {
      this.setPricing(modelId, {
        inputPer1M: info.inputPer1M,
        outputPer1M: info.outputPer1M,
        cachedPer1M: info.inputPer1M * 0.5
      });
    }
  }

  /**
   * Initialize model mappings
   * @private
   */
  _initializeModelMappings() {
    // GPT aliases
    this.addModelMapping('gpt4o', 'gpt-4o');
    this.addModelMapping('gpt-4', 'gpt-4-turbo');
    this.addModelMapping('gpt4', 'gpt-4-turbo');
    this.addModelMapping('gpt-3.5', 'gpt-3.5-turbo');
    this.addModelMapping('gpt35', 'gpt-3.5-turbo');

    // Llama aliases
    this.addModelMapping('llama3', 'llama-3.1-70b');
    this.addModelMapping('llama-3', 'llama-3.1-70b');
    this.addModelMapping('llama-70b', 'llama-3.1-70b');
    this.addModelMapping('llama-8b', 'llama-3.1-8b');

    // Mistral aliases
    this.addModelMapping('mistral', 'mistral-large');
    this.addModelMapping('mixtral', 'mixtral-8x7b');

    // Gemini aliases
    this.addModelMapping('gemini', 'gemini-1.5-pro');
    this.addModelMapping('gemini-pro', 'gemini-1.5-pro');
    this.addModelMapping('gemini-flash', 'gemini-1.5-flash');
  }

  /**
   * Add custom model
   * @param {string} modelId - Model ID
   * @param {Object} info - Model info
   */
  addModel(modelId, info) {
    this._customModels[modelId] = info;
    this._allModels[modelId] = info;
    this.setPricing(modelId, {
      inputPer1M: info.inputPer1M,
      outputPer1M: info.outputPer1M,
      cachedPer1M: info.inputPer1M * 0.5
    });
  }

  /**
   * Check if model is supported
   * @param {string} modelId
   * @returns {boolean}
   */
  supportsModel(modelId) {
    const mapped = this.mapModel(modelId);
    return this._allModels.hasOwnProperty(mapped) ||
           this._allModels.hasOwnProperty(modelId) ||
           modelId.includes('/'); // OpenRouter format: provider/model
  }

  /**
   * Get supported models
   * @returns {Array<Object>}
   */
  getSupportedModels() {
    return Object.entries(this._allModels).map(([id, info]) => ({
      id,
      name: info.name,
      provider: this.id,
      contextWindow: info.contextWindow,
      pricing: {
        inputPer1M: info.inputPer1M,
        outputPer1M: info.outputPer1M
      }
    }));
  }

  /**
   * Build request headers
   * @param {Object} [additionalHeaders]
   * @returns {Object}
   */
  buildHeaders(additionalHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.headers,
      ...additionalHeaders
    };

    // Add provider-specific headers
    const preset = this.options.preset;
    if (preset === 'openrouter') {
      headers['HTTP-Referer'] = 'https://dragon-ui.app';
      headers['X-Title'] = 'Dragon-UI';
    }

    return headers;
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

    // Add optional parameters if present
    if (request.top_p !== undefined) payload.top_p = request.top_p;
    if (request.frequency_penalty !== undefined) payload.frequency_penalty = request.frequency_penalty;
    if (request.presence_penalty !== undefined) payload.presence_penalty = request.presence_penalty;
    if (request.stop) payload.stop = request.stop;

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
        throw new Error(`API error: ${response.status} - ${error}`);
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
      stream: true,
      stream_options: { include_usage: true }
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
        throw new Error(`API error: ${response.status} - ${error}`);
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
      cachedTokens: usage.prompt_tokens_details?.cached_tokens || 0,
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
      headers
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  }

  /**
   * Fetch available models from API
   * @returns {Promise<Array>}
   */
  async fetchModels() {
    try {
      const url = this.buildUrl('/models');
      const headers = this.buildHeaders();

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || data.models || [];

    } catch (error) {
      console.error('Failed to fetch models:', error.message);
      return [];
    }
  }
}

/**
 * Create OpenAI-compatible provider instance
 * @param {Object} config
 * @returns {OpenAICompatibleProvider}
 */
function createOpenAICompatibleProvider(config) {
  return new OpenAICompatibleProvider(config);
}

/**
 * Create provider from preset
 * @param {string} preset - Preset name
 * @param {Object} config - Additional config
 * @returns {OpenAICompatibleProvider}
 */
function createFromPreset(preset, config) {
  if (!PROVIDER_PRESETS[preset]) {
    throw new Error(`Unknown preset: ${preset}`);
  }
  return new OpenAICompatibleProvider({
    ...config,
    preset
  });
}

module.exports = {
  OpenAICompatibleProvider,
  createOpenAICompatibleProvider,
  createFromPreset,
  COMMON_MODELS,
  PROVIDER_PRESETS
};
