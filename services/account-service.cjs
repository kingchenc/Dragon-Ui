/**
 * Account Service
 * Manages API accounts with secure key storage using Electron's safeStorage
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { safeStorage } = require('electron');

// Account storage file
const ACCOUNTS_FILE = path.join(os.homedir(), '.dragon-ui-accounts.json');
const KEYS_FILE = path.join(os.homedir(), '.dragon-ui-keys.enc');

class AccountService {
  constructor() {
    this.accounts = [];
    this.encryptedKeys = new Map();
    this.loadAccounts();
    this.loadKeys();
  }

  // Generate unique account ID
  generateId() {
    return `acc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  // Load accounts from file
  loadAccounts() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        this.accounts = parsed.accounts || [];
        console.log(`[ACCOUNTS] Loaded ${this.accounts.length} accounts`);
      }
    } catch (error) {
      console.error('[ACCOUNTS] Error loading accounts:', error);
      this.accounts = [];
    }
  }

  // Save accounts to file
  saveAccounts() {
    try {
      const data = JSON.stringify({ accounts: this.accounts }, null, 2);
      fs.writeFileSync(ACCOUNTS_FILE, data, 'utf8');
      console.log(`[ACCOUNTS] Saved ${this.accounts.length} accounts`);
    } catch (error) {
      console.error('[ACCOUNTS] Error saving accounts:', error);
      throw error;
    }
  }

  // Load encrypted keys from file
  loadKeys() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        const parsed = JSON.parse(data);

        // Parse encrypted keys
        for (const [id, encryptedBase64] of Object.entries(parsed)) {
          this.encryptedKeys.set(id, Buffer.from(encryptedBase64, 'base64'));
        }
        console.log(`[ACCOUNTS] Loaded ${this.encryptedKeys.size} encrypted keys`);
      }
    } catch (error) {
      console.error('[ACCOUNTS] Error loading keys:', error);
      this.encryptedKeys = new Map();
    }
  }

  // Save encrypted keys to file
  saveKeys() {
    try {
      const keysObj = {};
      for (const [id, buffer] of this.encryptedKeys.entries()) {
        keysObj[id] = buffer.toString('base64');
      }

      fs.writeFileSync(KEYS_FILE, JSON.stringify(keysObj), 'utf8');
      console.log(`[ACCOUNTS] Saved ${this.encryptedKeys.size} encrypted keys`);
    } catch (error) {
      console.error('[ACCOUNTS] Error saving keys:', error);
      throw error;
    }
  }

  // Encrypt API key using Electron's safeStorage
  encryptApiKey(apiKey) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(apiKey);
      } else {
        // Fallback: simple obfuscation (not secure, but better than plaintext)
        console.warn('[ACCOUNTS] safeStorage not available, using fallback encryption');
        const cipher = crypto.createCipher('aes-256-cbc', 'dragon-ui-fallback-key');
        let encrypted = cipher.update(apiKey, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return Buffer.from(encrypted);
      }
    } catch (error) {
      console.error('[ACCOUNTS] Encryption error:', error);
      throw error;
    }
  }

  // Decrypt API key using Electron's safeStorage
  decryptApiKey(encryptedBuffer) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(encryptedBuffer);
      } else {
        // Fallback decryption
        const decipher = crypto.createDecipher('aes-256-cbc', 'dragon-ui-fallback-key');
        let decrypted = decipher.update(encryptedBuffer.toString(), 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (error) {
      console.error('[ACCOUNTS] Decryption error:', error);
      throw error;
    }
  }

  // Get all accounts
  getAllAccounts() {
    return this.accounts.map(acc => ({
      ...acc,
      apiKeyId: acc.id // Reference ID, not the actual key
    }));
  }

  // Get account by ID
  getAccountById(id) {
    return this.accounts.find(acc => acc.id === id);
  }

  // Get active account
  getActiveAccount() {
    return this.accounts.find(acc => acc.isActive);
  }

  // Create new account
  createAccount(accountData, apiKey) {
    try {
      const id = this.generateId();

      // Encrypt and store API key
      const encryptedKey = this.encryptApiKey(apiKey);
      this.encryptedKeys.set(id, encryptedKey);

      const account = {
        id,
        name: accountData.name,
        provider: accountData.provider,
        apiKeyId: id,
        isActive: accountData.isActive || false,
        createdAt: new Date().toISOString(),
        profile: accountData.profile || null,
        settings: accountData.settings || null
      };

      // If this is set as active, deactivate others
      if (account.isActive) {
        this.accounts.forEach(acc => acc.isActive = false);
      }

      this.accounts.push(account);
      this.saveAccounts();
      this.saveKeys();

      console.log(`[ACCOUNTS] Created account: ${account.name} (${account.provider})`);
      return account;
    } catch (error) {
      console.error('[ACCOUNTS] Error creating account:', error);
      throw error;
    }
  }

  // Update account
  updateAccount(id, updates) {
    try {
      const index = this.accounts.findIndex(acc => acc.id === id);
      if (index === -1) {
        throw new Error('Account not found');
      }

      // Don't allow updating apiKeyId directly
      const { apiKeyId, id: _, ...safeUpdates } = updates;

      // If setting this account as active, deactivate others
      if (safeUpdates.isActive) {
        this.accounts.forEach(acc => acc.isActive = false);
      }

      this.accounts[index] = {
        ...this.accounts[index],
        ...safeUpdates,
        lastUsed: new Date().toISOString()
      };

      this.saveAccounts();
      console.log(`[ACCOUNTS] Updated account: ${id}`);
      return this.accounts[index];
    } catch (error) {
      console.error('[ACCOUNTS] Error updating account:', error);
      throw error;
    }
  }

  // Delete account
  deleteAccount(id) {
    try {
      const index = this.accounts.findIndex(acc => acc.id === id);
      if (index === -1) {
        throw new Error('Account not found');
      }

      // Remove encrypted key
      this.encryptedKeys.delete(id);

      // Remove account
      this.accounts.splice(index, 1);

      this.saveAccounts();
      this.saveKeys();

      console.log(`[ACCOUNTS] Deleted account: ${id}`);
      return true;
    } catch (error) {
      console.error('[ACCOUNTS] Error deleting account:', error);
      throw error;
    }
  }

  // Set active account
  setActiveAccount(id) {
    try {
      const account = this.getAccountById(id);
      if (!account) {
        throw new Error('Account not found');
      }

      // Deactivate all accounts
      this.accounts.forEach(acc => acc.isActive = false);

      // Activate the specified account
      account.isActive = true;
      account.lastUsed = new Date().toISOString();

      this.saveAccounts();
      console.log(`[ACCOUNTS] Set active account: ${account.name}`);
      return account;
    } catch (error) {
      console.error('[ACCOUNTS] Error setting active account:', error);
      throw error;
    }
  }

  // Get decrypted API key for account
  getApiKey(id) {
    try {
      const encryptedKey = this.encryptedKeys.get(id);
      if (!encryptedKey) {
        throw new Error('API key not found');
      }

      return this.decryptApiKey(encryptedKey);
    } catch (error) {
      console.error('[ACCOUNTS] Error getting API key:', error);
      throw error;
    }
  }

  // Update API key for account
  updateApiKey(id, newApiKey) {
    try {
      if (!this.getAccountById(id)) {
        throw new Error('Account not found');
      }

      const encryptedKey = this.encryptApiKey(newApiKey);
      this.encryptedKeys.set(id, encryptedKey);
      this.saveKeys();

      console.log(`[ACCOUNTS] Updated API key for account: ${id}`);
      return true;
    } catch (error) {
      console.error('[ACCOUNTS] Error updating API key:', error);
      throw error;
    }
  }

  // Get environment variables for active account
  getActiveAccountEnv() {
    try {
      const activeAccount = this.getActiveAccount();
      if (!activeAccount) {
        return {};
      }

      const apiKey = this.getApiKey(activeAccount.id);
      const envVarName = activeAccount.settings?.envVarName || this.getDefaultEnvVar(activeAccount.provider);

      return {
        [envVarName]: apiKey
      };
    } catch (error) {
      console.error('[ACCOUNTS] Error getting active account env:', error);
      return {};
    }
  }

  // Get default environment variable name for provider
  getDefaultEnvVar(provider) {
    const envVars = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      google: 'GOOGLE_API_KEY',
      custom: 'CUSTOM_API_KEY'
    };
    return envVars[provider] || 'API_KEY';
  }

  // Export accounts (without API keys)
  exportAccounts() {
    return JSON.stringify({
      version: 1,
      exportDate: new Date().toISOString(),
      accounts: this.accounts.map(acc => ({
        name: acc.name,
        provider: acc.provider,
        profile: acc.profile,
        settings: acc.settings
      }))
    }, null, 2);
  }

  // Import accounts
  importAccounts(data, apiKeys) {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
        throw new Error('Invalid import data format');
      }

      const imported = [];
      for (let i = 0; i < parsed.accounts.length; i++) {
        const accData = parsed.accounts[i];
        const apiKey = apiKeys[i];

        if (!apiKey) {
          console.warn(`[ACCOUNTS] Skipping account ${accData.name}: no API key provided`);
          continue;
        }

        const account = this.createAccount({
          name: accData.name,
          provider: accData.provider,
          profile: accData.profile,
          settings: accData.settings
        }, apiKey);

        imported.push(account);
      }

      console.log(`[ACCOUNTS] Imported ${imported.length} accounts`);
      return imported;
    } catch (error) {
      console.error('[ACCOUNTS] Error importing accounts:', error);
      throw error;
    }
  }
}

// Singleton instance
const accountService = new AccountService();

module.exports = { AccountService, accountService };
