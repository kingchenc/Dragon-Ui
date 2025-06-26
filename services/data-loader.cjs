const fs = require('fs');
const path = require('path');
const glob = require('glob');
const DatabaseService = require('./database.cjs');

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
   */
  async loadAllUsageEntries(activePaths) {
    const startTime = performance.now();
    console.log('[LOAD] DataLoader: Starting incremental loading...');
    
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
    
    const usageEntry = {
      timestamp: entry.timestamp,
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
   * Claude pricing model - Updated for Claude 4 models
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
    
    // Claude 4 and Claude 3 pricing (official Anthropic rates)
    let inputRate = 3.0;   // Default: Sonnet 3.5/4
    let outputRate = 15.0; 
    let cacheCreateRate = 3.75; // 1.25x base rate for Sonnet
    let cacheReadRate = 0.30;   // Standard cache read rate
    
    if (model.includes('opus')) {
      // Claude 3/4 Opus pricing
      inputRate = 15.0;  
      outputRate = 75.0;
      cacheCreateRate = 18.75; // 1.25x base rate
      cacheReadRate = 1.50;    // Higher cache read for Opus
    } else if (model.includes('haiku')) {
      // Claude 3.5 Haiku pricing (corrected to match Anthropic pricing)
      inputRate = 0.80;  
      outputRate = 4.00;
      cacheCreateRate = 1.00;  // Cache write rate for Haiku
      cacheReadRate = 0.08;    // Cache read rate for Haiku
    } else if (model.includes('sonnet-4') || model.includes('sonnet-3.5')) {
      // Sonnet 3.5/4 (already set as default)
      inputRate = 3.0;
      outputRate = 15.0;
      cacheCreateRate = 3.75;
      cacheReadRate = 0.30;
    }
    
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