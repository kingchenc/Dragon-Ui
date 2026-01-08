// Global window interface extensions for Dragon UI
// Unified type declarations for all preload APIs

// ==================== Data Types ====================

// SSH Configuration interface
interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  privateKeyPath: string;
  useKeyAuth: boolean;
  connectionTimeout: number;
  keepAliveInterval: number;
}

// Usage Data Types
interface DailyUsageData {
  date: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  requestCount: number;
  models: Record<string, { cost: number; tokens: number; requests: number }>;
}

interface MonthlyUsageData {
  month: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  requestCount: number;
  models: Record<string, { cost: number; tokens: number; requests: number }>;
}

interface SessionData {
  sessionId: string;
  fullSessionId: string;
  project: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  requestCount: number;
  models: string[];
}

interface ProjectData {
  project: string;
  totalCost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  requestCount: number;
  sessionCount: number;
  lastActive: string;
  models: Record<string, { cost: number; tokens: number; requests: number }>;
}

interface UsageStats {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  totalSessions: number;
  totalProjects: number;
  averageCostPerSession: number;
  averageTokensPerSession: number;
  modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
  topProjects: Array<{ project: string; cost: number; tokens: number }>;
  recentActivity: Array<{ date: string; cost: number; tokens: number }>;
}

interface CurrentSessionData {
  sessionId: string;
  fullSessionId: string;
  project: string;
  startTime: string;
  currentCost: number;
  currentTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  requestCount: number;
  models: string[];
  isActive: boolean;
}

interface LiveSessionData {
  sessionId: string;
  project: string;
  currentCost: number;
  currentTokens: number;
  lastActivity: string;
  isActive: boolean;
}

// Path Types
interface ClaudePaths {
  standard: string[];
  custom: string[];
  active: string[];
}

// ==================== Terminal Types ====================

interface ShellInfo {
  name: string;
  path: string;
  args?: string[];
}

interface TerminalSession {
  id: string;
  shell: string;
  cwd: string;
  pid: number;
  running: boolean;
  createdAt: string;
}

interface TerminalCreateOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

interface TerminalDataEvent {
  id: string;
  data: string;
}

interface TerminalExitEvent {
  id: string;
  exitCode: number;
  signal?: string;
}

// ==================== Account Types ====================

interface Account {
  id: string;
  name: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountCreateData {
  name: string;
  email?: string;
}

// ==================== MCP Types ====================

interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  autoConnect: boolean;
  enabled: boolean;
}

interface MCPServerStatus {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
}

interface MCPServerCapabilities {
  id: string;
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

interface MCPServerLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

interface MCPServerError {
  id: string;
  error: string;
  timestamp: string;
}

// ==================== Model Pricing Types ====================

interface ModelPricing {
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheWritePricePerMillion: number;
  cacheReadPricePerMillion: number;
  lastUpdated: string;
}

interface ModelPricingStats {
  totalModels: number;
  lastFetched: string;
  source: string;
}

// ==================== Result Types ====================

interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
  canceled?: boolean;
}

interface ScreenshotResult {
  success: boolean;
  filePath?: string;
  message?: string;
  error?: string;
}

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

// ==================== Vite Constants ====================

declare const __APP_VERSION__: string;

// ==================== Global Window Interface ====================

declare global {
  interface Window {
    // Claude Projects API (Claude Code Max)
    claudeMaxAPI: {
      // Data loading functions
      loadDailyUsageData: () => Promise<DailyUsageData[]>;
      loadMonthlyUsageData: () => Promise<MonthlyUsageData[]>;
      loadSessionData: () => Promise<SessionData[]>;
      loadProjectData: () => Promise<ProjectData[]>;
      loadUsageStats: () => Promise<UsageStats | null>;
      loadCurrentSession: () => Promise<CurrentSessionData | null>;
      loadLiveSessionData: () => Promise<LiveSessionData | null>;

      // Path management functions
      getClaudePaths: () => Promise<ClaudePaths>;
      addCustomPath: (customPath: string) => Promise<boolean>;
      removeCustomPath: (customPath: string) => Promise<boolean>;
      refreshPaths: () => Promise<ClaudePaths>;

      // Database management functions
      clearDatabase: () => Promise<boolean>;
      refreshDatabase: () => Promise<boolean>;

      // Utility functions
      calculateTotals: (data: Array<{ totalCost?: number; cost?: number; totalTokens?: number; tokens?: number }>) => { totalCost: number; totalTokens: number };
      getTotalTokens: (data: Array<{ totalTokens?: number; tokens?: number }>) => number;
    };

    // Electron APIs
    electronAPI: {
      // App info
      getAppVersion: () => Promise<string>;
      exportData: (data: string, filename: string) => Promise<ExportResult>;

      // Dev tools control
      toggleDevTools: () => Promise<IPCResult>;
      openDevTools: () => Promise<IPCResult>;
      closeDevTools: () => Promise<IPCResult>;

      // Auto-update
      performUpdate: () => Promise<IPCResult>;

      // Model price service
      getModelPrices: () => Promise<IPCResult<Record<string, ModelPricing>>>;
      getModelPricingStats: () => Promise<IPCResult<ModelPricingStats>>;
      forceUpdatePrices: () => Promise<IPCResult<boolean>>;
      getModelPricing: (model: string) => Promise<IPCResult<ModelPricing>>;

      // Terminal service
      terminalGetShells: () => Promise<IPCResult<ShellInfo[]>>;
      terminalCreate: (options?: TerminalCreateOptions) => Promise<IPCResult<TerminalSession>>;
      terminalWrite: (id: string, data: string) => Promise<IPCResult>;
      terminalResize: (id: string, cols: number, rows: number) => Promise<IPCResult>;
      terminalDestroy: (id: string) => Promise<IPCResult>;
      terminalList: () => Promise<IPCResult<TerminalSession[]>>;
      terminalGetInfo: (id: string) => Promise<IPCResult<TerminalSession>>;

      // Terminal event listeners
      onTerminalData: (callback: (data: TerminalDataEvent) => void) => void;
      onTerminalExit: (callback: (data: TerminalExitEvent) => void) => void;
      removeTerminalListeners: () => void;

      // Account service
      accountGetAll: () => Promise<IPCResult<Account[]>>;
      accountGetActive: () => Promise<IPCResult<Account | null>>;
      accountCreate: (accountData: AccountCreateData, apiKey: string) => Promise<IPCResult<Account>>;
      accountUpdate: (id: string, updates: Partial<AccountCreateData>) => Promise<IPCResult<Account>>;
      accountDelete: (id: string) => Promise<IPCResult>;
      accountSetActive: (id: string) => Promise<IPCResult>;
      accountGetApiKey: (id: string) => Promise<IPCResult<string>>;
      accountUpdateApiKey: (id: string, newApiKey: string) => Promise<IPCResult>;
      accountGetEnv: () => Promise<IPCResult<Record<string, string>>>;
      accountExport: () => Promise<IPCResult<string>>;
      accountImport: (data: string, apiKeys: Record<string, string>) => Promise<IPCResult<Account[]>>;

      // MCP (Model Context Protocol) service
      mcpGetServers: () => Promise<IPCResult<MCPServerConfig[]>>;
      mcpAddServer: (serverConfig: Omit<MCPServerConfig, 'id'>) => Promise<IPCResult<MCPServerConfig>>;
      mcpUpdateServer: (serverId: string, updates: Partial<MCPServerConfig>) => Promise<IPCResult<MCPServerConfig>>;
      mcpRemoveServer: (serverId: string) => Promise<IPCResult>;
      mcpConnect: (serverId: string) => Promise<IPCResult>;
      mcpDisconnect: (serverId: string) => Promise<IPCResult>;
      mcpSetAutoConnect: (serverId: string, enabled: boolean) => Promise<IPCResult>;
      mcpGetServerInfo: (serverId: string) => Promise<IPCResult<MCPServerCapabilities>>;
      mcpExecuteTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<IPCResult<unknown>>;
      mcpReadResource: (serverId: string, uri: string) => Promise<IPCResult<unknown>>;
      mcpGetPrompt: (serverId: string, promptName: string, args: Record<string, unknown>) => Promise<IPCResult<unknown>>;
      mcpGetAllTools: () => Promise<IPCResult<Array<MCPTool & { serverId: string }>>>;
      mcpGetAllResources: () => Promise<IPCResult<Array<MCPResource & { serverId: string }>>>;
      mcpGetAllPrompts: () => Promise<IPCResult<Array<MCPPrompt & { serverId: string }>>>;

      // MCP event listeners
      onMcpServerStatus: (callback: (data: MCPServerStatus) => void) => void;
      onMcpServerCapabilities: (callback: (data: MCPServerCapabilities) => void) => void;
      onMcpServerLog: (callback: (data: MCPServerLog) => void) => void;
      onMcpServerError: (callback: (data: MCPServerError) => void) => void;
      removeMcpListeners: () => void;

      // Generic invoke method
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;

      // Listen for events (for auto-push from backend)
      on: (channel: string, callback: (...args: unknown[]) => void) => void;

      // Menu actions
      onRefreshData: (callback: () => void) => void;
      onToggleTheme: (callback: () => void) => void;

      // Remove listeners
      removeAllListeners: (channel: string) => void;

      // Window state management
      saveWindowState: () => Promise<IPCResult>;
      getWindowState: () => Promise<WindowState>;

      // Screenshot functionality
      takeFullPageScreenshot: () => Promise<ScreenshotResult>;
      onHotkeyScreenshot: (callback: () => void) => void;

      // SSH Support
      'ssh-set-config': (config: SSHConfig) => Promise<IPCResult>;
      'ssh-get-config': () => Promise<IPCResult<SSHConfig>>;
      'ssh-test-connection': (config: SSHConfig) => Promise<IPCResult & { message: string }>;
      'ssh-execute-command': (config: SSHConfig, command: string) => Promise<IPCResult<string>>;

      // Legacy IPC calls (for compatibility)
      invokeClaudeProjectsStats: () => Promise<IPCResult<UsageStats>>;
      invokeClaudeProjectsDaily: () => Promise<IPCResult<DailyUsageData[]>>;
      invokeClaudeProjectsMonthly: () => Promise<IPCResult<MonthlyUsageData[]>>;
      invokeClaudeProjectsSessions: () => Promise<IPCResult<SessionData[]>>;
      invokeClaudeProjectsProjects: () => Promise<IPCResult<ProjectData[]>>;
      invokeClaudeProjectsBlocks: () => Promise<IPCResult<unknown>>;
      invokeClaudeProjectsCurrentSession: () => Promise<IPCResult<CurrentSessionData>>;
      invokeClaudeProjectsLive: () => Promise<IPCResult<LiveSessionData>>;
      invokeClaudeProjectsForceReload: () => Promise<IPCResult>;
    };

    // Dragon UI specific enhancements
    dragonAPI: {
      platform: NodeJS.Platform;
      isElectron: boolean;
      version: string;
      claudeCodeMaxLoaded: boolean;
      claudeProjectsLoaded: boolean;
    };
  }
}

export {
  SSHConfig,
  DailyUsageData,
  MonthlyUsageData,
  SessionData,
  ProjectData,
  UsageStats,
  CurrentSessionData,
  LiveSessionData,
  ClaudePaths,
  ShellInfo,
  TerminalSession,
  TerminalCreateOptions,
  TerminalDataEvent,
  TerminalExitEvent,
  Account,
  AccountCreateData,
  MCPServerConfig,
  MCPServerStatus,
  MCPServerCapabilities,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPServerLog,
  MCPServerError,
  ModelPricing,
  ModelPricingStats,
  IPCResult,
  ExportResult,
  ScreenshotResult,
  WindowState
};
