const { contextBridge, ipcRenderer } = require('electron');

console.log('[DRAGON] Dragon UI Preload starting...');

// Test basic functionality
console.log('[SCAN] Preload environment:');
console.log('   - Node Integration:', process.versions.node ? 'Available' : 'Not Available');
console.log('   - Context Isolation:', typeof contextBridge !== 'undefined');

// Claude Projects API via IPC (Claude Code Max API)
const claudeProjectsAPI = {
  loadDailyUsageData: async () => {
    console.log('[LOAD] Requesting daily usage data via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-daily');
      if (result.success) {
        console.log('[OK] Daily usage data loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Daily usage failed:', result.error);
        return [];
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for daily usage:', error);
      return [];
    }
  },

  loadMonthlyUsageData: async () => {
    console.log('[LOAD] Requesting monthly usage data via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-monthly');
      if (result.success) {
        console.log('[OK] Monthly usage data loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Monthly usage failed:', result.error);
        return [];
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for monthly usage:', error);
      return [];
    }
  },

  loadSessionData: async () => {
    console.log('[LOAD] Requesting session data via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-sessions');
      if (result.success) {
        console.log('[OK] Session data loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Session data failed:', result.error);
        return [];
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for session data:', error);
      return [];
    }
  },

  loadProjectData: async () => {
    console.log('[LOAD] Requesting project data via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-projects');
      if (result.success) {
        console.log('[OK] Project data loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Project data failed:', result.error);
        return [];
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for project data:', error);
      return [];
    }
  },

  loadUsageStats: async () => {
    console.log('[LOAD] Requesting usage stats via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-stats');
      if (result.success) {
        console.log('[OK] Usage stats loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Usage stats failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for usage stats:', error);
      return null;
    }
  },

  loadCurrentSession: async () => {
    console.log('[LOAD] Requesting current session via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-current-session');
      if (result.success) {
        console.log('[OK] Current session loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Current session failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for current session:', error);
      return null;
    }
  },

  loadLiveSessionData: async () => {
    console.log('[LOAD] Requesting live session data via Claude Projects IPC...');
    try {
      const result = await ipcRenderer.invoke('claude-projects-live');
      if (result.success) {
        console.log('[OK] Live session data loaded via', result.source);
        return result.data;
      } else {
        console.error('[FAILED] Live session failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for live session:', error);
      return null;
    }
  },

  // Path management functions
  getClaudePaths: async () => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-paths');
      if (result.success) {
        return result.data;
      } else {
        console.error('[FAILED] Get paths failed:', result.error);
        return { standard: [], custom: [], active: [] };
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for get paths:', error);
      return { standard: [], custom: [], active: [] };
    }
  },

  addCustomPath: async (customPath) => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-add-path', customPath);
      return result.success;
    } catch (error) {
      console.error('[IPC ERR] IPC error for add path:', error);
      return false;
    }
  },

  removeCustomPath: async (customPath) => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-remove-path', customPath);
      return result.success;
    } catch (error) {
      console.error('[IPC ERR] IPC error for remove path:', error);
      return false;
    }
  },

  refreshPaths: async () => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-refresh-paths');
      if (result.success) {
        return result.data;
      } else {
        console.error('[FAILED] Refresh paths failed:', result.error);
        return { standard: [], custom: [], active: [] };
      }
    } catch (error) {
      console.error('[IPC ERR] IPC error for refresh paths:', error);
      return { standard: [], custom: [], active: [] };
    }
  },

  // Database management functions
  clearDatabase: async () => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-clear-database');
      return result.success;
    } catch (error) {
      console.error('[IPC ERR] IPC error for clear database:', error);
      return false;
    }
  },

  refreshDatabase: async () => {
    try {
      const result = await ipcRenderer.invoke('claude-projects-refresh-database');
      return result.success;
    } catch (error) {
      console.error('[IPC ERR] IPC error for refresh database:', error);
      return false;
    }
  },

  // Utility functions (maintain compatibility with existing code)
  calculateTotals: (data) => {
    return data.reduce((acc, item) => ({
      totalCost: acc.totalCost + (item.totalCost || item.cost || 0),
      totalTokens: acc.totalTokens + (item.totalTokens || item.tokens || 0)
    }), { totalCost: 0, totalTokens: 0 });
  },

  getTotalTokens: (data) => {
    return data.reduce((total, item) => total + (item.totalTokens || item.tokens || 0), 0);
  }
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  exportData: (data, filename) => ipcRenderer.invoke('export-data', data, filename),
  
  // Dev tools control
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  closeDevTools: () => ipcRenderer.invoke('close-dev-tools'),
  
  // Auto-update
  performUpdate: () => ipcRenderer.invoke('perform-update'),
  
  // Model price service
  getModelPrices: () => ipcRenderer.invoke('model-prices-get-all'),
  getModelPricingStats: () => ipcRenderer.invoke('model-prices-get-stats'),
  forceUpdatePrices: () => ipcRenderer.invoke('model-prices-force-update'),
  getModelPricing: (model) => ipcRenderer.invoke('model-prices-get-for-model', model),
  
  // Generic invoke method for store.ts
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Listen for events (for auto-push from backend)
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  
  // Listen for menu actions
  onRefreshData: (callback) => {
    ipcRenderer.on('refresh-data', callback);
  },
  onToggleTheme: (callback) => {
    ipcRenderer.on('toggle-theme', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Window state management
  saveWindowState: () => ipcRenderer.invoke('save-window-state'),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  
  // Screenshot functionality
  takeFullPageScreenshot: () => ipcRenderer.invoke('take-full-page-screenshot'),
  onHotkeyScreenshot: (callback) => {
    ipcRenderer.on('hotkey-screenshot', callback);
  },

  // Direct IPC calls for store.ts (legacy compatibility)
  invokeClaudeProjectsStats: () => ipcRenderer.invoke('claude-projects-stats'),
  invokeClaudeProjectsDaily: () => ipcRenderer.invoke('claude-projects-daily'),
  invokeClaudeProjectsMonthly: () => ipcRenderer.invoke('claude-projects-monthly'),
  invokeClaudeProjectsSessions: () => ipcRenderer.invoke('claude-projects-sessions'),
  invokeClaudeProjectsProjects: () => ipcRenderer.invoke('claude-projects-projects'),
  invokeClaudeProjectsBlocks: () => ipcRenderer.invoke('claude-projects-blocks'),
  invokeClaudeProjectsCurrentSession: () => ipcRenderer.invoke('claude-projects-current-session'),
  invokeClaudeProjectsLive: () => ipcRenderer.invoke('claude-projects-live'),
  invokeClaudeProjectsForceReload: () => ipcRenderer.invoke('claude-projects-force-reload')
});

// Claude Projects API for Dragon UI (Claude Code Max API)
contextBridge.exposeInMainWorld('claudeMaxAPI', claudeProjectsAPI);

// Dragon UI specific enhancements
contextBridge.exposeInMainWorld('dragonAPI', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
  claudeCodeMaxLoaded: true,  // Claude Code Max is now used
  claudeProjectsLoaded: true  // New service is available
});

console.log('[OK] Dragon UI Preload complete - Claude Projects APIs exposed via IPC');