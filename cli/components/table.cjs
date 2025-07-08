/**
 * CLI Table Component (CommonJS)
 * Handles both ASCII and minimal table styles
 */

const Table = require('cli-table3');
const { colors } = require('./colors.cjs');

/**
 * Create a formatted table
 */
function createTable(headers, rows, options = {}) {
  const { style = 'ascii', compact = false } = options;
  
  if (style === 'minimal') {
    return createMinimalTable(headers, rows, compact);
  }
  
  return createAsciiTable(headers, rows, compact);
}

/**
 * Create ASCII table with borders
 */
function createAsciiTable(headers, rows, compact) {
  const table = new Table({
    head: headers.map(h => colors.tableHeader(h)),
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    },
    style: {
      'padding-left': compact ? 1 : 2,
      'padding-right': compact ? 1 : 2,
      head: [],
      border: []
    }
  });
  
  rows.forEach((row, index) => {
    const coloredRow = row.map(cell => {
      // Apply alternating row colors
      return index % 2 === 0 ? colors.tableRow(cell) : colors.tableAlt(cell);
    });
    table.push(coloredRow);
  });
  
  return table.toString();
}

/**
 * Create minimal table without borders
 */
function createMinimalTable(headers, rows, compact) {
  const padding = compact ? 1 : 2;
  const separator = ' '.repeat(padding);
  
  // Calculate column widths
  const widths = headers.map((header, index) => {
    const headerWidth = header.length;
    const maxRowWidth = Math.max(...rows.map(row => 
      (row[index] || '').toString().length
    ));
    return Math.max(headerWidth, maxRowWidth);
  });
  
  // Create header
  const headerRow = headers.map((header, index) => 
    colors.tableHeader(header.padEnd(widths[index]))
  ).join(separator);
  
  // Create separator line
  const separatorLine = widths.map(width => 
    colors.tableHeader('-'.repeat(width))
  ).join(separator);
  
  // Create rows
  const dataRows = rows.map((row, rowIndex) => {
    return row.map((cell, colIndex) => {
      const cellStr = (cell || '').toString();
      const colored = rowIndex % 2 === 0 ? 
        colors.tableRow(cellStr) : 
        colors.tableAlt(cellStr);
      return colored.padEnd(widths[colIndex] + (colors.tableRow('').length - cellStr.length));
    }).join(separator);
  });
  
  return [headerRow, separatorLine, ...dataRows].join('\n');
}

/**
 * Create a simple key-value table
 */
function createKeyValueTable(data, options = {}) {
  const { style = 'ascii', compact = false } = options;
  
  const rows = Object.entries(data).map(([key, value]) => [
    key,
    value !== null && value !== undefined ? value.toString() : 'N/A'
  ]);
  
  return createTable(['Property', 'Value'], rows, { style, compact });
}

/**
 * Create a stats summary table
 */
function createStatsTable(stats, options = {}) {
  const { style = 'ascii', compact = false } = options;
  
  const rows = [
    ['Total Cost', formatCurrency(stats.totalCost || 0, stats.currency)],
    ['Total Sessions', formatNumber(stats.totalSessions || 0)],
    ['Projects', formatNumber(stats.totalProjects || 0)],
    ['Total Tokens', formatNumber(stats.totalTokens || 0)],
    ['Active Days', formatNumber(stats.activeDays || 0)],
    ['Last Activity', formatDate(stats.lastActivity)]
  ];
  
  return createTable(['Metric', 'Value'], rows, { style, compact });
}

/**
 * Helper functions
 */
function formatCurrency(amount, currency = 'USD') {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(amount);
  
  return colors.currency(formatted);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return colors.number((num / 1000000).toFixed(1) + 'M');
  } else if (num >= 1000) {
    return colors.number((num / 1000).toFixed(1) + 'K');
  }
  return colors.number(num.toString());
}

function formatDate(date) {
  if (!date) return colors.inactive('Never');
  
  const now = new Date();
  const target = new Date(date);
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
  } else {
    return colors.date(target.toLocaleDateString());
  }
}

function formatDuration(milliseconds) {
  if (!milliseconds) return colors.inactive('0s');
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return colors.number(`${hours}h ${minutes % 60}m`);
  } else if (minutes > 0) {
    return colors.number(`${minutes}m ${seconds % 60}s`);
  } else {
    return colors.number(`${seconds}s`);
  }
}

module.exports = {
  createTable,
  createKeyValueTable,
  createStatsTable,
  createAsciiTable,
  createMinimalTable
};