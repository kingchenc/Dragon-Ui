/**
 * Tokens Widget
 * Displays token counts (input, output, total, or cached)
 */

const { Widget } = require('./widget-base.cjs');

class TokensInputWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'tokens-input',
      name: 'Input Tokens',
      description: 'Displays input token count',
      color: { fg: 'blue', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const tokens = data.tokensIn || data.inputTokens || 0;
    const label = this.metadata.showLabel ? 'In: ' : '';
    return `${label}${this.formatTokens(tokens)}`;
  }
}

class TokensOutputWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'tokens-output',
      name: 'Output Tokens',
      description: 'Displays output token count',
      color: { fg: 'magenta', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const tokens = data.tokensOut || data.outputTokens || 0;
    const label = this.metadata.showLabel ? 'Out: ' : '';
    return `${label}${this.formatTokens(tokens)}`;
  }
}

class TokensTotalWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'tokens-total',
      name: 'Total Tokens',
      description: 'Displays total token count',
      color: { fg: 'yellow', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const total = data.tokensTotal || data.totalTokens ||
                  ((data.tokensIn || 0) + (data.tokensOut || 0));
    const label = this.metadata.showLabel ? 'Tokens: ' : '';
    const icon = this.metadata.showIcon ? '📊 ' : '';
    return `${icon}${label}${this.formatTokens(total)}`;
  }
}

class TokensCachedWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'tokens-cached',
      name: 'Cached Tokens',
      description: 'Displays cached token count',
      color: { fg: 'gray', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const cached = data.tokensCached || data.cachedTokens || 0;
    if (cached === 0 && !this.metadata.showZero) return '';
    const label = this.metadata.showLabel ? 'Cached: ' : '';
    return `${label}${this.formatTokens(cached)}`;
  }
}

module.exports = {
  TokensInputWidget,
  TokensOutputWidget,
  TokensTotalWidget,
  TokensCachedWidget
};
