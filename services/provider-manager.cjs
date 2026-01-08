/**
 * Provider Manager
 * Multi-provider support for AI model providers
 * Handles provider configuration, API key management, and provider-specific settings
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Provider configuration
 * @typedef {Object} ProviderConfig
 * @property {string} id - Provider identifier
 * @property {string} name - Display name
 * @property {string} apiKeyEnvVar - Environment variable for API key
 * @property {string} baseUrl - API base URL
 * @property {string[]} modelPrefixes - Model name prefixes for this provider
 * @property {boolean} enabled - Whether provider is enabled
 * @property {Object} settings - Provider-specific settings
 */

/**
 * Built-in provider definitions
 */
const PROVIDER_DEFINITIONS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    modelPrefixes: ['claude-'],
    docUrl: 'https://docs.anthropic.com/claude/reference',
    features: {
      streaming: true,
      caching: true,
      batching: true,
      vision: true,
      toolUse: true,
      extendedContext: true
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    modelPrefixes: ['gpt-', 'o1-', 'o3-', 'dall-e-', 'whisper-', 'tts-'],
    docUrl: 'https://platform.openai.com/docs/api-reference',
    features: {
      streaming: true,
      caching: false,
      batching: true,
      vision: true,
      toolUse: true,
      extendedContext: false
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  },

  google: {
    id: 'google',
    name: 'Google AI',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    modelPrefixes: ['gemini-', 'palm-'],
    docUrl: 'https://ai.google.dev/docs',
    features: {
      streaming: true,
      caching: true,
      batching: false,
      vision: true,
      toolUse: true,
      extendedContext: true
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  },

  zhipu: {
    id: 'zhipu',
    name: 'Zhipu AI',
    apiKeyEnvVar: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelPrefixes: ['glm-'],
    docUrl: 'https://open.bigmodel.cn/dev/howuse/introduction',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: true,
      toolUse: true,
      extendedContext: false
    },
    pricing: {
      currency: 'CNY',
      billingUnit: 'per_million_tokens'
    }
  },

  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    apiKeyEnvVar: 'AZURE_OPENAI_API_KEY',
    baseUrl: '', // Set per deployment
    modelPrefixes: ['gpt-'],
    docUrl: 'https://learn.microsoft.com/en-us/azure/ai-services/openai',
    features: {
      streaming: true,
      caching: false,
      batching: true,
      vision: true,
      toolUse: true,
      extendedContext: false
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    },
    requiresDeployment: true
  },

  bedrock: {
    id: 'bedrock',
    name: 'AWS Bedrock',
    apiKeyEnvVar: 'AWS_ACCESS_KEY_ID', // Uses AWS credentials
    baseUrl: '', // Set per region
    modelPrefixes: ['anthropic.claude-', 'amazon.', 'meta.llama-', 'ai21.', 'cohere.'],
    docUrl: 'https://docs.aws.amazon.com/bedrock',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: true,
      toolUse: true,
      extendedContext: true
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    },
    requiresRegion: true
  },

  vertex: {
    id: 'vertex',
    name: 'Google Vertex AI',
    apiKeyEnvVar: 'GOOGLE_APPLICATION_CREDENTIALS',
    baseUrl: '', // Set per project/region
    modelPrefixes: ['claude-', 'gemini-'],
    docUrl: 'https://cloud.google.com/vertex-ai/docs',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: true,
      toolUse: true,
      extendedContext: true
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    },
    requiresProject: true
  },

  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    apiKeyEnvVar: '', // No API key needed
    baseUrl: 'http://localhost:11434',
    modelPrefixes: ['llama-', 'mistral-', 'codellama-', 'phi-', 'qwen-'],
    docUrl: 'https://ollama.ai/docs',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: false,
      toolUse: false,
      extendedContext: false
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'free' // Local models are free
    },
    isLocal: true
  },

  together: {
    id: 'together',
    name: 'Together AI',
    apiKeyEnvVar: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    modelPrefixes: ['togethercomputer/', 'meta-llama/', 'mistralai/'],
    docUrl: 'https://docs.together.ai',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: false,
      toolUse: false,
      extendedContext: false
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  },

  groq: {
    id: 'groq',
    name: 'Groq',
    apiKeyEnvVar: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelPrefixes: ['llama-', 'mixtral-', 'gemma-'],
    docUrl: 'https://console.groq.com/docs',
    features: {
      streaming: true,
      caching: false,
      batching: false,
      vision: false,
      toolUse: true,
      extendedContext: false
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  },

  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    modelPrefixes: ['deepseek-'],
    docUrl: 'https://platform.deepseek.com/docs',
    features: {
      streaming: true,
      caching: true,
      batching: false,
      vision: false,
      toolUse: true,
      extendedContext: true
    },
    pricing: {
      currency: 'USD',
      billingUnit: 'per_million_tokens'
    }
  }
};

/**
 * Provider Manager Class
 */
class ProviderManager {
  constructor() {
    this.configFile = path.join(os.homedir(), '.dragon-ui-providers.json');
    this.providers = new Map();
    this.activeProvider = null;
    this.config = this.loadConfig();
    this.initializeProviders();
  }

  /**
   * Load provider configuration from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        return JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
      }
    } catch (error) {
      console.error('[Provider] Error loading config:', error.message);
    }

    return {
      activeProvider: 'anthropic',
      providers: {},
      customProviders: []
    };
  }

  /**
   * Save provider configuration to file
   */
  saveConfig() {
    try {
      // Serialize provider configurations
      const providerConfigs = {};
      for (const [id, provider] of this.providers) {
        providerConfigs[id] = {
          enabled: provider.enabled,
          settings: provider.settings,
          apiKeyConfigured: provider.hasApiKey()
        };
      }

      const config = {
        activeProvider: this.activeProvider?.id || 'anthropic',
        providers: providerConfigs,
        customProviders: this.config.customProviders || []
      };

      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('[Provider] Error saving config:', error.message);
      return false;
    }
  }

  /**
   * Initialize all providers
   */
  initializeProviders() {
    // Initialize built-in providers
    for (const [id, definition] of Object.entries(PROVIDER_DEFINITIONS)) {
      const savedConfig = this.config.providers?.[id] || {};
      this.providers.set(id, new Provider({
        ...definition,
        enabled: savedConfig.enabled !== false,
        settings: { ...definition.settings, ...savedConfig.settings }
      }));
    }

    // Initialize custom providers
    for (const customProvider of this.config.customProviders || []) {
      this.providers.set(customProvider.id, new Provider(customProvider));
    }

    // Set active provider
    const activeId = this.config.activeProvider || 'anthropic';
    this.activeProvider = this.providers.get(activeId) || this.providers.get('anthropic');
  }

  /**
   * Get provider by ID
   */
  getProvider(id) {
    return this.providers.get(id) || null;
  }

  /**
   * Get active provider
   */
  getActiveProvider() {
    return this.activeProvider;
  }

  /**
   * Set active provider
   */
  setActiveProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider not found: ${id}`);
    }

    this.activeProvider = provider;
    this.saveConfig();
    return provider;
  }

  /**
   * Get all providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders() {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  /**
   * Get providers with configured API keys
   */
  getConfiguredProviders() {
    return Array.from(this.providers.values()).filter(p => p.enabled && p.hasApiKey());
  }

  /**
   * Detect provider from model name
   */
  detectProviderFromModel(modelName) {
    if (!modelName) return this.activeProvider;

    const modelLower = modelName.toLowerCase();

    for (const provider of this.providers.values()) {
      for (const prefix of provider.modelPrefixes) {
        if (modelLower.includes(prefix.toLowerCase())) {
          return provider;
        }
      }
    }

    // Check for provider/model format
    if (modelName.includes('/')) {
      const [providerPart] = modelName.split('/');
      const provider = this.providers.get(providerPart.toLowerCase());
      if (provider) return provider;
    }

    return this.activeProvider;
  }

  /**
   * Enable provider
   */
  enableProvider(id) {
    const provider = this.providers.get(id);
    if (provider) {
      provider.enabled = true;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Disable provider
   */
  disableProvider(id) {
    const provider = this.providers.get(id);
    if (provider) {
      provider.enabled = false;
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Update provider settings
   */
  updateProviderSettings(id, settings) {
    const provider = this.providers.get(id);
    if (provider) {
      provider.settings = { ...provider.settings, ...settings };
      this.saveConfig();
      return true;
    }
    return false;
  }

  /**
   * Add custom provider
   */
  addCustomProvider(providerConfig) {
    if (this.providers.has(providerConfig.id)) {
      throw new Error(`Provider already exists: ${providerConfig.id}`);
    }

    const provider = new Provider({
      ...providerConfig,
      isCustom: true
    });

    this.providers.set(providerConfig.id, provider);

    if (!this.config.customProviders) {
      this.config.customProviders = [];
    }
    this.config.customProviders.push(providerConfig);

    this.saveConfig();
    return provider;
  }

  /**
   * Remove custom provider
   */
  removeCustomProvider(id) {
    const provider = this.providers.get(id);
    if (!provider || !provider.isCustom) {
      throw new Error(`Cannot remove built-in provider: ${id}`);
    }

    this.providers.delete(id);
    this.config.customProviders = (this.config.customProviders || []).filter(p => p.id !== id);
    this.saveConfig();
    return true;
  }

  /**
   * Get provider statistics
   */
  getProviderStats() {
    const stats = {
      total: this.providers.size,
      enabled: 0,
      configured: 0,
      custom: 0,
      providers: []
    };

    for (const provider of this.providers.values()) {
      const providerInfo = {
        id: provider.id,
        name: provider.name,
        enabled: provider.enabled,
        hasApiKey: provider.hasApiKey(),
        isCustom: provider.isCustom || false
      };

      stats.providers.push(providerInfo);

      if (provider.enabled) stats.enabled++;
      if (provider.hasApiKey()) stats.configured++;
      if (provider.isCustom) stats.custom++;
    }

    return stats;
  }

  /**
   * Validate API key for provider
   */
  async validateApiKey(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      return { valid: false, error: 'Provider not found' };
    }

    return await provider.validateApiKey();
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      return { status: 'unknown', error: 'Provider not found' };
    }

    return await provider.checkHealth();
  }
}

/**
 * Provider Class
 */
class Provider {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.apiKeyEnvVar = config.apiKeyEnvVar || '';
    this.baseUrl = config.baseUrl || '';
    this.modelPrefixes = config.modelPrefixes || [];
    this.docUrl = config.docUrl || '';
    this.features = config.features || {};
    this.pricing = config.pricing || { currency: 'USD', billingUnit: 'per_million_tokens' };
    this.enabled = config.enabled !== false;
    this.settings = config.settings || {};
    this.isCustom = config.isCustom || false;
    this.isLocal = config.isLocal || false;
    this.requiresDeployment = config.requiresDeployment || false;
    this.requiresRegion = config.requiresRegion || false;
    this.requiresProject = config.requiresProject || false;
  }

  /**
   * Check if API key is configured
   */
  hasApiKey() {
    if (this.isLocal) return true; // Local providers don't need API keys
    if (!this.apiKeyEnvVar) return false;

    const apiKey = process.env[this.apiKeyEnvVar] || this.settings.apiKey;
    return !!apiKey && apiKey.length > 0;
  }

  /**
   * Get API key
   */
  getApiKey() {
    if (this.isLocal) return null;
    return process.env[this.apiKeyEnvVar] || this.settings.apiKey || null;
  }

  /**
   * Set API key in settings (not environment)
   */
  setApiKey(apiKey) {
    this.settings.apiKey = apiKey;
  }

  /**
   * Get base URL
   */
  getBaseUrl() {
    return this.settings.baseUrl || this.baseUrl;
  }

  /**
   * Check if provider supports a feature
   */
  supportsFeature(feature) {
    return this.features[feature] === true;
  }

  /**
   * Validate API key
   */
  async validateApiKey() {
    if (this.isLocal) {
      return { valid: true, message: 'Local provider does not require API key' };
    }

    if (!this.hasApiKey()) {
      return { valid: false, error: 'API key not configured' };
    }

    // Provider-specific validation would go here
    // For now, just check if key exists and has minimum length
    const apiKey = this.getApiKey();
    if (apiKey.length < 10) {
      return { valid: false, error: 'API key appears to be invalid (too short)' };
    }

    return { valid: true, message: 'API key configured' };
  }

  /**
   * Check provider health
   */
  async checkHealth() {
    if (!this.enabled) {
      return { status: 'disabled', message: 'Provider is disabled' };
    }

    if (!this.hasApiKey() && !this.isLocal) {
      return { status: 'unconfigured', message: 'API key not configured' };
    }

    // For local providers, check if service is running
    if (this.isLocal) {
      try {
        const https = require('https');
        const http = require('http');
        const url = new URL(this.getBaseUrl());
        const protocol = url.protocol === 'https:' ? https : http;

        return new Promise((resolve) => {
          const req = protocol.get(`${this.getBaseUrl()}/api/tags`, { timeout: 5000 }, (res) => {
            if (res.statusCode === 200) {
              resolve({ status: 'healthy', message: 'Service is running' });
            } else {
              resolve({ status: 'degraded', message: `Service returned ${res.statusCode}` });
            }
          });

          req.on('error', () => {
            resolve({ status: 'offline', message: 'Service not reachable' });
          });

          req.on('timeout', () => {
            req.destroy();
            resolve({ status: 'timeout', message: 'Connection timeout' });
          });
        });
      } catch (error) {
        return { status: 'error', message: error.message };
      }
    }

    return { status: 'configured', message: 'API key configured' };
  }

  /**
   * Get provider info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      hasApiKey: this.hasApiKey(),
      baseUrl: this.getBaseUrl(),
      features: this.features,
      pricing: this.pricing,
      modelPrefixes: this.modelPrefixes,
      docUrl: this.docUrl,
      isCustom: this.isCustom,
      isLocal: this.isLocal
    };
  }
}

// Export singleton instance
const providerManager = new ProviderManager();

module.exports = {
  ProviderManager,
  Provider,
  providerManager,
  PROVIDER_DEFINITIONS
};
