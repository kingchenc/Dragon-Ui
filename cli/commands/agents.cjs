/**
 * Agent Detection CLI Commands
 * Commands for analyzing and tracking agent/tool usage
 */

const { agentDetector, AGENT_TYPES, TOOL_CATEGORIES } = require('../../services/agent-detector.cjs');
const path = require('path');
const fs = require('fs');

// Dynamic chalk import
let chalk = null;
async function getChalk() {
  if (!chalk) {
    try {
      chalk = (await import('chalk')).default;
    } catch {
      const identity = (text) => text;
      chalk = {
        bold: identity, gray: identity, cyan: identity,
        green: identity, yellow: identity, red: identity, white: identity,
        magenta: identity, blue: identity, hex: () => identity
      };
      Object.keys(chalk).forEach(key => {
        if (typeof chalk[key] === 'function') {
          chalk[key].bold = identity;
          chalk.bold[key] = identity;
        }
      });
    }
  }
  return chalk;
}

/**
 * Detect agent usage in a string or file
 */
async function detect(input, options = {}) {
  const chalk = await getChalk();

  if (!input) {
    console.log(chalk.red('\nInput is required (string or file path)'));
    return;
  }

  let content = input;
  let isFile = false;

  // Check if input is a file path
  if (fs.existsSync(input)) {
    isFile = true;
    content = fs.readFileSync(input, 'utf8');
  }

  const result = agentDetector.detect(content);

  console.log(chalk.bold('\n=== Agent Detection Result ===\n'));

  if (isFile) {
    console.log(`  File:       ${chalk.cyan(input)}`);
  }

  console.log(`  Is Agent:   ${result.isAgentCall ? chalk.green('Yes') : chalk.gray('No')}`);
  console.log(`  Type:       ${chalk.yellow(result.agentType)}`);
  console.log(`  Confidence: ${getConfidenceColor(chalk, result.metadata.confidence)}${result.metadata.confidence}%`);

  if (result.tools.length > 0) {
    console.log();
    console.log(chalk.bold('  Tools Detected:'));
    for (const tool of result.tools) {
      console.log(`    - ${chalk.cyan(tool)}`);
    }
  }

  if (result.categories.length > 0) {
    console.log();
    console.log(chalk.bold('  Categories:'));
    for (const category of result.categories) {
      console.log(`    - ${chalk.magenta(category)}`);
    }
  }

  if (options.verbose && result.metadata.patterns.length > 0) {
    console.log();
    console.log(chalk.bold('  Patterns Matched:'));
    for (const pattern of result.metadata.patterns) {
      console.log(`    - ${chalk.gray(pattern)}`);
    }
  }

  console.log();
}

/**
 * Get color based on confidence level
 */
function getConfidenceColor(chalk, confidence) {
  if (confidence >= 80) return chalk.green;
  if (confidence >= 50) return chalk.yellow;
  return chalk.red;
}

/**
 * Analyze a JSONL file for agent usage
 */
async function analyzeFile(filePath) {
  const chalk = await getChalk();

  if (!filePath) {
    console.log(chalk.red('\nFile path is required'));
    return;
  }

  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`\nFile not found: ${filePath}`));
    return;
  }

  console.log(chalk.bold('\n=== Analyzing File for Agent Usage ===\n'));
  console.log(`  File: ${chalk.cyan(filePath)}`);
  console.log('  Analyzing...\n');

  const results = await agentDetector.analyzeFile(filePath);

  console.log(chalk.bold('  Summary:'));
  console.log(`    Total Entries:  ${results.totalEntries}`);
  console.log(`    Agent Calls:    ${chalk.green(results.agentCalls)}`);
  console.log(`    Percentage:     ${((results.agentCalls / results.totalEntries) * 100).toFixed(1)}%`);

  if (Object.keys(results.byType).length > 0) {
    console.log();
    console.log(chalk.bold('  By Type:'));
    for (const [type, count] of Object.entries(results.byType)) {
      const percentage = ((count / results.agentCalls) * 100).toFixed(1);
      console.log(`    ${type.padEnd(20)} ${String(count).padStart(5)} (${percentage}%)`);
    }
  }

  if (Object.keys(results.byTool).length > 0) {
    console.log();
    console.log(chalk.bold('  Top Tools:'));
    const topTools = Object.entries(results.byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [tool, count] of topTools) {
      console.log(`    ${chalk.cyan(tool.padEnd(25))} ${count}`);
    }
  }

  if (Object.keys(results.byCategory).length > 0) {
    console.log();
    console.log(chalk.bold('  By Category:'));
    for (const [category, count] of Object.entries(results.byCategory)) {
      console.log(`    ${chalk.magenta(category.padEnd(15))} ${count}`);
    }
  }

  console.log();
}

/**
 * Show agent detection statistics
 */
async function showStats() {
  const chalk = await getChalk();
  const stats = agentDetector.getStats();

  console.log(chalk.bold('\n=== Agent Detection Statistics ===\n'));

  console.log(`  Total Detections:  ${stats.totalDetections}`);
  console.log(`  Cache Size:        ${stats.cacheSize}`);
  console.log(`  Last Updated:      ${stats.lastUpdated || 'Never'}`);

  if (Object.keys(stats.byType).length > 0) {
    console.log();
    console.log(chalk.bold('  By Type:'));
    const typeDistribution = agentDetector.getTypeDistribution();
    for (const { type, count, percentage } of typeDistribution) {
      console.log(`    ${type.padEnd(20)} ${String(count).padStart(5)} (${percentage}%)`);
    }
  }

  if (Object.keys(stats.byTool).length > 0) {
    console.log();
    console.log(chalk.bold('  Top Tools:'));
    const topTools = agentDetector.getTopTools(10);
    for (const { tool, count } of topTools) {
      console.log(`    ${chalk.cyan(tool.padEnd(25))} ${count}`);
    }
  }

  if (Object.keys(stats.byCategory).length > 0) {
    console.log();
    console.log(chalk.bold('  By Category:'));
    for (const [category, count] of Object.entries(stats.byCategory)) {
      console.log(`    ${chalk.magenta(category.padEnd(15))} ${count}`);
    }
  }

  const sessionCount = Object.keys(stats.sessions).length;
  if (sessionCount > 0) {
    console.log();
    console.log(chalk.bold(`  Sessions Tracked: ${sessionCount}`));
  }

  console.log();
}

/**
 * Show session statistics
 */
async function showSession(sessionId) {
  const chalk = await getChalk();

  if (!sessionId) {
    // List all sessions
    const stats = agentDetector.getStats();
    const sessions = Object.entries(stats.sessions);

    if (sessions.length === 0) {
      console.log(chalk.gray('\nNo sessions tracked'));
      return;
    }

    console.log(chalk.bold('\n=== Tracked Sessions ===\n'));

    for (const [id, session] of sessions) {
      const truncatedId = id.length > 20 ? id.substring(0, 20) + '...' : id;
      console.log(`  ${chalk.cyan(truncatedId.padEnd(25))} ${session.totalCalls} calls`);
    }

    console.log();
    return;
  }

  const session = agentDetector.getSessionStats(sessionId);

  if (!session) {
    console.log(chalk.red(`\nSession not found: ${sessionId}`));
    return;
  }

  console.log(chalk.bold(`\n=== Session: ${sessionId} ===\n`));

  console.log(`  Total Calls:   ${session.totalCalls}`);
  console.log(`  Start Time:    ${session.startTime}`);
  console.log(`  Last Call:     ${session.lastCall || 'N/A'}`);

  if (Object.keys(session.byType).length > 0) {
    console.log();
    console.log(chalk.bold('  By Type:'));
    for (const [type, count] of Object.entries(session.byType)) {
      console.log(`    ${type.padEnd(20)} ${count}`);
    }
  }

  if (Object.keys(session.byTool).length > 0) {
    console.log();
    console.log(chalk.bold('  Tools Used:'));
    for (const [tool, count] of Object.entries(session.byTool)) {
      console.log(`    ${chalk.cyan(tool.padEnd(25))} ${count}`);
    }
  }

  console.log();
}

/**
 * List agent types
 */
async function listTypes() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Agent Types ===\n'));

  for (const [key, value] of Object.entries(AGENT_TYPES)) {
    console.log(`  ${chalk.cyan(key.padEnd(20))} ${value}`);
  }

  console.log();
}

/**
 * List tool categories
 */
async function listCategories() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Tool Categories ===\n'));

  for (const [category, patterns] of Object.entries(TOOL_CATEGORIES)) {
    console.log(`  ${chalk.magenta(category)}`);
    console.log(`    Patterns: ${chalk.gray(patterns.join(', '))}`);
    console.log();
  }
}

/**
 * Clear detection cache
 */
async function clearCache() {
  const chalk = await getChalk();
  agentDetector.clearCache();
  console.log(chalk.green('\nDetection cache cleared'));
}

/**
 * Reset statistics
 */
async function resetStats() {
  const chalk = await getChalk();
  agentDetector.resetStats();
  console.log(chalk.yellow('\nStatistics reset'));
}

/**
 * Show help
 */
async function showHelp() {
  const chalk = await getChalk();

  console.log(chalk.bold('\n=== Agent Detection Commands ===\n'));

  console.log('  dragon-ui-claude-cli agents detect <input> [--verbose]');
  console.log(chalk.gray('    Detect agent/tool usage in a string or file\n'));

  console.log('  dragon-ui-claude-cli agents analyze <file>');
  console.log(chalk.gray('    Analyze a JSONL file for agent usage\n'));

  console.log('  dragon-ui-claude-cli agents stats');
  console.log(chalk.gray('    Show overall detection statistics\n'));

  console.log('  dragon-ui-claude-cli agents session [id]');
  console.log(chalk.gray('    Show session statistics (list all if no ID)\n'));

  console.log('  dragon-ui-claude-cli agents types');
  console.log(chalk.gray('    List all agent types\n'));

  console.log('  dragon-ui-claude-cli agents categories');
  console.log(chalk.gray('    List all tool categories\n'));

  console.log('  dragon-ui-claude-cli agents clear-cache');
  console.log(chalk.gray('    Clear the detection cache\n'));

  console.log('  dragon-ui-claude-cli agents reset');
  console.log(chalk.gray('    Reset all statistics\n'));

  console.log(chalk.bold('Agent Types:\n'));
  for (const type of Object.values(AGENT_TYPES)) {
    console.log(`  - ${type}`);
  }

  console.log();
}

module.exports = {
  detect,
  analyzeFile,
  showStats,
  showSession,
  listTypes,
  listCategories,
  clearCache,
  resetStats,
  showHelp
};
