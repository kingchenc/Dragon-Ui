/**
 * CLI Formatting Utilities (CommonJS)
 * Handles currency, numbers, dates, and other formatting
 */

const { colors } = require('./colors.cjs');

/**
 * Format currency with proper locale and color
 */
function formatCurrency(amount, currency = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return colors.inactive('$0.00');
  }
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(amount);
  
  return colors.currency(formatted);
}

/**
 * Format numbers with K/M suffixes
 */
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return colors.inactive('0');
  }
  
  if (num >= 1000000) {
    return colors.number((num / 1000000).toFixed(1) + 'M');
  } else if (num >= 1000) {
    return colors.number((num / 1000).toFixed(1) + 'K');
  }
  return colors.number(num.toLocaleString());
}

/**
 * Format dates with relative time
 */
function formatDate(date, options = {}) {
  if (!date) return colors.inactive('Never');
  
  const { relative = true, showTime = false } = options;
  const now = new Date();
  const target = new Date(date);
  
  if (isNaN(target.getTime())) {
    return colors.inactive('Invalid');
  }
  
  if (relative) {
    const diff = now - target;
    
    if (diff < 60000) { // Less than 1 minute
      return colors.active('just now');
    } else if (diff < 3600000) { // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return colors.date(`${minutes}m ago`);
    } else if (diff < 86400000) { // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return colors.date(`${hours}h ago`);
    } else if (diff < 604800000) { // Less than 1 week
      const days = Math.floor(diff / 86400000);
      return colors.date(`${days}d ago`);
    } else if (diff < 2592000000) { // Less than 1 month
      const weeks = Math.floor(diff / 604800000);
      return colors.date(`${weeks}w ago`);
    } else {
      return colors.date(target.toLocaleDateString());
    }
  } else {
    const dateStr = target.toLocaleDateString();
    const timeStr = showTime ? ' ' + target.toLocaleTimeString() : '';
    return colors.date(dateStr + timeStr);
  }
}

/**
 * Format duration in milliseconds
 */
function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds < 0) {
    return colors.inactive('0s');
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return colors.number(`${days}d ${hours % 24}h`);
  } else if (hours > 0) {
    return colors.number(`${hours}h ${minutes % 60}m`);
  } else if (minutes > 0) {
    return colors.number(`${minutes}m ${seconds % 60}s`);
  } else {
    return colors.number(`${seconds}s`);
  }
}

/**
 * Format percentage
 */
function formatPercentage(value, total) {
  if (!total || total === 0) {
    return colors.inactive('0%');
  }
  
  const percentage = (value / total) * 100;
  return colors.number(percentage.toFixed(1) + '%');
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (!bytes || bytes < 0) {
    return colors.inactive('0 B');
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return colors.number(size.toFixed(1) + ' ' + units[unitIndex]);
}

/**
 * Format model name
 */
function formatModel(model) {
  if (!model) return colors.inactive('Unknown');
  
  // Common model name mappings
  const modelNames = {
    'claude-3-5-sonnet-20241022': 'Sonnet 3.5',
    'claude-3-5-sonnet-20240620': 'Sonnet 3.5',
    'claude-3-opus-20240229': 'Opus 3',
    'claude-3-sonnet-20240229': 'Sonnet 3',
    'claude-3-haiku-20240307': 'Haiku 3',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-3.5-turbo': 'GPT-3.5'
  };
  
  return colors.highlight(modelNames[model] || model);
}

/**
 * Format session ID
 */
function formatSessionId(sessionId) {
  if (!sessionId) return colors.inactive('N/A');
  
  // Show first 8 characters
  const short = sessionId.substring(0, 8);
  return colors.number(short + '...');
}

/**
 * Format project name
 */
function formatProject(project) {
  if (!project) return colors.inactive('Unknown');
  
  // Clean up project paths
  const cleaned = project.replace(/\\/g, '/');
  const parts = cleaned.split('/');
  const name = parts[parts.length - 1] || parts[parts.length - 2] || project;
  
  return colors.highlight(name);
}

/**
 * Format status indicator
 */
function formatStatus(status) {
  switch (status?.toLowerCase()) {
    case 'active':
      return colors.active('● Active');
    case 'idle':
      return colors.warning('○ Idle');
    case 'offline':
      return colors.inactive('○ Offline');
    default:
      return colors.inactive('○ Unknown');
  }
}

/**
 * Create a centered header
 */
function createHeader(text, width = 80) {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  const paddedText = ' '.repeat(padding) + text + ' '.repeat(padding);
  
  return colors.header('═'.repeat(width) + '\n' + paddedText + '\n' + '═'.repeat(width));
}

/**
 * Create a section divider
 */
function createDivider(title, width = 80) {
  const titleLength = title.length;
  const leftPadding = Math.max(0, Math.floor((width - titleLength - 4) / 2));
  const rightPadding = Math.max(0, width - titleLength - 4 - leftPadding);
  
  return colors.primary('─'.repeat(leftPadding) + '[ ' + title + ' ]' + '─'.repeat(rightPadding));
}

/**
 * Create a progress bar
 */
function createProgressBar(current, total, width = 20, options = {}) {
  const { showPercentage = true, showNumbers = false } = options;
  
  if (total === 0) {
    const bar = '[' + colors.inactive('░'.repeat(width)) + ']';
    return showPercentage ? bar + ' 0%' : bar;
  }
  
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = '[' + 
    colors.success('█'.repeat(filled)) + 
    colors.inactive('░'.repeat(empty)) + 
    ']';
  
  let suffix = '';
  if (showPercentage) {
    suffix += ' ' + colors.number(percentage.toFixed(1) + '%');
  }
  if (showNumbers) {
    suffix += ' ' + colors.number(`(${current}/${total})`);
  }
  
  return bar + suffix;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Pad text to specific width
 */
function padText(text, width, align = 'left') {
  if (!text) text = '';
  
  if (text.length >= width) {
    return text.substring(0, width);
  }
  
  const padding = width - text.length;
  
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
  formatCurrency,
  formatNumber,
  formatDate,
  formatDuration,
  formatPercentage,
  formatFileSize,
  formatModel,
  formatSessionId,
  formatProject,
  formatStatus,
  createHeader,
  createDivider,
  createProgressBar,
  truncate,
  padText
};