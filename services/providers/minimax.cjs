'use strict';

/**
 * Minimax Provider
 * Supports MiniMax-M2 and other Minimax models
 */

const { BaseProvider, ProviderType, ProviderStatus } = require('./base-provider.cjs');

const MINIMAX_MODELS = {
  'minimax-m2': {
    name: 'MiniMax-M2',
    contextWindow: 128000,
    inputPer1M: 0.15,
    outputPer1M: 0.15
  },
  'minimax-m1': {
    name: 'MiniMax-M1',
    contextWindow: 64000,
    inputPer1M: 0.1,
    outputPer1M: 0.1
  },
  'abab6.5s-chat': {
    name: 'ABAB 6.5S Chat',
    contextWindow: 245760,
    inputPer1M: 0.17,
    outputPer1M: 0.17
  },
  'abab6.5t-chat': {
    name: 'ABAB 6.5T Chat',
    contextWindow: 8192,
    inputPer1M: 0.07,
    outputPer1M: 0.07
  },
  'abab6.5g-chat': {
    name: 'ABAB 6.5G Chat',
    contextWindow: 8192,
    inputPer1M: 0.07,
    outputPer1M: 0.07
  },
  'speech-01': {
    name: 'Speech-01 TTS',
    contextWindow: 4096,
    inputPer1M: 0.1,
    outputPer1M: 0.1,
    tts: true
  }
};

class MinimaxProvider extends BaseProvider {
  /**
   * @param {Object} config - Provider configuration
   * @param {string} config.apiKey - Minimax API key
   * @param {string} config.groupId - Minimax Group ID
   * @param {string} [config.baseUrl] - Base URL
   */
  constructor(config) {
    super({
      id: config.id || 'minimax',
      name: config.name || 'Minimax',
      type: ProviderType.MINIMAX,
      baseUrl: config.baseUrl || 'https://api.minimax.chat/v1',
      apiKey: config.apiKey,
      headers: config.headers || {},
      options: {
        groupId: config.groupId,
        ...config.options
      }
    });

    this.groupId = config.groupId;
    this._initializePricing();
    this._initializeModelMappings();
  }

  /**
   * Initialize model pricing
   * @private
   */
  _initializePricing() {
    for (const [modelId, info] of Object.entries(MINIMAX_MODELS)) {
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
    this.addModelMapping('m2', 'minimax-m2');
    this.addModelMapping('minimax', 'minimax-m2');
    this.addModelMapping('abab', 'abab6.5s-chat');
  }

  /**
   * Check if model is supported
   * @param {string} modelId
   * @returns {boolean}
   */
  supportsModel(modelId) {
    const mapped = this.mapModel(modelId);
    return MINIMAX_MODELS.hasOwnProperty(mapped) ||
           MINIMAX_MODELS.hasOwnProperty(modelId);
  }

  /**
   * Get supported models
   * @returns {Array<Object>}
   */
  getSupportedModels() {
    return Object.entries(MINIMAX_MODELS).map(([id, info]) => ({
      id,
      name: info.name,
      provider: this.id,
      contextWindow: info.contextWindow,
      pricing: {
        inputPer1M: info.inputPer1M,
        outputPer1M: info.outputPer1M
      },
      capabilities: {
        tts: info.tts || false
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
      ...this.headers,
      ...additionalHeaders
    };
  }

  /**
   * Build request URL with group ID
   * @param {string} endpoint
   * @returns {string}
   */
  buildUrl(endpoint) {
    const base = this.baseUrl.replace(/\/+$/, '');
    const path = endpoint.replace(/^\/+/, '');
    if (this.groupId) {
      return `${base}/${path}?GroupId=${this.groupId}`;
    }
    return `${base}/${path}`;
  }

  /**
   * Send chat completion request
   * @param {Object} request
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  async sendRequest(request, options = {}) {
    const url = this.buildUrl('/text/chatcompletion_v2');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);

    const payload = {
      model: mappedModel,
      messages: this._convertMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      tokens_to_generate: request.max_tokens || 4096,
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
        throw new Error(`Minimax API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      if (data.base_resp && data.base_resp.status_code !== 0) {
        throw new Error(`Minimax error: ${data.base_resp.status_msg}`);
      }

      const usage = this.parseUsage(data);
      const cost = this.calculateCost(mappedModel, {
        input: usage.inputTokens,
        output: usage.outputTokens,
        cached: usage.cachedTokens
      });

      this.recordSuccess(usage, cost);

      return {
        id: data.id || `minimax-${Date.now()}`,
        object: 'chat.completion',
        model: mappedModel,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: data.choices?.[0]?.messages?.[0]?.text ||
                     data.reply || ''
          },
          finish_reason: data.choices?.[0]?.finish_reason || 'stop'
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
    const url = this.buildUrl('/text/chatcompletion_v2');
    const headers = this.buildHeaders();

    const mappedModel = this.mapModel(request.model);

    const payload = {
      model: mappedModel,
      messages: this._convertMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      tokens_to_generate: request.max_tokens || 4096,
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
        throw new Error(`Minimax API error: ${response.status} - ${error}`);
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
                id: chunk.id || `minimax-${Date.now()}`,
                object: 'chat.completion.chunk',
                model: mappedModel,
                choices: [{
                  index: 0,
                  delta: {
                    content: chunk.choices?.[0]?.messages?.[0]?.text ||
                             chunk.delta?.content || ''
                  },
                  finish_reason: chunk.choices?.[0]?.finish_reason || null
                }],
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
   * Convert messages to Minimax format
   * @private
   */
  _convertMessages(messages) {
    return messages.map(msg => ({
      sender_type: msg.role === 'assistant' ? 'BOT' :
                   msg.role === 'system' ? 'SYSTEM' : 'USER',
      sender_name: msg.role === 'assistant' ? 'Bot' :
                   msg.role === 'system' ? 'System' : 'User',
      text: msg.content
    }));
  }

  /**
   * Parse usage from response
   * @param {Object} response
   * @returns {Object}
   */
  parseUsage(response) {
    const usage = response.usage || {};
    return {
      inputTokens: usage.prompt_tokens || usage.total_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cachedTokens: 0,
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
   * Validate configuration
   * @returns {Object}
   */
  validate() {
    const result = super.validate();

    if (!this.groupId) {
      result.errors.push('Group ID is required for Minimax');
      result.valid = false;
    }

    return result;
  }
}

/**
 * Create Minimax provider instance
 * @param {Object} config
 * @returns {MinimaxProvider}
 */
function createMinimaxProvider(config) {
  return new MinimaxProvider(config);
}

module.exports = {
  MinimaxProvider,
  createMinimaxProvider,
  MINIMAX_MODELS
};
