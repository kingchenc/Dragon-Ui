/**
 * Dragon UI Service Type Definitions
 * TypeScript declarations for all service modules
 */

// ============================================
// Core Data Service Types
// ============================================

export interface SessionData {
  id: string;
  sessionId: string;
  projectPath: string | null;
  model: string;
  startTime: string;
  endTime: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCost: number;
  requestCount: number;
  isActive: boolean;
}

export interface OverviewData {
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
  totalRequests: number;
  activeSession: SessionData | null;
  models: string[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  type: 'session' | 'request' | 'error';
  timestamp: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface HourlyData {
  hour: string;
  tokens: number;
  cost: number;
  requests: number;
}

export interface ModelStats {
  model: string;
  tokens: number;
  cost: number;
  requests: number;
  percentage: number;
}

export interface CoreDataService {
  init(): Promise<void>;
  getOverviewData(): Promise<OverviewData>;
  getRecentSessions(limit?: number): Promise<SessionData[]>;
  getHourlyData(hours?: number): Promise<HourlyData[]>;
  getModelStats(): Promise<ModelStats[]>;
  getActiveSession(): Promise<SessionData | null>;
  close(): void;
}

// ============================================
// Provider Manager Types
// ============================================

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'zhipu'
  | 'azure'
  | 'bedrock'
  | 'vertex'
  | 'ollama'
  | 'together'
  | 'groq'
  | 'deepseek';

export interface ProviderFeatures {
  streaming: boolean;
  caching: boolean;
  batching: boolean;
  vision: boolean;
  toolUse: boolean;
}

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  apiKeyEnvVar: string;
  baseUrl: string;
  modelPrefixes: string[];
  models?: string[];
  features: ProviderFeatures;
  costMultiplier?: number;
}

export interface ProviderState {
  enabled: boolean;
  lastCheck: string | null;
  healthy: boolean;
  requestCount: number;
  totalCost: number;
}

export interface ProviderWithState extends ProviderDefinition {
  state: ProviderState;
  hasApiKey: boolean;
}

export interface ProviderManager {
  init(): void;
  getAllProviders(): Record<ProviderId, ProviderWithState>;
  getProvider(id: ProviderId): ProviderWithState | null;
  getActiveProvider(): ProviderId;
  setActiveProvider(id: ProviderId): boolean;
  enableProvider(id: ProviderId): boolean;
  disableProvider(id: ProviderId): boolean;
  detectProvider(modelName: string): ProviderId | null;
  checkHealth(id: ProviderId): Promise<boolean>;
  getStats(): ProviderState;
}

// ============================================
// Agent Detector Types
// ============================================

export type AgentType =
  | 'tool_use'
  | 'mcp'
  | 'code_execution'
  | 'file_operation'
  | 'web_operation'
  | 'system_operation'
  | 'unknown';

export type ToolCategory =
  | 'file_operations'
  | 'code_execution'
  | 'web_operations'
  | 'database_operations'
  | 'system_operations'
  | 'mcp_operations'
  | 'search_operations'
  | 'edit_operations';

export interface DetectionResult {
  type: AgentType;
  confidence: number;
  toolName: string | null;
  category: ToolCategory | null;
  metadata: Record<string, unknown>;
}

export interface AgentStats {
  totalDetections: number;
  byType: Record<AgentType, number>;
  byCategory: Record<ToolCategory, number>;
  byTool: Record<string, number>;
  avgConfidence: number;
}

export interface SessionAgentStats {
  sessionId: string;
  stats: AgentStats;
  history: DetectionResult[];
}

export interface AgentDetector {
  detect(input: string): DetectionResult;
  analyzeContent(content: string): DetectionResult[];
  getSessionStats(sessionId: string): SessionAgentStats | null;
  getGlobalStats(): AgentStats;
  clearCache(): void;
  resetStats(): void;
}

// ============================================
// Settings Migration Types
// ============================================

export type SettingsKey =
  | 'main'
  | 'statusline'
  | 'powerline'
  | 'widgets'
  | 'providers'
  | 'customCommands'
  | 'cache'
  | 'agentStats';

export interface MigrationDefinition {
  description: string;
  migrate: (settings: Record<string, unknown>) => Record<string, unknown>;
}

export interface BackupResult {
  success: boolean;
  path?: string;
  files?: string[];
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restored?: string[];
  version?: string;
  timestamp?: string;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  fromVersion?: string;
  toVersion?: string;
  appliedMigrations?: Array<{ version: string; description: string }>;
  error?: string;
}

export interface MigrationStatus {
  currentVersion: string;
  needsMigration: boolean;
  details: Record<SettingsKey, {
    exists: boolean;
    currentVersion?: string;
    targetVersion?: string;
    needsMigration: boolean;
  }>;
}

export interface SettingsMigrationManager {
  loadPackageVersion(): string;
  getSettingsPath(key: SettingsKey): string;
  loadSettings(key: SettingsKey): Record<string, unknown> | null;
  saveSettings(key: SettingsKey, settings: Record<string, unknown>): boolean;
  getSettingsVersion(settings: Record<string, unknown>): string;
  compareVersions(v1: string, v2: string): number;
  getMigrationsToApply(fromVersion: string, toVersion: string): MigrationDefinition[];
  createBackup(label?: string): BackupResult;
  listBackups(): Array<{
    name: string;
    label: string;
    timestamp: string;
    version: string;
    files: string[];
  }>;
  restoreBackup(backupName: string): RestoreResult;
  deleteBackup(backupName: string): { success: boolean; error?: string };
  migrateSettings(key: SettingsKey, targetVersion?: string): MigrationResult;
  migrateAll(options?: { backup?: boolean }): {
    success: boolean;
    backup: BackupResult | null;
    migrations: Record<SettingsKey, MigrationResult>;
  };
  checkMigrationNeeded(): MigrationStatus;
  exportSettings(exportPath: string): { success: boolean; path?: string; error?: string };
  importSettings(importPath: string, options?: { backup?: boolean }): {
    success: boolean;
    imported?: string[];
    sourceVersion?: string;
    error?: string;
  };
  resetSettings(key: SettingsKey): { success: boolean; skipped?: boolean; reason?: string; error?: string };
  resetAll(options?: { backup?: boolean }): Record<SettingsKey, { success: boolean; skipped?: boolean; reason?: string; error?: string }>;
}

// ============================================
// TUI Dashboard Types
// ============================================

export type ComponentType =
  | 'box'
  | 'list'
  | 'table'
  | 'log'
  | 'gauge'
  | 'sparkline'
  | 'bar'
  | 'tree'
  | 'markdown'
  | 'donut'
  | 'lcd'
  | 'map'
  | 'picture';

export type ThemeName = 'dragon' | 'ocean' | 'forest' | 'minimal';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  border: string;
  text: string;
  muted: string;
  success: string;
  warning: string;
  error: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  borderType: 'line' | 'double';
  focusStyle: { border: { fg: string } };
}

export interface ComponentPosition {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface TUIDataProviderData {
  stats: {
    todayTokens: string;
    totalTokens: string;
    todayCost: string;
    totalCost: string;
    todaySessions: string;
    totalSessions: string;
    todayRequests: string;
    totalRequests: string;
  };
  usage: {
    tokenPercent: number;
    costPercent: number;
  };
  trend: {
    tokens: number[];
  };
  sessions: Array<{
    project: string;
    model: string;
    tokens: number;
    cost: string;
    duration: string;
  }>;
  models: Array<{
    name: string;
    percent: number;
  }>;
}

export interface TUIDataProvider {
  getData(): Promise<TUIDataProviderData>;
}

export interface TUIDashboardOptions {
  title?: string;
  theme?: ThemeName;
  refreshInterval?: number;
  smartCSR?: boolean;
  dataProvider?: TUIDataProvider;
}

export interface TUIDashboard {
  init(): Promise<void>;
  addComponent(id: string, type: ComponentType, position: ComponentPosition, options?: Record<string, unknown>): unknown;
  removeComponent(id: string): void;
  getComponent(id: string): unknown | null;
  updateComponent(id: string, data: unknown): void;
  refresh(): Promise<void>;
  showHelp(): void;
  focusNext(): void;
  focusPrev(): void;
  addTab(id: string, label: string, createFn: (dashboard: TUIDashboard) => void): void;
  nextTab(): void;
  prevTab(): void;
  setDataProvider(provider: TUIDataProvider): void;
  setTheme(themeName: ThemeName): void;
  start(): Promise<void>;
  stop(): void;
  render(): void;
}

// ============================================
// Async DB Writer Types
// ============================================

export type WriteType = 'insert' | 'update' | 'delete' | 'batch' | 'transaction';
export type Priority = 1 | 2 | 3 | 4;

export interface WriteOperation {
  id: string;
  type: WriteType;
  table: string;
  data: Record<string, unknown> | Record<string, unknown>[];
  where?: Record<string, unknown>;
  priority: Priority;
  timestamp: number;
  retries: number;
}

export interface WriteResult {
  lastInsertRowid?: number;
  changes: number;
  inserted?: number;
}

export interface DbWriterStats {
  totalWrites: number;
  successfulWrites: number;
  failedWrites: number;
  retries: number;
  batchesProcessed: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  queueHighWaterMark: number;
  queueSize: number;
  isProcessing: boolean;
  isPaused: boolean;
}

export interface AsyncDbWriterOptions {
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxQueueSize?: number;
}

export interface AsyncDbWriter {
  insert(table: string, data: Record<string, unknown>, priority?: Priority): Promise<WriteResult>;
  update(table: string, data: Record<string, unknown>, where: Record<string, unknown>, priority?: Priority): Promise<WriteResult>;
  delete(table: string, where: Record<string, unknown>, priority?: Priority): Promise<WriteResult>;
  batchInsert(table: string, dataArray: Record<string, unknown>[], priority?: Priority): Promise<WriteResult>;
  transaction<T>(transactionFn: () => T, priority?: Priority): Promise<T>;
  pause(): void;
  resume(): void;
  flush(): Promise<void>;
  getQueueSize(): number;
  getStats(): DbWriterStats;
  resetStats(): void;
  clearQueue(): void;
  shutdown(): Promise<void>;
  isIdle(): boolean;
  waitForIdle(timeout?: number): Promise<void>;
}

// ============================================
// Model Price Service Types
// ============================================

export interface ModelPricing {
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M?: number;
  cacheWriteCostPer1M?: number;
}

export interface PriceResult {
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
  model: string;
  pricing: ModelPricing;
}

export interface ModelPriceService {
  getPricing(modelName: string): ModelPricing | null;
  calculateCost(
    inputTokens: number,
    outputTokens: number,
    modelName: string,
    options?: {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    }
  ): PriceResult | null;
  getAllModels(): string[];
  detectModel(modelName: string): string | null;
  refreshPricing(): Promise<boolean>;
  getCacheStats(): {
    size: number;
    lastRefresh: string | null;
    models: string[];
  };
}

// ============================================
// Statusline Types
// ============================================

export type StatuslineStyle = 'modern' | 'classic' | 'minimal' | 'dragon';

export interface StatuslineSettings {
  style: StatuslineStyle;
  lines: number;
  useColors: boolean;
  useEmojis: boolean;
  compact: boolean;
  showElements: string[];
}

export interface StatuslineData {
  model: string;
  branch: string;
  version: string;
  cwd: string;
  tokensIn: number;
  tokensOut: number;
  tokensTotal: number;
  tokensCached: number;
  context: string;
  session: string;
  cost: string;
}

export interface CLIStatusline {
  updateData(data: Partial<StatuslineData>): void;
  render(): string;
  showHelp(): void;
}

// ============================================
// Powerline Types
// ============================================

export type PowerlineTheme =
  | 'dragon'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'neon'
  | 'monochrome'
  | 'rainbow';

export type SeparatorType = 'arrows' | 'rounded' | 'flames' | 'slant' | 'blocks' | 'pixels' | 'none';

export interface PowerlineSettings {
  enabled: boolean;
  theme: PowerlineTheme;
  separatorType: SeparatorType;
}

export interface PowerlineSegment {
  content: string;
  bg: string;
  fg: string;
  icon?: string;
}

export interface PowerlineRenderer {
  render(segments: PowerlineSegment[]): string;
  setTheme(theme: PowerlineTheme): void;
  setSeparator(type: SeparatorType): void;
}

// ============================================
// Widget Types
// ============================================

export interface WidgetDefinition {
  id: string;
  name: string;
  render: (data: unknown) => string;
  getData?: () => Promise<unknown>;
  cacheDuration?: number;
}

export interface WidgetRegistry {
  register(widget: WidgetDefinition): void;
  unregister(id: string): void;
  get(id: string): WidgetDefinition | null;
  getAll(): WidgetDefinition[];
  render(id: string, data?: unknown): Promise<string>;
}

// ============================================
// Custom Command Types
// ============================================

export type OutputTransformer =
  | 'uppercase'
  | 'lowercase'
  | 'capitalize'
  | 'trim'
  | 'firstLine'
  | 'lastLine'
  | 'firstWord'
  | 'lastWord'
  | 'json'
  | 'csv'
  | 'count'
  | 'sum'
  | 'avg'
  | 'number'
  | 'percent';

export interface CustomCommandDefinition {
  id: string;
  name: string;
  command: string;
  prefix?: string;
  suffix?: string;
  transformer?: OutputTransformer;
  timeout?: number;
  cacheTimeout?: number;
  fallback?: string;
  maxLength?: number;
}

export interface CustomCommandResult {
  success: boolean;
  output?: string;
  error?: string;
  cached?: boolean;
  executionTime?: number;
}

export interface CustomCommandManager {
  add(definition: CustomCommandDefinition): boolean;
  remove(id: string): boolean;
  get(id: string): CustomCommandDefinition | null;
  getAll(): CustomCommandDefinition[];
  execute(id: string): Promise<CustomCommandResult>;
  test(definition: CustomCommandDefinition): Promise<CustomCommandResult>;
  exportAll(): CustomCommandDefinition[];
  importAll(definitions: CustomCommandDefinition[]): number;
}

// ============================================
// Export all types
// ============================================

export {
  SessionData,
  OverviewData,
  ActivityItem,
  HourlyData,
  ModelStats,
  CoreDataService,
  ProviderId,
  ProviderFeatures,
  ProviderDefinition,
  ProviderState,
  ProviderWithState,
  ProviderManager,
  AgentType,
  ToolCategory,
  DetectionResult,
  AgentStats,
  SessionAgentStats,
  AgentDetector,
  SettingsKey,
  MigrationDefinition,
  BackupResult,
  RestoreResult,
  MigrationResult,
  MigrationStatus,
  SettingsMigrationManager,
  ComponentType,
  ThemeName,
  ThemeColors,
  Theme,
  ComponentPosition,
  TUIDataProviderData,
  TUIDataProvider,
  TUIDashboardOptions,
  TUIDashboard,
  WriteType,
  Priority,
  WriteOperation,
  WriteResult,
  DbWriterStats,
  AsyncDbWriterOptions,
  AsyncDbWriter,
  ModelPricing,
  PriceResult,
  ModelPriceService,
  StatuslineStyle,
  StatuslineSettings,
  StatuslineData,
  CLIStatusline,
  PowerlineTheme,
  SeparatorType,
  PowerlineSettings,
  PowerlineSegment,
  PowerlineRenderer,
  WidgetDefinition,
  WidgetRegistry,
  OutputTransformer,
  CustomCommandDefinition,
  CustomCommandResult,
  CustomCommandManager
};
