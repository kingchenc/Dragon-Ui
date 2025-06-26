#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the package root directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.dirname(__dirname);

console.log('🐲 Starting Dragon UI - Claude Code Max Usage Dashboard...');

// Check if better-sqlite3 needs rebuilding
const needsRebuild = checkIfRebuildNeeded();
if (needsRebuild) {
  console.log('🔧 Rebuilding native modules for Electron...');
  rebuildNativeModules(() => {
    checkAndStart();
  });
} else {
  checkAndStart();
}

function checkIfRebuildNeeded() {
  try {
    // Check if better-sqlite3 exists
    const sqlitePath = path.join(packageRoot, 'node_modules', 'better-sqlite3');
    if (!fs.existsSync(sqlitePath)) {
      console.log('📦 better-sqlite3 not found, no rebuild needed');
      return false; // Module not installed
    }
    
    console.log('🔍 Checking if native modules need rebuilding...');
    
    // Check for rebuild cache file (use OS temp directory if package root is not writable)
    let cacheFile = path.join(packageRoot, '.dragon-ui-rebuild-cache');
    let cacheDir = packageRoot;
    
    // Check if we can write to package root (might be restricted in global installs)
    try {
      fs.accessSync(packageRoot, fs.constants.W_OK);
    } catch (error) {
      // Use OS temp directory if package root is not writable  
      const os = require('os');
      cacheDir = os.tmpdir();
      cacheFile = path.join(cacheDir, '.dragon-ui-rebuild-cache');
    }
    
    const electronPackageJson = path.join(packageRoot, 'node_modules', 'electron', 'package.json');
    
    if (fs.existsSync(cacheFile) && fs.existsSync(electronPackageJson)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const electronPkg = JSON.parse(fs.readFileSync(electronPackageJson, 'utf8'));
        
        // Check if electron version matches cached version
        if (cacheData.electronVersion === electronPkg.version) {
          // Check if better-sqlite3 binary exists
          const bindingPath = path.join(sqlitePath, 'build', 'Release', 'better_sqlite3.node');
          if (fs.existsSync(bindingPath)) {
            console.log('✅ Native modules are up to date');
            return false;
          } else {
            console.log('🔧 Binary missing, rebuild needed');
          }
        } else {
          console.log('🔄 Electron version changed, rebuild needed');
        }
      } catch (error) {
        console.log('⚠️ Cache file corrupted, will rebuild');
      }
    }
    
    // Rebuild needed
    console.log('🔧 Native modules need rebuilding');
    return true;
  } catch (error) {
    console.log('⚠️ Error checking rebuild status:', error.message);
    return true; // Rebuild on any error
  }
}

function rebuildNativeModules(callback) {
  const rebuildProcess = spawn('npx', ['electron-rebuild', '-f'], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  });
  
  rebuildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Native modules rebuilt successfully!');
      
      // Create cache file to avoid unnecessary rebuilds
      try {
        const electronPackageJson = path.join(packageRoot, 'node_modules', 'electron', 'package.json');
        if (fs.existsSync(electronPackageJson)) {
          const electronPkg = JSON.parse(fs.readFileSync(electronPackageJson, 'utf8'));
          const cacheData = {
            timestamp: new Date().toISOString(),
            electronVersion: electronPkg.version
          };
          
          // Use the same cache file logic as in checkIfRebuildNeeded
          let cacheFile = path.join(packageRoot, '.dragon-ui-rebuild-cache');
          try {
            fs.accessSync(packageRoot, fs.constants.W_OK);
          } catch (error) {
            const os = require('os');
            cacheFile = path.join(os.tmpdir(), '.dragon-ui-rebuild-cache');
          }
          
          fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
          console.log('💾 Rebuild cache updated');
        }
      } catch (error) {
        console.log('⚠️ Could not create rebuild cache:', error.message);
      }
      
      callback();
    } else {
      console.error('❌ Failed to rebuild native modules!');
      console.log('💡 Try running: npm install --global electron-rebuild');
      process.exit(1);
    }
  });
  
  rebuildProcess.on('error', (err) => {
    console.error('❌ Rebuild failed:', err.message);
    console.log('💡 Installing electron-rebuild...');
    
    // Try to install electron-rebuild
    const installProcess = spawn('npm', ['install', '-g', 'electron-rebuild'], {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: true
    });
    
    installProcess.on('close', (installCode) => {
      if (installCode === 0) {
        rebuildNativeModules(callback);
      } else {
        console.error('❌ Failed to install electron-rebuild');
        process.exit(1);
      }
    });
  });
}

function checkAndStart() {
const distPath = path.join(packageRoot, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('📦 Building Dragon UI for first time...');
  
  // Run build first
  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed successfully!');
      startElectron();
    } else {
      console.error('❌ Build failed!');
      process.exit(1);
    }
  });
} else {
  startElectron();
}

function startElectron() {
  console.log('🚀 Launching Dragon UI...');
  
  // Find the local electron executable
  const electronPath = path.join(packageRoot, 'node_modules', '.bin', 'electron');
  const electronCmd = process.platform === 'win32' ? `${electronPath}.cmd` : electronPath;
  
  // Start Electron app
  const electronProcess = spawn(electronCmd, ['.'], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  });
  
  electronProcess.on('close', (code) => {
    console.log(`🐲 Dragon UI closed with code ${code}`);
  });
  
  electronProcess.on('error', (err) => {
    console.error('❌ Failed to start Dragon UI:', err.message);
    console.log('💡 Electron path:', electronCmd);
  });
}
}