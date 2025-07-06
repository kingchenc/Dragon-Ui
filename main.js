const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public/Dragon-Ui.ico'),
    title: '🐲 Dragon UI - Claude Code Max Usage Dashboard',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    show: false, // Don't show until ready
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:1420' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus on window
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window minimize/restore performance
  mainWindow.on('minimize', () => {
    // Pause any heavy operations when minimized
    mainWindow.webContents.send('app-minimized');
  });

  mainWindow.on('restore', () => {
    // Resume operations and refresh UI when restored
    mainWindow.webContents.send('app-restored');
    // Small delay to ensure smooth restoration
    setTimeout(() => {
      mainWindow.webContents.send('refresh-data');
    }, 100);
  });

  mainWindow.on('focus', () => {
    // Ensure UI is responsive when focused
    mainWindow.webContents.send('app-focused');
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Dragon UI',
      submenu: [
        {
          label: 'About Dragon UI',
          click: () => {
            // You can add about dialog here
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Data',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('refresh-data');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Dark Mode',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            mainWindow.webContents.send('toggle-theme');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('export-data', async (event, data, filename) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, data);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, canceled: true };
});