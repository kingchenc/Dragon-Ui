/**
 * MCP (Model Context Protocol) Components
 * Components for managing MCP servers, tools, and resources
 */

export { default as MCPServerManager } from './MCPServerManager';
export { useMcpStore } from './useMcp';

export type {
  MCPServer,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerIcon,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPLogEntry,
  MCPToolResult,
  MCPResourceResult,
  MCPPromptResult
} from './types';

export { BUILTIN_SERVER_INFO } from './types';
