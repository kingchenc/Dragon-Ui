/**
 * Model Widget
 * Displays the current Claude model name
 */

const { Widget } = require('./widget-base.cjs');

class ModelWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'model',
      name: 'Model',
      description: 'Displays the current Claude model name',
      color: { fg: 'cyan', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const model = data.model || data.currentModel || 'unknown';

    // Shorten model name if configured
    if (this.metadata.short) {
      return this.shortenModelName(model);
    }

    return model;
  }

  shortenModelName(model) {
    // Common shortenings
    const shortenings = {
      'claude-opus-4.5': 'opus-4.5',
      'claude-sonnet-4.5': 'sonnet-4.5',
      'claude-haiku-4.5': 'haiku-4.5',
      'claude-sonnet-4': 'sonnet-4',
      'claude-opus-4': 'opus-4',
      'claude-3.5-sonnet': 'sonnet-3.5',
      'claude-3.5-haiku': 'haiku-3.5',
      'claude-3-opus': 'opus-3',
      'claude-3-sonnet': 'sonnet-3',
      'claude-3-haiku': 'haiku-3',
      'gpt-5-codex': 'codex',
      'gpt-4o-mini': 'gpt-4o-m'
    };

    return shortenings[model.toLowerCase()] || model;
  }
}

module.exports = ModelWidget;
