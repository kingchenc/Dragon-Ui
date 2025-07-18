const fs = require('fs');
const path = require('path');
const glob = require('glob');
const DatabaseService = require('./database.cjs');
const { sshService } = require('./ssh-service.cjs');
const { modelPriceService } = require('./model-price-service.cjs');

/**
 * Data Loader Service
 * Handles loading and parsing JSONL files from Claude projects
 * Now with SQLite database support for incremental loading
 */
class DataLoaderService {
  constructor() {
    this.allUsageEntries = [];
    this.db = new DatabaseService();
  }

  /**
   * Load all JSONL usage entries from given paths (with incremental loading)
   * Now supports SSH remote loading if enabled
   */
  async loadAllUsageEntries(activePaths) {
    const startTime = performance.now();
    console.log('[LOAD] DataLoader: Starting incremental loading...');
    
    // Check if SSH is enabled and configured
    const isSSHEnabled = sshService && sshService.isEnabled();
    if (isSSHEnabled) {
      console.log('[SSH] DataLoader: SSH is enabled, attempting remote data loading...');
      const remoteDataLoaded = await this.loadRemoteSSHData();
      if (remoteDataLoaded > 0) {
        console.log(`[SSH] DataLoader: Successfully loaded ${remoteDataLoaded} entries from SSH`);
      } else {
        console.log('[SSH] DataLoader: No remote data loaded, falling back to local paths');
      }
    }
    
    // Get last processed timestamp from DB
    const lastTimestamp = this.db.getLastTimestamp();
    console.log(`[DB] DataLoader: Last DB timestamp: ${lastTimestamp}`);
    
    let newEntriesProcessed = 0;
    this.allUsageEntries = [];
    
    for (const basePath of activePaths) {
      console.log(`[SCAN] DataLoader: Scanning path: ${basePath}`);
      
      // Find all JSONL files
      let jsonlFiles = [];
      if (basePath.startsWith('\\\\wsl$')) {
        jsonlFiles = this.findJsonlFilesWSL(basePath);
      } else {
        const pattern = path.join(basePath, '**/*.jsonl').replace(/\\/g, '/');
        jsonlFiles = glob.sync(pattern);
      }
      
      console.log(`[FILE] DataLoader: Found ${jsonlFiles.length} JSONL files`);
      
      // Process each JSONL file (only new entries)
      for (const file of jsonlFiles) {
        const newEntries = await this.processJsonlFileIncremental(file, lastTimestamp);
        newEntriesProcessed += newEntries;
      }
    }
    
    // If first run or no new entries, load all entries from DB
    if (!lastTimestamp || newEntriesProcessed === 0) {
      console.log('[STATS] DataLoader: Loading all entries from database...');
      this.allUsageEntries = this.db.getAllEntries();
    } else {
      console.log('[DATA] DataLoader: Loading all entries from database after incremental update...');
      this.allUsageEntries = this.db.getAllEntries();
    }
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    console.log(`[OK] DataLoader: Processed ${newEntriesProcessed} new entries, total in DB: ${this.allUsageEntries.length}`);
    console.log(`[PERF] Performance: Loading took ${loadTime.toFixed(2)}ms (${newEntriesProcessed > 0 ? 'incremental' : 'cached'})`);
    
    // Debug: Show sample entries
    if (this.allUsageEntries.length > 0) {
      const totalCost = this.allUsageEntries.reduce((sum, e) => sum + (e.cost || 0), 0);
      const uniqueSessions = new Set(this.allUsageEntries.map(e => e.sessionId || e.session_id)).size;
      console.log(`[DEBUG] DataLoader Debug: ${uniqueSessions} unique sessions, total cost: $${totalCost.toFixed(2)}`);
    }
    
    return this.allUsageEntries;
  }

  /**
   * Process a single JSONL file incrementally (only new entries)
   */
  async processJsonlFileIncremental(file, lastTimestamp) {
    let newEntriesCount = 0;
    const newEntries = [];
    const processedHashes = new Set(); // Duplicate detection using message+request IDs
    
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          
          // Only process assistant messages with usage data
          if (!entry.timestamp || entry.type !== 'assistant') continue;
          if (!entry.message?.usage) continue;
          if (typeof entry.message.usage.input_tokens !== 'number') continue;
          if (typeof entry.message.usage.output_tokens !== 'number') continue;
          
          // Skip if entry is older than last processed timestamp
          if (lastTimestamp && entry.timestamp <= lastTimestamp) continue;
          
          // Duplicate detection using messageId + requestId
          const uniqueHash = this.createUniqueHash(entry);
          if (uniqueHash && processedHashes.has(uniqueHash)) {
            console.log(`[DUPLICATE] Skipping duplicate entry: ${uniqueHash}`);
            continue; // Skip duplicate
          }
          if (uniqueHash) {
            processedHashes.add(uniqueHash);
          }
          
          // Extract and process the entry
          const usageEntry = this.createUsageEntry(entry, file);
          newEntries.push(usageEntry);
          newEntriesCount++;
          
        } catch (parseError) {
          continue; // Skip invalid JSON
        }
      }
      
      // Batch insert new entries into database
      if (newEntries.length > 0) {
        this.db.insertBatch(newEntries);
      }
      
    } catch (fileError) {
      console.warn(`[WARN] DataLoader: Could not read ${file}:`, fileError.message);
    }
    
    return newEntriesCount;
  }

  /**
   * Legacy method for compatibility (now calls incremental version)
   */
  async processJsonlFile(file) {
    return this.processJsonlFileIncremental(file, null);
  }

  /**
   * Create unique hash for duplicate detection
   */
  createUniqueHash(entry) {
    const messageId = entry.message?.id || entry.messageId;
    const requestId = entry.requestId;
    
    if (messageId && requestId) {
      return `${messageId}-${requestId}`;
    } else if (messageId) {
      return messageId;
    } else if (requestId) {
      return requestId;
    }
    
    // Fallback: use timestamp + session + tokens as hash
    return `${entry.timestamp}-${entry.sessionId}-${entry.message?.usage?.input_tokens}-${entry.message?.usage?.output_tokens}`;
  }

  /**
   * Create a standardized usage entry from raw JSONL entry
   */
  createUsageEntry(entry, file) {
    // Extract project from file path or cwd
    const projectName = this.extractProjectName(file, entry);
    
    // Truncate session ID for consistent display format
    const sessionId = this.truncateSessionId(entry.sessionId);
    
    // Validate and fix timestamp
    let validatedTimestamp = entry.timestamp;
    if (!entry.timestamp || typeof entry.timestamp !== 'string') {
      console.log(`[TIMESTAMP] Invalid timestamp detected, using current time: ${entry.timestamp}`);
      validatedTimestamp = new Date().toISOString();
    } else {
      const date = new Date(entry.timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
        console.log(`[TIMESTAMP] Corrupt timestamp detected, using current time: ${entry.timestamp}`);
        validatedTimestamp = new Date().toISOString();
      }
    }
    
    const usageEntry = {
      timestamp: validatedTimestamp,
      sessionId: sessionId,
      fullSessionId: entry.sessionId, // Keep full ID for debugging
      model: entry.message.model || 'unknown',
      project: projectName,
      
      // Token counts - exact field names from real data
      input_tokens: entry.message.usage.input_tokens || 0,
      output_tokens: entry.message.usage.output_tokens || 0,
      cache_creation_input_tokens: entry.message.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: entry.message.usage.cache_read_input_tokens || 0,
      
      // Calculate cost using pricing service
      cost: (() => {
        const originalCost = entry.message.usage.cost;
        const calculatedCost = this.calculateCost(entry.message.usage, entry.message.model);
        if (originalCost !== undefined) {
          console.log(`[COST COMPARE] Original: $${originalCost.toFixed(4)}, Calculated: $${calculatedCost.toFixed(4)}, Ratio: ${(calculatedCost/originalCost).toFixed(2)}x`);
        }
        return calculatedCost;
      })(),
      
      // Metadata for debugging
      file: file,
      uuid: entry.uuid,
      cwd: entry.cwd
    };
    
    usageEntry.total_tokens = usageEntry.input_tokens + usageEntry.output_tokens + 
                            usageEntry.cache_creation_input_tokens + usageEntry.cache_read_input_tokens;
    
    return usageEntry;
  }

  /**
   * Truncate session ID for consistent display format
   */
  truncateSessionId(fullSessionId) {
    if (!fullSessionId || typeof fullSessionId !== 'string') {
      return 'unknown';
    }
    
    // Truncate session IDs to last two segments for readability
    // Example: "dc236a80-a1de-426e-a094-03aa8ee63315" -> "094-03a"
    const parts = fullSessionId.split('-');
    if (parts.length >= 2) {
      const secondLast = parts[parts.length - 2];
      const last = parts[parts.length - 1].substring(0, 3);
      return `${secondLast}-${last}`;
    }
    
    return fullSessionId.substring(0, 10); // Fallback
  }

  /**
   * Extract project name from file path or cwd
   */
  extractProjectName(filePath, entry) {
    // First try to extract from cwd field
    if (entry.cwd && typeof entry.cwd === 'string') {
      const cwdParts = entry.cwd.split(path.sep);
      const projectName = cwdParts[cwdParts.length - 1];
      if (projectName && projectName !== '.' && projectName !== '') {
        return projectName;
      }
    }
    
    // Fallback: extract from file path
    const pathParts = filePath.split(path.sep);
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];
      if (part && part !== 'projects' && !part.endsWith('.jsonl')) {
        return part;
      }
    }
    
    return 'unknown';
  }

  /**
   * Claude pricing model - Now uses dynamic pricing from LiteLLM
   */
  calculateCost(usage, model = 'unknown') {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreateTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    
    // Debug: log model name to understand what we're getting
    if (inputTokens > 0 || outputTokens > 0) {
      console.log(`[COST] Calculating cost for model: "${model}"`);
    }
    
    // Get current pricing from model price service (with fallback to defaults)
    const pricing = modelPriceService.getModelPrices(model);
    const inputRate = pricing.input;
    const outputRate = pricing.output;
    const cacheCreateRate = pricing.cacheWrite;
    const cacheReadRate = pricing.cacheRead;
    
    const inputCost = (inputTokens / 1000000) * inputRate;
    const outputCost = (outputTokens / 1000000) * outputRate;
    const cacheCost = (cacheCreateTokens / 1000000) * cacheCreateRate;
    const cacheReadCost = (cacheReadTokens / 1000000) * cacheReadRate;
    
    const totalCost = inputCost + outputCost + cacheCost + cacheReadCost;
    
    if (totalCost > 0) {
      console.log(`[COST] Cost breakdown for ${model}: Input=$${inputCost.toFixed(4)}, Output=$${outputCost.toFixed(4)}, Cache=$${cacheCost.toFixed(4)}, Read=$${cacheReadCost.toFixed(4)}, Total=$${totalCost.toFixed(4)}`);
    }
    
    return totalCost;
  }

  /**
   * WSL-compatible file finder
   */
  findJsonlFilesWSL(basePath) {
    const jsonlFiles = [];
    
    const scanDirectory = (dir) => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scanDirectory(fullPath);
            } else if (entry.endsWith('.jsonl')) {
              jsonlFiles.push(fullPath);
            }
          } catch (statError) {
            continue;
          }
        }
      } catch (error) {
        console.warn(`DataLoader: Cannot scan directory ${dir}:`, error.message);
      }
    };
    
    scanDirectory(basePath);
    return jsonlFiles;
  }

  /**
   * Load remote data via SSH if enabled and configured
   * Safely handles connection failures without crashing the app
   */
  async loadRemoteSSHData() {
    try {
      if (!sshService || !sshService.isEnabled()) {
        console.log('[SSH] DataLoader: SSH not enabled or available');
        return 0;
      }

      console.log('[SSH] DataLoader: Attempting to create SSH connection...');
      
      // Create SSH connection with timeout and error handling
      const connectionResult = await sshService.createConnection('data-loader');
      
      if (!connectionResult.success) {
        console.warn('[SSH] DataLoader: Failed to create SSH connection:', connectionResult.message);
        return 0;
      }

      console.log('[SSH] DataLoader: SSH connection established successfully');

      // List remote JSONL files in common Claude directories
      const remotePaths = [
        '~/.config/claude/projects',
        '~/.claude/projects',
        '/tmp/claude-projects',
        '/home/claude/projects'
      ];

      let totalLoadedEntries = 0;
      
      for (const remotePath of remotePaths) {
        try {
          console.log(`[SSH] DataLoader: Scanning remote path: ${remotePath}`);
          
          const filesResult = await sshService.listRemoteFiles(remotePath, 'data-loader');
          
          if (filesResult.success && filesResult.files && filesResult.files.length > 0) {
            console.log(`[SSH] DataLoader: Found ${filesResult.files.length} JSONL files in ${remotePath}`);
            
            // Download and process each remote JSONL file
            for (const file of filesResult.files) {
              try {
                const remoteFilePath = `${remotePath}/${file.name}`;
                const localTempPath = path.join(require('os').tmpdir(), 'dragon-ui-ssh', file.name);
                
                console.log(`[SSH] DataLoader: Downloading ${file.name}...`);
                
                const downloadResult = await sshService.downloadJsonl(remoteFilePath, localTempPath, 'data-loader');
                
                if (downloadResult.success) {
                  console.log(`[SSH] DataLoader: Successfully downloaded ${file.name} (${downloadResult.fileSize} bytes)`);
                  
                  // Process the downloaded file
                  const lastTimestamp = this.db.getLastTimestamp();
                  const newEntries = await this.processJsonlFileIncremental(localTempPath, lastTimestamp);
                  totalLoadedEntries += newEntries;
                  
                  // Clean up temporary file
                  try {
                    require('fs').unlinkSync(localTempPath);
                  } catch (cleanupError) {
                    console.warn('[SSH] DataLoader: Failed to cleanup temp file:', cleanupError.message);
                  }
                  
                } else {
                  console.warn(`[SSH] DataLoader: Failed to download ${file.name}:`, downloadResult.message);
                }
                
              } catch (fileError) {
                console.warn(`[SSH] DataLoader: Error processing remote file ${file.name}:`, fileError.message);
                // Continue with next file
              }
            }
          } else {
            console.log(`[SSH] DataLoader: No JSONL files found in ${remotePath}`);
          }
          
        } catch (pathError) {
          console.warn(`[SSH] DataLoader: Error accessing remote path ${remotePath}:`, pathError.message);
          // Continue with next path
        }
      }

      // Close SSH connection
      try {
        sshService.closeConnection('data-loader');
        console.log('[SSH] DataLoader: SSH connection closed');
      } catch (closeError) {
        console.warn('[SSH] DataLoader: Error closing SSH connection:', closeError.message);
      }

      console.log(`[SSH] DataLoader: Completed SSH data loading, processed ${totalLoadedEntries} new entries`);
      return totalLoadedEntries;

    } catch (error) {
      console.error('[SSH] DataLoader: Critical SSH error (safely handled):', error.message);
      
      // Ensure SSH connection is cleaned up even on error
      try {
        if (sshService) {
          sshService.closeConnection('data-loader');
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      // Return 0 to indicate no data loaded, but don't crash the app
      return 0;
    }
  }

  /**
   * Get all loaded usage entries (now from database)
   */
  getAllUsageEntries() {
    // Always return fresh data from database
    this.allUsageEntries = this.db.getAllEntries();
    return this.allUsageEntries;
  }

  /**
   * Get database instance for direct access
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Get database info for debugging
   */
  getDbInfo() {
    return this.db.getDbInfo();
  }
}

module.exports = DataLoaderService;