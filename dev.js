#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the package root directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = __dirname;

console.log('🐲 Dragon UI Development Mode - Checking setup...');

// Check if better-sqlite3 needs rebuilding for development
const needsRebuild = checkIfRebuildNeeded();
if (needsRebuild) {
  console.log('🔧 Rebuilding native modules for Electron development...');
  rebuildNativeModules(() => {
    startElectronDev();
  });
} else {
  startElectronDev();
}

function checkIfRebuildNeeded() {
  try {
    // Check if better-sqlite3 exists
    const sqlitePath = path.join(packageRoot, 'node_modules', 'better-sqlite3');
    if (!fs.existsSync(sqlitePath)) {
      console.log('📦 better-sqlite3 not found, no rebuild needed');
      return false; // Module not installed
    }
    
    console.log('🔍 Checking if native modules need rebuilding for development...');
    
    // Check for rebuild cache file
    const cacheFile = path.join(packageRoot, '.dragon-ui-rebuild-cache-dev');
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
            console.log('✅ Native modules are up to date for development');
            return false;
          } else {
            console.log('🔧 Native binary missing, rebuild needed for development');
            return true;
          }
        } else {
          console.log('🔄 Electron version changed, rebuild needed for development');
          return true;
        }
      } catch (error) {
        console.log('⚠️ Development cache file corrupted, will rebuild');
        return true;
      }
    } else {
      console.log('🔧 No development cache found, rebuild needed');
      return true;
    }
    
    // Rebuild needed
    console.log('🔧 Native modules need rebuilding for development');
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
      console.log('✅ Native modules rebuilt successfully for development!');
      
      // Create development cache file to avoid unnecessary rebuilds
      try {
        const electronPackageJson = path.join(packageRoot, 'node_modules', 'electron', 'package.json');
        if (fs.existsSync(electronPackageJson)) {
          const electronPkg = JSON.parse(fs.readFileSync(electronPackageJson, 'utf8'));
          const cacheData = {
            timestamp: new Date().toISOString(),
            electronVersion: electronPkg.version
          };
          
          const cacheFile = path.join(packageRoot, '.dragon-ui-rebuild-cache-dev');
          fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
          console.log('💾 Development rebuild cache updated');
        }
      } catch (error) {
        console.log('⚠️ Could not create development rebuild cache:', error.message);
      }
      
      callback();
    } else {
      console.error('❌ Failed to rebuild native modules for development!');
      console.log('💡 Try running: npm install electron-rebuild');
      process.exit(1);
    }
  });
  
  rebuildProcess.on('error', (err) => {
    console.error('❌ Rebuild failed:', err.message);
    console.log('💡 Installing electron-rebuild...');
    
    // Try to install electron-rebuild locally
    const installProcess = spawn('npm', ['install', 'electron-rebuild'], {
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

function startElectronDev() {
  console.log('🚀 Starting Electron in development mode...');
  
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
    console.log(`🐲 Dragon UI development closed with code ${code}`);
  });
  
  electronProcess.on('error', (err) => {
    console.error('❌ Failed to start Dragon UI development:', err.message);
    console.log('💡 Electron path:', electronCmd);
  });
}
