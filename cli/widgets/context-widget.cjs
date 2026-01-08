/**
 * Context Widget
 * Displays context window usage
 */

const { Widget } = require('./widget-base.cjs');
const { modelPriceService } = require('../../services/model-price-service.cjs');

class ContextLengthWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'context-length',
      name: 'Context Length',
      description: 'Displays context window usage (e.g., 45k / 200k)',
      color: { fg: 'cyan', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const used = data.contextUsed || data.context || data.tokensTotal || 0;
    const model = data.model || 'claude-sonnet-4.5';

    // Get context window from model price service
    const contextWindow = modelPriceService.getContextWindow(model);
    const max = contextWindow.usable;

    return modelPriceService.formatContextUsage(used, max);
  }
}

class ContextPercentWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'context-percent',
      name: 'Context Percentage',
      description: 'Displays context usage as percentage with color coding',
      color: { fg: 'cyan', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const used = data.contextUsed || data.context || data.tokensTotal || 0;
    const model = data.model || 'claude-sonnet-4.5';

    // Calculate usage
    const usage = modelPriceService.calculateContextUsage(used, model);
    const percent = usage.percentage.toFixed(1);

    // Color based on usage
    if (usage.status === 'critical') {
      this.color.fg = 'red';
    } else if (usage.status === 'warning') {
      this.color.fg = 'yellow';
    } else if (usage.status === 'moderate') {
      this.color.fg = 'brightYellow';
    } else {
      this.color.fg = 'green';
    }

    const icon = this.metadata.showIcon ? '📈 ' : '';
    return `${icon}${percent}%`;
  }
}

class ContextUsableWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'context-usable',
      name: 'Context Usable Percentage',
      description: 'Displays usage as percentage of usable context (80%)',
      color: { fg: 'cyan', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const used = data.contextUsed || data.context || data.tokensTotal || 0;
    const model = data.model || 'claude-sonnet-4.5';

    // Calculate usage against usable limit
    const usage = modelPriceService.calculateContextUsage(used, model, true);
    const percent = usage.percentage.toFixed(1);

    // Color based on status
    if (usage.status === 'critical') {
      this.color.fg = 'red';
    } else if (usage.status === 'warning') {
      this.color.fg = 'yellow';
    } else {
      this.color.fg = 'green';
    }

    return `${percent}% (of ${this.formatTokens(usage.max)})`;
  }
}

class ContextRemainingWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'context-remaining',
      name: 'Context Remaining',
      description: 'Displays remaining context tokens',
      color: { fg: 'brightCyan', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const used = data.contextUsed || data.context || data.tokensTotal || 0;
    const model = data.model || 'claude-sonnet-4.5';

    const remaining = modelPriceService.getRemainingContext(used, model);

    // Color based on remaining
    if (remaining < 10000) {
      this.color.fg = 'red';
    } else if (remaining < 30000) {
      this.color.fg = 'yellow';
    } else {
      this.color.fg = 'green';
    }

    const label = this.metadata.showLabel ? 'Remaining: ' : '';
    return `${label}${this.formatTokens(remaining)}`;
  }
}

module.exports = {
  ContextLengthWidget,
  ContextPercentWidget,
  ContextUsableWidget,
  ContextRemainingWidget
};
