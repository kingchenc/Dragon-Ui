'use strict';

/**
 * MCP CLI Command - Model Context Protocol Server Management
 * Provides commands for starting, installing, and managing the MCP server
 */

const path = require('path');
const fs = require('fs');

/**
 * Register MCP commands with Commander
 */
function registerMCPCommand(program, services) {
  const mcp = program
    .command('mcp')
    .description('Model Context Protocol server for Claude Desktop integration');

  // mcp serve - Start the MCP server in stdio mode
  mcp
    .command('serve')
    .description('Start MCP server in stdio mode (for Claude Desktop)')
    .option('--http', 'Use HTTP transport instead of stdio')
    .option('--port <port>', 'HTTP port (default: 8080)', '8080')
    .action(async (options) => {
      await handleServe(options, services);
    });

  // mcp install - Install to Claude Desktop
  mcp
    .command('install')
    .description('Install Dragon-UI as MCP server in Claude Desktop')
    .option('--npx', 'Use npx to run (default)')
    .option('--node', 'Use node directly')
    .option('--show-config', 'Show config without installing')
    .action(async (options) => {
      await handleInstall(options, services);
    });

  // mcp uninstall - Uninstall from Claude Desktop
  mcp
    .command('uninstall')
    .description('Remove Dragon-UI MCP server from Claude Desktop')
    .action(async (options) => {
      await handleUninstall(options, services);
    });

  // mcp status - Show installation status
  mcp
    .command('status')
    .description('Show MCP server installation status')
    .action(async (options) => {
      await handleStatus(options, services);
    });

  // mcp config - Show/edit configuration
  mcp
    .command('config')
    .description('Show Claude Desktop MCP configuration')
    .option('--path', 'Show config file path only')
    .option('--open', 'Open config file in editor')
    .action(async (options) => {
      await handleConfig(options, services);
    });

  // mcp test - Test MCP server functionality
  mcp
    .command('test')
    .description('Test MCP server tools')
    .option('--tool <name>', 'Tool to test (daily, monthly, session, blocks, overview, projects)')
    .action(async (options) => {
      await handleTest(options, services);
    });

  return mcp;
}

/**
 * Handle serve command
 */
async function handleServe(options, services) {
  if (options.http) {
    // Use HTTP server
    const { getMCPHttpServer } = require('../../services/mcp-http-server.cjs');
    const server = getMCPHttpServer({ port: parseInt(options.port, 10) });

    // Register tools
    registerHttpTools(server, services);

    await server.start();
    console.log(`MCP HTTP Server started on port ${options.port}`);
    console.log('Press Ctrl+C to stop');

    // Keep running
    process.on('SIGINT', async () => {
      await server.stop();
      process.exit(0);
    });
  } else {
    // Use stdio server (for Claude Desktop)
    const { getMCPStdioServer } = require('../../services/mcp-stdio-server.cjs');

    const server = getMCPStdioServer({
      coreDataService: services.coreDataService || null,
      database: services.database || null
    });

    server.on('started', () => {
      // Log to stderr so it doesn't interfere with stdio protocol
      process.stderr.write('[Dragon-UI MCP] Server started in stdio mode\n');
    });

    server.on('initialized', () => {
      process.stderr.write('[Dragon-UI MCP] Client connected and initialized\n');
    });

    server.on('closed', () => {
      process.stderr.write('[Dragon-UI MCP] Connection closed\n');
      process.exit(0);
    });

    server.start();
  }
}

/**
 * Register HTTP tools
 */
function registerHttpTools(server, services) {
  const { MCP_TOOLS } = require('../../services/mcp-stdio-server.cjs');

  // Register each tool
  Object.entries(MCP_TOOLS).forEach(([name, tool]) => {
    server.registerTool(name, async (args) => {
      return executeToolForHttp(name, args, services);
    }, tool.inputSchema);
  });
}

/**
 * Execute tool for HTTP mode
 */
async function executeToolForHttp(name, args, services) {
  const coreDataService = services.coreDataService;

  switch (name) {
    case 'daily': {
      const date = args.date || new Date().toISOString().split('T')[0];
      if (coreDataService) {
        const data = await coreDataService.getTabData('daily');
        const dayEntry = (data.dailyData || []).find(d => d.date === date);
        return dayEntry || { date, totalCost: 0, totalTokens: 0 };
      }
      return { date, totalCost: 0, totalTokens: 0 };
    }

    case 'monthly': {
      const month = args.month || new Date().toISOString().slice(0, 7);
      if (coreDataService) {
        const data = await coreDataService.getTabData('monthly');
        const monthEntry = (data.monthlyData || []).find(m => m.month === month);
        return {
          ...monthEntry,
          projectedMonthly: data.projectedMonthly,
          dailyAverage: data.dailyAverage
        };
      }
      return { month, totalCost: 0, totalTokens: 0 };
    }

    case 'session': {
      if (coreDataService) {
        const data = await coreDataService.getTabData('active');
        return {
          sessionId: data.sessionId,
          status: data.status,
          cost: data.currentCost,
          tokens: data.tokensUsed,
          duration: data.duration,
          timeLeft: data.timeLeft
        };
      }
      return { status: 'idle', cost: 0, tokens: 0 };
    }

    case 'blocks': {
      const count = Math.min(args.count || 5, 20);
      if (coreDataService) {
        const data = await coreDataService.getTabData('daily');
        return { blocks: (data.blocks || []).slice(0, count) };
      }
      return { blocks: [] };
    }

    case 'overview': {
      if (coreDataService) {
        return await coreDataService.getTabData('overview');
      }
      return { totalCost: 0, totalSessions: 0, totalTokens: 0 };
    }

    case 'projects': {
      const limit = args.limit || 10;
      if (coreDataService) {
        const data = await coreDataService.getTabData('projects');
        return { projects: (data.projectsData || []).slice(0, limit) };
      }
      return { projects: [] };
    }

    default:
      throw new Error('Unknown tool: ' + name);
  }
}

/**
 * Handle install command
 */
async function handleInstall(options, services) {
  const {
    generateClaudeDesktopConfig,
    installToClaudeDesktop,
    getClaudeDesktopConfigPath,
    SERVER_NAME
  } = require('../../services/mcp-stdio-server.cjs');

  const useNpx = !options.node;
  const config = generateClaudeDesktopConfig({ useNpx });

  if (options.showConfig) {
    console.log('Claude Desktop MCP Configuration:');
    console.log('');
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    console.log('Config file path:', getClaudeDesktopConfigPath());
    return;
  }

  console.log('Installing Dragon-UI MCP server to Claude Desktop...');
  console.log('');

  try {
    const result = installToClaudeDesktop({ useNpx });

    console.log('Successfully installed!');
    console.log('');
    console.log('Server name:', SERVER_NAME);
    console.log('Config path:', result.configPath);
    console.log('');
    console.log('Configuration added:');
    console.log(JSON.stringify(result.config, null, 2));
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart Claude Desktop');
    console.log('2. The Dragon-UI tools will be available in Claude');
    console.log('');
    console.log('Available tools:');
    console.log('  - daily: Get daily usage statistics');
    console.log('  - monthly: Get monthly usage statistics');
    console.log('  - session: Get current session data');
    console.log('  - blocks: Get 5-hour usage blocks');
    console.log('  - overview: Get overall usage overview');
    console.log('  - projects: Get usage by project');

  } catch (error) {
    console.error('Failed to install:', error.message);
    console.log('');
    console.log('You can manually add this to your Claude Desktop config:');
    console.log('');
    console.log('Config path:', getClaudeDesktopConfigPath());
    console.log('');
    console.log('Add this to your config file:');
    console.log(JSON.stringify(config, null, 2));
    process.exit(1);
  }
}

/**
 * Handle uninstall command
 */
async function handleUninstall(options, services) {
  const {
    uninstallFromClaudeDesktop,
    SERVER_NAME
  } = require('../../services/mcp-stdio-server.cjs');

  console.log('Uninstalling Dragon-UI MCP server from Claude Desktop...');
  console.log('');

  const result = uninstallFromClaudeDesktop();

  if (result.removed) {
    console.log('Successfully removed!');
    console.log('');
    console.log('Config path:', result.configPath);
    console.log('');
    console.log('Restart Claude Desktop to apply changes.');
  } else {
    console.log('Nothing to remove:', result.reason);
  }
}

/**
 * Handle status command
 */
async function handleStatus(options, services) {
  const {
    isInstalledInClaudeDesktop,
    getClaudeDesktopConfigPath,
    SERVER_NAME,
    SERVER_VERSION,
    MCP_PROTOCOL_VERSION
  } = require('../../services/mcp-stdio-server.cjs');

  const installed = isInstalledInClaudeDesktop();
  const configPath = getClaudeDesktopConfigPath();
  const configExists = fs.existsSync(configPath);

  console.log('Dragon-UI MCP Server Status');
  console.log('===========================');
  console.log('');
  console.log('Server Info:');
  console.log('  Name:', SERVER_NAME);
  console.log('  Version:', SERVER_VERSION);
  console.log('  Protocol:', MCP_PROTOCOL_VERSION);
  console.log('');
  console.log('Claude Desktop:');
  console.log('  Config exists:', configExists ? 'Yes' : 'No');
  console.log('  Config path:', configPath);
  console.log('  Installed:', installed ? 'Yes' : 'No');
  console.log('');

  if (installed) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const serverConfig = config.mcpServers[SERVER_NAME];
      console.log('Current Configuration:');
      console.log('  Command:', serverConfig.command);
      console.log('  Args:', serverConfig.args.join(' '));
    } catch (e) {
      // Ignore read errors
    }
  } else {
    console.log('Run `dragon-ui mcp install` to install.');
  }
}

/**
 * Handle config command
 */
async function handleConfig(options, services) {
  const {
    getClaudeDesktopConfigPath
  } = require('../../services/mcp-stdio-server.cjs');

  const configPath = getClaudeDesktopConfigPath();

  if (options.path) {
    console.log(configPath);
    return;
  }

  if (options.open) {
    const { exec } = require('child_process');
    const platform = process.platform;

    let command;
    if (platform === 'darwin') {
      command = `open "${configPath}"`;
    } else if (platform === 'win32') {
      command = `start "" "${configPath}"`;
    } else {
      command = `xdg-open "${configPath}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Failed to open config file:', error.message);
        console.log('Config path:', configPath);
      }
    });
    return;
  }

  console.log('Claude Desktop MCP Configuration');
  console.log('=================================');
  console.log('');
  console.log('Config path:', configPath);
  console.log('');

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('Current configuration:');
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.log('Error reading config:', error.message);
    }
  } else {
    console.log('Config file does not exist.');
    console.log('');
    console.log('Run `dragon-ui mcp install` to create it.');
  }
}

/**
 * Handle test command
 */
async function handleTest(options, services) {
  const { MCPStdioServer, MCP_TOOLS } = require('../../services/mcp-stdio-server.cjs');

  const toolName = options.tool || 'overview';

  if (!MCP_TOOLS[toolName]) {
    console.error('Unknown tool:', toolName);
    console.log('');
    console.log('Available tools:');
    Object.keys(MCP_TOOLS).forEach(name => {
      console.log('  -', name + ':', MCP_TOOLS[name].description);
    });
    process.exit(1);
  }

  console.log('');

  // Create a temporary server instance for testing
  const server = new MCPStdioServer({
    coreDataService: services.coreDataService || null,
    database: services.database || null
  });

  try {
    // Simulate tool call
    const result = await server._handleToolCall({
      name: toolName,
      arguments: {}
    });

    console.log('Result:');
    console.log('-------');
    if (result.content && result.content[0]) {
      console.log(result.content[0].text);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  registerMCPCommand
};
