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
      devTools: false // Completely disable dev tools
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
  
  // Disable all dev tools access
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, etc.
    if (input.key === 'F12' || 
        (input.control && input.shift && (input.key === 'I' || input.key === 'J' || input.key === 'C'))) {
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

// Enable auto-push to store when core data changes
coreDataService.setAutoPush((coreData) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('core-data-updated', coreData);
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

// Electron app handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Save window state before closing
  saveWindowState();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Save window state before quitting
  saveWindowState();
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
    mainWindow.webContents.openDevTools();
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

// Unregister shortcuts when app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

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

console.log('[OK] Modular Dragon UI main process initialized with model price service');