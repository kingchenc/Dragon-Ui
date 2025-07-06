const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  exportData: (data, filename) => ipcRenderer.invoke('export-data', data, filename),
  
  // Dev tools control
  toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  closeDevTools: () => ipcRenderer.invoke('close-dev-tools'),
  
  // Listen for menu actions
  onRefreshData: (callback) => {
    ipcRenderer.on('refresh-data', callback);
  },
  onToggleTheme: (callback) => {
    ipcRenderer.on('toggle-theme', callback);
  },
  
  // Listen for app state changes
  onAppMinimized: (callback) => {
    ipcRenderer.on('app-minimized', callback);
  },
  onAppRestored: (callback) => {
    ipcRenderer.on('app-restored', callback);
  },
  onAppFocused: (callback) => {
    ipcRenderer.on('app-focused', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Dragon UI specific enhancements
contextBridge.exposeInMainWorld('dragonAPI', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron
});