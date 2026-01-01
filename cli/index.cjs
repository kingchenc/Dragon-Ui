#!/usr/bin/env node

/**
 * Dragon UI CLI Entry Point (CommonJS version for Windows compatibility)
 * Supports dragon-ui-claude-cli command
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startCLI } = require('./dashboard.cjs');
const { loadSettings, getStatuslineSettings, applyStatuslinePreset } = require('./settings.cjs');
const { initChalk } = require('./components/colors.cjs');
const { clearScreen } = require('./utils/screen.cjs');
const CLIStatusline = require('./components/statusline.cjs');
const CLIDataAdapter = require('./data-adapter.cjs');
const { startMCPServer } = require('../services/mcp-server.cjs');

// Get version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Load settings from external module
async function main() {
  // Clear screen immediately when CLI starts
  clearScreen();
  
  // Initialize chalk first
  await initChalk();
  
  const settings = await loadSettings();
  
  // Statusline command
  program
    .command('statusline')
    .description('Show or configure statusline')
    .option('-s, --style <style>', 'Statusline style (modern|classic|minimal|dragon)')
    .option('-l, --lines <number>', 'Number of lines (1-3)')
    .option('--no-color', 'Disable colors')
    .option('--no-emoji', 'Disable emojis')
    .option('--compact', 'Use compact display')
    .option('--elements <elements>', 'Comma-separated elements to show')
    .option('--preset <preset>', 'Apply preset (modern|classic|minimal|dragon) and save')
    .option('--help-config', 'Show configuration help')
    .action(async (options) => {
      if (options.helpConfig) {
        const statusline = new CLIStatusline();
        statusline.showHelp();
        return;
      }

      // Apply preset if specified (saves to settings)
      if (options.preset) {
        const result = applyStatuslinePreset(options.preset);
        if (result) {
          console.log(`Applied statusline preset: ${options.preset}`);
        }
        return;
      }

      // Load saved settings as defaults
      const savedSettings = getStatuslineSettings();

      // Create statusline with configured options (CLI overrides saved settings)
      const statuslineSettings = {
        style: options.style || savedSettings.style || 'dragon',
        lines: options.lines ? parseInt(options.lines) : (savedSettings.lines || 1),
        useColors: options.color !== false && savedSettings.useColors !== false,
        useEmojis: options.emoji !== false && savedSettings.useEmojis !== false,
        compact: options.compact || savedSettings.compact || false,
        showElements: options.elements
          ? options.elements.split(',').map(e => e.trim())
          : (savedSettings.showElements || ['model', 'branch', 'cwd', 'tokens', 'cost'])
      };

      const statusline = new CLIStatusline(statuslineSettings);

      // Load real data from database
      const dataAdapter = new CLIDataAdapter(settings);
      await dataAdapter.init();

      const activeData = await dataAdapter.getActiveData();
      const overviewData = await dataAdapter.getOverviewData();

      // Get current git branch
      let gitBranch = 'main';
      try {
        const { execSync } = require('child_process');
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
      } catch {
        gitBranch = 'N/A';
      }

      // Calculate session duration
      let sessionDuration = '0m';
      if (activeData.activeSession && activeData.activeSession.startTime) {
        const startTime = new Date(activeData.activeSession.startTime);
        const now = new Date();
        const diffMs = now - startTime;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins >= 60) {
          sessionDuration = `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
        } else {
          sessionDuration = `${diffMins}m`;
        }
      }

      // Format cost with currency symbol
      const formatCost = (cost) => {
        if (cost === 0) return '$0.00';
        return `$${cost.toFixed(2)}`;
      };

      // Build statusline data from real database values
      const statuslineData = {
        model: overviewData.models && overviewData.models.length > 0
          ? overviewData.models[0]
          : 'claude-sonnet-4',
        branch: gitBranch,
        version: version,
        cwd: path.basename(process.cwd()),
        tokensIn: activeData.activeSession ? activeData.activeSession.totalTokens : 0,
        tokensOut: activeData.activeSession ? Math.floor(activeData.activeSession.totalTokens * 0.07) : 0,
        tokensTotal: overviewData.totalTokens || 0,
        tokensCached: 0,
        context: `${((overviewData.totalTokens || 0) / 1000).toFixed(1)}k`,
        session: sessionDuration,
        cost: formatCost(activeData.activeSession ? activeData.activeSession.totalCost : overviewData.totalCost)
      };

      statusline.updateData(statuslineData);
      console.log(statusline.render());
    });

  // MCP Server command
  program
    .command('mcp-server')
    .description('Start the MCP server for Claude Desktop integration')
    .action(async () => {
      // Don't clear screen for MCP server - it uses stdio
      await startMCPServer();
    });

  // Main CLI command
  program
    .name('dragon-ui-claude-cli')
    .description('🐲 Dragon UI CLI - Claude Code Max Usage Dashboard')
    .version(version)
    .option('-c, --cli', 'Start CLI mode')
    .option('--no-color', 'Disable colors')
    .option('--minimal', 'Use minimal table style')
    .option('--refresh <seconds>', 'Auto-refresh interval in seconds', '30')
    .action(async (options) => {
      // Override settings with CLI options
      if (options.noColor) settings.useColors = false;
      if (options.minimal) settings.tableStyle = 'minimal';
      if (options.refresh) settings.refreshInterval = parseInt(options.refresh) * 1000;

      // Start CLI dashboard
      await startCLI(settings);
    });

  program.parse();
}

// Start the application
main().catch(error => {
  console.error('Error starting Dragon UI CLI:', error.message);
  process.exit(1);
});