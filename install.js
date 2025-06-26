#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🐲 Dragon UI Installation Script');
console.log('⚡ Rebuilding native modules for Electron...');

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
