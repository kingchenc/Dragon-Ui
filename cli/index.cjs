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
const { loadSettings } = require('./settings.cjs');
const { initChalk } = require('./components/colors.cjs');
const { clearScreen } = require('./utils/screen.cjs');

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