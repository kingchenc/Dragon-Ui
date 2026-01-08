/**
 * Dragon UI CLI Type Definitions
 * TypeScript declarations for CLI modules
 */

import type {
  StatuslineSettings,
  StatuslineData,
  PowerlineSettings,
  ProviderWithState,
  DetectionResult,
  AgentStats,
  MigrationStatus,
  BackupResult,
  ThemeName
} from './services';

// ============================================
// CLI Settings Types
// ============================================

export interface CLISettings {
  useColors: boolean;
  tableStyle: 'default' | 'minimal' | 'compact';
  refreshInterval: number;
  dateFormat: string;
  compactMode: boolean;
  showEmojis: boolean;
}

export interface AppSettings {
  cli: CLISettings;
  statusline: StatuslineSettings;
  powerline: PowerlineSettings;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardData {
  overview: {
    totalTokens: number;
    totalCost: number;
    totalSessions: number;
    activeModel: string;
  };
  sessions: Array<{
    id: string;
    project: string;
    model: string;
    tokens: number;
    cost: number;
    duration: string;
    status: 'active' | 'completed';
  }>;
  charts: {
    hourly: number[];
    daily: number[];
    models: Array<{ name: string; value: number }>;
  };
}

export interface DashboardRenderer {
  render(data: DashboardData): void;
  clear(): void;
  setTitle(title: string): void;
  refresh(): Promise<void>;
}

// ============================================
// Command Types
// ============================================

export interface CommandOptions {
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// ============================================
// Pricing Command Types
// ============================================

export interface PricingShowOptions extends CommandOptions {
  filter?: string;
  sort?: 'name' | 'input' | 'output';
}

export interface PricingCalculateOptions {
  model: string;
  input: number;
  output: number;
  cached?: number;
}

export interface PricingCommands {
  showPricing(options?: PricingShowOptions): void;
  refreshPricing(): Promise<void>;
  detectModel(modelName: string): void;
  calculateCost(input: number, output: number, model: string, options?: { cached?: number }): void;
  showCacheStats(): void;
}

// ============================================
// Powerline Command Types
// ============================================

export interface PowerlinePreviewOptions {
  theme?: string;
  separator?: string;
  full?: boolean;
}

export interface PowerlineCommands {
  enablePowerline(theme?: string): Promise<void>;
  disablePowerline(): Promise<void>;
  setTheme(theme: string): Promise<void>;
  listThemes(): Promise<void>;
  setSeparator(type: string): Promise<void>;
  listSeparators(): Promise<void>;
  showPreview(theme?: string): Promise<void>;
  previewAllThemes(): Promise<void>;
  showStatus(): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// Live Dashboard Command Types
// ============================================

export interface LiveDashboardOptions {
  interval?: number;
  compact?: boolean;
  widgets?: string[];
}

export interface LiveDashboardCommands {
  startLiveDashboard(options?: LiveDashboardOptions): Promise<void>;
  showLiveHelp(): Promise<void>;
}

// ============================================
// Custom Commands Types
// ============================================

export interface CustomCommandsAddOptions {
  id: string;
  name: string;
  command: string;
  template?: string;
  prefix?: string;
  suffix?: string;
  transform?: string;
  timeout?: string;
  cache?: string;
  fallback?: string;
  maxLength?: string;
}

export interface CustomCommandsCommands {
  listCommands(): Promise<void>;
  listTemplates(): Promise<void>;
  listTransformers(): Promise<void>;
  addCommand(options: CustomCommandsAddOptions): Promise<void>;
  removeCommand(id: string): Promise<void>;
  testCommand(options: Partial<CustomCommandsAddOptions>): Promise<void>;
  previewCommand(options: Partial<CustomCommandsAddOptions>): Promise<void>;
  exportCommands(filePath?: string): Promise<void>;
  importCommands(filePath: string): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// Provider Command Types
// ============================================

export interface ProviderCommands {
  listProviders(options?: CommandOptions): Promise<void>;
  showProvider(id: string): Promise<void>;
  setActiveProvider(id: string): Promise<void>;
  enableProvider(id: string): Promise<void>;
  disableProvider(id: string): Promise<void>;
  checkHealth(id?: string): Promise<void>;
  detectProvider(modelName: string): Promise<void>;
  showStats(): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// Agent Command Types
// ============================================

export interface AgentCommands {
  detect(input: string, options?: CommandOptions): Promise<void>;
  analyzeFile(filePath: string): Promise<void>;
  showStats(): Promise<void>;
  showSession(sessionId?: string): Promise<void>;
  listTypes(): Promise<void>;
  listCategories(): Promise<void>;
  clearCache(): Promise<void>;
  resetStats(): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// Migration Command Types
// ============================================

export interface MigrationRunOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
}

export interface MigrationCommands {
  checkStatus(): Promise<void>;
  runMigration(options?: MigrationRunOptions): Promise<void>;
  listBackups(): Promise<void>;
  createBackup(label?: string): Promise<void>;
  restoreBackup(backupName: string): Promise<void>;
  deleteBackup(backupName: string): Promise<void>;
  exportSettings(filePath?: string): Promise<void>;
  importSettings(filePath: string, options?: { backup?: boolean }): Promise<void>;
  resetSettings(key?: string, options?: { force?: boolean; backup?: boolean }): Promise<void>;
  showFiles(): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// TUI Command Types
// ============================================

export interface TUIStartOptions {
  theme?: ThemeName;
  interval?: number;
  title?: string;
}

export interface TUICommands {
  startTUI(options?: TUIStartOptions): Promise<void>;
  startFallbackDashboard(options?: TUIStartOptions): Promise<void>;
  listThemes(): Promise<void>;
  previewTheme(themeName: string): Promise<void>;
  showHelp(): Promise<void>;
}

// ============================================
// Config Manager Types
// ============================================

export interface ConfigFile {
  cli?: Partial<CLISettings>;
  statusline?: Partial<StatuslineSettings>;
  powerline?: Partial<PowerlineSettings>;
  database?: {
    path?: string;
    backupEnabled?: boolean;
    backupInterval?: number;
  };
  display?: {
    theme?: string;
    language?: string;
    dateFormat?: string;
    numberFormat?: string;
  };
}

export interface ConfigManager {
  findConfig(customPath?: string): string | null;
  loadConfig(options?: { config?: string }): ConfigFile;
  getLoadedConfigPath(): string | null;
  initConfig(): { success: boolean; path?: string; error?: string };
  showHelp(): void;
}

// ============================================
// Data Adapter Types
// ============================================

export interface ActiveData {
  activeSession: {
    sessionId: string;
    projectPath: string | null;
    model: string;
    startTime: string;
    totalTokens: number;
    totalCost: number;
  } | null;
  recentRequests: Array<{
    timestamp: string;
    model: string;
    tokens: number;
    cost: number;
  }>;
}

export interface CLIDataAdapter {
  init(): Promise<void>;
  getActiveData(): Promise<ActiveData>;
  getOverviewData(): Promise<{
    totalTokens: number;
    totalCost: number;
    totalSessions: number;
    totalRequests: number;
    models: string[];
  }>;
  getSessionHistory(limit?: number): Promise<Array<{
    id: string;
    project: string;
    model: string;
    tokens: number;
    cost: number;
    startTime: string;
    endTime: string | null;
  }>>;
  close(): void;
}

// ============================================
// Screen Utilities Types
// ============================================

export interface ScreenUtils {
  clearScreen(): void;
  moveCursor(row: number, col: number): void;
  hideCursor(): void;
  showCursor(): void;
  getTerminalSize(): { width: number; height: number };
  isInteractive(): boolean;
}

// ============================================
// Color Utilities Types
// ============================================

export interface ColorUtils {
  initChalk(): Promise<typeof import('chalk').default>;
  getChalk(): typeof import('chalk').default | null;
  hexToAnsi(hex: string): number;
  rgbToAnsi(r: number, g: number, b: number): number;
  supportsColor(): boolean;
  supports256Colors(): boolean;
  supportsTrueColor(): boolean;
}

// ============================================
// Table Rendering Types
// ============================================

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: (value: unknown) => string;
}

export interface TableOptions {
  style?: 'default' | 'minimal' | 'compact' | 'bordered';
  showHeaders?: boolean;
  showRowNumbers?: boolean;
  maxWidth?: number;
  truncate?: boolean;
}

export interface TableRenderer {
  render(data: Array<Record<string, unknown>>, columns: TableColumn[], options?: TableOptions): string;
}

// ============================================
// Export all types
// ============================================

export {
  CLISettings,
  AppSettings,
  DashboardData,
  DashboardRenderer,
  CommandOptions,
  CommandResult,
  PricingShowOptions,
  PricingCalculateOptions,
  PricingCommands,
  PowerlinePreviewOptions,
  PowerlineCommands,
  LiveDashboardOptions,
  LiveDashboardCommands,
  CustomCommandsAddOptions,
  CustomCommandsCommands,
  ProviderCommands,
  AgentCommands,
  MigrationRunOptions,
  MigrationCommands,
  TUIStartOptions,
  TUICommands,
  ConfigFile,
  ConfigManager,
  ActiveData,
  CLIDataAdapter,
  ScreenUtils,
  ColorUtils,
  TableColumn,
  TableOptions,
  TableRenderer
};
