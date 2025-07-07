/**
 * CLI Color Management (CommonJS)
 * Handles colored output with fallback to monochrome
 */

let chalk;
let useColors = true;
let initialized = false;

// Dynamic import of chalk (ESM module)
async function initChalk() {
  if (!initialized) {
    try {
      chalk = (await import('chalk')).default;
    } catch (error) {
      // Fallback if chalk is not available - create mock chalk object
      chalk = {
        red: (text) => text,
        green: (text) => text,
        yellow: (text) => text,
        blue: (text) => text,
        magenta: (text) => text,
        cyan: (text) => text,
        white: (text) => text,
        gray: (text) => text,
        bold: (text) => text,
        dim: (text) => text,
        hex: () => (text) => text
      };
      // Add chaining support for fallback
      Object.keys(chalk).forEach(color => {
        chalk[color].bold = chalk.bold;
        chalk[color].dim = chalk.dim;
        chalk.bold[color] = chalk[color];
      });
    }
    initialized = true;
  }
  return chalk;
}

function setColorMode(enabled) {
  useColors = enabled;
}

function getColorMode() {
  return useColors;
}

// Create color functions that work synchronously after initialization
function createColors() {
  return {
    // Primary colors
    primary: (text) => useColors && chalk ? chalk.hex('#ff4444')(text) : text,
    secondary: (text) => useColors && chalk ? chalk.hex('#ff6666')(text) : text,
    accent: (text) => useColors && chalk ? chalk.hex('#ff8888')(text) : text,
    
    // Status colors
    success: (text) => useColors && chalk ? chalk.green(text) : text,
    warning: (text) => useColors && chalk ? chalk.yellow(text) : text,
    error: (text) => useColors && chalk ? chalk.red(text) : text,
    info: (text) => useColors && chalk ? chalk.blue(text) : text,
    
    // UI colors
    header: (text) => useColors && chalk ? chalk.bold.hex('#ff4444')(text) : text,
    title: (text) => useColors && chalk ? chalk.bold.white(text) : text,
    subtitle: (text) => useColors && chalk ? chalk.gray(text) : text,
    highlight: (text) => useColors && chalk ? chalk.bold.hex('#ff6666')(text) : text,
    
    // Data colors
    currency: (text) => useColors && chalk ? chalk.green.bold(text) : text,
    number: (text) => useColors && chalk ? chalk.cyan(text) : text,
    date: (text) => useColors && chalk ? chalk.gray(text) : text,
    active: (text) => useColors && chalk ? chalk.hex('#00ff00')(text) : text,
    inactive: (text) => useColors && chalk ? chalk.gray(text) : text,
    
    // Table colors
    tableHeader: (text) => useColors && chalk ? chalk.bold.hex('#ff4444')(text) : text,
    tableRow: (text) => useColors && chalk ? chalk.white(text) : text,
    tableAlt: (text) => useColors && chalk ? chalk.gray(text) : text,
  };
}

// Initialize colors object
const colors = createColors();

// Helper functions
function colorize(text, color) {
  if (!useColors || !chalk) return text;
  return colors[color] ? colors[color](text) : text;
}

function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number') amount = 0;
  const formatted = amount.toFixed(6);
  return colors.currency(`$${formatted} ${currency}`);
}

function formatNumber(num) {
  if (typeof num !== 'number') num = 0;
  return colors.number(num.toLocaleString());
}

function formatDate(dateStr) {
  if (!dateStr) return colors.inactive('Never');
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffHours < 1) {
      return colors.active('Just now');
    } else if (diffHours < 24) {
      return colors.date(`${Math.floor(diffHours)}h ago`);
    } else if (diffDays < 7) {
      return colors.date(`${Math.floor(diffDays)}d ago`);
    } else {
      return colors.date(date.toLocaleDateString());
    }
  } catch (error) {
    return colors.inactive('Invalid date');
  }
}

function formatPercentage(value, total) {
  if (!total || total === 0) return colors.number('0.0%');
  const percentage = ((value / total) * 100).toFixed(1);
  return colors.number(`${percentage}%`);
}

// Progress bar creator
function createProgressBar(current, total, width = 30) {
  if (!chalk) return '='.repeat(width);
  
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const filledBar = useColors ? chalk.green('█'.repeat(filled)) : '█'.repeat(filled);
  const emptyBar = useColors ? chalk.gray('░'.repeat(empty)) : '░'.repeat(empty);
  
  return filledBar + emptyBar;
}

// Export everything with proper async initialization
module.exports = {
  initChalk,
  colors,
  setColorMode,
  getColorMode,
  colorize,
  formatCurrency,
  formatNumber,
  formatDate,
  formatPercentage,
  createProgressBar
};