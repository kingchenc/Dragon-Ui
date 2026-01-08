#!/usr/bin/env node

/**
 * Dragon UI MCP Server Binary
 * Entry point for running the MCP server via Claude Desktop or CLI
 *
 * Usage:
 *   npx dragon-ui-claude mcp-server
 *   node bin/mcp-server.cjs
 *
 * Claude Desktop Configuration (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "dragon-ui": {
 *       "command": "npx",
 *       "args": ["dragon-ui-claude", "mcp-server"]
 *     }
 *   }
 * }
 */

const path = require('path');

// Ensure we're using the correct module paths
const serverPath = path.resolve(__dirname, '../services/mcp-server.cjs');

// Start the MCP server
const { startMCPServer } = require(serverPath);
startMCPServer();
