/**
 * Quick Wins Utilities for Dragon-UI
 * Consolidated Phase 9 enhancements
 *
 * @module cli/utils/quick-wins
 */

'use strict';

// Re-export all Phase 9 utilities
const terminalUtils = require('./terminal-utils.cjs');
const modelAliases = require('./model-aliases.cjs');
const currencyFormatter = require('./currency-formatter.cjs');
const compactMode = require('./compact-mode.cjs');

/**
 * Format duration as HH:MM:SS
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDurationHMS(ms) {
  if (!ms || ms < 0) return '00:00:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => n.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format duration as human-readable (Xh Ym Zs)
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDurationHuman(ms) {
  if (!ms || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format duration for compact display
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
function formatDurationCompact(ms) {
  if (!ms || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${totalSeconds % 60}s`;
}

/**
 * Calculate session duration from start time
 * @param {Date|string|number} startTime
 * @returns {{ms: number, formatted: string, hms: string}}
 */
function calculateSessionDuration(startTime) {
  if (!startTime) {
    return { ms: 0, formatted: '0s', hms: '00:00:00' };
  }

  const start = new Date(startTime);
  const now = new Date();
  const ms = now.getTime() - start.getTime();

  return {
    ms,
    formatted: formatDurationHuman(ms),
    hms: formatDurationHMS(ms)
  };
}

/**
 * Parse git diff shortstat output
 * @param {string} stat - Output from `git diff --shortstat`
 * @returns {{files: number, insertions: number, deletions: number}}
 */
function parseGitDiffStat(stat) {
  if (!stat) {
    return { files: 0, insertions: 0, deletions: 0 };
  }

  const filesMatch = stat.match(/(\d+) files? changed/);
  const insertionsMatch = stat.match(/(\d+) insertions?\(\+\)/);
  const deletionsMatch = stat.match(/(\d+) deletions?\(-\)/);

  return {
    files: filesMatch ? parseInt(filesMatch[1], 10) : 0,
    insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
    deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0
  };
}

/**
 * Format git changes as +X, -Y
 * @param {Object} stats - Parsed git stats
 * @returns {string}
 */
function formatGitChanges(stats) {
  const { insertions, deletions } = stats;

  if (insertions === 0 && deletions === 0) {
    return '';
  }

  return `+${insertions}, -${deletions}`;
}

/**
 * Execute git command and parse diff stat
 * @param {string} cwd - Working directory
 * @returns {{staged: Object, unstaged: Object, total: Object, formatted: string}}
 */
function getGitChanges(cwd = process.cwd()) {
  const { execSync } = require('child_process');

  const execGit = (cmd) => {
    try {
      return execSync(cmd, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 3000,
        cwd
      }).trim();
    } catch {
      return '';
    }
  };

  const unstagedStat = execGit('git diff --shortstat');
  const stagedStat = execGit('git diff --cached --shortstat');

  const unstaged = parseGitDiffStat(unstagedStat);
  const staged = parseGitDiffStat(stagedStat);

  const total = {
    files: unstaged.files + staged.files,
    insertions: unstaged.insertions + staged.insertions,
    deletions: unstaged.deletions + staged.deletions
  };

  return {
    staged,
    unstaged,
    total,
    formatted: formatGitChanges(total)
  };
}

/**
 * Get comprehensive terminal info
 * @returns {Object}
 */
function getTerminalInfo() {
  return {
    width: terminalUtils.getTerminalWidth(),
    height: terminalUtils.getTerminalHeight(),
    breakpoint: terminalUtils.getBreakpoint(),
    isTTY: terminalUtils.isTTY(),
    colorLevel: terminalUtils.getColorLevel(),
    supportsColor: terminalUtils.supportsColor()
  };
}

/**
 * Quick wins helper - apply all compact mode adjustments
 * @param {Object} options - CLI options
 * @returns {Object}
 */
function applyQuickWins(options = {}) {
  // Apply compact mode if specified
  if (options.compact) {
    compactMode.enableCompactMode();
  }

  // Expand model aliases
  if (options.model) {
    options.model = modelAliases.expandAlias(options.model);
  }

  // Set currency if specified
  if (options.currency) {
    currencyFormatter.setDefaultCurrency(options.currency);
  }

  return {
    ...options,
    terminalWidth: terminalUtils.getTerminalWidth(),
    isCompact: compactMode.isCompactMode(),
    currency: currencyFormatter.getDefaultCurrency()
  };
}

/**
 * Format value based on context
 * @param {any} value
 * @param {string} type
 * @param {Object} options
 * @returns {string}
 */
function formatValue(value, type, options = {}) {
  switch (type) {
    case 'cost':
      return currencyFormatter.formatCost(value, options.currency);

    case 'currency':
      return currencyFormatter.formatCurrency(value, options.currency);

    case 'duration':
      return options.hms ? formatDurationHMS(value) : formatDurationHuman(value);

    case 'model':
      return options.short
        ? modelAliases.getShortName(value)
        : modelAliases.getDisplayName(value);

    case 'tokens':
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return String(value);

    default:
      return String(value);
  }
}

/**
 * Create responsive table columns
 * @param {Object[]} baseColumns
 * @returns {Object[]}
 */
function createResponsiveColumns(baseColumns) {
  const width = terminalUtils.getTerminalWidth();
  const isCompact = compactMode.isCompactMode();

  return baseColumns.map(col => {
    let colWidth = col.width;

    // Apply compact mode reduction
    if (isCompact && colWidth) {
      colWidth = Math.round(colWidth * 0.7);
    }

    // Hide columns that won't fit
    if (col.minWidth && width < col.minWidth) {
      return { ...col, hidden: true };
    }

    return { ...col, width: colWidth };
  }).filter(col => !col.hidden);
}

module.exports = {
  // Duration formatting
  formatDurationHMS,
  formatDurationHuman,
  formatDurationCompact,
  calculateSessionDuration,

  // Git changes
  parseGitDiffStat,
  formatGitChanges,
  getGitChanges,

  // Terminal utilities
  getTerminalInfo,

  // Quick wins helpers
  applyQuickWins,
  formatValue,
  createResponsiveColumns,

  // Re-exports
  terminalUtils,
  modelAliases,
  currencyFormatter,
  compactMode
};
