#!/usr/bin/env node

/**
 * Dragon UI CLI Entry Point (CommonJS version for Windows compatibility)
 * Supports both dragon-ui-claude-cli and dragon-ui-claude --cli
 */

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { startCLI } = require('./dashboard.cjs');
const { loadSettings } = require('./settings.cjs');
const { initChalk } = require('./components/colors.cjs');

// Get version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

// Load settings from external module
async function main() {
  // Clear screen immediately when CLI starts
  console.clear();
  
  // Initialize chalk first
  await initChalk();
  
  const settings = await loadSettings();
  
  program
    .name('dragon-ui-claude-cli')
    .description('🐲 Dragon UI CLI - Claude Code Max Usage Dashboard')
    .version(version)
    .option('-c, --cli', 'Start CLI mode (for dragon-ui-claude --cli compatibility)')
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

  // Handle dragon-ui-claude --cli
  if (process.argv.includes('--cli')) {
    // Clear screen for --cli flag usage too
    console.clear();
    const settings = await loadSettings();
    await startCLI(settings);
  } else {
    program.parse();
  }
}

// Start the application
main().catch(error => {
  console.error('Error starting Dragon UI CLI:', error.message);
  process.exit(1);
});