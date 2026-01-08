# Dragon UI MCP Server Setup

This guide explains how to set up the Dragon UI MCP (Model Context Protocol) server for integration with Claude Desktop.

## Overview

The Dragon UI MCP Server exposes your Claude Code usage data as tools that Claude Desktop can query directly. This allows you to ask Claude about your usage statistics, costs, and session data without leaving the conversation.

## Available Tools

| Tool | Description |
|------|-------------|
| `dragon_daily` | Get daily usage report (tokens, cost, sessions) |
| `dragon_monthly` | Get monthly usage statistics |
| `dragon_session` | Get current or specific session details |
| `dragon_blocks` | Get 5-hour usage block breakdown |
| `dragon_overview` | Get overall usage dashboard |
| `dragon_projects` | Get usage breakdown by project |

## Installation

### Option 1: Via npm (Recommended)

```bash
npm install -g dragon-ui-claude
```

### Option 2: From Source

```bash
git clone https://github.com/KingchenC/dragon-ui
cd dragon-ui
npm install
```

## Claude Desktop Configuration

1. Open your Claude Desktop configuration file:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/claude/claude_desktop_config.json`

2. Add the Dragon UI MCP server configuration:

```json
{
  "mcpServers": {
    "dragon-ui": {
      "command": "npx",
      "args": ["dragon-ui-claude", "mcp-server"]
    }
  }
}
```

Alternatively, if installed globally:

```json
{
  "mcpServers": {
    "dragon-ui": {
      "command": "dragon-ui-mcp"
    }
  }
}
```

3. Restart Claude Desktop to apply changes.

## Usage Examples

Once configured, you can ask Claude questions like:

- "What's my Claude Code usage today?"
- "How much have I spent this month?"
- "Show me my current session statistics"
- "Which projects have I used the most?"
- "What was my usage breakdown by 5-hour blocks today?"

Claude will automatically use the Dragon UI tools to fetch and display your usage data.

## Manual Testing

You can test the MCP server manually:

```bash
# Via CLI
dragon-ui-claude-cli mcp-server

# Direct node execution
node bin/mcp-server.cjs
```

The server will output to stderr (for debugging) and communicate via stdin/stdout using JSON-RPC.

## Tool Schemas

### dragon_daily

```json
{
  "name": "dragon_daily",
  "inputSchema": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "Date in YYYY-MM-DD format. Defaults to today."
      }
    }
  }
}
```

### dragon_monthly

```json
{
  "name": "dragon_monthly",
  "inputSchema": {
    "type": "object",
    "properties": {
      "month": {
        "type": "string",
        "description": "Month in YYYY-MM format. Defaults to current month."
      }
    }
  }
}
```

### dragon_session

```json
{
  "name": "dragon_session",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sessionId": {
        "type": "string",
        "description": "Session ID to query. Defaults to current active session."
      }
    }
  }
}
```

### dragon_blocks

```json
{
  "name": "dragon_blocks",
  "inputSchema": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "Date in YYYY-MM-DD format. Defaults to today."
      }
    }
  }
}
```

### dragon_overview

```json
{
  "name": "dragon_overview",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

### dragon_projects

```json
{
  "name": "dragon_projects",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": {
        "type": "number",
        "description": "Maximum number of projects to return. Defaults to 10."
      }
    }
  }
}
```

## Troubleshooting

### Server Not Starting

1. Check that Node.js is installed (v18+)
2. Verify the package is installed correctly: `npm list -g dragon-ui-claude`
3. Check stderr output for error messages

### No Data Returned

1. Ensure you have Claude Code usage data in your database
2. Check the database path in your settings
3. Verify the CLI can access data: `dragon-ui-claude-cli statusline`

### Claude Desktop Not Finding Server

1. Verify the configuration file path is correct
2. Check JSON syntax in the configuration file
3. Restart Claude Desktop after configuration changes

## Security Notes

- The MCP server only reads local usage data
- No data is sent to external servers
- The server only responds to local stdio communication
- Tokens and API keys are never exposed through the MCP interface

## Version

Current version: 1.2.1
