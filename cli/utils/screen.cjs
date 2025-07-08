/**
 * CLI Screen Management (CommonJS)
 * Handles screen size, updates, and layout
 */

const { colors } = require('../components/colors.cjs');

/**
 * Get terminal size
 */
function getTerminalSize() {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24
  };
}

/**
 * Clear screen completely
 */
function clearScreen() {
  // Windows terminals are problematic with ANSI codes, use console.clear()
  if (process.platform === 'win32') {
    console.clear();
    // Also try to reset cursor position after console.clear()
    process.stdout.write('\x1b[H');
  } else {
    process.stdout.write('\x1b[3J\x1b[2J\x1b[1;1H');
  }
}

/**
 * Clear current line
 */
function clearLine() {
  process.stdout.write('\x1b[2K\r');
}

/**
 * Move cursor to position
 */
function moveCursor(x, y) {
  process.stdout.write(`\x1b[${y};${x}H`);
}

/**
 * Hide cursor
 */
function hideCursor() {
  process.stdout.write('\x1b[?25l');
}

/**
 * Show cursor
 */
function showCursor() {
  process.stdout.write('\x1b[?25h');
}

/**
 * Create a centered line
 */
function centerText(text, width = null) {
  if (!width) {
    width = getTerminalSize().width;
  }
  
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Create a box around text
 */
function createBox(content, options = {}) {
  const {
    width = null,
    padding = 1,
    style = 'single',
    title = null,
    color = 'primary'
  } = options;
  
  const terminalWidth = getTerminalSize().width;
  const boxWidth = width || Math.min(terminalWidth - 4, 80);
  
  // Box drawing characters
  const chars = {
    single: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      topMid: '┬',
      bottomMid: '┴'
    },
    double: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
      topMid: '╦',
      bottomMid: '╩'
    },
    rounded: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
      topMid: '┬',
      bottomMid: '┴'
    }
  };
  
  const boxChars = chars[style] || chars.single;
  const colorFn = colors[color] || colors.primary;
  
  // Split content into lines
  const lines = content.split('\n');
  const contentWidth = boxWidth - 2 - (padding * 2);
  
  // Wrap long lines
  const wrappedLines = [];
  lines.forEach(line => {
    if (line.length <= contentWidth) {
      wrappedLines.push(line);
    } else {
      // Simple word wrapping
      const words = line.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        if ((currentLine + word).length <= contentWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            // Word is too long, truncate it
            wrappedLines.push(word.substring(0, contentWidth));
            currentLine = word.substring(contentWidth);
          }
        }
      });
      
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }
  });
  
  // Build box
  const result = [];
  
  // Top border
  if (title) {
    const titleLength = title.length;
    const leftPadding = Math.max(0, Math.floor((boxWidth - titleLength - 4) / 2));
    const rightPadding = Math.max(0, boxWidth - titleLength - 4 - leftPadding);
    
    result.push(colorFn(
      boxChars.topLeft + 
      boxChars.horizontal.repeat(leftPadding) + 
      '[ ' + title + ' ]' + 
      boxChars.horizontal.repeat(rightPadding) + 
      boxChars.topRight
    ));
  } else {
    result.push(colorFn(
      boxChars.topLeft + 
      boxChars.horizontal.repeat(boxWidth - 2) + 
      boxChars.topRight
    ));
  }
  
  // Content lines
  wrappedLines.forEach(line => {
    const paddedLine = ' '.repeat(padding) + line + ' '.repeat(contentWidth - line.length + padding);
    result.push(colorFn(boxChars.vertical) + paddedLine + colorFn(boxChars.vertical));
  });
  
  // Bottom border
  result.push(colorFn(
    boxChars.bottomLeft + 
    boxChars.horizontal.repeat(boxWidth - 2) + 
    boxChars.bottomRight
  ));
  
  return result.join('\n');
}

/**
 * Create a progress indicator
 */
function createProgressIndicator(current, total, width = 40) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return colors.success('█'.repeat(filled)) + colors.inactive('░'.repeat(empty));
}

/**
 * Create a status line
 */
function createStatusLine(items, width = null) {
  if (!width) {
    width = getTerminalSize().width;
  }
  
  const separator = ' | ';
  const content = items.join(separator);
  
  if (content.length <= width) {
    return content;
  }
  
  // Truncate if too long
  return content.substring(0, width - 3) + '...';
}

/**
 * Create a two-column layout
 */
function createTwoColumnLayout(left, right, width = null) {
  if (!width) {
    width = getTerminalSize().width;
  }
  
  const leftWidth = Math.floor(width / 2) - 2;
  const rightWidth = width - leftWidth - 4;
  
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  
  const maxLines = Math.max(leftLines.length, rightLines.length);
  const result = [];
  
  for (let i = 0; i < maxLines; i++) {
    const leftLine = (leftLines[i] || '').padEnd(leftWidth);
    const rightLine = (rightLines[i] || '').padEnd(rightWidth);
    
    result.push(leftLine + ' | ' + rightLine);
  }
  
  return result.join('\n');
}

/**
 * Create a header with timestamp
 */
function createTimestampHeader(title, width = null) {
  if (!width) {
    width = getTerminalSize().width;
  }
  
  const timestamp = new Date().toLocaleString();
  const titleLen = title.length;
  const timestampLen = timestamp.length;
  
  if (titleLen + timestampLen + 3 <= width) {
    const padding = width - titleLen - timestampLen;
    return colors.header(title) + ' '.repeat(padding) + colors.date(timestamp);
  } else {
    return colors.header(title);
  }
}

/**
 * Create a footer with navigation hints
 */
function createFooter(hints = [], width = null) {
  if (!width) {
    width = getTerminalSize().width;
  }
  
  const defaultHints = [
    '[0] Menu',
    '[q] Quit',
    '[r] Refresh',
    '[h] Help'
  ];
  
  const allHints = [...hints, ...defaultHints];
  const content = allHints.join('  ');
  
  if (content.length <= width) {
    return colors.subtitle(content);
  }
  
  // Show only essential hints if too long
  const essential = ['[0] Menu', '[q] Quit'];
  return colors.subtitle(essential.join('  '));
}

/**
 * Handle terminal resize
 */
function onResize(callback) {
  process.stdout.on('resize', callback);
}

/**
 * Get safe display width (accounting for potential color codes)
 */
function getSafeDisplayWidth(text) {
  // Remove ANSI escape codes to get actual text length
  return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/**
 * Pad text to fit terminal width
 */
function padToTerminalWidth(text, align = 'left') {
  const terminalWidth = getTerminalSize().width;
  const textLength = getSafeDisplayWidth(text);
  
  if (textLength >= terminalWidth) {
    return text;
  }
  
  const padding = terminalWidth - textLength;
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    default:
      return text + ' '.repeat(padding);
  }
}

module.exports = {
  getTerminalSize,
  clearScreen,
  clearLine,
  moveCursor,
  hideCursor,
  showCursor,
  centerText,
  createBox,
  createProgressIndicator,
  createStatusLine,
  createTwoColumnLayout,
  createTimestampHeader,
  createFooter,
  onResize,
  getSafeDisplayWidth,
  padToTerminalWidth
};