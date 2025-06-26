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
      return false; // Module not installed
    }
    
    // Always rebuild for npm installs - safer approach
    // Since we can't easily test the module without loading it
    console.log('🔍 Checking if native modules need rebuilding...');
    return true; // Always rebuild to be safe
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