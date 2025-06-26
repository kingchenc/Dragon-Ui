#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🐲 Dragon UI Installation Script');

// Check if better-sqlite3 needs rebuilding for installation
const needsRebuild = checkIfRebuildNeeded();
if (needsRebuild) {
  console.log('⚡ Rebuilding native modules for Electron...');
  rebuildNativeModules();
} else {
  console.log('✅ Native modules are already up to date for installation');
}

function checkIfRebuildNeeded() {
  try {
    // Get the package directory
    const packageDir = __dirname;
    
    // Check if better-sqlite3 exists
    const sqlitePath = path.join(packageDir, 'node_modules', 'better-sqlite3');
    if (!fs.existsSync(sqlitePath)) {
      console.log('📦 better-sqlite3 not found, no rebuild needed');
      return false; // Module not installed
    }
    
    console.log('🔍 Checking if native modules need rebuilding for installation...');
    
    // Check for rebuild cache file
    const cacheFile = path.join(packageDir, '.dragon-ui-rebuild-cache');
    const electronPackageJson = path.join(packageDir, 'node_modules', 'electron', 'package.json');
    
    if (fs.existsSync(cacheFile) && fs.existsSync(electronPackageJson)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        const electronPkg = JSON.parse(fs.readFileSync(electronPackageJson, 'utf8'));
        
        // Check if electron version matches cached version
        if (cacheData.electronVersion === electronPkg.version) {
          // Check if better-sqlite3 binary exists
          const bindingPath = path.join(sqlitePath, 'build', 'Release', 'better_sqlite3.node');
          if (fs.existsSync(bindingPath)) {
            console.log('✅ Native modules are up to date for installation');
            return false;
          } else {
            console.log('🔧 Native binary missing, rebuild needed for installation');
            return true;
          }
        } else {
          console.log('🔄 Electron version changed, rebuild needed for installation');
          return true;
        }
      } catch (error) {
        console.log('⚠️ Installation cache file corrupted, will rebuild');
        return true;
      }
    } else {
      console.log('🔧 No installation cache found, rebuild needed');
      return true;
    }
    
    // Rebuild needed
    console.log('🔧 Native modules need rebuilding for installation');
    return true;
  } catch (error) {
    console.log('⚠️ Error checking rebuild status:', error.message);
    return true; // Rebuild on any error
  }
}

function rebuildNativeModules() {
  try {
    // Get the package directory
    const packageDir = __dirname;
    
    // Check if we're in a global installation
    const isGlobalInstall = packageDir.includes('npm/node_modules') || packageDir.includes('AppData');
    
    if (isGlobalInstall) {
      console.log('🔧 Detected global installation, rebuilding better-sqlite3...');
      
      // Change to package directory
      process.chdir(packageDir);
      
      // Run electron-rebuild
      execSync('npx electron-rebuild', { 
        stdio: 'inherit',
        cwd: packageDir 
      });
      
      console.log('✅ Native modules rebuilt successfully!');
      
      // Create installation cache file to avoid unnecessary rebuilds
      try {
        const electronPackageJson = path.join(packageDir, 'node_modules', 'electron', 'package.json');
        if (fs.existsSync(electronPackageJson)) {
          const electronPkg = JSON.parse(fs.readFileSync(electronPackageJson, 'utf8'));
          const cacheData = {
            timestamp: new Date().toISOString(),
            electronVersion: electronPkg.version
          };
          
          const cacheFile = path.join(packageDir, '.dragon-ui-rebuild-cache');
          fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
          console.log('💾 Installation rebuild cache updated');
        }
      } catch (error) {
        console.log('⚠️ Could not create installation rebuild cache:', error.message);
      }
      
    } else {
      console.log('📦 Local installation detected, skipping rebuild');
    }
  } catch (error) {
    console.error('❌ Failed to rebuild native modules:', error.message);
    console.log('');
    console.log('💡 Manual fix: Run the following command:');
    console.log('   npx electron-rebuild');
    console.log('');
    process.exit(1);
  }
}
