// Global window interface extensions for Dragon UI

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