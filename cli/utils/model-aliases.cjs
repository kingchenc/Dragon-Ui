/**
 * Model Alias Expansion for Dragon-UI
 * Comprehensive Claude model aliases and version resolution
 *
 * @module cli/utils/model-aliases
 */

'use strict';

/**
 * Full model ID mapping
 * Maps all known aliases to their canonical model IDs
 */
const MODEL_ALIASES = {
  // Claude 3.5 Sonnet aliases
  'sonnet': 'claude-3-5-sonnet-20241022',
  'claude-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'sonnet-3.5': 'claude-3-5-sonnet-20241022',
  'sonnet-latest': 'claude-3-5-sonnet-20241022',
  '3.5-sonnet': 'claude-3-5-sonnet-20241022',
  '35-sonnet': 'claude-3-5-sonnet-20241022',

  // Claude 3.5 Haiku aliases
  'haiku': 'claude-3-5-haiku-20241022',
  'claude-haiku': 'claude-3-5-haiku-20241022',
  'claude-3-haiku': 'claude-3-5-haiku-20241022',
  'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
  'haiku-3.5': 'claude-3-5-haiku-20241022',
  'haiku-latest': 'claude-3-5-haiku-20241022',
  '3.5-haiku': 'claude-3-5-haiku-20241022',
  '35-haiku': 'claude-3-5-haiku-20241022',

  // Claude 3 Opus aliases
  'opus': 'claude-3-opus-20240229',
  'claude-opus': 'claude-3-opus-20240229',
  'claude-3-opus': 'claude-3-opus-20240229',
  'opus-3': 'claude-3-opus-20240229',
  '3-opus': 'claude-3-opus-20240229',

  // Claude 4 / Opus 4 aliases
  'claude-4': 'claude-sonnet-4-20250514',
  'claude4': 'claude-sonnet-4-20250514',
  'sonnet-4': 'claude-sonnet-4-20250514',
  'claude-opus-4': 'claude-opus-4-5-20251101',
  'opus-4': 'claude-opus-4-5-20251101',
  'opus-4.5': 'claude-opus-4-5-20251101',
  'claude-opus-4.5': 'claude-opus-4-5-20251101',

  // Generic aliases
  'claude-3': 'claude-3-5-sonnet-20241022',
  'claude3': 'claude-3-5-sonnet-20241022',
  'claude': 'claude-3-5-sonnet-20241022',
  'latest': 'claude-3-5-sonnet-20241022',
  'default': 'claude-3-5-sonnet-20241022',

  // Legacy Claude 3 models
  'claude-3-sonnet-legacy': 'claude-3-sonnet-20240229',
  'claude-3-haiku-legacy': 'claude-3-haiku-20240307',
  'sonnet-legacy': 'claude-3-sonnet-20240229',
  'haiku-legacy': 'claude-3-haiku-20240307',

  // Older Sonnet version
  'sonnet-june': 'claude-3-5-sonnet-20240620',
  'sonnet-0620': 'claude-3-5-sonnet-20240620',
  'claude-3-5-sonnet-june': 'claude-3-5-sonnet-20240620'
};

/**
 * Model family groupings
 */
const MODEL_FAMILIES = {
  'sonnet': [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-sonnet-20240229',
    'claude-sonnet-4-20250514'
  ],
  'haiku': [
    'claude-3-5-haiku-20241022',
    'claude-3-haiku-20240307'
  ],
  'opus': [
    'claude-3-opus-20240229',
    'claude-opus-4-5-20251101'
  ]
};

/**
 * Display names for models
 */
const MODEL_DISPLAY_NAMES = {
  'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
  'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet (June)',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-opus-20240229': 'Claude 3 Opus',
  'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5'
};

/**
 * Short names for models (for statusline)
 */
const MODEL_SHORT_NAMES = {
  'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
  'claude-3-5-sonnet-20240620': 'Sonnet 3.5',
  'claude-3-5-haiku-20241022': 'Haiku 3.5',
  'claude-3-opus-20240229': 'Opus 3',
  'claude-3-sonnet-20240229': 'Sonnet 3',
  'claude-3-haiku-20240307': 'Haiku 3',
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-5-20251101': 'Opus 4.5'
};

/**
 * Model icons/emojis
 */
const MODEL_ICONS = {
  'claude-3-5-sonnet-20241022': '🎵',
  'claude-3-5-sonnet-20240620': '🎵',
  'claude-3-5-haiku-20241022': '🌸',
  'claude-3-opus-20240229': '🎭',
  'claude-3-sonnet-20240229': '🎵',
  'claude-3-haiku-20240307': '🌸',
  'claude-sonnet-4-20250514': '🎵',
  'claude-opus-4-5-20251101': '🎭'
};

/**
 * Expand model alias to full model ID
 * @param {string} alias
 * @returns {string}
 */
function expandAlias(alias) {
  if (!alias) return null;

  const normalized = alias.toLowerCase().trim();

  // Direct alias match
  if (MODEL_ALIASES[normalized]) {
    return MODEL_ALIASES[normalized];
  }

  // Check if already a full model ID
  const allModelIds = new Set(Object.values(MODEL_ALIASES));
  if (allModelIds.has(alias)) {
    return alias;
  }

  // Partial match - try to find best match
  for (const [key, value] of Object.entries(MODEL_ALIASES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Return original if no match found
  return alias;
}

/**
 * Get display name for model
 * @param {string} modelId
 * @returns {string}
 */
function getDisplayName(modelId) {
  const expanded = expandAlias(modelId);
  return MODEL_DISPLAY_NAMES[expanded] || modelId;
}

/**
 * Get short name for model
 * @param {string} modelId
 * @returns {string}
 */
function getShortName(modelId) {
  const expanded = expandAlias(modelId);
  return MODEL_SHORT_NAMES[expanded] || extractShortName(modelId);
}

/**
 * Extract short name from model ID
 * @param {string} modelId
 * @returns {string}
 */
function extractShortName(modelId) {
  if (!modelId) return 'Unknown';

  // Try to extract model family and version
  const patterns = [
    /claude-(\d+(?:\.\d+)?)-?(\w+)/i,
    /claude-(\w+)-(\d+(?:\.\d+)?)/i,
    /(\w+)-(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of patterns) {
    const match = modelId.match(pattern);
    if (match) {
      const family = match[2] || match[1];
      const version = match[1] || match[2];
      return `${family.charAt(0).toUpperCase() + family.slice(1)} ${version}`;
    }
  }

  return modelId.split('-').slice(0, 2).join(' ');
}

/**
 * Get icon for model
 * @param {string} modelId
 * @returns {string}
 */
function getIcon(modelId) {
  const expanded = expandAlias(modelId);
  return MODEL_ICONS[expanded] || '🤖';
}

/**
 * Get model family
 * @param {string} modelId
 * @returns {string|null}
 */
function getFamily(modelId) {
  const expanded = expandAlias(modelId);

  for (const [family, models] of Object.entries(MODEL_FAMILIES)) {
    if (models.includes(expanded)) {
      return family;
    }
  }

  // Try to extract from model ID
  if (expanded.includes('sonnet')) return 'sonnet';
  if (expanded.includes('haiku')) return 'haiku';
  if (expanded.includes('opus')) return 'opus';

  return null;
}

/**
 * Check if model is a specific family
 * @param {string} modelId
 * @param {string} family
 * @returns {boolean}
 */
function isFamily(modelId, family) {
  return getFamily(modelId) === family.toLowerCase();
}

/**
 * Get all aliases for a model
 * @param {string} modelId
 * @returns {string[]}
 */
function getAliases(modelId) {
  const expanded = expandAlias(modelId);
  const aliases = [];

  for (const [alias, target] of Object.entries(MODEL_ALIASES)) {
    if (target === expanded) {
      aliases.push(alias);
    }
  }

  return aliases;
}

/**
 * Get all known model IDs
 * @returns {string[]}
 */
function getAllModels() {
  return [...new Set(Object.values(MODEL_ALIASES))];
}

/**
 * Get all known aliases
 * @returns {string[]}
 */
function getAllAliases() {
  return Object.keys(MODEL_ALIASES);
}

/**
 * Check if alias is valid
 * @param {string} alias
 * @returns {boolean}
 */
function isValidAlias(alias) {
  if (!alias) return false;
  const normalized = alias.toLowerCase().trim();
  return MODEL_ALIASES.hasOwnProperty(normalized);
}

/**
 * Compare two model IDs (check if they're the same model)
 * @param {string} model1
 * @param {string} model2
 * @returns {boolean}
 */
function isSameModel(model1, model2) {
  return expandAlias(model1) === expandAlias(model2);
}

/**
 * Format model for display with icon
 * @param {string} modelId
 * @param {Object} options
 * @returns {string}
 */
function formatModel(modelId, options = {}) {
  const showIcon = options.showIcon !== false;
  const useShortName = options.short === true;

  const name = useShortName ? getShortName(modelId) : getDisplayName(modelId);
  const icon = showIcon ? getIcon(modelId) : '';

  return icon ? `${icon} ${name}` : name;
}

/**
 * Search models by query
 * @param {string} query
 * @returns {Object[]}
 */
function searchModels(query) {
  const lowerQuery = query.toLowerCase();
  const results = [];

  for (const [alias, modelId] of Object.entries(MODEL_ALIASES)) {
    if (alias.includes(lowerQuery) || modelId.includes(lowerQuery)) {
      const existing = results.find(r => r.modelId === modelId);
      if (!existing) {
        results.push({
          modelId,
          displayName: getDisplayName(modelId),
          shortName: getShortName(modelId),
          family: getFamily(modelId),
          aliases: getAliases(modelId)
        });
      }
    }
  }

  return results;
}

module.exports = {
  MODEL_ALIASES,
  MODEL_FAMILIES,
  MODEL_DISPLAY_NAMES,
  MODEL_SHORT_NAMES,
  MODEL_ICONS,
  expandAlias,
  getDisplayName,
  getShortName,
  extractShortName,
  getIcon,
  getFamily,
  isFamily,
  getAliases,
  getAllModels,
  getAllAliases,
  isValidAlias,
  isSameModel,
  formatModel,
  searchModels
};
