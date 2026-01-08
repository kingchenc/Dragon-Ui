'use strict';

/**
 * Provider Index
 * Exports all provider implementations and utilities
 */

const { BaseProvider, ProviderFactory, ProviderStatus, ProviderType, getProviderFactory } = require('./base-provider.cjs');
const { NanoGPTProvider, createNanoGPTProvider, NANOGPT_MODELS } = require('./nanogpt.cjs');
const { MinimaxProvider, createMinimaxProvider, MINIMAX_MODELS } = require('./minimax.cjs');
const { ZaiProvider, createZaiProvider, ZAI_MODELS } = require('./zai.cjs');
const { OpenAICompatibleProvider, createOpenAICompatibleProvider, createFromPreset, COMMON_MODELS, PROVIDER_PRESETS } = require('./openai-compatible.cjs');

/**
 * Initialize provider factory with all providers
 */
function initializeProviderFactory() {
  const factory = getProviderFactory();

  factory.register(ProviderType.NANOGPT, createNanoGPTProvider);
  factory.register(ProviderType.MINIMAX, createMinimaxProvider);
  factory.register(ProviderType.ZAI, createZaiProvider);
  factory.register(ProviderType.OPENAI_COMPATIBLE, createOpenAICompatibleProvider);

  return factory;
}

/**
 * Create provider from configuration
 * @param {Object} config - Provider configuration
 * @param {string} config.type - Provider type
 * @returns {BaseProvider}
 */
function createProvider(config) {
  const factory = getProviderFactory();

  if (!factory.hasType(config.type)) {
    initializeProviderFactory();
  }

  return factory.create(config.type, config);
}

/**
 * Get all supported models across all providers
 * @returns {Object} Map of model ID to model info
 */
function getAllModels() {
  return {
    ...NANOGPT_MODELS,
    ...MINIMAX_MODELS,
    ...ZAI_MODELS,
    ...COMMON_MODELS
  };
}

/**
 * Find provider type for a model
 * @param {string} modelId - Model ID
 * @returns {string|null} Provider type or null
 */
function findProviderForModel(modelId) {
  const normalizedId = modelId.toLowerCase();

  // Check NanoGPT models
  if (normalizedId.includes('glm') || normalizedId.includes('cogview')) {
    return ProviderType.NANOGPT;
  }

  // Check Minimax models
  if (normalizedId.includes('minimax') || normalizedId.includes('abab')) {
    return ProviderType.MINIMAX;
  }

  // Check z.ai (Claude) models
  if (normalizedId.includes('claude')) {
    return ProviderType.ZAI;
  }

  // Check OpenAI-compatible models
  if (normalizedId.includes('gpt') ||
      normalizedId.includes('llama') ||
      normalizedId.includes('mistral') ||
      normalizedId.includes('gemini') ||
      normalizedId.includes('deepseek') ||
      normalizedId.includes('qwen')) {
    return ProviderType.OPENAI_COMPATIBLE;
  }

  return null;
}

module.exports = {
  // Base classes
  BaseProvider,
  ProviderFactory,
  ProviderStatus,
  ProviderType,
  getProviderFactory,

  // Provider implementations
  NanoGPTProvider,
  MinimaxProvider,
  ZaiProvider,
  OpenAICompatibleProvider,

  // Factory functions
  createNanoGPTProvider,
  createMinimaxProvider,
  createZaiProvider,
  createOpenAICompatibleProvider,
  createFromPreset,
  createProvider,

  // Model constants
  NANOGPT_MODELS,
  MINIMAX_MODELS,
  ZAI_MODELS,
  COMMON_MODELS,
  PROVIDER_PRESETS,

  // Utilities
  initializeProviderFactory,
  getAllModels,
  findProviderForModel
};
