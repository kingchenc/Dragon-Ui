/**
 * Core Data Service
 * Central service that calculates all 75 unique values once
 * Provides consistent data to all tabs with individual refresh capability
 * Now uses Worker threads + SQLite database for blazing fast calculations
 */
const { Worker } = require('worker_threads');
const path = require('path');
const { modelPriceService } = require('./model-price-service.cjs');

class CoreDataService {
  constructor(dataLoader, pathManager) {
    this.dataLoader = dataLoader;
    this.pathManager = pathManager;
    
    // Currency support (data provided by currency-service.ts via store)
    this.currency = 'USD'; // Default currency
    this.exchangeRates = {}; // Provided by currency-service.ts
    this.billingCycleDay = 1; // Default billing cycle day
    
    // Auto-push callback for sending data to store.ts
    this.autoPushCallback = null;
    
    // Incremental loading state
    this.lastProcessedTimestamp = 0;
    this.lastRefreshTime = 0;
    this.processedEntryIds = new Set();
    this.isInitialLoad = true;
    
    // Core calculated data - the 75 unique values
    this.coreData = {
      // Basic Financial
      totalCost: 0,
      cost: 0,
      currentCost: 0,
      costAmount: 0,
      
      // Sessions & Projects  
      totalSessions: 0,
      sessions: 0,
      sessionsCount: 0,
      validSessions: 0,
      recentSessions: 0,
      totalProjects: 0,
      projectsCount: 0,
      
      // Averages & Ratios
      averageCostPerSession: 0,
      avgCostPerSession: 0,
      avgCostPerProject: 0,
      avgDuration: 0,
      avgSessionCost: 0,
      avgTokensPerSession: 0,
      
      // Tokens
      totalTokens: 0,
      tokens: 0,
      tokensUsed: 0,
      tokensCount: 0,
      
      // Costs per Unit
      costPer1MTokens: 0,
      costPerToken: 0,
      costPer1KTokens: 0,
      costPerConversation: 0,
      costPerEntry: 0,
      
      // Time & Duration
      started: null,
      duration: 0,
      timeLeft: 0,
      timeAgo: null,
      lastActivity: null,
      dateTime: null,
      sessionTimeLeft: 0,
      
      // Active/Live Data
      activeSession: null,
      sessionActive: false,
      activeDays: 0,
      entries: 0,
      
      // Status & State
      status: 'idle',
      sessionStatus: 'idle',
      
      // Models & Technical
      models: [],
      modelsCount: 0,
      modelsList: [],
      sessionId: null,
      block: null,
      blocks: [],
      blocksCount: 0,
      totalBlocks: 0,
      
      // Project Specific
      projectName: null,
      project: null,
      topRanking: 0,
      percentageOfTotal: 0,
      mostActiveProject: null,
      mostRecentActivity: null,
      
      // Session Analysis
      mostProductiveSession: null,
      longestSession: null,
      mostExpensiveSession: null,
      sessionNumber: 0,
      recentCount: 0,
      conversations: 0,
      efficiency: 0,
      
      // Time Periods
      daysTracked: 0,
      monthsTracked: 0,
      trackingPeriod: null,
      daysCount: 0,
      monthName: null,
      currentPeriod: 0,
      dailyAverage: 0,
      currentMonth: null,
      currentMonthCost: 0,
      
      // Projections & Trends
      projectedMonthly: 0,
      monthlyAverage: 0,
      quarterlyProjection: 0,
      yearlyProjection: 0,
      currentRunRate: 0,
      growthTrend: 0,
      
      // Performance Metrics
      costEfficiency: 0,
      tokensPerSession: 0,
      tokensPerMinute: 0,
      estimatedHourlyCost: 0,
      projectedSessionCost: 0,
      sessionTimeProgress: 0,
      progressPercentage: 0,
      tokensPerHour: 0,
      entriesPerHour: 0,
      projectedPerHour: 0,
      sessionRate: 0,
      
      // Additional Analysis
      highestSpendingMonth: null,
      mostActiveMonth: null,
      vsAvgPercentage: 0,
      timeRanges: [],
      dailyBreakdown: [],
      last7DaysTotal: 0,
      activityData: [],
      
      // Live Monitor Data for Active Tab
      liveMetrics: {},
      activityWindows: [],
      peakActivity: 0,
      averageActivity: 0,
      timeSinceLastActivity: null,
      isSystemActive: false,
      
      // Gap Detection Data
      gaps: [],
      gapStatistics: {},
      productivityPatterns: {},
      workPattern: 'mixed-pattern',
      
      // Model Breakdown Data
      modelBreakdown: [],
      modelStats: {},
      modelEfficiency: [],
      costDistribution: {},
      
      // Export capabilities
      exportFormats: ['json', 'csv', 'markdown', 'html', 'txt'],
      
      // Currency data
      currentCurrency: 'USD',
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'],
      exchangeRates: {},
      lastRateUpdate: null
    };
    
    // Individual tab data refresh timestamps
    this.lastRefresh = {
      overview: 0,
      projects: 0, 
      sessions: 0,
      monthly: 0,
      daily: 0,
      active: 0
    };
    
    // Tab-specific refresh intervals (in ms)
    this.refreshIntervals = {
      overview: 30000,    // 30s
      projects: 60000,    // 1min
      sessions: 60000,    // 1min  
      monthly: 300000,    // 5min
      daily: 120000,      // 2min
      active: 5000        // 5s - most frequent for live data
    };
    
    this.isLoading = false;
  }
  
  /**
   * Helper method to yield control back to the event loop
   * This prevents blocking the UI during heavy calculations
   */
  async yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Load and calculate core data - SMART INCREMENTAL MODE
   * Only processes new/changed data after initial load
   */
  async calculateCoreData() {
    if (this.isLoading) return this.coreData;
    
    this.isLoading = true;
    const currentTime = Date.now();
    
    try {
      // Get fresh data from DataLoader
      const activePaths = this.pathManager.getAllPaths().active;
      await this.dataLoader.loadAllUsageEntries(activePaths);
      const allEntries = this.dataLoader.getAllUsageEntries();
      
      if (this.isInitialLoad) {
        // First load - process everything
        console.log(`[LOAD] CoreDataService: INITIAL LOAD - Processing ${allEntries.length} entries with Worker thread...`);
        
        const result = await this.calculateInWorker(allEntries);
        Object.assign(this.coreData, result);
        
        // Track processed entries
        this.processedEntryIds = new Set(allEntries.map(e => e.id || `${e.timestamp}-${e.sessionId}`));
        this.lastProcessedTimestamp = Math.max(...allEntries.map(e => new Date(e.timestamp).getTime()));
        this.isInitialLoad = false;
        
        console.log(`[OK] CoreDataService: Initial load completed - ${allEntries.length} entries processed`);
      } else {
        // Incremental refresh - only process new entries
        const newEntries = allEntries.filter(entry => {
          const entryId = entry.id || `${entry.timestamp}-${entry.sessionId}`;
          const entryTime = new Date(entry.timestamp).getTime();
          return !this.processedEntryIds.has(entryId) || entryTime > this.lastProcessedTimestamp;
        });
        
        if (newEntries.length === 0) {
          console.log('[OK] CoreDataService: No new data to process - using cached results');
          this.lastRefreshTime = currentTime;
          return this.coreData;
        }
        
        console.log(`[LOAD] CoreDataService: INCREMENTAL UPDATE - Processing ${newEntries.length} new entries (${allEntries.length} total)`);
        
        // Process only new entries and merge with existing data
        const incrementalResult = await this.calculateIncrementalUpdate(newEntries, allEntries);
        Object.assign(this.coreData, incrementalResult);
        
        // Update tracking
        newEntries.forEach(entry => {
          const entryId = entry.id || `${entry.timestamp}-${entry.sessionId}`;
          this.processedEntryIds.add(entryId);
        });
        this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, ...newEntries.map(e => new Date(e.timestamp).getTime()));
        
        console.log(`[OK] CoreDataService: Incremental update completed - ${newEntries.length} new entries processed`);
      }
      
      this.lastRefreshTime = currentTime;
      
      // Auto-push to store.ts if callback is set
      if (this.autoPushCallback) {
        this.autoPushCallback({ ...this.coreData });
      }
      
      return this.coreData;
      
    } catch (error) {
      console.error('[ERR] CoreDataService: Error calculating core data:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Smart incremental update - only recalculates affected metrics
   */
  async calculateIncrementalUpdate(newEntries, allEntries) {
    console.log(`[CALC] CoreDataService: Smart incremental calculation for ${newEntries.length} new entries`);
    
    // Always use Worker thread for proper monthly calculations
    // Even small updates need proper monthly/billing period recalculation
    console.log(`[CALC] CoreDataService: Using Worker thread for proper monthly calculations`);
    return this.calculateInWorker(allEntries, true);
  }
  
  /**
   * Direct incremental calculation for small updates (< 1000 entries)
   */
  async calculateIncrementalDirect(newEntries) {
    const updates = { ...this.coreData };
    
    // Process new entries directly
    let newCost = 0;
    let newTokens = 0;
    const newSessions = new Set();
    const newProjects = new Set();
    
    for (const entry of newEntries) {
      newCost += (entry.cost || 0);
      newTokens += (entry.total_tokens || entry.input_tokens + entry.output_tokens || 0);
      
      if (entry.sessionId) newSessions.add(entry.sessionId);
      if (entry.project || entry.cwd) newProjects.add(entry.project || entry.cwd);
    }
    
    // Update totals
    updates.totalCost += newCost;
    updates.cost = updates.totalCost;
    updates.currentCost = updates.totalCost;
    updates.costAmount = updates.totalCost;
    
    updates.totalTokens += newTokens;
    updates.tokens = updates.totalTokens;
    updates.tokensUsed = updates.totalTokens;
    updates.tokensCount = updates.totalTokens;
    
    // Update session counts (check for truly new sessions)
    const existingSessions = new Set(updates.sessionsData?.map(s => s.sessionId) || []);
    const actuallyNewSessions = Array.from(newSessions).filter(s => !existingSessions.has(s));
    
    updates.totalSessions += actuallyNewSessions.length;
    updates.sessions = updates.totalSessions;
    updates.sessionsCount = updates.totalSessions;
    updates.validSessions = updates.totalSessions;
    
    // Update project counts
    const existingProjects = new Set(updates.projectsData?.map(p => p.project) || []);
    const actuallyNewProjects = Array.from(newProjects).filter(p => !existingProjects.has(p));
    
    updates.totalProjects += actuallyNewProjects.length;
    updates.projectsCount = updates.totalProjects;
    
    // Recalculate averages
    if (updates.totalSessions > 0) {
      updates.averageCostPerSession = updates.totalCost / updates.totalSessions;
      updates.avgCostPerSession = updates.averageCostPerSession;
      updates.avgTokensPerSession = updates.totalTokens / updates.totalSessions;
    }
    
    // Update daily data for new entries (simple approximation for small updates)
    if (updates.dailyData && newEntries.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      let todayEntry = updates.dailyData.find(d => d.date === today);
      
      if (!todayEntry) {
        todayEntry = {
          date: today,
          totalCost: 0,
          totalTokens: 0,
          sessions: 0,
          models: [],
          isToday: true,
          isYesterday: false,
          isRecent: true
        };
        updates.dailyData.unshift(todayEntry);
      }
      
      // Add new data to today's entry
      todayEntry.totalCost += newCost;
      todayEntry.totalTokens += newTokens;
      
      // Recalculate last 7 days activity chart data
      const last7Days = updates.dailyData.slice(0, 7).reverse();
      updates.dailyBreakdown = last7Days;
      updates.last7DaysTotal = last7Days.reduce((sum, day) => sum + day.totalCost, 0);
      
      updates.activityData = last7Days.map(day => ({
        date: day.date,
        cost: day.totalCost,
        tokens: day.totalTokens,
        sessions: day.sessions,
        label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      }));
    }
    
    // Update monthly data for current month (simple approximation)
    if (updates.monthlyData && newEntries.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let currentMonthEntry = updates.monthlyData.find(m => m.month === currentMonth);
      
      if (!currentMonthEntry) {
        const now = new Date();
        currentMonthEntry = {
          month: currentMonth,
          year: now.getFullYear(),
          monthNumber: now.getMonth() + 1,
          monthName: now.toLocaleDateString('en-US', { month: 'long' }),
          totalCost: 0,
          totalTokens: 0,
          sessions: 0,
          daysActive: 0,
          models: [],
          avgCostPerDay: 0,
          avgCostPerSession: 0,
          isCurrent: true
        };
        updates.monthlyData.unshift(currentMonthEntry);
      }
      
      // Add new costs to current month
      currentMonthEntry.totalCost += newCost;
      currentMonthEntry.totalTokens += newTokens;
      
      // Update monthly summary fields
      updates.currentMonth = currentMonthEntry.monthName;
      updates.currentMonthCost = currentMonthEntry.totalCost;
      updates.currentPeriod = currentMonthEntry.totalCost;
      updates.monthsTracked = updates.monthlyData.length;
    }
    
    // Update overview fields with new data
    if (newEntries.length > 0) {
      // Update models list
      const existingModels = new Set(updates.models || []);
      for (const entry of newEntries) {
        if (entry.model) existingModels.add(entry.model);
      }
      updates.models = Array.from(existingModels);
      updates.modelsCount = updates.models.length;
      updates.modelsList = updates.models;
      
      // Update active days count
      if (updates.dailyData) {
        updates.activeDays = updates.dailyData.length;
        updates.daysTracked = updates.dailyData.length;
      }
    }
    
    // Update active session data from database
    this.updateActiveSessionData(updates);
    
    console.log(`[FAST] CoreDataService: Direct incremental update completed - +$${newCost.toFixed(4)}, +${newTokens} tokens, activity: ${updates.activityData?.length || 0} days`);
    return updates;
  }
  
  /**
   * Update active session data from database (for incremental updates)
   */
  updateActiveSessionData(updates) {
    try {
      const now = Date.now();
      const db = this.dataLoader.getDatabase(); // Get database from dataLoader
      const recentEntries = db.getRecentEntries(30); // Last 30 minutes
      
      console.log(`[ACTIVE UPDATE] Found ${recentEntries.length} entries in last 30 minutes`);
      
      let activeSessionId = null;
      if (recentEntries.length > 0) {
        // Find the most recent session
        const latestEntry = recentEntries.reduce((latest, entry) => {
          return new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest;
        });
        activeSessionId = latestEntry.session_id;
        
        const minutesAgo = Math.round((now - new Date(latestEntry.timestamp).getTime()) / (1000 * 60));
        console.log(`[ACTIVE UPDATE] Latest entry: ${latestEntry.session_id}, ${minutesAgo}min ago`);
      }
      
      // Update active session data
      updates.activeSession = activeSessionId;
      updates.sessionActive = !!activeSessionId;
      updates.sessionId = activeSessionId;
      
      // Calculate current session data if active
      if (activeSessionId) {
        const sessionEntries = db.getSessionEntries(activeSessionId);
        
        if (sessionEntries.length > 0) {
          const sessionStart = new Date(Math.min(...sessionEntries.map(e => new Date(e.timestamp).getTime())));
          const sessionEnd = new Date(Math.max(...sessionEntries.map(e => new Date(e.timestamp).getTime())));
          const sessionCost = sessionEntries.reduce((sum, e) => sum + (e.cost || 0), 0);
          const sessionTokens = sessionEntries.reduce((sum, e) => sum + ((e.input_tokens || 0) + (e.output_tokens || 0) + (e.cache_creation_input_tokens || 0) + (e.cache_read_input_tokens || 0)), 0);
          
          const durationMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60));
          const timeLeftMinutes = Math.max(0, 300 - durationMinutes); // 5 hours = 300 minutes
          
          console.log(`[ACTIVE UPDATE] Current Session: ${sessionEntries.length} entries, cost=$${sessionCost.toFixed(4)}, tokens=${sessionTokens}, duration=${durationMinutes}min`);
          
          updates.started = sessionStart.toISOString();
          updates.duration = durationMinutes;
          updates.currentCost = sessionCost;
          updates.currentTokens = sessionTokens;
          updates.timeLeft = timeLeftMinutes;
          updates.sessionTimeLeft = timeLeftMinutes;
          updates.lastActivity = sessionEnd.toISOString();
          updates.status = timeLeftMinutes > 0 ? 'active' : 'expired';
          updates.sessionStatus = updates.status;
        }
      } else {
        updates.status = 'idle';
        updates.sessionStatus = 'idle';
        updates.currentCost = 0;
        updates.currentTokens = 0;
        updates.duration = 0;
        updates.timeLeft = 0;
        updates.sessionTimeLeft = 0;
        console.log(`[ACTIVE UPDATE] No active session found`);
      }
      
    } catch (error) {
      console.error('[ERROR] Failed to update active session data:', error);
    }
  }
  
  /**
   * Run calculations in Worker thread
   */
  async calculateInWorker(usageEntries, isIncremental = false) {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, 'core-data-worker.cjs');
      const worker = new Worker(workerPath);
      
      // Send data to worker
      worker.postMessage({
        type: 'calculateAllData',
        usageEntries,
        currency: this.currency,
        exchangeRates: this.exchangeRates,
        billingCycleDay: this.billingCycleDay || 1,
        isIncremental: isIncremental,
        existingData: isIncremental ? this.coreData : null
      });
      
      // Handle worker messages
      worker.on('message', (message) => {
        if (message.type === 'progress') {
          console.log(`[LOAD] Worker Progress: ${message.message} (${message.progress.toFixed(1)}%)`);
          
          // Optionally send progress to UI
          if (this.autoPushCallback) {
            this.autoPushCallback({
              ...this.coreData,
              _loadingProgress: {
                step: message.step,
                progress: message.progress,
                message: message.message
              }
            });
          }
        } else if (message.type === 'result') {
          // Debug the currency problem BEFORE resolving
          console.log(`[DEBUG] MAIN: Currency: ${this.currency}`);
          console.log(`[DEBUG] MAIN: Total Cost: $${message.data.totalCost?.toFixed(2) || 0}`);
          console.log(`[DEBUG] MAIN: Current Month Cost: $${message.data.currentMonthCost?.toFixed(2) || 0}`);
          console.log(`[DEBUG] MAIN: Current Month: ${message.data.currentMonth}`);
          console.log(`[DEBUG] MAIN: Monthly Data Array Length: ${message.data.monthlyData?.length || 0}`);
          
          // Debug first monthly entry
          if (message.data.monthlyData && message.data.monthlyData.length > 0) {
            const firstMonth = message.data.monthlyData[0];
            console.log(`[DEBUG] MAIN: First monthly entry:`, {
              month: firstMonth.monthName,
              cost: firstMonth.totalCost,
              isCurrent: firstMonth.isCurrent || firstMonth.isCurrentMonth
            });
          }
          
          if (message.data.currentMonthCost > message.data.totalCost) {
            console.error('[CURRENCY BUG] MAIN: CURRENCY BUG DETECTED! Current Month ($${message.data.currentMonthCost?.toFixed(2)}) > Total Cost ($${message.data.totalCost?.toFixed(2)})');
            
            // FORCE FIX the impossible values
            message.data.currentMonthCost = message.data.totalCost;
            message.data.currentPeriod = message.data.totalCost;
            
            // Also fix the monthly data entry
            if (message.data.monthlyData) {
              const currentMonthEntry = message.data.monthlyData.find(m => m.isCurrent || m.isCurrentMonth);
              if (currentMonthEntry) {
                currentMonthEntry.totalCost = message.data.totalCost;
                console.log(`[FIX] MAIN: Also fixed monthly data entry to $${message.data.totalCost?.toFixed(2)}`);
              }
            }
            
            console.log(`[FIX] MAIN: Fixed Current Month to match Total Cost: $${message.data.totalCost?.toFixed(2)}`);
          }
          
          worker.terminate();
          resolve(message.data);
        } else if (message.type === 'error') {
          worker.terminate();
          reject(new Error(message.error));
        }
      });
      
      worker.on('error', (error) => {
        worker.terminate();
        reject(error);
      });
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker calculation timed out after 2 minutes'));
      }, 120000); // 2 minutes timeout
    });
  }
  
  /**
   * Get data for specific tab with refresh check
   */
  async getTabData(tabName) {
    const now = Date.now();
    const lastRefresh = this.lastRefresh[tabName] || 0;
    const refreshInterval = this.refreshIntervals[tabName] || 60000;
    
    // Check if tab needs refresh
    if (now - lastRefresh > refreshInterval) {
      console.log(`[LOAD] CoreDataService: Refreshing ${tabName} tab data`);
      await this.calculateCoreData();
      this.lastRefresh[tabName] = now;
    }
    
    // Return tab-specific data subset
    switch (tabName) {
      case 'overview':
        return this.getOverviewData();
      case 'projects':
        return this.getProjectsData();
      case 'sessions':
        return this.getSessionsData();
      case 'monthly':
        return this.getMonthlyData();
      case 'daily':
        return this.getDailyData();
      case 'active':
        return this.getActiveData();
      default:
        return this.coreData;
    }
  }
  
  /**
   * Force refresh specific tab
   */
  async forceRefreshTab(tabName) {
    console.log(`[LOAD] CoreDataService: Force refreshing ${tabName} tab`);
    this.lastRefresh[tabName] = 0; // Reset timestamp to force refresh
    return await this.getTabData(tabName);
  }
  
  /**
   * Force refresh all data - bypasses incremental mode
   */
  async forceRefreshAll() {
    console.log('[LOAD] CoreDataService: Force refreshing all data - FULL RECALCULATION');
    
    // Reset incremental tracking to force full recalculation
    // DO NOT set isInitialLoad = true (causes January 2001 bugs!)
    this.lastProcessedTimestamp = 0;
    this.processedEntryIds.clear();
    
    Object.keys(this.lastRefresh).forEach(tab => {
      this.lastRefresh[tab] = 0;
    });
    
    return await this.calculateCoreData();
  }
  
  /**
   * Update currency and exchange rates (called by store.ts)
   */
  updateCurrency(newCurrency, exchangeRates) {
    console.log(`[CURRENCY] CoreDataService: Updating currency to ${newCurrency}`);
    
    this.currency = newCurrency;
    this.exchangeRates = exchangeRates;
    this.coreData.currentCurrency = newCurrency;
    this.coreData.exchangeRates = exchangeRates;
    
    console.log(`[OK] CoreDataService: Currency updated to ${newCurrency}`);
  }

  /**
   * Update billing cycle day (called by store.ts)
   */
  updateBillingCycleDay(billingCycleDay) {
    console.log(`[BILLING] CoreDataService: Updating billing cycle day to ${billingCycleDay}`);
    
    this.billingCycleDay = billingCycleDay;
    
    console.log(`[OK] CoreDataService: Billing cycle day updated to ${billingCycleDay}`);
  }
  
  /**
   * Recalculate all data with new currency (called by store.ts after currency change)
   */
  async recalculateWithNewCurrency() {
    console.log('[CURRENCY] CoreDataService: Recalculating all costs with new currency');
    return await this.forceRefreshAll();
  }
  
  // Tab-specific data getters
  getOverviewData() {
    return {
      totalCost: this.coreData.totalCost,
      totalSessions: this.coreData.totalSessions,
      averageCostPerSession: this.coreData.averageCostPerSession,
      avgTokensPerSession: this.coreData.avgTokensPerSession,
      totalTokens: this.coreData.totalTokens,
      activeSession: this.coreData.activeSession,
      currentCost: this.coreData.currentCost,
      costPer1MTokens: this.coreData.costPer1MTokens,
      dailyBreakdown: this.coreData.dailyBreakdown,
      last7DaysTotal: this.coreData.last7DaysTotal,
      activityData: this.coreData.activityData,
      activeDays: this.coreData.activeDays,
      status: this.coreData.status,
      lastActivity: this.coreData.lastActivity,
      started: this.coreData.started,
      duration: this.coreData.duration,
      tokens: this.coreData.tokens,
      models: this.coreData.models
    };
  }
  
  getProjectsData() {
    return {
      totalProjects: this.coreData.totalProjects,
      totalCost: this.coreData.totalCost,
      avgCostPerProject: this.coreData.avgCostPerProject,
      projectsData: this.coreData.projectsData || [],
      mostActiveProject: this.coreData.mostActiveProject,
      mostRecentActivity: this.coreData.mostRecentActivity
    };
  }
  
  getSessionsData() {
    return {
      totalSessions: this.coreData.totalSessions,
      validSessions: this.coreData.validSessions,
      avgCostPerSession: this.coreData.avgCostPerSession,
      avgDuration: this.coreData.avgDuration,
      recentSessions: this.coreData.recentSessions,
      mostProductiveSession: this.coreData.mostProductiveSession,
      longestSession: this.coreData.longestSession,
      mostExpensiveSession: this.coreData.mostExpensiveSession,
      totalCost: this.coreData.totalCost,
      totalTokens: this.coreData.totalTokens,
      avgTokensPerSession: this.coreData.avgTokensPerSession,
      costEfficiency: this.coreData.costEfficiency,
      sessionsData: this.coreData.sessionsData || []
    };
  }
  
  getMonthlyData() {
    return {
      monthsTracked: this.coreData.monthsTracked,
      currentPeriod: this.coreData.currentPeriod,
      dailyAverage: this.coreData.dailyAverage,
      totalCost: this.coreData.totalCost,
      projectedMonthly: this.coreData.projectedMonthly,
      monthlyData: this.coreData.monthlyData || [],
      highestSpendingMonth: this.coreData.highestSpendingMonth,
      mostActiveMonth: this.coreData.mostActiveMonth,
      growthTrend: this.coreData.growthTrend,
      monthlyAverage: this.coreData.monthlyAverage,
      quarterlyProjection: this.coreData.quarterlyProjection,
      yearlyProjection: this.coreData.yearlyProjection,
      currentRunRate: this.coreData.currentRunRate
    };
  }
  
  getDailyData() {
    return {
      daysTracked: this.coreData.daysTracked,
      activeDays: this.coreData.activeDays,
      currentCost: this.coreData.currentCost,
      tokens: this.coreData.tokens,
      blocks: this.coreData.blocks,
      models: this.coreData.models,
      totalCost: this.coreData.totalCost,
      dailyAverage: this.coreData.dailyAverage,
      totalBlocks: this.coreData.totalBlocks,
      currentPeriod: this.coreData.currentPeriod,
      totalTokens: this.coreData.totalTokens,
      projectedMonthly: this.coreData.projectedMonthly,
      dailyData: this.coreData.dailyData || []
    };
  }
  
  getActiveData() {
    return {
      status: this.coreData.status,
      sessionActive: this.coreData.sessionActive,
      currentCost: this.coreData.currentCost,
      tokensUsed: this.coreData.tokensUsed,
      entries: this.coreData.entries,
      started: this.coreData.started,
      duration: this.coreData.duration,
      timeLeft: this.coreData.timeLeft,
      models: this.coreData.models,
      sessionId: this.coreData.sessionId,
      block: this.coreData.block,
      costPerEntry: this.coreData.costPerEntry,
      tokensPerMinute: this.coreData.tokensPerMinute,
      estimatedHourlyCost: this.coreData.estimatedHourlyCost,
      costPer1MTokens: this.coreData.costPer1MTokens,
      projectedSessionCost: this.coreData.projectedSessionCost,
      sessionTimeLeft: this.coreData.sessionTimeLeft,
      sessionTimeProgress: this.coreData.sessionTimeProgress,
      progressPercentage: this.coreData.progressPercentage,
      tokensPerHour: this.coreData.tokensPerHour,
      entriesPerHour: this.coreData.entriesPerHour,
      projectedPerHour: this.coreData.projectedPerHour,
      sessionStatus: this.coreData.sessionStatus,
      sessionRate: this.coreData.sessionRate,
      
      // Live Monitor Data
      liveMetrics: this.coreData.liveMetrics,
      activityWindows: this.coreData.activityWindows,
      peakActivity: this.coreData.peakActivity,
      averageActivity: this.coreData.averageActivity,
      timeSinceLastActivity: this.coreData.timeSinceLastActivity,
      isSystemActive: this.coreData.isSystemActive
    };
  }
  
  // Calculation methods for each category
  async calculateBasicFinancial(usageEntries) {
    // Calculate costs in USD first, then convert
    const totalCostUSD = usageEntries.reduce((sum, entry) => sum + (entry.cost || 0), 0);
    
    this.coreData.totalCost = this.convertCurrency(totalCostUSD);
    this.coreData.cost = this.coreData.totalCost;
    this.coreData.currentCost = this.coreData.totalCost; // Will be updated with current session
    this.coreData.costAmount = this.coreData.totalCost;
  }
  
  async calculateSessionsAndProjects(usageEntries) {
    // Group by sessionId to get unique sessions
    const sessionMap = new Map();
    const projectSet = new Set();
    
    usageEntries.forEach(entry => {
      const sessionId = entry.sessionId || entry.fullSessionId || 'unknown';
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, {
          sessionId,
          cost: 0,
          tokens: 0,
          conversations: 0,
          project: entry.project || entry.cwd
        });
      }
      
      const session = sessionMap.get(sessionId);
      session.cost += this.convertCurrency(entry.cost || 0);
      session.tokens += entry.total_tokens || 0;
      session.conversations += 1;
      
      if (entry.project || entry.cwd) {
        projectSet.add(entry.project || entry.cwd);
      }
    });
    
    const sessions = Array.from(sessionMap.values());
    
    this.coreData.totalSessions = sessions.length;
    this.coreData.sessions = sessions.length;
    this.coreData.sessionsCount = sessions.length;
    this.coreData.validSessions = sessions.filter(s => s.cost > 0 || s.tokens > 0).length;
    this.coreData.recentSessions = Math.min(10, sessions.length);
    this.coreData.totalProjects = projectSet.size;
    this.coreData.projectsCount = projectSet.size;
    
    // Store sessions data for individual tabs
    this.coreData.sessionsData = sessions;
  }
  
  async calculateAveragesAndRatios(usageEntries) {
    if (this.coreData.totalSessions > 0) {
      this.coreData.averageCostPerSession = this.coreData.totalCost / this.coreData.totalSessions;
      this.coreData.avgCostPerSession = this.coreData.averageCostPerSession;
      this.coreData.avgSessionCost = this.coreData.averageCostPerSession;
    }
    
    if (this.coreData.totalProjects > 0) {
      this.coreData.avgCostPerProject = this.coreData.totalCost / this.coreData.totalProjects;
    }
    
    // Calculate average duration from sessions
    // TODO: Implement duration calculation from session timestamps
    this.coreData.avgDuration = 180; // Placeholder - 3 hours average
    
    if (this.coreData.totalSessions > 0) {
      this.coreData.avgTokensPerSession = this.coreData.totalTokens / this.coreData.totalSessions;
    }
  }
  
  async calculateTokens(usageEntries) {
    this.coreData.totalTokens = usageEntries.reduce((sum, entry) => sum + (entry.total_tokens || 0), 0);
    this.coreData.tokens = this.coreData.totalTokens;
    this.coreData.tokensUsed = this.coreData.totalTokens;
    this.coreData.tokensCount = this.coreData.totalTokens;
  }
  
  async calculateCostsPerUnit(usageEntries) {
    if (this.coreData.totalTokens > 0) {
      this.coreData.costPerToken = this.coreData.totalCost / this.coreData.totalTokens;
      this.coreData.costPer1MTokens = this.coreData.costPerToken * 1000000;
      this.coreData.costPer1KTokens = this.coreData.costPerToken * 1000;
    }
    
    const totalConversations = usageEntries.length;
    if (totalConversations > 0) {
      this.coreData.costPerConversation = this.coreData.totalCost / totalConversations;
      this.coreData.costPerEntry = this.coreData.costPerConversation;
    }
  }
  
  async calculateTimeAndDuration(usageEntries) {
    if (usageEntries.length > 0) {
      // Get most recent entry for current session
      const sortedEntries = usageEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const mostRecent = sortedEntries[0];
      
      this.coreData.started = mostRecent.timestamp;
      this.coreData.lastActivity = mostRecent.timestamp;
      this.coreData.dateTime = mostRecent.timestamp;
      
      // Calculate time ago and duration
      const now = new Date();
      const startTime = new Date(mostRecent.timestamp);
      const diffMs = now - startTime;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      this.coreData.duration = diffMinutes;
      this.coreData.timeAgo = `${diffMinutes}m ago`;
      
      // Calculate session time left (5 hour limit)
      const sessionLimitMinutes = 300; // 5 hours
      this.coreData.sessionTimeLeft = Math.max(0, sessionLimitMinutes - diffMinutes);
      this.coreData.timeLeft = this.coreData.sessionTimeLeft;
    }
  }
  
  async calculateActiveLiveData(usageEntries) {
    // Check if there's an active session (recent activity within 2 hours)
    if (usageEntries.length > 0) {
      const now = new Date();
      const mostRecent = new Date(Math.max(...usageEntries.map(e => new Date(e.timestamp))));
      const timeDiffMinutes = (now - mostRecent) / (1000 * 60);
      
      this.coreData.sessionActive = timeDiffMinutes < 120; // 2 hours
      this.coreData.activeSession = this.coreData.sessionActive ? 'In Progress' : null;
      this.coreData.status = this.coreData.sessionActive ? 'Live' : 'Idle';
    }
    
    this.coreData.entries = usageEntries.length;
    
    // Calculate active days
    const uniqueDays = new Set(usageEntries.map(e => e.timestamp.split('T')[0]));
    this.coreData.activeDays = uniqueDays.size;
  }
  
  async calculateModelsAndTechnical(usageEntries) {
    const modelsSet = new Set();
    usageEntries.forEach(entry => {
      if (entry.model) {
        modelsSet.add(entry.model);
      }
    });
    
    this.coreData.models = Array.from(modelsSet);
    this.coreData.modelsCount = modelsSet.size;
    this.coreData.modelsList = this.coreData.models;
    
    // Session ID from most recent entry
    if (usageEntries.length > 0) {
      const sortedEntries = usageEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      this.coreData.sessionId = sortedEntries[0].sessionId;
      this.coreData.block = sortedEntries[0].sessionId; // Same as session ID
    }
    
    // Calculate blocks (sessions grouped by 5-hour windows)
    // For now, use sessions as blocks
    this.coreData.blocks = this.coreData.sessionsData || [];
    this.coreData.blocksCount = this.coreData.totalSessions;
    this.coreData.totalBlocks = this.coreData.totalSessions;
  }
  
  async calculateProjectSpecific(usageEntries) {
    // Group by project
    const projectMap = new Map();
    
    usageEntries.forEach(entry => {
      const project = entry.project || entry.cwd || 'unknown';
      if (!projectMap.has(project)) {
        projectMap.set(project, {
          project,
          cost: 0,
          tokens: 0,
          sessions: 0,
          lastActivity: entry.timestamp
        });
      }
      
      const proj = projectMap.get(project);
      proj.cost += entry.cost || 0;
      proj.tokens += entry.total_tokens || 0;
      proj.sessions += 1;
      
      if (entry.timestamp > proj.lastActivity) {
        proj.lastActivity = entry.timestamp;
      }
    });
    
    const projects = Array.from(projectMap.values()).sort((a, b) => b.cost - a.cost);
    
    if (projects.length > 0) {
      this.coreData.mostActiveProject = projects[0].project;
      this.coreData.projectName = projects[0].project;
      this.coreData.project = projects[0].project;
      this.coreData.topRanking = 1;
      this.coreData.percentageOfTotal = (projects[0].cost / this.coreData.totalCost) * 100;
      
      // Most recent activity
      const mostRecentProject = projects.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))[0];
      this.coreData.mostRecentActivity = mostRecentProject.project;
    }
    
    // Store projects data
    this.coreData.projectsData = projects;
  }
  
  async calculateSessionAnalysis(usageEntries) {
    const sessions = this.coreData.sessionsData || [];
    
    if (sessions.length > 0) {
      // Most productive (highest tokens)
      const mostTokens = sessions.reduce((max, current) => 
        current.tokens > max.tokens ? current : max, sessions[0]);
      this.coreData.mostProductiveSession = mostTokens.tokens;
      
      // Most expensive
      const mostExpensive = sessions.reduce((max, current) =>
        current.cost > max.cost ? current : max, sessions[0]);
      this.coreData.mostExpensiveSession = mostExpensive.cost;
      
      // Longest session (placeholder - would need duration calculation)
      this.coreData.longestSession = 299; // minutes
      
      this.coreData.sessionNumber = sessions.length;
      this.coreData.recentCount = Math.min(10, sessions.length);
      
      const totalConversations = sessions.reduce((sum, s) => sum + s.conversations, 0);
      this.coreData.conversations = totalConversations;
      
      // Efficiency (tokens per minute)
      if (this.coreData.avgDuration > 0) {
        this.coreData.efficiency = this.coreData.avgTokensPerSession / this.coreData.avgDuration;
      }
    }
  }
  
  async calculateTimePeriods(usageEntries) {
    this.coreData.daysTracked = this.coreData.activeDays;
    
    // Calculate months - ensure at least 1 month if we have any data (with validation)
    const uniqueMonths = new Set();
    usageEntries.forEach(e => {
      if (e.timestamp && typeof e.timestamp === 'string' && e.timestamp.length >= 7) {
        const monthStr = e.timestamp.substr(0, 7); // YYYY-MM
        const date = new Date(monthStr + '-01');
        // Only add valid months from 2020 onwards
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020) {
          uniqueMonths.add(monthStr);
        }
      }
    });
    
    // If we have any usage data but no valid months detected, add current month
    if (usageEntries.length > 0 && uniqueMonths.size === 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      uniqueMonths.add(currentMonth);
    }
    
    this.coreData.monthsTracked = Math.max(uniqueMonths.size, usageEntries.length > 0 ? 1 : 0);
    
    this.coreData.trackingPeriod = `${this.coreData.daysTracked} days`;
    this.coreData.daysCount = this.coreData.daysTracked;
    
    if (usageEntries.length > 0) {
      const mostRecent = new Date(Math.max(...usageEntries.map(e => new Date(e.timestamp))));
      this.coreData.monthName = mostRecent.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    // Current period (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentEntries = usageEntries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
    this.coreData.currentPeriod = recentEntries.reduce((sum, e) => sum + (e.cost || 0), 0);
    
    if (this.coreData.daysTracked > 0) {
      this.coreData.dailyAverage = this.coreData.totalCost / this.coreData.daysTracked;
    }
  }
  
  async calculateProjectionsAndTrends(usageEntries) {
    if (this.coreData.dailyAverage > 0) {
      this.coreData.projectedMonthly = this.coreData.dailyAverage * 30;
      this.coreData.monthlyAverage = this.coreData.projectedMonthly;
      this.coreData.quarterlyProjection = this.coreData.projectedMonthly * 3;
      this.coreData.yearlyProjection = this.coreData.projectedMonthly * 12;
      this.coreData.currentRunRate = this.coreData.yearlyProjection;
    }
    
    // Growth trend (placeholder - would need historical comparison)
    this.coreData.growthTrend = 0; // 0% change
  }
  
  async calculatePerformanceMetrics(usageEntries) {
    if (this.coreData.totalTokens > 0) {
      this.coreData.costEfficiency = this.coreData.totalCost / this.coreData.totalTokens;
    }
    
    if (this.coreData.totalSessions > 0) {
      this.coreData.tokensPerSession = this.coreData.totalTokens / this.coreData.totalSessions;
    }
    
    if (this.coreData.duration > 0) {
      this.coreData.tokensPerMinute = this.coreData.totalTokens / this.coreData.duration;
      this.coreData.tokensPerHour = this.coreData.tokensPerMinute * 60;
    }
    
    if (this.coreData.duration > 0) {
      this.coreData.estimatedHourlyCost = (this.coreData.currentCost / this.coreData.duration) * 60;
      this.coreData.entriesPerHour = (this.coreData.entries / this.coreData.duration) * 60;
      this.coreData.projectedPerHour = this.coreData.estimatedHourlyCost;
    }
    
    this.coreData.projectedSessionCost = this.coreData.currentCost; // For current session
    
    // Session progress (percentage of 5-hour limit)
    if (this.coreData.duration > 0) {
      this.coreData.sessionTimeProgress = (this.coreData.duration / 300) * 100; // 300 minutes = 5 hours
      this.coreData.progressPercentage = this.coreData.sessionTimeProgress;
    }
    
    this.coreData.sessionRate = `${this.coreData.estimatedHourlyCost}/hour`;
    
    // Live Monitor metrics for Active Tab
    this.coreData.liveMetrics = this.calculateLiveMetrics(usageEntries);
    this.coreData.activityWindows = this.calculateActivityWindows(usageEntries, 5);
    this.coreData.peakActivity = this.coreData.activityWindows.length > 0 ? 
      Math.max(...this.coreData.activityWindows.map(w => w.entries), 0) : 0;
    this.coreData.averageActivity = this.coreData.activityWindows.length > 0 ? 
      (this.coreData.activityWindows.reduce((sum, w) => sum + w.entries, 0) / this.coreData.activityWindows.length) : 0;
    this.coreData.isSystemActive = this.isSystemActive(usageEntries);
    this.coreData.timeSinceLastActivity = usageEntries.length > 0 ? 
      this.getTimeSinceLastActivity(usageEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp) : null;
  }
  
  async calculateAdditionalAnalysis(usageEntries) {
    // Group by month for spending analysis (with validation)
    const monthlyMap = new Map();
    
    usageEntries.forEach(entry => {
      if (entry.timestamp && typeof entry.timestamp === 'string' && entry.timestamp.length >= 7) {
        const month = entry.timestamp.substr(0, 7); // YYYY-MM
        const date = new Date(month + '-01');
        // Only process valid months from 2020 onwards
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020) {
          if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { cost: 0, sessions: 0 });
          }
          monthlyMap.get(month).cost += entry.cost || 0;
          monthlyMap.get(month).sessions += 1;
        }
      }
    });
    
    // Ensure current month exists if we have any data
    if (usageEntries.length > 0 && monthlyMap.size === 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      monthlyMap.set(currentMonth, { cost: 0, sessions: 0 });
    }
    
    const monthlyData = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      ...data
    }));
    
    if (monthlyData.length > 0) {
      const highestSpending = monthlyData.reduce((max, current) =>
        current.cost > max.cost ? current : max, monthlyData[0]);
      this.coreData.highestSpendingMonth = highestSpending.month;
      
      const mostActive = monthlyData.reduce((max, current) =>
        current.sessions > max.sessions ? current : max, monthlyData[0]);
      this.coreData.mostActiveMonth = mostActive.month;
    }
    
    this.coreData.vsAvgPercentage = 0; // Placeholder
    this.coreData.timeRanges = ['0h', '5h']; // Session time range
    
    // Calculate last 7 days breakdown and total
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const last7Days = usageEntries.filter(e => new Date(e.timestamp) >= sevenDaysAgo);
    this.coreData.last7DaysTotal = last7Days.reduce((sum, e) => sum + (e.cost || 0), 0);
    
    // Daily breakdown for chart
    const dailyMap = new Map();
    last7Days.forEach(entry => {
      const day = entry.timestamp.split('T')[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + (entry.cost || 0));
    });
    
    this.coreData.dailyBreakdown = Array.from(dailyMap.entries()).map(([date, cost]) => ({
      date,
      cost
    }));
    
    // Store additional data arrays
    this.coreData.monthlyData = monthlyData;
    this.coreData.dailyData = this.coreData.dailyBreakdown;
    
    // Update monthsTracked to match the actual monthly data we have
    this.coreData.monthsTracked = Math.max(this.coreData.monthsTracked, monthlyData.length);
  }
  
  /**
   * Get current session status for other services
   */
  getSessionStatus() {
    return {
      sessionActive: this.coreData.sessionActive,
      status: this.coreData.status,
      duration: this.coreData.duration,
      currentCost: this.coreData.currentCost,
      entries: this.coreData.entries
    };
  }
  
  /**
   * Calculate live metrics for Active Tab (from LiveMonitor)
   */
  calculateLiveMetrics(entries) {
    if (entries.length === 0) return {};

    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstEntry = sortedEntries[0];
    const lastEntry = sortedEntries[sortedEntries.length - 1];
    const sessionDuration = (new Date(lastEntry.timestamp) - new Date(firstEntry.timestamp)) / (1000 * 60);

    // Calculate activity windows (5-minute buckets)
    const activityWindows = this.calculateActivityWindows(entries, 5);
    
    return {
      sessionDuration: Math.round(sessionDuration),
      entriesPerMinute: sessionDuration > 0 ? (entries.length / sessionDuration).toFixed(2) : 0,
      activeWindows: activityWindows.length,
      peakActivity: Math.max(...activityWindows.map(w => w.entries), 0),
      averageActivity: activityWindows.length > 0 ? 
        (activityWindows.reduce((sum, w) => sum + w.entries, 0) / activityWindows.length).toFixed(1) : 0,
      lastActivity: lastEntry.timestamp,
      timeSinceLastActivity: this.getTimeSinceLastActivity(lastEntry.timestamp)
    };
  }

  /**
   * Calculate activity in time windows (5-minute buckets)
   */
  calculateActivityWindows(entries, windowMinutes) {
    if (entries.length === 0) return [];

    const windows = [];
    const windowSize = windowMinutes * 60 * 1000; // milliseconds
    
    const sortedEntries = entries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const startTime = new Date(sortedEntries[0].timestamp).getTime();
    const endTime = new Date(sortedEntries[sortedEntries.length - 1].timestamp).getTime();

    for (let time = startTime; time <= endTime; time += windowSize) {
      const windowEnd = time + windowSize;
      const entriesInWindow = sortedEntries.filter(entry => {
        const entryTime = new Date(entry.timestamp).getTime();
        return entryTime >= time && entryTime < windowEnd;
      });

      if (entriesInWindow.length > 0) {
        // Calculate tokens for this window
        const windowTokens = entriesInWindow.reduce((sum, entry) => sum + (entry.total_tokens || 0), 0);
        
        windows.push({
          startTime: new Date(time).toISOString(),
          endTime: new Date(windowEnd).toISOString(),
          entries: entriesInWindow.length,
          tokens: windowTokens
        });
      }
    }

    return windows;
  }

  /**
   * Get time since last activity in human readable format
   */
  getTimeSinceLastActivity(timestamp) {
    const now = new Date();
    const lastActivity = new Date(timestamp);
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  /**
   * Get recent entries within time window (for live monitoring)
   */
  getRecentEntries(entries, minutes) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return entries.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Check if system is currently active (for real-time status)
   */
  isSystemActive(entries) {
    const recentEntries = this.getRecentEntries(entries, 10); // Last 10 minutes
    return recentEntries.length > 0;
  }
  
  /**
   * Calculate Gap Detection (from GapDetectorService)
   */
  async calculateGapDetection(usageEntries) {
    if (usageEntries.length === 0) return;
    
    const GAP_THRESHOLD_MINUTES = 30;
    const sortedEntries = [...usageEntries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const gaps = [];
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const prevEntry = sortedEntries[i - 1];
      const currentEntry = sortedEntries[i];
      
      const prevTime = new Date(prevEntry.timestamp);
      const currentTime = new Date(currentEntry.timestamp);
      const gapDuration = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60); // minutes

      if (gapDuration > GAP_THRESHOLD_MINUTES) {
        gaps.push({
          id: `gap-${prevTime.toISOString()}`,
          startTime: prevTime.toISOString(),
          endTime: currentTime.toISOString(),
          durationMinutes: Math.round(gapDuration),
          durationHours: (gapDuration / 60).toFixed(1),
          reason: this.classifyGapReason(gapDuration)
        });
      }
    }
    
    this.coreData.gaps = gaps;
    this.coreData.gapStatistics = this.analyzeGapPatterns(gaps);
    this.coreData.productivityPatterns = this.findProductivityPatterns(usageEntries, gaps);
    this.coreData.workPattern = this.coreData.productivityPatterns.workPattern || 'mixed-pattern';
  }
  
  /**
   * Classify gap reason based on duration
   */
  classifyGapReason(durationMinutes) {
    if (durationMinutes < 60) return 'short-break';
    if (durationMinutes < 240) return 'break'; // 4 hours
    if (durationMinutes < 480) return 'long-break'; // 8 hours
    if (durationMinutes < 1440) return 'overnight'; // 24 hours
    return 'extended-absence';
  }
  
  /**
   * Analyze gap patterns
   */
  analyzeGapPatterns(gaps) {
    if (gaps.length === 0) return {};

    const gapDurations = gaps.map(gap => gap.durationMinutes);
    const gapTypes = gaps.reduce((acc, gap) => {
      const reason = gap.reason;
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    return {
      totalGaps: gaps.length,
      averageGapDuration: gaps.length > 0 ? (gapDurations.reduce((sum, dur) => sum + dur, 0) / gaps.length).toFixed(1) : 0,
      longestGap: gaps.length > 0 ? Math.max(...gapDurations) : 0,
      shortestGap: gaps.length > 0 ? Math.min(...gapDurations) : 0,
      gapTypeDistribution: gapTypes,
      totalGapTime: gapDurations.reduce((sum, dur) => sum + dur, 0),
      totalGapHours: (gapDurations.reduce((sum, dur) => sum + dur, 0) / 60).toFixed(1)
    };
  }
  
  /**
   * Find productivity patterns based on gaps
   */
  findProductivityPatterns(usageEntries, gaps) {
    if (usageEntries.length === 0) return {};
    
    // Calculate session durations (simplified)
    const totalWorkTime = this.coreData.duration || 0;
    const totalBreakTime = gaps.reduce((sum, gap) => sum + gap.durationMinutes, 0);
    const avgGap = gaps.length > 0 ? totalBreakTime / gaps.length : 0;
    
    return {
      totalWorkTime: totalWorkTime.toFixed(1),
      totalBreakTime: totalBreakTime.toFixed(1),
      workBreakRatio: totalBreakTime > 0 ? (totalWorkTime / totalBreakTime).toFixed(2) : 'infinite',
      workPattern: this.classifyWorkPattern(totalWorkTime, avgGap)
    };
  }
  
  /**
   * Classify work pattern
   */
  classifyWorkPattern(totalWorkTime, avgGap) {
    if (totalWorkTime > 180 && avgGap > 60) return 'marathon-worker'; // Long sessions, long breaks
    if (totalWorkTime > 90 && avgGap < 30) return 'focused-worker'; // Medium sessions, short breaks
    if (totalWorkTime < 60 && avgGap < 30) return 'sprint-worker'; // Short sessions, short breaks
    if (totalWorkTime < 90 && avgGap > 120) return 'sporadic-worker'; // Short sessions, long breaks
    
    return 'mixed-pattern';
  }
  
  /**
   * Calculate Model Breakdown (from ModelBreakdownService)
   */
  async calculateModelBreakdown(usageEntries) {
    const modelMap = new Map();
    // Use dynamic pricing from model price service instead of hardcoded values

    usageEntries.forEach(entry => {
      const model = entry.model;
      if (!modelMap.has(model)) {
        modelMap.set(model, {
          modelName: model,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          cost: 0,
          entryCount: 0
        });
      }

      const breakdown = modelMap.get(model);
      breakdown.inputTokens += entry.input_tokens || 0;
      breakdown.outputTokens += entry.output_tokens || 0;
      breakdown.cacheCreationTokens += entry.cache_creation_input_tokens || 0;
      breakdown.cacheReadTokens += entry.cache_read_input_tokens || 0;
      breakdown.cost += entry.cost || 0;
      breakdown.entryCount += 1;
    });

    const modelBreakdown = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);
    const totalCost = modelBreakdown.reduce((sum, model) => sum + model.cost, 0);
    
    // Calculate cost distribution
    const costDistribution = {};
    if (totalCost > 0) {
      modelBreakdown.forEach(model => {
        costDistribution[model.modelName] = ((model.cost / totalCost) * 100).toFixed(1);
      });
    }
    
    this.coreData.modelBreakdown = modelBreakdown;
    this.coreData.costDistribution = costDistribution;
    this.coreData.modelStats = {
      uniqueModels: modelBreakdown.length,
      totalCost: totalCost,
      mostExpensive: modelBreakdown[0]?.modelName || 'none',
      costDistribution: costDistribution
    };
    
    // Model efficiency calculations
    this.coreData.modelEfficiency = modelBreakdown.map(model => {
      const totalTokens = model.inputTokens + model.outputTokens + 
                         model.cacheCreationTokens + model.cacheReadTokens;
      
      return {
        ...model,
        totalTokens,
        costPerToken: totalTokens > 0 ? (model.cost / totalTokens) : 0,
        tokensPerEntry: model.entryCount > 0 ? (totalTokens / model.entryCount) : 0,
        costPerEntry: model.entryCount > 0 ? (model.cost / model.entryCount) : 0
      };
    });
  }
  
  /**
   * Export data in various formats
   */
  exportData(dataType, format = 'json', options = {}) {
    let data;
    
    switch (dataType) {
      case 'overview':
        data = this.getOverviewData();
        break;
      case 'projects':
        data = this.getProjectsData();
        break;
      case 'sessions':
        data = this.getSessionsData();
        break;
      case 'monthly':
        data = this.getMonthlyData();
        break;
      case 'daily':
        data = this.getDailyData();
        break;
      case 'active':
        data = this.getActiveData();
        break;
      case 'gaps':
        data = { gaps: this.coreData.gaps, statistics: this.coreData.gapStatistics };
        break;
      case 'models':
        data = { breakdown: this.coreData.modelBreakdown, stats: this.coreData.modelStats };
        break;
      case 'all':
        data = this.coreData;
        break;
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
    
    return this.formatForExport(data, format, options);
  }
  
  /**
   * Format data for export in specified format
   */
  formatForExport(data, format, options = {}) {
    switch (format.toLowerCase()) {
      case 'json':
        return this.formatAsJSON(data, options);
      case 'csv':
        return this.formatAsCSV(data, options);
      case 'markdown':
        return this.formatAsMarkdown(data, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Format data as JSON
   */
  formatAsJSON(data, options = {}) {
    const indent = options.indent || 2;
    const includeMetadata = options.includeMetadata !== false;

    let exportData = data;
    
    if (includeMetadata) {
      exportData = {
        metadata: {
          exportTime: new Date().toISOString(),
          exportFormat: 'json',
          generatedBy: 'Dragon UI - Claude Usage Tracker',
          version: '2.0.0'
        },
        data: data
      };
    }

    return JSON.stringify(exportData, null, indent);
  }
  
  /**
   * Format data as CSV (simplified)
   */
  formatAsCSV(data, options = {}) {
    const separator = options.separator || ',';
    
    if (Array.isArray(data)) {
      if (data.length === 0) return 'No data available';
      
      const headers = Object.keys(data[0]).join(separator);
      const rows = data.map(item => 
        Object.values(item).map(val => 
          typeof val === 'string' && val.includes(separator) ? `"${val}"` : val
        ).join(separator)
      );
      
      return [headers, ...rows].join('\n');
    }
    
    // For objects, create key-value CSV
    const headers = 'Key,Value';
    const rows = Object.entries(data).map(([key, value]) => 
      `${key},${typeof value === 'object' ? JSON.stringify(value) : value}`
    );
    
    return [headers, ...rows].join('\n');
  }
  
  /**
   * Format data as Markdown (simplified)
   */
  formatAsMarkdown(data, options = {}) {
    const title = options.title || 'Claude Usage Data Export';
    
    let markdown = `# ${title}\n\n`;
    markdown += `*Generated on ${new Date().toISOString()}*\n\n`;
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        markdown += `| ${headers.join(' | ')} |\n`;
        markdown += `| ${headers.map(() => '---').join(' | ')} |\n`;
        
        data.forEach(item => {
          markdown += `| ${Object.values(item).join(' | ')} |\n`;
        });
      }
    } else {
      Object.entries(data).forEach(([key, value]) => {
        markdown += `**${key}**: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}\n\n`;
      });
    }
    
    return markdown;
  }
  
  
  /**
   * Convert USD amount to current currency
   */
  convertCurrency(usdAmount) {
    if (!usdAmount || usdAmount === 0) return 0;
    if (this.currency === 'USD') return usdAmount;
    
    const rate = this.exchangeRates[this.currency];
    if (!rate) {
      console.warn(`[WARN] CoreDataService: No exchange rate for ${this.currency}, using USD`);
      return usdAmount;
    }
    
    return usdAmount * rate;
  }
  
  /**
   * Format currency amount with proper symbol and decimals
   */
  formatCurrency(amount) {
    const currencySymbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF',
      'CNY': '¥',
      'INR': '₹',
      'BRL': 'R$'
    };
    
    const symbol = currencySymbols[this.currency] || this.currency;
    
    // Different formatting for different currencies
    let decimals = 2;
    if (['JPY', 'CNY'].includes(this.currency)) {
      decimals = 0; // No decimals for yen/yuan
    }
    
    const formatted = amount.toFixed(decimals);
    
    // Place symbol before or after based on currency
    if (['EUR'].includes(this.currency)) {
      return `${formatted}${symbol}`; // €50.00
    } else {
      return `${symbol}${formatted}`; // $50.00
    }
  }
  
  /**
   * Get currency information
   */
  getCurrencyInfo() {
    return {
      current: this.currency,
      supported: this.coreData.supportedCurrencies,
      rates: this.exchangeRates,
      rateForCurrent: this.exchangeRates[this.currency] || 1
    };
  }
  
  /**
   * Set auto-push callback for sending data to store.ts
   */
  setAutoPush(callback) {
    this.autoPushCallback = callback;
    console.log('[AUTO] CoreDataService: Auto-push enabled for store.ts');
  }
}

module.exports = CoreDataService;