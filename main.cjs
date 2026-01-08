const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog, globalShortcut } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs');
const os = require('os');

// Import core services
const DataLoaderService = require('./services/data-loader.cjs');
const CoreDataService = require('./services/core-data.cjs');
const PathManagerService = require('./services/path-manager.cjs');
const { sshService } = require('./services/ssh-service.cjs');
const { modelPriceService } = require('./services/model-price-service.cjs');

let mainWindow;

// Window state management
const configPath = path.join(os.homedir(), '.dragon-ui-config.json');

function saveWindowState() {
  if (!mainWindow) return;
  
  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.log('Could not read config file, creating new one');
  }
  
  const bounds = mainWindow.getBounds();
  const isMaximized = mainWindow.isMaximized();
  const isFullScreen = mainWindow.isFullScreen();
  
  // Always save current bounds
  const newState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: isMaximized,
    isFullScreen: isFullScreen
  };
  
  // If not maximized and not fullscreen, save as 'normal' bounds for restore
  if (!isMaximized && !isFullScreen) {
    newState.normalBounds = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    };
  } else if (config.windowState && config.windowState.normalBounds) {
    // Keep previous normal bounds if currently maximized/fullscreen
    newState.normalBounds = config.windowState.normalBounds;
  } else {
    // Default normal bounds
    newState.normalBounds = {
      width: 1400,
      height: 900
    };
  }
  
  config.windowState = newState;
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

function loadWindowState() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.windowState || {};
    }
  } catch (error) {
    console.log('Could not load window state:', error);
  }
  return {};
}

function createWindow() {
  console.log('[DRAGON] Dragon UI starting...');
  
  // Load saved window state
  const savedState = loadWindowState();
  
  // Create the browser window with saved state or defaults
  mainWindow = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width || 1400,
    height: savedState.height || 900,
    minWidth: 1200,
    minHeight: 800,
    resizable: true,
    maximizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      sandbox: false,
      devTools: true // Enable dev tools for debugging
    },
    icon: path.join(__dirname, 'public/Dragon-Ui.ico'),
    title: 'Dragon UI - Claude Code Max Dashboard',
    titleBarStyle: 'default',
    autoHideMenuBar: true, // Hide menu bar for clean screenshots
    show: false,
  });

  // Always load from dist (production build)
  const startUrl = `file://${path.join(__dirname, 'dist/index.html')}`;
  
  console.log('[DRAGON] Loading Dragon UI from:', startUrl);
  
  // Add error handling and debugging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[ERR] Failed to load:', errorCode, errorDescription, validatedURL);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[OK] Page loaded successfully!');
  });
  
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[WEB] Console:', message);
  });
  
  // Remove menu bar completely for production look
  mainWindow.setMenuBarVisibility(false);
  
  // Disable right-click context menu and dev tools completely
  mainWindow.webContents.on('context-menu', (event, params) => {
    // Disabled for production - no context menu
    event.preventDefault();
  });
  
  // Dev tools access enabled for debugging (F12, Ctrl+Shift+I)
  // Direct keyboard shortcut for instant DevTools (bypasses IPC)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    // Ctrl+Shift+I also opens DevTools
    if (input.control && input.shift && input.key === 'I' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadURL(startUrl);
  
  // Restore window state after the window is ready
  mainWindow.once('ready-to-show', () => {
    if (savedState.isMaximized) {
      mainWindow.maximize();
    }
    if (savedState.isFullScreen) {
      mainWindow.setFullScreen(true);
    }
  });
  
  // Save window state on various events
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', () => {
    // Restore to saved normal bounds or default size
    setTimeout(() => {
      const config = loadWindowState();
      const normalBounds = config.normalBounds;
      
      if (normalBounds) {
        // Restore to saved normal size
        const width = normalBounds.width || 1400;
        const height = normalBounds.height || 900;
        mainWindow.setSize(width, height, true);
        
        // Center if no position saved, otherwise use saved position
        if (normalBounds.x !== undefined && normalBounds.y !== undefined) {
          mainWindow.setPosition(normalBounds.x, normalBounds.y, true);
        } else {
          mainWindow.center();
        }
      } else {
        // Fallback to default size
        mainWindow.setSize(1400, 900, true);
        mainWindow.center();
      }
    }, 100);
    saveWindowState();
  });
  mainWindow.on('enter-full-screen', saveWindowState);
  mainWindow.on('leave-full-screen', saveWindowState);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[SCAN] Main process ready - Modular Services initialized');
  });
  
  // Window fully loaded
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('[DRAGON] Dragon UI loaded successfully - Production ready');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  // Production menu - minimal and clean
  const menuTemplate = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

// Initialize core services with SQLite database
console.log('[INIT] Initializing core services with SQLite database...');

const pathManager = new PathManagerService();
const dataLoader = new DataLoaderService(); // This now initializes the SQLite database
const coreDataService = new CoreDataService(dataLoader, pathManager);
// SSH service is initialized as singleton

// Log database initialization
console.log('[DB] SQLite database initialized via DataLoaderService');
console.log('[INIT] All services ready - database-powered calculations enabled');

console.log('[OK] Core services initialized (simplified architecture)');

/**
 * Safe IPC send helper - prevents crashes when renderer is not ready or destroyed
 * @param {string} channel - IPC channel name
 * @param {any} data - Data to send
 * @returns {boolean} - Whether send was successful
 */
function safeIPCSend(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send(channel, data);
      return true;
    }
    return false;
  } catch (err) {
    // Ignore errors during send - renderer may have closed
    if (err.message && !err.message.includes('destroyed')) {
      console.warn(`[IPC] Safe send failed for ${channel}:`, err.message);
    }
    return false;
  }
}

// Enable auto-push to store when core data changes
coreDataService.setAutoPush((coreData) => {
  if (safeIPCSend('core-data-updated', coreData)) {
    console.log('[IPC] Core data pushed to store.ts via IPC');
  }
});

// Simple coordinator using CoreDataService
class ServiceCoordinator {
  constructor() {
    this.coreDataService = coreDataService;
  }

  async ensureDataLoaded() {
    // CoreDataService handles its own caching and refresh logic
    return await this.coreDataService.calculateCoreData();
  }

  async forceReload() {
    console.log('[LOAD] ServiceCoordinator: Force reloading via CoreDataService...');
    return await this.coreDataService.forceRefreshAll();
  }
}

const coordinator = new ServiceCoordinator();

// NEW: Core data handler - returns ALL 75+ values for store.ts
ipcMain.handle('claude-projects-core-data', async () => {
  try {
    console.log('[LOAD] Getting ALL core data for store.ts...');
    await coreDataService.calculateCoreData();
    
    // Return ALL core data - the 75+ values
    const allData = {
      ...coreDataService.coreData
    };
    
    console.log(`[OK] Core data sent to store.ts: ${Object.keys(allData).length} values`);
    return { success: true, data: allData };
  } catch (error) {
    console.error('[ERR] Core data error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers - using CoreDataService
ipcMain.handle('claude-projects-daily', async () => {
  try {
    console.log('[STATS] Getting daily data from CoreDataService...');
    const data = await coreDataService.getTabData('daily');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Daily usage error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-monthly', async () => {
  try {
    console.log('[STATS] Getting monthly data from CoreDataService...');
    const data = await coreDataService.getTabData('monthly');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Monthly usage error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-sessions', async () => {
  try {
    console.log('[DATA] Getting sessions data from CoreDataService...');
    const data = await coreDataService.getTabData('sessions');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Session data error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-projects', async () => {
  try {
    console.log('[DATA] Getting projects data from CoreDataService...');
    const data = await coreDataService.getTabData('projects');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Project data error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-stats', async () => {
  try {
    console.log('[DATA] Getting overview stats from CoreDataService...');
    const data = await coreDataService.getTabData('overview');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Usage stats error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-current-session', async () => {
  try {
    console.log('[DATA] Getting active session from CoreDataService...');
    const data = await coreDataService.getTabData('active');
    return { success: true, data: data };
  } catch (error) {
    console.error('[ERR] Current session error:', error);
    return { success: false, error: error.message };
  }
});

// Enhanced analytics from CoreDataService
ipcMain.handle('claude-projects-analytics', async () => {
  try {
    console.log('[LOAD] Getting analytics from CoreDataService...');
    await coreDataService.calculateCoreData();
    
    const analytics = {
      gaps: coreDataService.coreData.gaps,
      gapStatistics: coreDataService.coreData.gapStatistics,
      productivityPatterns: coreDataService.coreData.productivityPatterns,
      modelBreakdown: coreDataService.coreData.modelBreakdown,
      modelStats: coreDataService.coreData.modelStats,
      liveMetrics: coreDataService.coreData.liveMetrics,
      activityWindows: coreDataService.coreData.activityWindows
    };
    
    console.log(`[OK] Enhanced analytics from CoreDataService`);
    return { success: true, data: analytics };
  } catch (error) {
    console.error('[ERR] Analytics error:', error);
    return { success: false, error: error.message };
  }
});

// Export data using CoreDataService
ipcMain.handle('claude-projects-export', async (event, format, dataType, options) => {
  try {
    console.log(`[EXPORT] Exporting ${dataType} data as ${format} via CoreDataService...`);
    
    const exportedData = coreDataService.exportData(dataType, format, options);
    console.log(`[OK] Export completed: ${exportedData.length} characters`);
    
    return { success: true, data: exportedData, format, dataType };
  } catch (error) {
    console.error('[ERR] Export error:', error);
    return { success: false, error: error.message };
  }
});

// Path management handlers
ipcMain.handle('claude-projects-paths', async () => {
  try {
    const data = pathManager.getAllPaths();
    return { success: true, data, source: 'modular-services' };
  } catch (error) {
    console.error('[ERR] Paths error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-add-path', async (event, customPath) => {
  try {
    const success = pathManager.addCustomPath(customPath);
    if (success) {
      console.log('💪 Path added - clearing cache and reloading data');
      await coordinator.forceReload();
    }
    return { success };
  } catch (error) {
    console.error('[ERR] Add path error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-remove-path', async (event, customPath) => {
  try {
    const success = pathManager.removeCustomPath(customPath);
    if (success) {
      console.log('💪 Path removed - clearing cache and reloading data');
      await coordinator.forceReload();
    }
    return { success };
  } catch (error) {
    console.error('[ERR] Remove path error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-refresh-paths', async () => {
  try {
    const data = pathManager.forceRefreshPaths();
    console.log('💪 Paths refreshed - clearing cache and reloading data');
    await coordinator.forceReload();
    return { success: true, data, source: 'cached' };
  } catch (error) {
    console.error('[ERR] Refresh paths error:', error);
    return { success: false, error: error.message };
  }
});

// Service stats using CoreDataService
ipcMain.handle('claude-projects-service-stats', async () => {
  try {
    const pathStats = pathManager.getPathStats();
    const dataStats = {
      entriesLoaded: dataLoader.getAllUsageEntries().length,
      coreDataCalculated: !!coreDataService.coreData.totalCost
    };
    
    return { 
      success: true, 
      data: { pathStats, dataStats }
    };
  } catch (error) {
    console.error('[ERR] Service stats error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-force-reload', async () => {
  try {
    console.log('[RELOAD] Force reload requested via IPC');
    await coordinator.forceReload();
    return { success: true, message: 'Data refreshed via CoreDataService' };
  } catch (error) {
    console.error('[ERR] Force reload error:', error);
    return { success: false, error: error.message };
  }
});

// Statusline CLI sync handlers
const CLI_SETTINGS_FILE = path.join(os.homedir(), '.dragon-ui-cli-settings.json');

ipcMain.handle('statusline-export-to-cli', async (event, statuslineConfig) => {
  try {
    let settings = {};

    // Read existing settings if file exists
    if (fs.existsSync(CLI_SETTINGS_FILE)) {
      const data = fs.readFileSync(CLI_SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    }

    // Update statusline config
    settings.statusline = statuslineConfig;

    // Write back to file
    fs.writeFileSync(CLI_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    console.log('[STATUSLINE] Exported config to CLI settings');
    return { success: true };
  } catch (error) {
    console.error('[ERR] Statusline export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('statusline-import-from-cli', async () => {
  try {
    if (!fs.existsSync(CLI_SETTINGS_FILE)) {
      return { success: false, error: 'CLI settings file not found' };
    }

    const data = fs.readFileSync(CLI_SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);

    if (!settings.statusline) {
      return { success: false, error: 'No statusline config in CLI settings' };
    }

    console.log('[STATUSLINE] Imported config from CLI settings');
    return { success: true, config: settings.statusline };
  } catch (error) {
    console.error('[ERR] Statusline import error:', error);
    return { success: false, error: error.message };
  }
});

// Electron app handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Save window state before closing
  saveWindowState();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Consolidated cleanup handler for app quit
let isCleaningUp = false;
app.on('before-quit', () => {
  // Prevent multiple cleanup runs
  if (isCleaningUp) return;
  isCleaningUp = true;

  console.log('[QUIT] Starting consolidated cleanup...');

  // 1. Save window state
  try {
    saveWindowState();
    console.log('[QUIT] Window state saved');
  } catch (err) {
    console.warn('[QUIT] Failed to save window state:', err.message);
  }

  // 2. Clean up terminal sessions
  try {
    console.log('[QUIT] Cleaning up terminal sessions...');
    for (const [id, listeners] of terminalListeners) {
      try {
        const session = terminalService.getSession(id);
        if (session) {
          session.removeListener('data', listeners.dataHandler);
          session.removeListener('exit', listeners.exitHandler);
        }
      } catch {
        // Ignore individual cleanup errors
      }
    }
    terminalListeners.clear();
    terminalService.destroyAllSessions();
    console.log('[QUIT] Terminal sessions cleaned up');
  } catch (err) {
    console.warn('[QUIT] Failed to cleanup terminals:', err.message);
  }

  // 3. Clean up background workers
  try {
    if (coreDataService && coreDataService.cleanup) {
      coreDataService.cleanup();
      console.log('[QUIT] Core data service cleaned up');
    }
  } catch (err) {
    console.warn('[QUIT] Failed to cleanup core data service:', err.message);
  }

  // 4. Shutdown MCP service
  try {
    if (mcpService) {
      mcpService.shutdown();
      console.log('[QUIT] MCP service shutdown');
    }
  } catch (err) {
    console.warn('[QUIT] Failed to shutdown MCP service:', err.message);
  }

  // 5. Unregister global shortcuts
  try {
    globalShortcut.unregisterAll();
    console.log('[QUIT] Global shortcuts unregistered');
  } catch (err) {
    console.warn('[QUIT] Failed to unregister shortcuts:', err.message);
  }

  console.log('[QUIT] Cleanup complete');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Additional IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Dev tools control
ipcMain.handle('toggle-dev-tools', () => {
  if (mainWindow) {
    mainWindow.webContents.toggleDevTools();
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

ipcMain.handle('open-dev-tools', () => {
  if (mainWindow) {
    // Use detached mode for faster opening
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

ipcMain.handle('close-dev-tools', () => {
  if (mainWindow) {
    mainWindow.webContents.closeDevTools();
    return { success: true };
  }
  return { success: false, error: 'No main window' };
});

// Auto-update handler
ipcMain.handle('perform-update', async () => {
  try {
    console.log('[UPDATE] Performing self-update...');
    
    const { spawn } = require('child_process');
    const fs = require('fs');
    const os = require('os');
    
    // Create update script file
    let scriptPath, scriptContent;
    
    if (process.platform === 'win32') {
      // Windows batch script
      scriptPath = path.join(os.tmpdir(), 'dragon-ui-update.bat');
      scriptContent = `@echo off
echo [UPDATE] Starting Dragon UI update process...
echo [UPDATE] Installing latest version...
call npm install -g dragon-ui-claude@latest
echo [UPDATE] npm install completed with exit code %errorlevel%

if %errorlevel% equ 0 (
  echo [UPDATE] Update successful! Starting Dragon UI...
  echo [UPDATE] Waiting 3 seconds for npm cache to settle...
  timeout /t 3 /nobreak >nul
  
  echo [UPDATE] Refreshing PATH and checking for dragon-ui...
  call refreshenv 2>nul
  
  echo [UPDATE] Trying direct npm global path...
  set "NPM_GLOBAL_PATH=%APPDATA%\\npm"
  if exist "%NPM_GLOBAL_PATH%\\dragon-ui.cmd" (
    echo [UPDATE] Found dragon-ui in npm global path, starting...
    start "" "%NPM_GLOBAL_PATH%\\dragon-ui.cmd"
    echo [UPDATE] Dragon UI restart initiated via npm global path
  ) else (
    echo [UPDATE] Trying npx method...
    start "" npx dragon-ui-claude
    echo [UPDATE] Dragon UI restart initiated via npx
  )
  
  echo [UPDATE] Closing update window in 60 seconds...
  timeout /t 60 /nobreak >nul
) else (
  echo [UPDATE] Update failed with error code %errorlevel%
  echo [UPDATE] Auto-closing in 60 seconds...
  timeout /t 60 /nobreak >nul
)`;
    } else {
      // Unix shell script
      scriptPath = path.join(os.tmpdir(), 'dragon-ui-update.sh');
      scriptContent = `#!/bin/bash
echo "[UPDATE] Starting Dragon UI update process..."
echo "[UPDATE] Current PATH: $PATH"
echo "[UPDATE] Checking if dragon-ui is accessible..."
which dragon-ui
if [ $? -ne 0 ]; then
  echo "[UPDATE] dragon-ui not found in PATH, will use npx after update"
fi

echo "[UPDATE] Installing latest version..."
npm install -g dragon-ui-claude@latest
if [ $? -eq 0 ]; then
  echo "[UPDATE] Update successful! Starting Dragon UI..."
  echo "[UPDATE] Waiting 3 seconds for npm cache to settle..."
  sleep 3
  
  echo "[UPDATE] Checking updated PATH..."
  which dragon-ui
  if [ $? -eq 0 ]; then
    echo "[UPDATE] Found dragon-ui in PATH, starting..."
    nohup dragon-ui > /dev/null 2>&1 &
    if [ $? -ne 0 ]; then
      echo "[UPDATE] dragon-ui start failed, trying npx fallback..."
      nohup npx dragon-ui-claude > /dev/null 2>&1 &
    fi
  else
    echo "[UPDATE] dragon-ui still not in PATH after update"
    echo "[UPDATE] Trying npx method..."
    nohup npx dragon-ui-claude > /dev/null 2>&1 &
  fi
  
  echo "[UPDATE] Dragon UI restart initiated, closing update window in 60 seconds..."
  sleep 60
else
  echo "[UPDATE] Update failed with exit code $?"
  echo "[UPDATE] Auto-closing in 60 seconds..."
  sleep 60
fi
rm "$0"`;
    }
    
    // Write script file
    fs.writeFileSync(scriptPath, scriptContent);
    
    // Make executable on Unix
    if (process.platform !== 'win32') {
      fs.chmodSync(scriptPath, '755');
    }
    
    // Execute script
    let updateProcess;
    if (process.platform === 'win32') {
      updateProcess = spawn('cmd', ['/c', 'start', '', scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
    } else {
      updateProcess = spawn('bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
    }
    
    updateProcess.unref();
    
    // Close current app after short delay
    setTimeout(() => {
      app.quit();
    }, 1000);
    
    return { success: true };
  } catch (error) {
    console.error('[UPDATE] Update failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-window-state', () => {
  saveWindowState();
  return { success: true };
});

ipcMain.handle('get-window-state', () => {
  return loadWindowState();
});

ipcMain.handle('export-data', async (event, data, filename) => {
  return { success: true };
});

// Database management handlers
ipcMain.handle('claude-projects-clear-database', async () => {
  try {
    console.log('[DB] Clearing database via DataLoaderService...');
    const success = dataLoader.db.clearAllData();
    if (success) {
      console.log('[OK] Database cleared successfully');
      return { success: true };
    } else {
      console.error('[ERR] Failed to clear database');
      return { success: false, error: 'Failed to clear database' };
    }
  } catch (error) {
    console.error('[ERR] Clear database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-refresh-database', async () => {
  try {
    console.log('[DB] Refreshing database via DataLoaderService...');
    const success = dataLoader.db.refreshDatabase();
    if (success) {
      console.log('[OK] Database refreshed, reloading data...');
      await coordinator.forceReload();
      return { success: true };
    } else {
      console.error('[ERR] Failed to refresh database');
      return { success: false, error: 'Failed to refresh database' };
    }
  } catch (error) {
    console.error('[ERR] Refresh database error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('claude-projects-cleanup-timestamps', async () => {
  try {
    console.log('[DB] Cleaning up corrupted timestamps...');
    const cleaned = dataLoader.db.cleanupCorruptedTimestamps();
    if (cleaned > 0) {
      console.log(`[OK] Cleaned up ${cleaned} corrupted entries, reloading data...`);
      await coordinator.forceReload();
      return { success: true, cleaned };
    } else {
      console.log('[OK] No corrupted timestamps found');
      return { success: true, cleaned: 0 };
    }
  } catch (error) {
    console.error('[ERR] Cleanup timestamps error:', error);
    return { success: false, error: error.message };
  }
});

// Full-page screenshot handler with hotkey L
ipcMain.handle('take-full-page-screenshot', async () => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'No main window available' };
    }

    console.log('[SCREENSHOT] Taking full-page screenshot...');
    
    // Get detailed page dimensions and scroll info
    const pageInfo = await mainWindow.webContents.executeJavaScript(`(() => {
      const body = document.body;
      const html = document.documentElement;
      
      const result = {
        contentHeight: Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        ),
        contentWidth: Math.max(
          body.scrollWidth,
          body.offsetWidth,
          html.clientWidth,
          html.scrollWidth,
          html.offsetWidth
        ),
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        currentScrollY: window.pageYOffset,
        currentScrollX: window.pageXOffset
      };
      
      console.log('[SCREENSHOT] Page dimensions:', result);
      return result;
    })()`);
    
    // Store current window state
    const originalBounds = mainWindow.getBounds();
    const wasMaximized = mainWindow.isMaximized();
    
    console.log(`[SCREENSHOT] Original bounds: ${originalBounds.width}x${originalBounds.height}`);
    console.log(`[SCREENSHOT] Content size: ${pageInfo.contentWidth}x${pageInfo.contentHeight}`);
    console.log(`[SCREENSHOT] Current scroll: ${pageInfo.currentScrollX}, ${pageInfo.currentScrollY}`);
    
    // Calculate required window size (add padding and respect limits)
    const requiredWidth = Math.min(Math.max(pageInfo.contentWidth + 50, originalBounds.width), 8000);
    const requiredHeight = Math.min(pageInfo.contentHeight + 100, 16000); // Conservative limit
    
    // Unmaximize if needed
    if (wasMaximized) {
      mainWindow.unmaximize();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Resize window to capture full content
    console.log(`[SCREENSHOT] Resizing to ${requiredWidth}x${requiredHeight} for full capture...`);
    mainWindow.setSize(requiredWidth, requiredHeight);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Scroll to top-left corner
    await mainWindow.webContents.executeJavaScript('window.scrollTo(0, 0)');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Force a repaint to ensure everything is rendered
    await mainWindow.webContents.executeJavaScript(`(() => {
      document.body.style.transform = 'translateZ(0)';
      document.body.offsetHeight;
      document.body.style.transform = '';
      return true;
    })()`);
    
    // Wait for final render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capture the full page
    console.log('[SCREENSHOT] Capturing full page...');
    const image = await mainWindow.capturePage();
    
    // Restore original window state
    console.log('[SCREENSHOT] Restoring original window state...');
    if (wasMaximized) {
      mainWindow.maximize();
    } else {
      mainWindow.setBounds(originalBounds);
    }
    
    // Restore scroll position
    await mainWindow.webContents.executeJavaScript(`window.scrollTo(${pageInfo.currentScrollX}, ${pageInfo.currentScrollY})`);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `dragon-ui-fullpage-${timestamp}.png`;
    
    // Show save dialog
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Dragon UI Full-Page Screenshot',
      defaultPath: path.join(os.homedir(), 'Desktop', filename),
      filters: [
        { name: 'PNG Images', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (filePath) {
      // Save the screenshot
      fs.writeFileSync(filePath, image.toPNG());
      console.log(`[SCREENSHOT] Full-page screenshot saved to: ${filePath}`);
      console.log(`[SCREENSHOT] Image size: ${image.getSize().width}x${image.getSize().height}`);
      
      return { 
        success: true, 
        filePath,
        message: `Full-page screenshot saved to ${path.basename(filePath)}`,
        dimensions: {
          width: image.getSize().width,
          height: image.getSize().height,
          contentHeight: pageInfo.contentHeight
        }
      };
    } else {
      return { success: false, error: 'Save cancelled by user' };
    }
    
  } catch (error) {
    console.error('[ERR] Screenshot error:', error);
    return { success: false, error: error.message };
  }
});

// Register global hotkey L for screenshot (DISABLED)
app.whenReady().then(() => {
  // DISABLED: Screenshot functionality temporarily disabled
  // globalShortcut.register('L', async () => {
  //   console.log('[HOTKEY] L pressed - triggering full-page screenshot');
  //   if (mainWindow) {
  //     try {
  //       mainWindow.webContents.send('hotkey-screenshot');
  //     } catch (error) {
  //       console.error('[ERR] Hotkey screenshot error:', error);
  //     }
  //   }
  // });
  
  console.log('[OK] Screenshot hotkey DISABLED for now');
});

// Note: Shortcut unregistration is handled in consolidated before-quit handler

// SSH Service IPC Handlers
ipcMain.handle('ssh-set-config', async (event, config) => {
  try {
    console.log('[SSH] Setting SSH configuration via IPC');
    sshService.setConfig(config);
    return { success: true };
  } catch (error) {
    console.error('[SSH] Set config error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh-get-config', async () => {
  try {
    const config = sshService.getConfig();
    return { success: true, config };
  } catch (error) {
    console.error('[SSH] Get config error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh-test-connection', async (event, config) => {
  try {
    console.log('[SSH] Testing SSH connection via IPC');
    if (config) {
      sshService.setConfig(config);
    }
    const result = await sshService.testConnection();
    return result;
  } catch (error) {
    console.error('[SSH] Test connection error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ssh-create-connection', async (event, connectionId = 'default') => {
  try {
    console.log(`[SSH] Creating SSH connection '${connectionId}' via IPC`);
    const result = await sshService.createConnection(connectionId);
    return result;
  } catch (error) {
    console.error('[SSH] Create connection error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ssh-execute-command', async (event, command, connectionId = 'default') => {
  try {
    console.log(`[SSH] Executing command '${command}' via IPC`);
    const result = await sshService.executeCommand(command, connectionId);
    return result;
  } catch (error) {
    console.error('[SSH] Execute command error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh-download-jsonl', async (event, remotePath, localPath, connectionId = 'default') => {
  try {
    console.log(`[SSH] Downloading JSONL file '${remotePath}' to '${localPath}' via IPC`);
    
    // Default local path if not provided
    if (!localPath) {
      const downloadsPath = path.join(os.homedir(), 'Downloads', 'dragon-ui-ssh');
      const fileName = path.basename(remotePath);
      localPath = path.join(downloadsPath, fileName);
    }
    
    const result = await sshService.downloadJsonl(remotePath, localPath, connectionId);
    return result;
  } catch (error) {
    console.error('[SSH] Download JSONL error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ssh-list-remote-files', async (event, remotePath, connectionId = 'default') => {
  try {
    console.log(`[SSH] Listing remote files in '${remotePath}' via IPC`);
    const result = await sshService.listRemoteFiles(remotePath, connectionId);
    return result;
  } catch (error) {
    console.error('[SSH] List remote files error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('ssh-close-connection', async (event, connectionId = 'default') => {
  try {
    console.log(`[SSH] Closing SSH connection '${connectionId}' via IPC`);
    const result = sshService.closeConnection(connectionId);
    return { success: result };
  } catch (error) {
    console.error('[SSH] Close connection error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ssh-get-active-connections', async () => {
  try {
    const connections = sshService.getActiveConnections();
    return { success: true, connections };
  } catch (error) {
    console.error('[SSH] Get active connections error:', error);
    return { success: false, error: error.message };
  }
});

// Model Price Service IPC Handlers
ipcMain.handle('model-prices-get-all', async () => {
  try {
    const prices = modelPriceService.getAllPrices();
    return { success: true, prices };
  } catch (error) {
    console.error('[PRICE] Get all prices error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('model-prices-get-stats', async () => {
  try {
    const stats = modelPriceService.getPricingStats();
    return { success: true, stats };
  } catch (error) {
    console.error('[PRICE] Get pricing stats error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('model-prices-force-update', async () => {
  try {
    console.log('[PRICE] Force update requested via IPC');
    const updated = await modelPriceService.forceUpdate();
    return { success: true, updated };
  } catch (error) {
    console.error('[PRICE] Force update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('model-prices-get-for-model', async (event, model) => {
  try {
    const pricing = modelPriceService.getModelPrices(model);
    return { success: true, pricing };
  } catch (error) {
    console.error('[PRICE] Get model pricing error:', error);
    return { success: false, error: error.message };
  }
});

// Terminal Service IPC Handlers
const { terminalService } = require('./services/terminal-service.cjs');

// Account Service IPC Handlers
const { accountService } = require('./services/account-service.cjs');

// Active terminal session listeners (for cleanup)
const terminalListeners = new Map();

ipcMain.handle('terminal-get-shells', async () => {
  try {
    const shells = terminalService.getAvailableShells();
    return { success: true, shells };
  } catch (error) {
    console.error('[TERM] Get shells error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-create', async (event, options) => {
  try {
    console.log('[TERM] Creating terminal session:', options);

    // Inject active account environment variables
    let accountEnv = {};
    try {
      accountEnv = accountService.getActiveAccountEnv();
      if (Object.keys(accountEnv).length > 0) {
        console.log('[TERM] Injecting account env vars:', Object.keys(accountEnv).join(', '));
      }
    } catch (err) {
      console.warn('[TERM] Could not get account env:', err.message);
    }

    // Merge account env with any provided env
    const mergedOptions = {
      ...options,
      env: { ...accountEnv, ...(options.env || {}) }
    };

    const session = terminalService.createSession(mergedOptions);

    // Set up event listeners for the session
    const dataHandler = (data) => {
      safeIPCSend('terminal-data', { id: session.id, data });
    };

    const exitHandler = (exitInfo) => {
      safeIPCSend('terminal-exit', { id: session.id, ...exitInfo });
      // Clean up listeners
      session.removeListener('data', dataHandler);
      session.removeListener('exit', exitHandler);
      terminalListeners.delete(session.id);
    };

    session.on('data', dataHandler);
    session.on('exit', exitHandler);

    // Store listeners for cleanup
    terminalListeners.set(session.id, { dataHandler, exitHandler });

    // Start the session
    const started = session.start();

    if (started) {
      console.log(`[TERM] Session ${session.id} started successfully`);
      return { success: true, session: session.getInfo() };
    } else {
      return { success: false, error: 'Failed to start terminal session' };
    }
  } catch (error) {
    console.error('[TERM] Create terminal error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-write', async (event, id, data) => {
  try {
    const session = terminalService.getSession(id);
    if (session) {
      const written = session.write(data);
      return { success: written };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    console.error('[TERM] Write error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-resize', async (event, id, cols, rows) => {
  try {
    const session = terminalService.getSession(id);
    if (session) {
      session.resize(cols, rows);
      return { success: true };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    console.error('[TERM] Resize error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-destroy', async (event, id) => {
  try {
    console.log(`[TERM] Destroying session ${id}`);

    // Clean up listeners before destroying session
    const listeners = terminalListeners.get(id);
    if (listeners) {
      const session = terminalService.getSession(id);
      if (session) {
        try {
          session.removeListener('data', listeners.dataHandler);
          session.removeListener('exit', listeners.exitHandler);
        } catch (listenerErr) {
          // Ignore listener removal errors
        }
      }
      terminalListeners.delete(id);
    }

    const destroyed = terminalService.destroySession(id);
    return { success: destroyed };
  } catch (error) {
    console.error('[TERM] Destroy error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-list', async () => {
  try {
    const sessions = terminalService.getAllSessions();
    return { success: true, sessions };
  } catch (error) {
    console.error('[TERM] List error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('terminal-get-info', async (event, id) => {
  try {
    const session = terminalService.getSession(id);
    if (session) {
      return { success: true, session: session.getInfo() };
    }
    return { success: false, error: 'Session not found' };
  } catch (error) {
    console.error('[TERM] Get info error:', error);
    return { success: false, error: error.message };
  }
});

// Note: Terminal and worker cleanup is handled in consolidated before-quit handler

// Account Service IPC Handlers
ipcMain.handle('account-get-all', async () => {
  try {
    const accounts = accountService.getAllAccounts();
    return { success: true, accounts };
  } catch (error) {
    console.error('[ACCOUNT] Get all error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-get-active', async () => {
  try {
    const account = accountService.getActiveAccount();
    return { success: true, account };
  } catch (error) {
    console.error('[ACCOUNT] Get active error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-create', async (event, accountData, apiKey) => {
  try {
    console.log('[ACCOUNT] Creating account:', accountData.name);
    const account = accountService.createAccount(accountData, apiKey);
    return { success: true, account };
  } catch (error) {
    console.error('[ACCOUNT] Create error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-update', async (event, id, updates) => {
  try {
    console.log('[ACCOUNT] Updating account:', id);
    const account = accountService.updateAccount(id, updates);
    return { success: true, account };
  } catch (error) {
    console.error('[ACCOUNT] Update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-delete', async (event, id) => {
  try {
    console.log('[ACCOUNT] Deleting account:', id);
    const result = accountService.deleteAccount(id);
    return { success: result };
  } catch (error) {
    console.error('[ACCOUNT] Delete error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-set-active', async (event, id) => {
  try {
    console.log('[ACCOUNT] Setting active account:', id);
    const account = accountService.setActiveAccount(id);
    return { success: true, account };
  } catch (error) {
    console.error('[ACCOUNT] Set active error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-get-api-key', async (event, id) => {
  try {
    const apiKey = accountService.getApiKey(id);
    // Mask the key for security (only show first 8 and last 4 chars)
    const masked = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
    return { success: true, apiKey, masked };
  } catch (error) {
    console.error('[ACCOUNT] Get API key error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-update-api-key', async (event, id, newApiKey) => {
  try {
    console.log('[ACCOUNT] Updating API key for:', id);
    const result = accountService.updateApiKey(id, newApiKey);
    return { success: result };
  } catch (error) {
    console.error('[ACCOUNT] Update API key error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-get-env', async () => {
  try {
    const env = accountService.getActiveAccountEnv();
    return { success: true, env };
  } catch (error) {
    console.error('[ACCOUNT] Get env error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-export', async () => {
  try {
    const data = accountService.exportAccounts();
    return { success: true, data };
  } catch (error) {
    console.error('[ACCOUNT] Export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('account-import', async (event, data, apiKeys) => {
  try {
    console.log('[ACCOUNT] Importing accounts...');
    const accounts = accountService.importAccounts(data, apiKeys);
    return { success: true, accounts };
  } catch (error) {
    console.error('[ACCOUNT] Import error:', error);
    return { success: false, error: error.message };
  }
});

// ==================== MCP (Model Context Protocol) Service ====================
const { MCPService } = require('./services/mcp-service.cjs');
const mcpService = new MCPService();

// Initialize MCP service
mcpService.initialize().then(() => {
  console.log('[MCP] Service initialized');
}).catch((err) => {
  console.error('[MCP] Failed to initialize:', err);
});

// Forward MCP events to renderer
mcpService.on('server-status', (data) => {
  safeIPCSend('mcp-server-status', data);
});

mcpService.on('server-capabilities', (data) => {
  safeIPCSend('mcp-server-capabilities', data);
});

mcpService.on('server-log', (data) => {
  safeIPCSend('mcp-server-log', data);
});

mcpService.on('server-error', (data) => {
  safeIPCSend('mcp-server-error', data);
});

// Get all MCP servers
ipcMain.handle('mcp-get-servers', async () => {
  try {
    const servers = mcpService.getAllServers();
    return { success: true, servers };
  } catch (error) {
    console.error('[MCP] Get servers error:', error);
    return { success: false, error: error.message };
  }
});

// Add custom MCP server
ipcMain.handle('mcp-add-server', async (event, serverConfig) => {
  try {
    const result = mcpService.addServer(serverConfig);
    return result;
  } catch (error) {
    console.error('[MCP] Add server error:', error);
    return { success: false, error: error.message };
  }
});

// Update custom MCP server
ipcMain.handle('mcp-update-server', async (event, serverId, updates) => {
  try {
    const result = mcpService.updateServer(serverId, updates);
    return result;
  } catch (error) {
    console.error('[MCP] Update server error:', error);
    return { success: false, error: error.message };
  }
});

// Remove custom MCP server
ipcMain.handle('mcp-remove-server', async (event, serverId) => {
  try {
    const result = mcpService.removeServer(serverId);
    return result;
  } catch (error) {
    console.error('[MCP] Remove server error:', error);
    return { success: false, error: error.message };
  }
});

// Connect to MCP server
ipcMain.handle('mcp-connect', async (event, serverId) => {
  try {
    console.log('[MCP] Connecting to server:', serverId);
    const result = await mcpService.connect(serverId);
    return result;
  } catch (error) {
    console.error('[MCP] Connect error:', error);
    return { success: false, error: error.message };
  }
});

// Disconnect from MCP server
ipcMain.handle('mcp-disconnect', async (event, serverId) => {
  try {
    console.log('[MCP] Disconnecting from server:', serverId);
    const result = mcpService.disconnect(serverId);
    return result;
  } catch (error) {
    console.error('[MCP] Disconnect error:', error);
    return { success: false, error: error.message };
  }
});

// Set auto-connect for MCP server
ipcMain.handle('mcp-set-auto-connect', async (event, serverId, enabled) => {
  try {
    const result = mcpService.setAutoConnect(serverId, enabled);
    return result;
  } catch (error) {
    console.error('[MCP] Set auto-connect error:', error);
    return { success: false, error: error.message };
  }
});

// Get MCP server info
ipcMain.handle('mcp-get-server-info', async (event, serverId) => {
  try {
    const info = mcpService.getServerInfo(serverId);
    return { success: true, server: info };
  } catch (error) {
    console.error('[MCP] Get server info error:', error);
    return { success: false, error: error.message };
  }
});

// Execute MCP tool
ipcMain.handle('mcp-execute-tool', async (event, serverId, toolName, args) => {
  try {
    console.log('[MCP] Executing tool:', toolName, 'on server:', serverId);
    const result = await mcpService.executeTool(serverId, toolName, args);
    return result;
  } catch (error) {
    console.error('[MCP] Execute tool error:', error);
    return { success: false, error: error.message };
  }
});

// Read MCP resource
ipcMain.handle('mcp-read-resource', async (event, serverId, uri) => {
  try {
    console.log('[MCP] Reading resource:', uri, 'from server:', serverId);
    const result = await mcpService.readResource(serverId, uri);
    return result;
  } catch (error) {
    console.error('[MCP] Read resource error:', error);
    return { success: false, error: error.message };
  }
});

// Get MCP prompt
ipcMain.handle('mcp-get-prompt', async (event, serverId, promptName, args) => {
  try {
    console.log('[MCP] Getting prompt:', promptName, 'from server:', serverId);
    const result = await mcpService.getPrompt(serverId, promptName, args);
    return result;
  } catch (error) {
    console.error('[MCP] Get prompt error:', error);
    return { success: false, error: error.message };
  }
});

// Get all available tools from connected servers
ipcMain.handle('mcp-get-all-tools', async () => {
  try {
    const tools = mcpService.getAllTools();
    return { success: true, tools };
  } catch (error) {
    console.error('[MCP] Get all tools error:', error);
    return { success: false, error: error.message };
  }
});

// Get all available resources from connected servers
ipcMain.handle('mcp-get-all-resources', async () => {
  try {
    const resources = mcpService.getAllResources();
    return { success: true, resources };
  } catch (error) {
    console.error('[MCP] Get all resources error:', error);
    return { success: false, error: error.message };
  }
});

// Get all available prompts from connected servers
ipcMain.handle('mcp-get-all-prompts', async () => {
  try {
    const prompts = mcpService.getAllPrompts();
    return { success: true, prompts };
  } catch (error) {
    console.error('[MCP] Get all prompts error:', error);
    return { success: false, error: error.message };
  }
});

// Note: MCP cleanup is handled in consolidated before-quit handler

console.log('[OK] Modular Dragon UI main process initialized with account service and MCP');