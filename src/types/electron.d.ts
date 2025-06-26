// Electron API types for window.electronAPI
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  exportData: (data: string, filename: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
    canceled?: boolean;
  }>;
  onRefreshData: (callback: () => void) => void;
  onToggleTheme: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
  
  // Window state management
  saveWindowState: () => Promise<{ success: boolean }>;
  getWindowState: () => Promise<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isMaximized?: boolean;
    isFullScreen?: boolean;
  }>;
  
  // Direct IPC calls for modular services
  invokeClaudeProjectsStats: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsDaily: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsMonthly: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsSessions: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsProjects: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsBlocks: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsCurrentSession: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsLive: () => Promise<{ success: boolean; data: any; error?: string }>;
  invokeClaudeProjectsForceReload: () => Promise<{ success: boolean; message?: string; error?: string }>;
}

// Claude Max API types
export interface ClaudeMaxAPI {
  loadDailyUsageData: () => Promise<any[]>;
  loadMonthlyUsageData: () => Promise<any[]>;
  loadSessionData: () => Promise<any[]>;
  loadProjectData: () => Promise<any[]>;
  loadUsageStats: () => Promise<any>;
  loadCurrentSession: () => Promise<any>;
  loadLiveSessionData: () => Promise<any>;
  getClaudePaths: () => Promise<{ standard: string[]; custom: string[]; active: string[] }>;
  addCustomPath: (path: string) => Promise<boolean>;
  removeCustomPath: (path: string) => Promise<boolean>;
  refreshPaths: () => Promise<{ standard: string[]; custom: string[]; active: string[] }>;
  clearDatabase: () => Promise<{ success: boolean }>;
  refreshDatabase: () => Promise<{ success: boolean }>;
  calculateTotals: (data: any[]) => { totalCost: number; totalTokens: number };
  getTotalTokens: (data: any[]) => number;
}

// Dragon API types
export interface DragonAPI {
  platform: string;
  isElectron: boolean;
  version: string;
  claudeCodeMaxLoaded: boolean;
  claudeProjectsLoaded: boolean;
}

// Extend Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    claudeMaxAPI: ClaudeMaxAPI;
    dragonAPI: DragonAPI;
  }
}

export {};