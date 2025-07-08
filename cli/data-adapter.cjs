/**
 * CLI Data Adapter (CommonJS)
 * Uses the same services as Electron UI for identical data
 */

const path = require('path');

// Import CLI database service (compatible with Windows)
const CLIDatabaseService = require('./database-cli.cjs');

// Import PathManager to scan for JSONL files like Electron UI
const PathManagerService = require('../services/path-manager.cjs');

// Import model price service for dynamic pricing
const { modelPriceService } = require('../services/model-price-service.cjs');

class CLIDataAdapter {
  constructor(settings) {
    this.settings = settings;
    this.lastUpdate = 0;
    this.cache = new Map();
    
    // Use Windows-compatible database service
    this.db = new CLIDatabaseService();
    
    // Use PathManager to scan for JSONL files like Electron UI
    this.pathManager = new PathManagerService();
  }

  /**
   * Initialize Windows-compatible database service
   */
  async init() {
    try {
      // Initialize database
      if (!this.db.db) {
        await this.db.init();
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Force refresh data like Electron UI (silent)
   */
  async forceRefreshData() {
    try {
      // Add timeout to prevent hanging
      const refreshPromise = this.doForceRefreshData();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000) // 5 second timeout
      );
      
      await Promise.race([refreshPromise, timeoutPromise]);
      
    } catch (error) {
      // Silent error - no logs, don't hang the CLI
    }
  }

  /**
   * Internal refresh implementation
   */
  async doForceRefreshData() {
    // Silent scan and refresh like Electron UI
    const allPaths = this.pathManager.getAllPaths();
    const activePaths = allPaths.active || [];
    
    if (activePaths.length > 0) {
      // Get last processed timestamp from database
      const lastTimestamp = this.db.getLastTimestamp ? this.db.getLastTimestamp() : null;
      
      // Process JSONL files and add new entries to database
      for (const basePath of activePaths) {
        try {
          // Find JSONL files
          let jsonlFiles = [];
          if (basePath.startsWith('\\\\wsl$')) {
            jsonlFiles = this.findJsonlFilesWSL(basePath);
          } else {
            const pattern = path.join(basePath, '**/*.jsonl').replace(/\\/g, '/');
            const glob = require('glob');
            jsonlFiles = glob.sync(pattern);
          }
          
          // Process each JSONL file for new entries (limit to prevent hanging)
          for (const file of jsonlFiles.slice(0, 10)) { // Limit to 10 files per refresh
            await this.processJsonlFileIncremental(file, lastTimestamp);
          }
          
        } catch (error) {
          // Silent error
        }
      }
    }
    
    // Silent database refresh
    await this.db.refreshIfNeeded();
    this.clearCache();
  }

  /**
   * WSL-compatible file finder (copied from data-loader)
   */
  findJsonlFilesWSL(basePath) {
    const fs = require('fs');
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
        // Silent error
      }
    };
    
    scanDirectory(basePath);
    return jsonlFiles;
  }

  /**
   * Process a single JSONL file incrementally (only new entries)
   */
  async processJsonlFileIncremental(file, lastTimestamp) {
    const fs = require('fs');
    let newEntriesCount = 0;
    const newEntries = [];
    const processedHashes = new Set();
    
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
            continue; // Skip duplicate
          }
          if (uniqueHash) {
            processedHashes.add(uniqueHash);
          }
          
          // Extract and process the entry
          const usageEntry = this.createUsageEntry(entry, file);
          
          // Store for batch insert
          newEntries.push(usageEntry);
          newEntriesCount++;
          
        } catch (parseError) {
          continue; // Skip invalid JSON
        }
      }
      
      // Batch insert all new entries into database
      if (newEntries.length > 0) {
        try {
          if (this.db.insertBatch) {
            this.db.insertBatch(newEntries);
          }
        } catch (dbError) {
          // Silent error - database might be locked
        }
      }
      
    } catch (fileError) {
      // Silent error
    }
    
    return newEntriesCount;
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
      validatedTimestamp = new Date().toISOString();
    } else {
      const date = new Date(entry.timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
        validatedTimestamp = new Date().toISOString();
      }
    }
    
    const usageEntry = {
      timestamp: validatedTimestamp,
      session_id: entry.sessionId, // Use full session ID for database
      model: entry.message.model || 'unknown',
      project: projectName,
      
      // Token counts
      input_tokens: entry.message.usage.input_tokens || 0,
      output_tokens: entry.message.usage.output_tokens || 0,
      cache_creation_input_tokens: entry.message.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: entry.message.usage.cache_read_input_tokens || 0,
      
      // Calculate cost (simplified)
      cost: this.calculateCost(entry.message.usage, entry.message.model)
    };
    
    return usageEntry;
  }

  /**
   * Truncate session ID for consistent display format
   */
  truncateSessionId(fullSessionId) {
    if (!fullSessionId || typeof fullSessionId !== 'string') {
      return 'unknown';
    }
    
    const parts = fullSessionId.split('-');
    if (parts.length >= 2) {
      const secondLast = parts[parts.length - 2];
      const last = parts[parts.length - 1].substring(0, 3);
      return `${secondLast}-${last}`;
    }
    
    return fullSessionId.substring(0, 10);
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
   * Dynamic cost calculation using model price service (like Electron UI)
   */
  calculateCost(usage, model = 'unknown') {
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreateTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    
    // Get current pricing from model price service (with automatic updates)
    const pricing = modelPriceService.getModelPrices(model);
    const inputRate = pricing.input;
    const outputRate = pricing.output;
    const cacheCreateRate = pricing.cacheWrite;
    const cacheReadRate = pricing.cacheRead;
    
    const inputCost = (inputTokens / 1000000) * inputRate;
    const outputCost = (outputTokens / 1000000) * outputRate;
    const cacheCost = (cacheCreateTokens / 1000000) * cacheCreateRate;
    const cacheReadCost = (cacheReadTokens / 1000000) * cacheReadRate;
    
    return inputCost + outputCost + cacheCost + cacheReadCost;
  }

  /**
   * Get overview/dashboard data (Windows-compatible with real-time sync)
   */
  async getOverviewData() {
    try {
      const cacheKey = 'overview';
      const cached = this.getCachedData(cacheKey, 2000); // 2 seconds cache for real-time
      if (cached) return cached;

      // Get fresh data from database (with auto-refresh)
      const sessionStats = await this.db.getSessionStats();
      const projectStats = await this.db.getProjectStats();
      const dailyStats = await this.db.getDailyStats(7);

      // Calculate totals from arrays
      const totalCost = sessionStats.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const totalSessions = await this.db.getRealSessionCount();
      const totalTokens = sessionStats.reduce((sum, s) => sum + (s.total_tokens || 0), 0);
      
      // Calculate averages
      const avgCostPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;
      const avgTokensPerSession = totalSessions > 0 ? totalTokens / totalSessions : 0;
      
      // Get all unique models from database
      const models = await this.db.getAllModels();
      
      // Get current session info using 30-minute logic (same as Electron)
      const currentSessionInfo = await this.db.getCurrentSessionInfo();
      
      // Session is active if we found data (means activity in last 30 minutes)
      const sessionActive = !!currentSessionInfo;
      const status = sessionActive ? 'active' : 'inactive';
      
      // Build current session object exactly like electron
      const currentSession = sessionActive ? {
        active: true,
        id: currentSessionInfo.session_id,
        started: currentSessionInfo.session_start,
        duration: currentSessionInfo.duration || 0,
        cost: currentSessionInfo.total_cost || 0
      } : { active: false };

      const data = {
        // Basic stats (exactly like Electron UI)
        totalCost: totalCost,
        totalSessions: totalSessions,
        totalProjects: projectStats.length || 0,
        totalTokens: totalTokens,
        
        // Averages and derived stats
        averageCostPerSession: avgCostPerSession,
        avgTokensPerSession: avgTokensPerSession,
        
        // Time-based stats
        activeDays: dailyStats.filter(d => d.total_cost > 0).length,
        lastActivity: currentSessionInfo ? currentSessionInfo.last_activity : null,
        
        // Status and models (exactly like Electron UI)
        status: status,
        models: models,
        
        // Current session (exactly like Electron UI)
        currentSession: currentSession,
        
        // Metadata
        currency: this.settings.currency,
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      return this.getEmptyOverviewData();
    }
  }

  /**
   * Get projects data (Windows-compatible)
   */
  async getProjectsData() {
    try {
      const cacheKey = 'projects';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const projectStats = await this.db.getProjectStats();
      
      const data = {
        projects: projectStats.map(project => ({
          name: project.project || 'Unknown',
          totalCost: project.total_cost || 0,
          sessionCount: project.session_count || 0,
          totalTokens: project.total_tokens || 0,
          lastActivity: project.last_activity,
          avgCostPerSession: project.session_count > 0 ? 
            (project.total_cost / project.session_count) : 0,
          currency: this.settings.currency
        })),
        summary: {
          totalProjects: projectStats.length,
          totalCost: projectStats.reduce((sum, p) => sum + (p.total_cost || 0), 0),
          totalSessions: projectStats.reduce((sum, p) => sum + (p.session_count || 0), 0),
          totalTokens: projectStats.reduce((sum, p) => sum + (p.total_tokens || 0), 0),
          currency: this.settings.currency
        },
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      return { projects: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get sessions data (Windows-compatible)
   */
  async getSessionsData() {
    try {
      const cacheKey = 'sessions';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const sessionStats = await this.db.getSessionStats();
      const recentSessions = sessionStats;
      
      const data = {
        sessions: recentSessions.map(session => ({
          sessionId: session.session_id,
          project: session.project || 'Unknown',
          totalCost: session.total_cost || 0,
          totalTokens: session.total_tokens || 0,
          duration: session.duration || 0,
          startTime: session.start_time,
          endTime: session.end_time,
          entryCount: session.entry_count || 0,
          models: session.models || [],
          currency: this.settings.currency
        })),
        summary: {
          totalSessions: await this.db.getRealSessionCount(),
          totalCost: sessionStats.reduce((sum, s) => sum + (s.total_cost || 0), 0),
          totalTokens: sessionStats.reduce((sum, s) => sum + (s.total_tokens || 0), 0),
          avgCostPerSession: sessionStats.length > 0 ? 
            (sessionStats.reduce((sum, s) => sum + (s.total_cost || 0), 0) / sessionStats.length) : 0,
          currency: this.settings.currency
        },
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      return { sessions: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get monthly data (Windows-compatible)
   */
  async getMonthlyData() {
    try {
      const cacheKey = 'monthly';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const monthlyStats = await this.db.getMonthlyStats();
      
      const data = {
        months: monthlyStats.map(month => ({
          month: month.month,
          totalCost: month.total_cost || 0,
          sessionCount: month.session_count || 0,
          totalTokens: month.total_tokens || 0,
          activeDays: month.active_days || 0,
          avgDailyCost: month.active_days > 0 ? 
            (month.total_cost / month.active_days) : 0,
          currency: this.settings.currency
        })),
        summary: {
          totalMonths: monthlyStats.length,
          totalCost: monthlyStats.reduce((sum, m) => sum + (m.total_cost || 0), 0),
          totalSessions: monthlyStats.reduce((sum, m) => sum + (m.session_count || 0), 0),
          totalTokens: monthlyStats.reduce((sum, m) => sum + (m.total_tokens || 0), 0),
          currency: this.settings.currency
        },
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      return { months: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get daily data (Windows-compatible)
   */
  async getDailyData() {
    try {
      const cacheKey = 'daily';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const dailyStats = await this.db.getDailyStats(30);
      
      const data = {
        days: dailyStats.map(day => ({
          date: day.date,
          totalCost: day.total_cost || 0,
          sessionCount: day.session_count || 0,
          totalTokens: day.total_tokens || 0,
          models: day.models || [],
          modelCount: day.model_count || 0,
          entryCount: day.entry_count || 0,
          firstActivity: day.first_activity,
          lastActivity: day.last_activity,
          currency: this.settings.currency
        })),
        summary: {
          totalDays: dailyStats.length,
          activeDays: dailyStats.filter(d => d.total_cost > 0).length,
          totalCost: dailyStats.reduce((sum, d) => sum + (d.total_cost || 0), 0),
          totalSessions: dailyStats.reduce((sum, d) => sum + (d.session_count || 0), 0),
          totalTokens: dailyStats.reduce((sum, d) => sum + (d.total_tokens || 0), 0),
          avgDailyCost: dailyStats.length > 0 ? 
            (dailyStats.reduce((sum, d) => sum + (d.total_cost || 0), 0) / dailyStats.length) : 0,
          currency: this.settings.currency
        },
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      return { days: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get active session data (Windows-compatible)
   */
  async getActiveData() {
    try {
      const cacheKey = 'active';
      const cached = this.getCachedData(cacheKey, 5000); // Cache for 5 seconds only
      if (cached) return cached;

      // Use the same 30-minute logic as overview page for consistency
      const currentSessionInfo = await this.db.getCurrentSessionInfo();
      const sessionActive = !!currentSessionInfo;
      
      const todayStats = await this.db.getDailyStats(1);
      const todayData = todayStats.length > 0 ? todayStats[0] : null;
      
      // Get models for the current session if it exists
      let sessionModels = [];
      if (currentSessionInfo) {
        sessionModels = await this.db.getSessionModels(currentSessionInfo.session_id);
      }
      
      const data = {
        activeSession: currentSessionInfo ? {
          sessionId: currentSessionInfo.session_id,
          project: currentSessionInfo.project || 'Unknown',
          totalCost: currentSessionInfo.total_cost || 0,
          totalTokens: currentSessionInfo.total_tokens || 0,
          duration: currentSessionInfo.duration || 0,
          startTime: currentSessionInfo.session_start,
          lastActivity: currentSessionInfo.last_activity,
          entryCount: currentSessionInfo.entry_count || 0,
          models: sessionModels,
          currency: this.settings.currency
        } : null,
        
        todayStats: todayData ? {
          totalCost: todayData.total_cost || 0,
          sessionCount: todayData.session_count || 0,
          totalTokens: todayData.total_tokens || 0,
          models: todayData.models || [],
          modelCount: todayData.model_count || 0,
          currency: this.settings.currency
        } : null,
        
        isActive: sessionActive, // Use same 30-minute logic as overview
        
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data, 5000);
      return data;
    } catch (error) {
      return { activeSession: null, todayStats: null, isActive: false, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Cache management
   */
  getCachedData(key, maxAge = 10000) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < maxAge) {
      return cached.data;
    }
    return null;
  }

  setCachedData(key, data, maxAge = 10000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      maxAge
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Get empty overview data as fallback
   */
  getEmptyOverviewData() {
    return {
      totalCost: 0,
      totalSessions: 0,
      totalProjects: 0,
      totalTokens: 0,
      totalEntries: 0,
      averageCostPerSession: 0,
      avgTokensPerSession: 0,
      activeDays: 0,
      lastActivity: null,
      status: 'inactive',
      models: [],
      currentSession: { active: false },
      currentMonth: { total_cost: 0, session_count: 0, total_tokens: 0 },
      currency: this.settings.currency,
      databaseSize: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Refresh all data (Windows-compatible)
   */
  async refreshAll() {
    this.clearCache();
    
    try {
      // Force refresh the database first
      await this.forceRefreshData();
      
      // Then pre-load all tab data
      const promises = [
        this.getOverviewData(),
        this.getProjectsData(),
        this.getSessionsData(),
        this.getMonthlyData(),
        this.getDailyData(),
        this.getActiveData()
      ];
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = CLIDataAdapter;