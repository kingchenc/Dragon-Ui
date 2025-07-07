// Global window interface extensions for Dragon UI

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

// Vite build-time constants
declare const __APP_VERSION__: string;

declare global {
  interface Window {
    // Claude Projects API (Claude Code Max)
    claudeMaxAPI: {
      // Data loading functions
      loadDailyUsageData: () => Promise<any[]>;
      loadMonthlyUsageData: () => Promise<any[]>;
      loadSessionData: () => Promise<any[]>;
      loadProjectData: () => Promise<any[]>;
      loadUsageStats: () => Promise<any>;
      loadCurrentSession: () => Promise<any>;
      loadLiveSessionData: () => Promise<any>;
      
      // Path management functions
      getClaudePaths: () => Promise<{ standard: string[], custom: string[], active: string[] }>;
      addCustomPath: (customPath: string) => Promise<boolean>;
      removeCustomPath: (customPath: string) => Promise<boolean>;
      refreshPaths: () => Promise<{ standard: string[], custom: string[], active: string[] }>;
      
      // Database management functions
      clearDatabase: () => Promise<{ success: boolean }>;
      refreshDatabase: () => Promise<{ success: boolean }>;
      
      // Utility functions (maintain compatibility)
      calculateTotals: (data: any[]) => { totalCost: number; totalTokens: number };
      getTotalTokens: (data: any[]) => number;
    };
    
    // Electron APIs
    electronAPI: {
      getAppVersion: () => Promise<string>;
      exportData: (data: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
      
      // Generic IPC methods for store.ts
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      
      // Menu actions
      onRefreshData: (callback: () => void) => void;
      onToggleTheme: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
      
      // Window state management
      saveWindowState: () => Promise<{ success: boolean }>;
      getWindowState: () => Promise<any>;
      
      // Screenshot functionality
      takeFullPageScreenshot: () => Promise<{ success: boolean; filePath?: string; message?: string; error?: string }>;
      onHotkeyScreenshot: (callback: () => void) => void;
      
      // Dev tools control
      toggleDevTools: () => Promise<{ success: boolean; error?: string }>;
      openDevTools: () => Promise<{ success: boolean; error?: string }>;
      closeDevTools: () => Promise<{ success: boolean; error?: string }>;
      
      // Auto-update
      performUpdate: () => Promise<{ success: boolean; error?: string }>;
      
      // Model price service
      getModelPrices: () => Promise<{ success: boolean; prices?: any; error?: string }>;
      getModelPricingStats: () => Promise<{ success: boolean; stats?: any; error?: string }>;
      forceUpdatePrices: () => Promise<{ success: boolean; updated?: boolean; error?: string }>;
      getModelPricing: (model: string) => Promise<{ success: boolean; pricing?: any; error?: string }>;
      
      // App state events
      onAppMinimized: (callback: () => void) => void;
      onAppRestored: (callback: () => void) => void;
      onAppFocused: (callback: () => void) => void;
      
      // SSH Support
      'ssh-set-config': (config: SSHConfig) => Promise<{ success: boolean; message?: string; error?: string }>;
      'ssh-get-config': () => Promise<{ success: boolean; data?: SSHConfig; error?: string }>;
      'ssh-test-connection': (config: SSHConfig) => Promise<{ success: boolean; message: string; error?: string }>;
      'ssh-execute-command': (config: SSHConfig, command: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      
      // Legacy IPC calls (for compatibility)
      invokeClaudeProjectsStats: () => Promise<any>;
      invokeClaudeProjectsDaily: () => Promise<any>;
      invokeClaudeProjectsMonthly: () => Promise<any>;
      invokeClaudeProjectsSessions: () => Promise<any>;
      invokeClaudeProjectsProjects: () => Promise<any>;
      invokeClaudeProjectsBlocks: () => Promise<any>;
      invokeClaudeProjectsCurrentSession: () => Promise<any>;
      invokeClaudeProjectsLive: () => Promise<any>;
      invokeClaudeProjectsForceReload: () => Promise<any>;
    };
    
    // Dragon UI specific enhancements
    dragonAPI: {
      platform: string;
      isElectron: boolean;
      version: string;
      claudeCodeMaxLoaded: boolean;  // true now
      claudeProjectsLoaded: boolean;  // true now
    };
  }
}

export {};