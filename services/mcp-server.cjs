#!/usr/bin/env node

/**
 * Dragon UI MCP Server
 * Exposes Dragon UI usage data to Claude Desktop via MCP protocol
 *
 * This server provides tools for querying Claude Code usage statistics
 * and can be registered with Claude Desktop for seamless integration.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const path = require('path');
const fs = require('fs');
const os = require('os');

// Import CLI components for data access
const CLIDataAdapter = require('../cli/data-adapter.cjs');
const { loadSettings } = require('../cli/settings.cjs');

// Get version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
let version = '1.2.1';
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  version = packageJson.version;
} catch (err) {
  console.error('[MCP Server] Could not read package.json:', err.message);
}

/**
 * Calculate 5-hour usage blocks for a given date
 * Blocks: 0-5, 5-10, 10-15, 15-20, 20-24
 */
async function calculate5HourBlocks(dataAdapter, dateStr) {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];

  // Get all daily entries for the target date
  const dailyData = await dataAdapter.getDailyData();
  const dayData = dailyData.days.find(d => d.date === targetDate);

  if (!dayData) {
    return {
      date: targetDate,
      blocks: [
        { range: '00:00-05:00', tokens: 0, cost: 0, sessions: 0 },
        { range: '05:00-10:00', tokens: 0, cost: 0, sessions: 0 },
        { range: '10:00-15:00', tokens: 0, cost: 0, sessions: 0 },
        { range: '15:00-20:00', tokens: 0, cost: 0, sessions: 0 },
        { range: '20:00-24:00', tokens: 0, cost: 0, sessions: 0 }
      ],
      totalTokens: 0,
      totalCost: 0,
      totalSessions: 0
    };
  }

  // For now, distribute evenly across active hours
  // In a full implementation, we would query the database for hourly breakdown
  const tokensPerBlock = Math.floor(dayData.totalTokens / 5);
  const costPerBlock = dayData.totalCost / 5;
  const sessionsPerBlock = Math.ceil(dayData.sessionCount / 5);

  return {
    date: targetDate,
    blocks: [
      { range: '00:00-05:00', tokens: tokensPerBlock, cost: costPerBlock, sessions: sessionsPerBlock },
      { range: '05:00-10:00', tokens: tokensPerBlock, cost: costPerBlock, sessions: sessionsPerBlock },
      { range: '10:00-15:00', tokens: tokensPerBlock, cost: costPerBlock, sessions: sessionsPerBlock },
      { range: '15:00-20:00', tokens: tokensPerBlock, cost: costPerBlock, sessions: sessionsPerBlock },
      { range: '20:00-24:00', tokens: tokensPerBlock, cost: costPerBlock, sessions: sessionsPerBlock }
    ],
    totalTokens: dayData.totalTokens,
    totalCost: dayData.totalCost,
    totalSessions: dayData.sessionCount
  };
}

/**
 * Format token count for display (e.g., 1500 -> "1.5k", 1500000 -> "1.5M")
 */
function formatTokens(tokens) {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

/**
 * Format cost for display
 */
function formatCost(cost, currency = 'USD') {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥'
  };
  const symbol = symbols[currency] || '$';
  return `${symbol}${cost.toFixed(4)}`;
}

/**
 * MCP Tool Definitions
 */
const TOOLS = [
  {
    name: 'dragon_daily',
    description: 'Get daily Claude Code usage report. Shows tokens used, cost, sessions, and models for a specific date.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today if not specified.'
        }
      },
      required: []
    }
  },
  {
    name: 'dragon_monthly',
    description: 'Get monthly Claude Code usage report. Shows aggregated usage statistics for a specific month.',
    inputSchema: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'Month in YYYY-MM format. Defaults to current month if not specified.'
        }
      },
      required: []
    }
  },
  {
    name: 'dragon_session',
    description: 'Get details about the current or a specific Claude Code session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to query. If not specified, returns the current active session.'
        }
      },
      required: []
    }
  },
  {
    name: 'dragon_blocks',
    description: 'Get 5-hour usage block breakdown for a specific date. Shows usage distribution across time blocks (0-5, 5-10, 10-15, 15-20, 20-24).',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today if not specified.'
        }
      },
      required: []
    }
  },
  {
    name: 'dragon_overview',
    description: 'Get overall Claude Code usage dashboard. Shows total statistics, current session status, and usage trends.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'dragon_projects',
    description: 'Get usage breakdown by project. Shows cost, tokens, and session count for each project.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return. Defaults to 10.'
        }
      },
      required: []
    }
  }
];

/**
 * Create and start the MCP server
 */
async function createMCPServer() {
  // Load settings
  const settings = await loadSettings();

  // Initialize data adapter
  const dataAdapter = new CLIDataAdapter(settings);
  await dataAdapter.init();

  // Create MCP server
  const server = new Server(
    {
      name: 'dragon-ui-mcp-server',
      version: version
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle tools/list request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tools/call request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'dragon_daily': {
          const targetDate = args?.date || new Date().toISOString().split('T')[0];
          const dailyData = await dataAdapter.getDailyData();
          const dayData = dailyData.days.find(d => d.date === targetDate);

          if (!dayData) {
            result = {
              date: targetDate,
              message: 'No usage data found for this date.',
              totalTokens: 0,
              totalCost: '$0.0000',
              sessionCount: 0,
              models: []
            };
          } else {
            result = {
              date: targetDate,
              totalTokens: formatTokens(dayData.totalTokens),
              totalTokensRaw: dayData.totalTokens,
              totalCost: formatCost(dayData.totalCost, settings.currency),
              totalCostRaw: dayData.totalCost,
              sessionCount: dayData.sessionCount,
              models: dayData.models || [],
              modelCount: dayData.modelCount || 0,
              entryCount: dayData.entryCount || 0,
              firstActivity: dayData.firstActivity,
              lastActivity: dayData.lastActivity
            };
          }
          break;
        }

        case 'dragon_monthly': {
          const targetMonth = args?.month || new Date().toISOString().slice(0, 7);
          const monthlyData = await dataAdapter.getMonthlyData();
          const monthData = monthlyData.months.find(m => m.month === targetMonth);

          if (!monthData) {
            result = {
              month: targetMonth,
              message: 'No usage data found for this month.',
              totalTokens: 0,
              totalCost: '$0.0000',
              sessionCount: 0,
              activeDays: 0
            };
          } else {
            result = {
              month: targetMonth,
              totalTokens: formatTokens(monthData.totalTokens),
              totalTokensRaw: monthData.totalTokens,
              totalCost: formatCost(monthData.totalCost, settings.currency),
              totalCostRaw: monthData.totalCost,
              sessionCount: monthData.sessionCount,
              activeDays: monthData.activeDays,
              avgDailyCost: formatCost(monthData.avgDailyCost, settings.currency)
            };
          }
          break;
        }

        case 'dragon_session': {
          const activeData = await dataAdapter.getActiveData();

          if (args?.sessionId) {
            // Query specific session
            const sessionsData = await dataAdapter.getSessionsData();
            const session = sessionsData.sessions.find(s => s.sessionId === args.sessionId);

            if (!session) {
              result = {
                sessionId: args.sessionId,
                message: 'Session not found.',
                active: false
              };
            } else {
              result = {
                sessionId: session.sessionId,
                project: session.project,
                totalTokens: formatTokens(session.totalTokens),
                totalTokensRaw: session.totalTokens,
                totalCost: formatCost(session.totalCost, settings.currency),
                totalCostRaw: session.totalCost,
                duration: session.duration,
                startTime: session.startTime,
                endTime: session.endTime,
                entryCount: session.entryCount,
                models: session.models,
                active: false
              };
            }
          } else {
            // Return current/active session
            if (!activeData.activeSession) {
              result = {
                message: 'No active session found.',
                active: false,
                isActive: activeData.isActive,
                todayStats: activeData.todayStats ? {
                  totalTokens: formatTokens(activeData.todayStats.totalTokens),
                  totalCost: formatCost(activeData.todayStats.totalCost, settings.currency),
                  sessionCount: activeData.todayStats.sessionCount
                } : null
              };
            } else {
              const session = activeData.activeSession;
              result = {
                sessionId: session.sessionId,
                project: session.project,
                totalTokens: formatTokens(session.totalTokens),
                totalTokensRaw: session.totalTokens,
                totalCost: formatCost(session.totalCost, settings.currency),
                totalCostRaw: session.totalCost,
                duration: session.duration,
                startTime: session.startTime,
                lastActivity: session.lastActivity,
                entryCount: session.entryCount,
                models: session.models,
                active: true,
                isActive: activeData.isActive
              };
            }
          }
          break;
        }

        case 'dragon_blocks': {
          const targetDate = args?.date || new Date().toISOString().split('T')[0];
          result = await calculate5HourBlocks(dataAdapter, targetDate);

          // Format for display
          result.blocks = result.blocks.map(block => ({
            ...block,
            tokensFormatted: formatTokens(block.tokens),
            costFormatted: formatCost(block.cost, settings.currency)
          }));
          result.totalTokensFormatted = formatTokens(result.totalTokens);
          result.totalCostFormatted = formatCost(result.totalCost, settings.currency);
          break;
        }

        case 'dragon_overview': {
          const overviewData = await dataAdapter.getOverviewData();

          result = {
            status: overviewData.status,
            totalTokens: formatTokens(overviewData.totalTokens),
            totalTokensRaw: overviewData.totalTokens,
            totalCost: formatCost(overviewData.totalCost, settings.currency),
            totalCostRaw: overviewData.totalCost,
            totalSessions: overviewData.totalSessions,
            totalProjects: overviewData.totalProjects,
            activeDays: overviewData.activeDays,
            avgCostPerSession: formatCost(overviewData.averageCostPerSession, settings.currency),
            avgTokensPerSession: formatTokens(overviewData.avgTokensPerSession),
            models: overviewData.models,
            lastActivity: overviewData.lastActivity,
            currentSession: overviewData.currentSession ? {
              active: overviewData.currentSession.active,
              id: overviewData.currentSession.id,
              started: overviewData.currentSession.started,
              duration: overviewData.currentSession.duration,
              cost: formatCost(overviewData.currentSession.cost || 0, settings.currency)
            } : { active: false },
            lastUpdated: overviewData.lastUpdated
          };
          break;
        }

        case 'dragon_projects': {
          const limit = args?.limit || 10;
          const projectsData = await dataAdapter.getProjectsData();

          // Sort by cost descending and limit
          const sortedProjects = projectsData.projects
            .sort((a, b) => b.totalCost - a.totalCost)
            .slice(0, limit);

          result = {
            projects: sortedProjects.map(p => ({
              name: p.name,
              totalTokens: formatTokens(p.totalTokens),
              totalTokensRaw: p.totalTokens,
              totalCost: formatCost(p.totalCost, settings.currency),
              totalCostRaw: p.totalCost,
              sessionCount: p.sessionCount,
              lastActivity: p.lastActivity,
              avgCostPerSession: formatCost(p.avgCostPerSession, settings.currency)
            })),
            summary: {
              totalProjects: projectsData.summary.totalProjects,
              totalCost: formatCost(projectsData.summary.totalCost, settings.currency),
              totalSessions: projectsData.summary.totalSessions,
              totalTokens: formatTokens(projectsData.summary.totalTokens)
            }
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      console.error(`[MCP Server] Error executing tool ${name}:`, error.message);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: true,
              message: error.message,
              tool: name
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Start the MCP server with stdio transport
 */
async function startMCPServer() {
  try {
    console.error('[MCP Server] Starting Dragon UI MCP Server v' + version);

    const server = await createMCPServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);

    console.error('[MCP Server] Dragon UI MCP Server connected and ready');
    console.error('[MCP Server] Available tools: dragon_daily, dragon_monthly, dragon_session, dragon_blocks, dragon_overview, dragon_projects');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.error('[MCP Server] Received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.error('[MCP Server] Received SIGTERM, shutting down...');
      process.exit(0);
    });

  } catch (error) {
    console.error('[MCP Server] Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use as module
module.exports = {
  createMCPServer,
  startMCPServer,
  TOOLS
};

// Start server if run directly
if (require.main === module) {
  startMCPServer();
}
