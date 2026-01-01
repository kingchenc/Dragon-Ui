/**
 * CLI Statusline Component
 * Renders configurable statusline in terminal
 */

const { colors } = require('./colors.cjs');
const { createBox } = require('../utils/screen.cjs');

class CLIStatusline {
  constructor(settings = {}) {
    this.settings = {
      style: settings.style || 'classic',
      lines: settings.lines || 1,
      useColors: settings.useColors !== false,
      useEmojis: settings.useEmojis !== false,
      compact: settings.compact || false,
      showElements: settings.showElements || ['model', 'branch', 'cwd', 'tokens'],
      ...settings
    };

    // Initialize with empty/default values - will be populated by updateData()
    this.data = {
      model: 'N/A',
      branch: 'N/A',
      version: '0.0.0',
      cwd: process.cwd().replace(/^.*[\\\/]/, ''),
      tokensIn: 0,
      tokensOut: 0,
      tokensCached: 0,
      tokensTotal: 0,
      context: '0k',
      session: '0m',
      cost: '$0.00'
    };

    this.stylePresets = {
      modern: {
        separator: ' │ ',
        prefix: '',
        suffix: '',
        border: true
      },
      classic: {
        separator: ' | ',
        prefix: '[',
        suffix: ']',
        border: false
      },
      minimal: {
        separator: ' | ',
        prefix: '',
        suffix: '',
        border: false
      },
      dragon: {
        separator: ' ⚡ ',
        prefix: '🐲 ',
        suffix: '',
        border: true
      }
    };
  }

  updateData(newData) {
    this.data = { ...this.data, ...newData };
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  formatTokens(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toString();
  }

  formatElement(elementId, label, value, emoji = '') {
    const preset = this.stylePresets[this.settings.style];
    const colorize = (text, color = 'white') => {
      if (!this.settings.useColors) return text;
      return colors[color] ? colors[color](text) : text;
    };

    const elementColors = {
      model: 'cyan',
      branch: 'magenta',
      version: 'blue',
      cwd: 'yellow',
      tokens: 'red',
      context: 'green',
      session: 'white',
      cost: 'magenta'
    };

    const color = elementColors[elementId] || 'white';
    const emojiStr = this.settings.useEmojis && emoji ? `${emoji} ` : '';

    if (this.settings.compact) {
      return colorize(`${emojiStr}${value}`, color);
    }

    return colorize(`${emojiStr}${label}: ${value}`, color);
  }

  renderLine(elements) {
    const preset = this.stylePresets[this.settings.style];
    const visibleElements = elements.filter(el => this.settings.showElements.includes(el.id));

    const elementStrings = visibleElements.map(el =>
      this.formatElement(el.id, el.label, el.value, el.emoji)
    );

    let line = elementStrings.join(preset.separator);

    if (preset.border) {
      const width = process.stdout.columns || 80;
      const padding = Math.max(0, width - line.length - 4);
      line = `│ ${line}${' '.repeat(padding)} │`;

      return [
        '┌' + '─'.repeat(width - 2) + '┐',
        line,
        '└' + '─'.repeat(width - 2) + '┘'
      ];
    }

    return [line];
  }

  render() {
    const lines = [];

    // Line 1: Model, Branch, Directory
    if (this.settings.lines >= 1) {
      const line1Elements = [
        { id: 'model', label: 'Model', value: this.data.model, emoji: this.settings.style === 'dragon' ? '🐲' : '' },
        { id: 'branch', label: 'Branch', value: `${this.data.branch} | v${this.data.version}`, emoji: this.settings.style === 'dragon' ? '⚡' : '⎇' },
        { id: 'cwd', label: 'cwd', value: this.data.cwd, emoji: this.settings.style === 'dragon' ? '📁' : '' }
      ];

      lines.push(...this.renderLine(line1Elements));
    }

    // Line 2: Tokens, Context, Session
    if (this.settings.lines >= 2) {
      const tokensValue = `In: ${this.formatTokens(this.data.tokensIn)} | Out: ${this.formatTokens(this.data.tokensOut)} | Total: ${this.formatTokens(this.data.tokensTotal)}`;
      const line2Elements = [
        { id: 'tokens', label: 'Tokens', value: tokensValue, emoji: this.settings.style === 'dragon' ? '💰' : '' },
        { id: 'context', label: 'Ctx', value: this.data.context, emoji: this.settings.style === 'dragon' ? '🧠' : '' },
        { id: 'session', label: 'Session', value: this.data.session, emoji: this.settings.style === 'dragon' ? '⏱️' : '' }
      ];

      lines.push(...this.renderLine(line2Elements));
    }

    // Line 3: Cost, Additional metrics
    if (this.settings.lines >= 3) {
      const line3Elements = [
        { id: 'cost', label: 'Cost', value: this.data.cost, emoji: this.settings.style === 'dragon' ? '💸' : '' }
      ];

      lines.push(...this.renderLine(line3Elements));
    }

    return lines.join('\n');
  }

  showHelp() {
    const helpText = `
${colors.cyan('Dragon UI CLI Statusline Configuration')}

${colors.yellow('Usage:')}
  dragon-ui-claude-cli --statusline [options]

${colors.yellow('Styles:')}
  modern     - Clean, minimalist design
  classic    - Traditional terminal style
  minimal    - Bare essentials
  dragon     - Dragon themed with emojis

${colors.yellow('Options:')}
  --style <name>     Set statusline style (modern|classic|minimal|dragon)
  --lines <number>   Number of lines (1-3)
  --no-color         Disable colors
  --no-emoji         Disable emojis
  --compact          Use compact display
  --elements <list>  Comma-separated elements to show
                     (model,branch,cwd,tokens,context,session,cost)

${colors.yellow('Examples:')}
  dragon-ui-claude-cli --statusline --style dragon --lines 2
  dragon-ui-claude-cli --statusline --compact --elements model,branch,cost
  dragon-ui-claude-cli --statusline --no-color --style classic
`;
    console.log(helpText);
  }
}

module.exports = CLIStatusline;