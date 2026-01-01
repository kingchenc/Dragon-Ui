/**
 * Statusline Types and Interfaces
 * Defines the structure for configurable statusline components
 */

export interface StatuslineElement {
  id: string;
  label: string;
  visible: boolean;
  color: string;
  bgColor?: string;
  emoji?: string;
  order: number;
}

export interface StatuslineConfig {
  // Layout & Style
  style: 'modern' | 'classic' | 'minimal' | 'dragon';
  lines: 1 | 2 | 3;
  compactMode: boolean;

  // Visual Settings
  useEmojis: boolean;
  useColors: boolean;
  fontFamily: string;
  fontSize: number;

  // Elements Configuration
  elements: StatuslineElement[];

  // Dragon UI Specific Elements
  showDragonMetrics: boolean;
  showProjectStats: boolean;
  showSessionInfo: boolean;

  // Performance
  refreshInterval: number;
  animateUpdates: boolean;
}

export interface StatuslineData {
  // System Info
  model?: string;
  branch?: string;
  version?: string;
  cwd?: string;

  // Token Usage
  tokensIn?: number;
  tokensOut?: number;
  tokensCached?: number;
  tokensTotal?: number;

  // Context Info
  contextCurrent?: number;
  contextMax?: number;
  contextUsed?: number;
  sessionTime?: string;
  blockTime?: string;

  // Cost Tracking
  cost?: number;

  // Dragon UI Specific
  activeProjects?: number;
  totalSessions?: number;
  dailyUsage?: number;
  lastUpdate?: Date;
}

export type StatuslineStyle = Pick<StatuslineConfig, 'style' | 'lines' | 'compactMode'>;

export const DEFAULT_STATUSLINE_CONFIG: StatuslineConfig = {
  style: 'dragon',
  lines: 1,
  compactMode: false,
  useEmojis: true,
  useColors: true,
  fontFamily: 'monospace',
  fontSize: 12,
  elements: [
    { id: 'model', label: 'Model', visible: true, color: '#10b981', order: 1 },
    { id: 'branch', label: 'Branch', visible: true, color: '#8b5cf6', order: 2 },
    { id: 'version', label: 'Version', visible: true, color: '#06b6d4', order: 3 },
    { id: 'cwd', label: 'Directory', visible: true, color: '#f59e0b', order: 4 },
    { id: 'tokens', label: 'Tokens', visible: true, color: '#ef4444', order: 5 },
    { id: 'context', label: 'Context', visible: true, color: '#84cc16', order: 6 },
    { id: 'session', label: 'Session', visible: true, color: '#3b82f6', order: 7 },
    { id: 'cost', label: 'Cost', visible: true, color: '#a855f7', order: 8 },
  ],
  showDragonMetrics: true,
  showProjectStats: true,
  showSessionInfo: true,
  refreshInterval: 1000,
  animateUpdates: true
};

export const STATUSLINE_STYLES = {
  modern: {
    name: 'Modern',
    description: 'Clean, minimalist design with subtle gradients',
    preview: 'Model: claude-sonnet-4 | main | v1.2.1'
  },
  classic: {
    name: 'Classic',
    description: 'Traditional terminal-style status line',
    preview: '[claude-sonnet-4] [main] [v1.2.1] [cwd]'
  },
  minimal: {
    name: 'Minimal',
    description: 'Bare essentials, maximum information density',
    preview: 'sonnet-4 | main | 1.2.1 | cwd'
  },
  dragon: {
    name: 'Dragon',
    description: 'Dragon UI themed with colors and animations',
    preview: '🐲 claude-sonnet-4 | ⚡ main | v1.2.1'
  }
} as const;

export const FONT_FAMILIES = [
  { value: 'monospace', label: 'Monospace' },
  { value: 'system-ui', label: 'System UI' },
  { value: 'SF Mono', label: 'SF Mono' },
  { value: 'Consolas', label: 'Consolas' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' }
];

export const PRESET_COLORS = [
  '#10b981', '#8b5cf6', '#06b6d4', '#f59e0b',
  '#ef4444', '#84cc16', '#3b82f6', '#a855f7',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1'
];