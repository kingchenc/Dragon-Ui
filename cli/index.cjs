#!/usr/bin/env node

/**
 * Dragon UI CLI Entry Point (CommonJS version for Windows compatibility)
 * Supports dragon-ui-claude-cli command
 */

// Global error handlers for unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`\nUnhandled promise rejection: ${message}`);
  if (process.env.DEBUG) {
    console.error('Promise:', promise);
    console.error('Reason:', reason);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`\nUncaught exception: ${error.message}`);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

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
const { configManager } = require('./config-manager.cjs');
const { showPricing, refreshPricing, detectModel, calculateCost, showCacheStats } = require('./commands/pricing.cjs');
const powerlineCmd = require('./commands/powerline.cjs');
const { startLiveDashboard, showLiveHelp } = require('./commands/live.cjs');
const customCommandsCmd = require('./commands/custom-commands.cjs');
const providersCmd = require('./commands/providers.cjs');
const agentsCmd = require('./commands/agents.cjs');
const migrateCmd = require('./commands/migrate.cjs');
const tuiCmd = require('./commands/tui.cjs');
const docsCmd = require('./commands/docs.cjs');
const apikeyCmd = require('./commands/apikey.cjs');
const widgetsCmd = require('./commands/widgets.cjs');
const oauthCmd = require('./commands/oauth.cjs');
const proxyCmd = require('./commands/proxy.cjs');
const weeklyCmd = require('./commands/weekly.cjs');
const codexCmd = require('./commands/codex.cjs');
const fontsCmd = require('./commands/fonts.cjs');
const installCmd = require('./commands/install.cjs');
const analyticsCmd = require('./commands/analytics.cjs');
const realtimeCmd = require('./commands/realtime.cjs');
const retentionCmd = require('./commands/retention.cjs');

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

  // Config command
  program
    .command('config')
    .description('Manage Dragon UI configuration')
    .argument('[action]', 'Action: init, show, path, help')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (action, options) => {
      switch (action) {
        case 'init':
          const result = configManager.initConfig();
          if (result.success) {
            console.log(`Configuration file created: ${result.path}`);
          } else {
            console.error(`Error: ${result.error}`);
            if (result.path) console.log(`Path: ${result.path}`);
          }
          break;

        case 'show':
          const config = configManager.loadConfig({ config: options.config });
          console.log('\nCurrent Configuration:');
          console.log(JSON.stringify(config, null, 2));
          const loadedPath = configManager.getLoadedConfigPath();
          if (loadedPath) {
            console.log(`\nLoaded from: ${loadedPath}`);
          } else {
            console.log('\nUsing default configuration');
          }
          break;

        case 'path':
          const foundPath = configManager.findConfig(options.config);
          if (foundPath) {
            console.log(`Config file: ${foundPath}`);
          } else {
            console.log('No configuration file found');
            console.log('Create one with: dragon-ui-claude-cli config init');
          }
          break;

        case 'help':
        default:
          configManager.showHelp();
          break;
      }
    });

  // Pricing command
  program
    .command('pricing')
    .description('Manage model pricing')
    .argument('[action]', 'Action: list, refresh, detect, calculate, stats')
    .option('-m, --model <model>', 'Model name for detect/calculate')
    .option('-i, --input <tokens>', 'Input tokens for calculate', '0')
    .option('-o, --output <tokens>', 'Output tokens for calculate', '0')
    .option('--cached <tokens>', 'Cached tokens for calculate', '0')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (action, options) => {
      switch (action) {
        case 'list':
        case 'show':
          showPricing({ verbose: options.verbose });
          break;

        case 'refresh':
          await refreshPricing();
          break;

        case 'detect':
          if (!options.model) {
            console.error('Error: --model is required for detect');
            console.log('Usage: dragon-ui-claude-cli pricing detect --model <model-name>');
            return;
          }
          detectModel(options.model);
          break;

        case 'calculate':
        case 'calc':
          if (!options.model) {
            console.error('Error: --model is required for calculate');
            console.log('Usage: dragon-ui-claude-cli pricing calculate --model <model> --input <tokens> --output <tokens>');
            return;
          }
          calculateCost(
            parseInt(options.input) || 0,
            parseInt(options.output) || 0,
            options.model,
            { cached: parseInt(options.cached) || 0 }
          );
          break;

        case 'stats':
          showCacheStats();
          break;

        default:
          showPricing({ verbose: options.verbose });
          break;
      }
    });

  // Powerline command
  program
    .command('powerline')
    .description('Manage powerline mode and themes')
    .argument('[action]', 'Action: enable, disable, theme, themes, separator, separators, preview, preview-all, status, help')
    .argument('[value]', 'Value for theme or separator')
    .action(async (action, value) => {
      switch (action) {
        case 'enable':
          await powerlineCmd.enablePowerline(value || 'dragon');
          break;

        case 'disable':
          await powerlineCmd.disablePowerline();
          break;

        case 'theme':
          if (!value) {
            console.error('Error: Theme name required');
            console.log('Usage: dragon-ui-claude-cli powerline theme <name>');
            return;
          }
          await powerlineCmd.setTheme(value);
          break;

        case 'themes':
          await powerlineCmd.listThemes();
          break;

        case 'separator':
          if (!value) {
            console.error('Error: Separator type required');
            console.log('Usage: dragon-ui-claude-cli powerline separator <type>');
            return;
          }
          await powerlineCmd.setSeparator(value);
          break;

        case 'separators':
          await powerlineCmd.listSeparators();
          break;

        case 'preview':
          await powerlineCmd.showPreview(value);
          break;

        case 'preview-all':
          await powerlineCmd.previewAllThemes();
          break;

        case 'status':
          await powerlineCmd.showStatus();
          break;

        case 'help':
        default:
          await powerlineCmd.showHelp();
          break;
      }
    });

  // Live monitoring command
  program
    .command('live')
    .description('Start live monitoring dashboard')
    .option('-i, --interval <ms>', 'Refresh interval in milliseconds', '2000')
    .option('--compact', 'Use compact display mode')
    .option('--help-live', 'Show live dashboard help')
    .action(async (options) => {
      if (options.helpLive) {
        await showLiveHelp();
        return;
      }

      await startLiveDashboard({
        interval: parseInt(options.interval) || 2000,
        compact: options.compact || false
      });
    });

  // Custom commands widget management
  program
    .command('custom-commands')
    .description('Manage custom command widgets')
    .argument('[action]', 'Action: list, templates, transformers, add, remove, test, preview, export, import, help')
    .argument('[value]', 'Value for action (id or file path)')
    .option('--id <id>', 'Command ID')
    .option('--name <name>', 'Display name')
    .option('--command <cmd>', 'Shell command to execute')
    .option('--template <name>', 'Use predefined template')
    .option('--prefix <str>', 'Prefix for output')
    .option('--suffix <str>', 'Suffix for output')
    .option('--transform <type>', 'Output transformer')
    .option('--timeout <ms>', 'Execution timeout')
    .option('--cache <ms>', 'Cache timeout')
    .option('--fallback <str>', 'Fallback on error')
    .option('--max-length <n>', 'Maximum output length')
    .action(async (action, value, options) => {
      switch (action) {
        case 'list':
          await customCommandsCmd.listCommands();
          break;

        case 'templates':
          await customCommandsCmd.listTemplates();
          break;

        case 'transformers':
          await customCommandsCmd.listTransformers();
          break;

        case 'add':
          await customCommandsCmd.addCommand(options);
          break;

        case 'remove':
          await customCommandsCmd.removeCommand(value || options.id);
          break;

        case 'test':
          await customCommandsCmd.testCommand(options);
          break;

        case 'preview':
          await customCommandsCmd.previewCommand(options);
          break;

        case 'export':
          await customCommandsCmd.exportCommands(value);
          break;

        case 'import':
          await customCommandsCmd.importCommands(value);
          break;

        case 'help':
        default:
          await customCommandsCmd.showHelp();
          break;
      }
    });

  // Provider management command
  program
    .command('providers')
    .description('Manage AI model providers')
    .argument('[action]', 'Action: list, show, set, enable, disable, health, detect, stats, help')
    .argument('[value]', 'Provider ID or model name')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (action, value, options) => {
      switch (action) {
        case 'list':
          await providersCmd.listProviders({ verbose: options.verbose });
          break;

        case 'show':
          await providersCmd.showProvider(value);
          break;

        case 'set':
          await providersCmd.setActiveProvider(value);
          break;

        case 'enable':
          await providersCmd.enableProvider(value);
          break;

        case 'disable':
          await providersCmd.disableProvider(value);
          break;

        case 'health':
          await providersCmd.checkHealth(value);
          break;

        case 'detect':
          await providersCmd.detectProvider(value);
          break;

        case 'stats':
          await providersCmd.showStats();
          break;

        case 'help':
        default:
          await providersCmd.showHelp();
          break;
      }
    });

  // Agent detection command
  program
    .command('agents')
    .description('Detect and analyze agent/tool usage')
    .argument('[action]', 'Action: detect, analyze, stats, session, types, categories, clear-cache, reset, help')
    .argument('[value]', 'Input string, file path, or session ID')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (action, value, options) => {
      switch (action) {
        case 'detect':
          await agentsCmd.detect(value, { verbose: options.verbose });
          break;

        case 'analyze':
          await agentsCmd.analyzeFile(value);
          break;

        case 'stats':
          await agentsCmd.showStats();
          break;

        case 'session':
          await agentsCmd.showSession(value);
          break;

        case 'types':
          await agentsCmd.listTypes();
          break;

        case 'categories':
          await agentsCmd.listCategories();
          break;

        case 'clear-cache':
          await agentsCmd.clearCache();
          break;

        case 'reset':
          await agentsCmd.resetStats();
          break;

        case 'help':
        default:
          await agentsCmd.showHelp();
          break;
      }
    });

  // Settings migration command
  program
    .command('migrate')
    .description('Manage settings migration, backup, and restore')
    .argument('[action]', 'Action: status, run, backups, backup, restore, delete, export, import, reset, files, help')
    .argument('[value]', 'Backup name, file path, or settings key')
    .option('--dry-run', 'Preview migrations without applying')
    .option('--force', 'Force operation without confirmation')
    .option('--no-backup', 'Skip backup creation')
    .action(async (action, value, options) => {
      switch (action) {
        case 'status':
          await migrateCmd.checkStatus();
          break;

        case 'run':
          await migrateCmd.runMigration({
            dryRun: options.dryRun,
            force: options.force,
            backup: options.backup
          });
          break;

        case 'backups':
        case 'list':
          await migrateCmd.listBackups();
          break;

        case 'backup':
          await migrateCmd.createBackup(value);
          break;

        case 'restore':
          await migrateCmd.restoreBackup(value);
          break;

        case 'delete':
          await migrateCmd.deleteBackup(value);
          break;

        case 'export':
          await migrateCmd.exportSettings(value);
          break;

        case 'import':
          await migrateCmd.importSettings(value, {
            backup: options.backup
          });
          break;

        case 'reset':
          await migrateCmd.resetSettings(value, {
            force: options.force,
            backup: options.backup
          });
          break;

        case 'files':
          await migrateCmd.showFiles();
          break;

        case 'help':
        default:
          await migrateCmd.showHelp();
          break;
      }
    });

  // Interactive TUI command
  program
    .command('tui')
    .description('Start interactive TUI dashboard')
    .argument('[action]', 'Action: start, themes, preview, help')
    .argument('[value]', 'Theme name for preview')
    .option('-t, --theme <name>', 'Set theme (dragon, ocean, forest, minimal)')
    .option('-i, --interval <ms>', 'Refresh interval in milliseconds', '5000')
    .option('--title <text>', 'Set dashboard title')
    .action(async (action, value, options) => {
      switch (action) {
        case 'themes':
        case 'list':
          await tuiCmd.listThemes();
          break;

        case 'preview':
          await tuiCmd.previewTheme(value || options.theme || 'dragon');
          break;

        case 'help':
          await tuiCmd.showHelp();
          break;

        case 'start':
        default:
          await tuiCmd.startTUI({
            theme: options.theme || 'dragon',
            interval: parseInt(options.interval) || 5000,
            title: options.title
          });
          break;
      }
    });

  // Documentation command
  program
    .command('docs')
    .description('View and generate Dragon UI documentation')
    .argument('[action]', 'Action: overview, commands, command, config, api, examples, search, generate, help')
    .argument('[value]', 'Command name, search query, or output directory')
    .action(async (action, value) => {
      switch (action) {
        case 'overview':
          await docsCmd.showOverview();
          break;

        case 'commands':
        case 'list':
          await docsCmd.listCommands();
          break;

        case 'command':
          await docsCmd.showCommand(value);
          break;

        case 'config':
        case 'configuration':
          await docsCmd.showConfiguration();
          break;

        case 'api':
          await docsCmd.showAPI();
          break;

        case 'examples':
          await docsCmd.showExamples();
          break;

        case 'search':
          await docsCmd.searchDocs(value);
          break;

        case 'generate':
          await docsCmd.generateDocs(value);
          break;

        case 'help':
          await docsCmd.showHelp();
          break;

        default:
          await docsCmd.showOverview();
          break;
      }
    });

  // API Key management command
  apikeyCmd.registerCommands(program);

  // Widget management command
  widgetsCmd.registerCommands(program);

  // OAuth management command
  oauthCmd.registerCommands(program);

  // Register proxy/load balancing commands
  proxyCmd.registerCommands(program);

  // Register weekly reports command
  weeklyCmd.registerCommands(program);

  // Register Codex/GPT-5 commands
  codexCmd.registerCommands(program);

  // Register font management commands
  fontsCmd.registerCommands(program);

  // Register install/setup commands
  installCmd.registerCommands(program);

  // Register analytics dashboard commands
  analyticsCmd.registerCommands(program);

  // Register real-time dashboard commands
  realtimeCmd.registerCommands(program);

  // Register data retention commands
  retentionCmd.registerCommands(program);

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
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error starting Dragon UI CLI: ${message}`);
  if (process.env.DEBUG && error instanceof Error) {
    console.error(error.stack);
  }
  process.exit(1);
});