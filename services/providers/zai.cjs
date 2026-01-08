'use strict';

/**
 * z.ai Provider
 * Claude proxy with higher rate limits
 * API-compatible with Anthropic, but with enhanced limits
 */

const { BaseProvider, ProviderType, ProviderStatus } = require('./base-provider.cjs');

const ZAI_MODELS = {
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    inputPer1M: 3.0,
    outputPer1M: 15.0
  },
  'claude-3-5-haiku-20241022': {
    name: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    inputPer1M: 0.8,
    outputPer1M: 4.0
  },
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    contextWindow: 200000,
    inputPer1M: 15.0,
    outputPer1M: 75.0
  },
  'claude-sonnet-4-20250514': {
    name: 'Claude Sonnet 4',
    contextWindow: 200000,
    inputPer1M: 3.0,
    outputPer1M: 15.0
  },
  'claude-opus-4-20250514': {
    name: 'Claude Opus 4',
    contextWindow: 200000,
    inputPer1M: 15.0,
    outputPer1M: 75.0
  }
};

class ZaiProvider extends BaseProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - z.ai API key
   * @param {string} [config.baseUrl] - Base URL (default: https://api.z.ai/v1)
   */
  constructor(config) {
    super({
      id: config.id || 'zai',
      name: config.name || 'z.ai (Claude Proxy)',
      type: ProviderType.ZAI,
      baseUrl: config.baseUrl || 'https://api.z.ai/v1',
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
    for (const [modelId, info] of Object.entries(ZAI_MODELS)) {
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
    this.addModelMapping('claude-3.5-sonnet', 'claude-3-5-sonnet-20241022');
    this.addModelMapping('claude-3.5-haiku', 'claude-3-5-haiku-20241022');
    this.addModelMapping('claude-3-opus', 'claude-3-opus-20240229');
    this.addModelMapping('sonnet', 'claude-3-5-sonnet-20241022');
    this.addModelMapping('haiku', 'claude-3-5-haiku-20241022');
    this.addModelMapping('opus', 'claude-3-opus-20240229');
    this.addModelMapping('claude-sonnet-4', 'claude-sonnet-4-20250514');
    this.addModelMapping('claude-opus-4', 'claude-opus-4-20250514');
  }

  /**
   * Check if model is supported
   * @param {string} modelId
   * @returns {boolean}
   */
  supportsModel(modelId) {
    const mapped = this.mapModel(modelId);
    return ZAI_MODELS.hasOwnProperty(mapped) ||
           ZAI_MODELS.hasOwnProperty(modelId) ||
           modelId.startsWith('claude-');
  }

  /**
   * Get supported models
   * @returns {Array<Object>}
   */
  getSupportedModels() {
    return Object.entries(ZAI_MODELS).map(([id, info]) => ({
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
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
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
    const url = this.buildUrl('/messages');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);

    const payload = this._buildAnthropicPayload(request, mappedModel);

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
        throw new Error(`z.ai API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const usage = this.parseUsage(data);
      const cost = this.calculateCost(mappedModel, {
        input: usage.inputTokens,
        output: usage.outputTokens,
        cached: usage.cachedTokens
      });

      this.recordSuccess(usage, cost);

      return this._convertToOpenAIFormat(data, mappedModel, usage, cost);

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
    const url = this.buildUrl('/messages');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);

    const payload = {
      ...this._buildAnthropicPayload(request, mappedModel),
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
        throw new Error(`z.ai API error: ${response.status} - ${error}`);
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
              const event = JSON.parse(data);

              if (event.type === 'message_start' && event.message?.usage) {
                totalUsage.inputTokens = event.message.usage.input_tokens || 0;
              }

              if (event.type === 'message_delta' && event.usage) {
                totalUsage.outputTokens = event.usage.output_tokens || 0;
              }

              if (event.type === 'content_block_delta') {
                yield {
                  id: `zai-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  model: mappedModel,
                  choices: [{
                    index: 0,
                    delta: {
                      content: event.delta?.text || ''
                    },
                    finish_reason: null
                  }],
                  _provider: this.id
                };
              }

              if (event.type === 'message_stop') {
                yield {
                  id: `zai-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  model: mappedModel,
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop'
                  }],
                  _provider: this.id
                };
              }

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
   * Build Anthropic-format payload
   * @private
   */
  _buildAnthropicPayload(request, model) {
    const messages = [];
    let system = null;

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    return {
      model,
      messages,
      system,
      max_tokens: request.max_tokens || 4096,
      temperature: request.temperature
    };
  }

  /**
   * Convert Anthropic response to OpenAI format
   * @private
   */
  _convertToOpenAIFormat(data, model, usage, cost) {
    return {
      id: data.id,
      object: 'chat.completion',
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: data.content?.[0]?.text || ''
        },
        finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason
      }],
      usage: {
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
        total_tokens: usage.inputTokens + usage.outputTokens
      },
      _provider: this.id,
      _usage: usage,
      _cost: cost
    };
  }

  /**
   * Parse usage from response
   * @param {Object} response
   * @returns {Object}
   */
  parseUsage(response) {
    const usage = response.usage || {};
    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cachedTokens: usage.cache_read_input_tokens || 0,
      model: response.model
    };
  }

  /**
   * Perform health check
   * @protected
   */
  async _performHealthCheck() {
    const url = this.buildUrl('/messages');
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });

    if (!response.ok && response.status !== 400) {
      throw new Error(`Health check failed: ${response.status}`);
    }
  }
}

/**
 * Create z.ai provider instance
 * @param {Object} config
 * @returns {ZaiProvider}
 */
function createZaiProvider(config) {
  return new ZaiProvider(config);
}

module.exports = {
  ZaiProvider,
  createZaiProvider,
  ZAI_MODELS
};
