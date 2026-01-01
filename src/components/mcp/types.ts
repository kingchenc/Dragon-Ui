/**
 * MCP (Model Context Protocol) Types
 */

// Server status
export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Server icons
export type MCPServerIcon =
  | 'server'
  | 'folder'
  | 'git-branch'
  | 'database'
  | 'globe'
  | 'code'
  | 'terminal'
  | 'search';

// Tool input schema
export interface MCPToolInputSchema {
  type: 'object';
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
}

// MCP Tool definition
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: MCPToolInputSchema;
  serverId?: string;
  serverName?: string;
}

// MCP Resource definition
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId?: string;
  serverName?: string;
}

// MCP Prompt definition
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId?: string;
  serverName?: string;
}

// MCP Server configuration
export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  icon: MCPServerIcon;
  builtin: boolean;
}

// MCP Server state
export interface MCPServer extends MCPServerConfig {
  status: MCPServerStatus;
  error: string | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  autoConnect?: boolean;
}

// Log entry
export interface MCPLogEntry {
  serverId: string;
  level: 'info' | 'error' | 'warn' | 'debug';
  message: string;
  timestamp: Date;
}

// Tool execution result
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

// Resource read result
export interface MCPResourceResult {
  contents: Array<{
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
  }>;
}

// Prompt result
export interface MCPPromptResult {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: {
      type: 'text';
      text: string;
    };
  }>;
}

// Built-in server info for display
export const BUILTIN_SERVER_INFO: Record<string, {
  name: string;
  description: string;
  icon: MCPServerIcon;
  color: string;
}> = {
  'builtin-filesystem': {
    name: 'Filesystem',
    description: 'Access local files and directories',
    icon: 'folder',
    color: '#3B82F6'
  },
  'builtin-git': {
    name: 'Git',
    description: 'Git repository operations',
    icon: 'git-branch',
    color: '#F97316'
  },
  'builtin-memory': {
    name: 'Memory',
    description: 'Persistent key-value storage',
    icon: 'database',
    color: '#8B5CF6'
  },
  'builtin-fetch': {
    name: 'Fetch',
    description: 'HTTP fetch capabilities',
    icon: 'globe',
    color: '#10B981'
  }
};
