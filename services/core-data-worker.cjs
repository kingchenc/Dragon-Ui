/**
 * Core Data Worker
 * Runs heavy calculations in a separate thread to avoid blocking the UI
 * Now powered by SQLite for blazing fast calculations
 */
const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const DatabaseService = require('./database.cjs');
const { modelPriceService } = require('./model-price-service.cjs');

// Import calculation logic (we'll move the heavy parts here)
class CoreDataWorker {
  constructor() {
    this.currency = 'USD';
    this.exchangeRates = {};
    this.db = new DatabaseService();
    
    // Ensure cache token columns exist in worker thread
    try {
      this.db.db.exec(`ALTER TABLE usage_entries ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.db.exec(`ALTER TABLE usage_entries ADD COLUMN cache_read_input_tokens INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
  
  // Extract main project name from full path (group subfolders)
  extractProjectName(projectPath) {
    if (!projectPath) return null;
    
    // If it's already just a name, return it
    if (!projectPath.includes('/') && !projectPath.includes('\\')) {
      return projectPath;
    }
    
    // Normalize path separators
    const normalizedPath = projectPath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/');
    
    // Find the main project directory (usually under /Coding/ or similar)
    const codingIndex = pathParts.findIndex(part => 
      part.toLowerCase().includes('coding') || 
      part.toLowerCase().includes('projects') ||
      part.toLowerCase().includes('dev') ||
      part.toLowerCase().includes('work')
    );
    
    if (codingIndex >= 0 && codingIndex < pathParts.length - 1) {
      // Return the directory immediately after the coding folder
      return pathParts[codingIndex + 1];
    }
    
    // Fallback: if path has at least 2 parts, take the second-to-last
    // This handles cases like /some/main-project/subfolder
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 2];
    }
    
    // Final fallback
    return path.basename(projectPath);
  }

  convertCurrency(usdAmount) {
    if (this.currency === 'USD') return usdAmount;
    const rate = this.exchangeRates[this.currency]?.rate || 1;
    const converted = usdAmount * rate;
    
    // Debug extreme values
    if (converted > usdAmount * 100) {
      console.error(`[EXTREME CURRENCY] EXTREME CURRENCY CONVERSION: $${usdAmount} -> $${converted} (rate: ${rate}, currency: ${this.currency})`);
      return usdAmount; // Fallback to USD to prevent impossible values
    }
    
    return converted;
  }

  async calculateAllData(usageEntries, currency = 'USD', exchangeRates = {}, billingCycleDay = 1) {
    const startTime = performance.now();
    this.currency = currency;
    this.exchangeRates = exchangeRates;
    
    console.log(`[WORKER] Using SQLite database for blazing fast calculations`);
    console.log(`[MONEY] Currency: ${currency}, Exchange rates:`, exchangeRates);
    
    // Use database aggregations instead of processing arrays
    const dbInfo = this.db.getDbInfo();
    console.log(`[DB] Worker: DB contains ${dbInfo.entryCount} entries (${dbInfo.dbSizeMB}MB)`);
    console.log(`[BILLING] Worker: Using billing cycle day ${billingCycleDay}`);
    
    // Quick DB-powered calculations - USE BILLING CYCLE GROUPING
    const sessionStats = this.db.getSessionStats();
    const projectStats = this.db.getProjectStats();
    const monthlyStats = this.db.getMonthlyStats(billingCycleDay); // Use billing cycle
    const dailyStats = this.db.getDailyStatsBySessionStart(7); // Use session-start-date grouping
    const dailyFinancialStats = this.db.getDailyFinancialStats(30); // Last 30 days for chart
    
    // Lightning-fast DB calculations
    const totalCost = this.convertCurrency(this.db.getTotalCost());
    const totalTokens = this.db.getTotalTokens();
    
    const result = {
      // Basic Financial (from DB aggregations)
      totalCost: totalCost,
      cost: totalCost,
      currentCost: 0, // Will be calculated for active session
      costAmount: totalCost,
      
      // Sessions & Projects (from DB aggregations) - placeholder, will be updated later
      totalSessions: sessionStats.length,
      sessions: sessionStats.length,
      sessionsCount: sessionStats.length,
      validSessions: sessionStats.length,
      recentSessions: 0, // Will be calculated
      totalProjects: 0, // Will be calculated after project grouping
      projectsCount: 0, // Will be calculated after project grouping
      
      // Token data (from DB aggregations)
      totalTokens: totalTokens,
      averageCostPerSession: sessionStats.length > 0 ? totalCost / sessionStats.length : 0,
      
      // Pre-calculated data arrays
      sessionsData: [],
      projectsData: [],
      dailyData: [],
      monthlyData: [],
      dailyFinancialData: [],
      
      // Additional fields
      currentMonth: null,
      currentMonthCost: 0,
      averageMonthlySpend: 0,
      highestSpendingMonth: null,
      mostActiveMonth: null,
      monthlyGrowth: null,
      projectedYearlySpend: 0,
      quarterlyProjection: 0,
      currentRunRate: 0,
      
      // Overview specific
      last7DaysTotal: 0,
      activityData: [],
      
      // Session metadata
      models: [],
      modelsCount: 0,
      modelsList: [],
      mostActiveProject: null,
      activeDays: 0,
      avgTokensPerSession: 0,
      costPer1MTokens: 0,
      costPerToken: 0,
      costPer1KTokens: 0,
      costPerConversation: 0,
      costPerEntry: 0,
      
      // Status & Timing
      status: 'idle',
      sessionStatus: 'idle',
      activeSession: null,
      sessionActive: false,
      sessionId: null,
      started: null,
      duration: 0,
      timeLeft: 0,
      timeAgo: null,
      dateTime: null,
      sessionTimeLeft: 0,
      lastActivity: null
    };

    console.log(`[STATS] DB Stats: $${totalCost.toFixed(2)}, ${totalTokens.toLocaleString()} tokens, ${sessionStats.length} sessions`);

    // Get models for each session from database
    const sessionModelsQuery = this.db.db.prepare(`
      SELECT session_id, GROUP_CONCAT(DISTINCT model) as models
      FROM usage_entries 
      WHERE session_id IS NOT NULL AND model IS NOT NULL
      GROUP BY session_id
    `);
    const sessionModelsData = sessionModelsQuery.all();
    
    // Create a map of session_id to models
    const sessionModelsMap = new Map();
    sessionModelsData.forEach(row => {
      const models = row.models ? row.models.split(',') : [];
      sessionModelsMap.set(row.session_id, models);
    });

    // Process sessions data from DB (lightning fast!)
    result.sessionsData = sessionStats
      .map(session => {
        const sessionCost = this.convertCurrency(session.total_cost);
        const duration = session.start_time && session.end_time ? 
          Math.floor((new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60)) : null;
        
        // Cap duration at 300 minutes (5 hours) for display
        const cappedDuration = duration ? Math.min(duration, 300) : null;
        
        return {
          sessionId: session.session_id,
          totalCost: sessionCost,
          totalTokens: session.total_tokens,
          conversations: session.entry_count,
          project: this.extractProjectName(session.project), // Extract clean project name
          isActive: false, // Will be determined later
          startTime: session.start_time,
          endTime: session.end_time,
          duration: cappedDuration,
          models: sessionModelsMap.get(session.session_id.split('_')[0]) || [] // Handle segmented session IDs
        };
      })
      .filter(session => {
        // Filter out sessions with N/A duration or under 10 minutes
        return session.duration !== null && session.duration >= 10;
      });

    // Update session counts after filtering
    result.totalSessions = result.sessionsData.length;
    result.sessions = result.sessionsData.length;
    result.sessionsCount = result.sessionsData.length;
    result.validSessions = result.sessionsData.length;

    // Process projects data from DB (lightning fast!)
    // First extract project names, then group by the extracted names
    const projectMap = new Map();
    const sessionProjectMap = new Map(); // Track unique sessions per project
    
    projectStats.forEach(project => {
      const extractedName = this.extractProjectName(project.project);
      if (!extractedName) return;
      
      if (projectMap.has(extractedName)) {
        // Merge with existing project
        const existing = projectMap.get(extractedName);
        existing.totalCost += this.convertCurrency(project.total_cost);
        existing.totalTokens += project.total_tokens;
        // Don't add sessions here - we'll count unique sessions separately
        // Keep the most recent activity
        if (project.last_activity > existing.lastActivity) {
          existing.lastActivity = project.last_activity;
        }
      } else {
        // Create new project entry
        projectMap.set(extractedName, {
          project: extractedName,
          totalCost: this.convertCurrency(project.total_cost),
          totalTokens: project.total_tokens,
          sessions: 0, // Will be calculated from sessionProjectMap
          lastActivity: project.last_activity,
          models: [] // TODO: Add model info if needed
        });
        sessionProjectMap.set(extractedName, new Set());
      }
    });
    
    // Count unique sessions per extracted project name
    result.sessionsData.forEach(session => {
      const projectName = session.project; // Already extracted in sessionsData
      if (projectName && sessionProjectMap.has(projectName)) {
        sessionProjectMap.get(projectName).add(session.sessionId);
      }
    });
    
    // Update session counts with unique sessions
    sessionProjectMap.forEach((sessionSet, projectName) => {
      if (projectMap.has(projectName)) {
        projectMap.get(projectName).sessions = sessionSet.size;
      }
    });
    
    // Get models for each project from database
    const projectModelsQuery = this.db.db.prepare(`
      SELECT project, GROUP_CONCAT(DISTINCT model) as models
      FROM usage_entries 
      WHERE project IS NOT NULL AND model IS NOT NULL
      GROUP BY project
    `);
    const projectModelsData = projectModelsQuery.all();
    
    // Create a map of extracted project names to their models
    const projectModelsMap = new Map();
    projectModelsData.forEach(row => {
      const extractedName = this.extractProjectName(row.project);
      if (extractedName) {
        const models = row.models ? row.models.split(',') : [];
        if (projectModelsMap.has(extractedName)) {
          // Merge models for the same extracted project name
          const existing = projectModelsMap.get(extractedName);
          const allModels = [...existing, ...models];
          projectModelsMap.set(extractedName, [...new Set(allModels)]); // Remove duplicates
        } else {
          projectModelsMap.set(extractedName, models);
        }
      }
    });
    
    // Update project data with models
    projectMap.forEach((project, projectName) => {
      project.models = projectModelsMap.get(projectName) || [];
    });
    
    // Convert map to array and calculate averages
    result.projectsData = Array.from(projectMap.values()).map(project => ({
      ...project,
      avgCostPerSession: project.sessions > 0 ? project.totalCost / project.sessions : 0
    })).sort((a, b) => b.totalCost - a.totalCost); // Sort by total cost descending

    // Update project counts after grouping
    result.totalProjects = result.projectsData.length;
    result.projectsCount = result.projectsData.length;

    // Calculate averages and additional fields
    result.avgTokensPerSession = result.totalSessions > 0 ? result.totalTokens / result.totalSessions : 0;
    result.costPer1MTokens = result.totalTokens > 0 ? (result.totalCost / result.totalTokens) * 1000000 : 0;
    result.costPerToken = result.totalTokens > 0 ? result.totalCost / result.totalTokens : 0;
    result.costPer1KTokens = result.totalTokens > 0 ? (result.totalCost / result.totalTokens) * 1000 : 0;
    
    // Get models from database
    const modelsQuery = this.db.db.prepare('SELECT DISTINCT model FROM usage_entries WHERE model IS NOT NULL').all();
    result.models = modelsQuery.map(row => row.model);
    result.modelsCount = result.models.length;
    result.modelsList = result.models;
    
    // Calculate active days - use current billing period for consistency
    const currentPeriodData = this.db.getCurrentBillingPeriodData(billingCycleDay);
    result.activeDays = currentPeriodData?.activeDays || 0;
    
    // Calculate total days tracked (from first entry to today)
    const firstEntryQuery = this.db.db.prepare('SELECT MIN(date(timestamp)) as first_date FROM usage_entries').get();
    let daysTracked = 0;
    if (firstEntryQuery?.first_date) {
      const firstDate = new Date(firstEntryQuery.first_date);
      const today = new Date();
      const timeDiff = today.getTime() - firstDate.getTime();
      daysTracked = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days
    }
    result.daysTracked = daysTracked;
    
    // Process billing period data with enhanced calculations
    const avgPeriodCost = monthlyStats.length > 1 ? 
      monthlyStats.reduce((sum, m) => sum + this.convertCurrency(m.total_cost), 0) / monthlyStats.length : 0;
    
    // Get current billing period info
    const currentPeriod = this.db.getBillingPeriodForDate(new Date(), billingCycleDay);
    const currentPeriodKey = currentPeriod.key;
    
    // Don't add empty current periods - only show periods with actual data
    // This prevents confusing empty "Current" entries in the UI
    
    console.log(`[MONTH] Monthly stats from DB:`, monthlyStats.map(m => ({ month: m.month, cost: m.total_cost, tokens: m.total_tokens })));
    
    result.monthlyData = monthlyStats
      .filter(period => {
        // Filter out invalid months before processing
        if (!period.month || typeof period.month !== 'string') {
          console.log(`[MONTH] ❌ Filtering out invalid month: ${period.month}`);
          return false;
        }
        
        // For calendar months (billingCycleDay === 1), validate YYYY-MM format
        if (billingCycleDay === 1 && period.month.includes('-')) {
          const [year, monthNum] = period.month.split('-').map(Number);
          if (isNaN(year) || isNaN(monthNum) || year < 2020 || monthNum < 1 || monthNum > 12) {
            console.log(`[MONTH] ❌ Filtering out corrupted calendar month: ${period.month} (year: ${year}, month: ${monthNum})`);
            return false;
          }
        }
        
        // For custom billing periods, check if the month key contains a valid year
        if (billingCycleDay !== 1) {
          const yearMatch = period.month.match(/(\d{4})/);
          if (!yearMatch || parseInt(yearMatch[1]) < 2020) {
            console.log(`[MONTH] ❌ Filtering out corrupted billing period: ${period.month}`);
            return false;
          }
        }
        
        console.log(`[MONTH] ✅ Valid period: ${period.month} ($${period.total_cost}, ${period.total_tokens} tokens)`);
        return true;
      })
      .map(period => {
      const periodCost = this.convertCurrency(period.total_cost);
      const costPer1MTokens = period.total_tokens > 0 ? 
        (periodCost / period.total_tokens) * 1000000 : 0;
      
      // Calculate total days in the billing period
      let totalDaysInPeriod = 30; // Default fallback
      if (period.billing_period_start && period.billing_period_end) {
        const start = new Date(period.billing_period_start);
        const end = new Date(period.billing_period_end);
        totalDaysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      } else if (billingCycleDay === 1) {
        // For calendar months, calculate normally (with validation)
        if (period.month && typeof period.month === 'string' && period.month.includes('-')) {
          const [year, monthNum] = period.month.split('-').map(Number);
          if (!isNaN(year) && !isNaN(monthNum) && year >= 2020 && monthNum >= 1 && monthNum <= 12) {
            totalDaysInPeriod = new Date(year, monthNum, 0).getDate();
          } else {
            console.log(`[MONTH] Invalid month format detected: ${period.month}, using default 30 days`);
            totalDaysInPeriod = 30;
          }
        } else {
          console.log(`[MONTH] Invalid month string detected: ${period.month}, using default 30 days`);
          totalDaysInPeriod = 30;
        }
      }
      
      // Only calculate vs avg if we have more than 1 period
      let vsAveragePercent = 0;
      if (monthlyStats.length > 1 && avgPeriodCost > 0) {
        vsAveragePercent = ((periodCost - avgPeriodCost) / avgPeriodCost * 100);
      }
      
      return {
        date: period.month,
        billing_period_start: period.billing_period_start,
        billing_period_end: period.billing_period_end,
        billing_period_label: period.billing_period_label || period.month,
        totalCost: periodCost,
        totalTokens: period.total_tokens,
        totalSessions: period.session_count,
        activeDays: period.active_days,
        totalDays: totalDaysInPeriod,
        dailyAverage: period.active_days > 0 ? periodCost / period.active_days : 0,
        avgSessionCost: period.session_count > 0 ? periodCost / period.session_count : 0,
        tokensPerSession: period.session_count > 0 ? period.total_tokens / period.session_count : 0,
        isCurrentMonth: period.month === currentPeriodKey,
        isCurrentPeriod: period.month === currentPeriodKey,
        costPer1MTokens: Math.round(costPer1MTokens * 100) / 100,
        vsAveragePercent: Math.round(vsAveragePercent * 10) / 10,
        isFirstMonth: monthlyStats.length === 1,
        billingCycleDay: billingCycleDay
      };
    });
    
    // Process daily activity data (already in chronological order from DB)
    result.activityData = dailyStats.map(day => ({
      date: day.date,
      cost: this.convertCurrency(day.total_cost),
      tokens: day.total_tokens,
      sessions: day.session_count,
      label: new Date(day.date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    }));

    // Active session detection using DB
    const now = Date.now();
    const recentEntries = this.db.getRecentEntries(30); // Last 30 minutes
    
    console.log(`[ACTIVE DEBUG] Found ${recentEntries.length} entries in last 30 minutes`);
    if (recentEntries.length > 0) {
      const latest = recentEntries[0];
      const minutesAgo = Math.round((now - new Date(latest.timestamp).getTime()) / (1000 * 60));
      console.log(`[ACTIVE DEBUG] Latest entry: ${latest.session_id}, ${minutesAgo}min ago`);
    }
    
    let activeSessionId = null;
    if (recentEntries.length > 0) {
      // Find the most recent session
      const latestEntry = recentEntries.reduce((latest, entry) => {
        return new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest;
      });
      activeSessionId = latestEntry.session_id;
    }
    
    // Set active session data
    result.activeSession = activeSessionId;
    result.sessionActive = !!activeSessionId;
    result.sessionId = activeSessionId;
    
    // Calculate current session data if active
    if (activeSessionId) {
      const sessionEntries = this.db.getSessionEntries(activeSessionId);
      
      if (sessionEntries.length > 0) {
        const sessionStart = new Date(Math.min(...sessionEntries.map(e => new Date(e.timestamp).getTime())));
        const sessionEnd = new Date(Math.max(...sessionEntries.map(e => new Date(e.timestamp).getTime())));
        const sessionCost = sessionEntries.reduce((sum, e) => sum + this.convertCurrency(e.cost || 0), 0);
        const sessionTokens = sessionEntries.reduce((sum, e) => sum + ((e.input_tokens || 0) + (e.output_tokens || 0) + (e.cache_creation_input_tokens || 0) + (e.cache_read_input_tokens || 0)), 0);
        
        const durationMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60));
        const timeLeftMinutes = Math.max(0, 300 - durationMinutes); // 5 hours = 300 minutes
        
        console.log(`[DEBUG] Current Session Debug: ${sessionEntries.length} entries, cost=$${sessionCost.toFixed(4)}, tokens=${sessionTokens}, duration=${durationMinutes}min`);
        
        result.started = sessionStart.toISOString();
        result.duration = durationMinutes;
        result.currentCost = sessionCost;
        result.currentTokens = sessionTokens; // Add current session tokens
        result.timeLeft = timeLeftMinutes;
        result.sessionTimeLeft = timeLeftMinutes;
        result.lastActivity = sessionEnd.toISOString();
        result.status = timeLeftMinutes > 0 ? 'active' : 'expired';
        result.sessionStatus = result.status;
        
        console.log(`[DEBUG] Active Session Calculated: Cost=$${sessionCost.toFixed(2)}, Tokens=${sessionTokens}, Duration=${durationMinutes}min`);
      }
    } else {
      result.status = 'idle';
      result.sessionStatus = 'idle';
      result.currentCost = 0; // No active session = no current cost
      result.currentTokens = 0; // No active session = no current tokens
      result.duration = 0;
      result.timeLeft = 0;
      result.sessionTimeLeft = 0;
      console.log(`[DEBUG] No Active Session: currentCost set to $0.00`);
    }
    
    // Mark active session in sessionsData
    result.sessionsData = result.sessionsData.map(session => ({
      ...session,
      isActive: session.sessionId === activeSessionId
    }));
    
    // Find most active project and set additional stats
    if (result.projectsData.length > 0) {
      const mostActive = result.projectsData.reduce((max, proj) => 
        proj.totalCost > max.totalCost ? proj : max
      );
      result.mostActiveProject = mostActive.project;
    }
    
    // Calculate 7-day total for overview
    const last7Days = dailyStats.reduce((sum, day) => sum + day.total_cost, 0);
    result.last7DaysTotal = this.convertCurrency(last7Days);
    
    // Daily usage specific data - USE ENTRY-DATE GROUPING for today/yesterday
    const todayData = this.db.getTodayData();
    const yesterdayData = this.db.getYesterdayData();
    const lastSessionData = this.db.getLastSessionData();
    
    // Add daily data to result
    result.todayData = todayData ? {
      date: todayData.date,
      totalCost: this.convertCurrency(todayData.totalCost),
      totalTokens: todayData.totalTokens,
      sessionCount: todayData.sessionCount,
      modelCount: todayData.modelCount,
      models: todayData.models,
      entryCount: todayData.entryCount,
      firstActivity: todayData.firstActivity,
      lastActivity: todayData.lastActivity
    } : null;
    
    result.yesterdayData = yesterdayData ? {
      date: yesterdayData.date,
      totalCost: this.convertCurrency(yesterdayData.totalCost),
      totalTokens: yesterdayData.totalTokens,
      sessionCount: yesterdayData.sessionCount,
      modelCount: yesterdayData.modelCount,
      models: yesterdayData.models,
      entryCount: yesterdayData.entryCount,
      firstActivity: yesterdayData.firstActivity,
      lastActivity: yesterdayData.lastActivity
    } : null;
    
    result.lastSessionData = lastSessionData ? {
      sessionId: lastSessionData.sessionId,
      totalCost: this.convertCurrency(lastSessionData.totalCost),
      totalTokens: lastSessionData.totalTokens,
      entryCount: lastSessionData.entryCount,
      startTime: lastSessionData.startTime,
      endTime: lastSessionData.endTime,
      duration: lastSessionData.duration,
      project: this.extractProjectName(lastSessionData.project), // Extract clean project name
      lastActivity: lastSessionData.lastActivity
    } : null;
    
    // Enhanced daily data array for charts and history with session-start-date grouping
    result.dailyData = dailyStats.map(day => {
      return {
        date: day.date,
        totalCost: this.convertCurrency(day.total_cost),
        totalTokens: day.total_tokens,
        sessionCount: day.session_count,
        sessions: day.session_count, // Add sessions field for frontend compatibility
        models: day.models || [],
        modelCount: day.model_count || 0,
        costPer1KTokens: day.total_tokens > 0 ? 
          parseFloat(((day.total_cost / day.total_tokens) * 1000).toFixed(6)) : 0
      };
    });
    
    // Daily financial data for line chart (30 days) with running total
    result.dailyFinancialData = dailyFinancialStats.map(day => {
      const cost = this.convertCurrency(day.total_cost);
      const runningTotal = this.convertCurrency(day.running_total);
      return {
        date: day.date,
        totalCost: cost,
        runningTotal: runningTotal,
        sessionCount: day.session_count || 0,
        entryCount: day.entry_count || 0,
        firstActivity: day.first_activity,
        lastActivity: day.last_activity,
        // Format for chart display
        datetime: new Date(day.date).toISOString(),
        formattedDate: new Date(day.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        money: cost,
        cumulativeMoney: runningTotal
      };
    });
    
    console.log(`[CHART] Daily financial data: ${result.dailyFinancialData.length} days, total: $${result.dailyFinancialData.reduce((sum, d) => sum + d.money, 0).toFixed(2)}`);
    
    // Average daily cost calculation
    result.avgDailyCost = result.activeDays > 0 ? result.totalCost / result.activeDays : 0;
    
    // Monthly summary calculations
    if (result.monthlyData.length > 0) {
      // Find current month data - use the most recent period with data
      const mostRecentPeriod = result.monthlyData[0]; // monthlyData is sorted newest first
      
      // For now, treat the most recent period as current if it has data
      let currentMonthData = null;
      
      // Try to find explicitly marked current month first
      currentMonthData = result.monthlyData.find(m => m.isCurrentMonth);
      
      // If no explicitly marked current month, use the most recent period
      if (!currentMonthData && mostRecentPeriod && mostRecentPeriod.totalCost > 0) {
        currentMonthData = mostRecentPeriod;
        currentMonthData.isCurrentMonth = true;
        console.log(`[DEBUG] Using most recent period as current: ${currentMonthData.date}, cost: $${currentMonthData.totalCost}`);
      }
      
      // Set current month values with proper fallback
      if (currentMonthData) {
        // Fix: Ensure month name is always valid - check properties in correct order
        const monthName = currentMonthData.month || currentMonthData.date || currentMonthData.billing_period_label;
        if (monthName && monthName !== 'undefined') {
          result.currentMonth = monthName;
        } else {
          // Fallback to current month if data is corrupted
          result.currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          console.log(`[MONTH FIX] Corrupted month data detected, using current month: ${result.currentMonth}`);
        }
        result.currentMonthCost = currentMonthData.totalCost;
        console.log(`[DEBUG] Current month set: ${result.currentMonth}, cost: $${result.currentMonthCost}`);
      } else {
        // No period data with cost - use defaults
        result.currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        result.currentMonthCost = 0;
        console.log(`[DEBUG] No current period data found, using defaults: ${result.currentMonth}`);
      }
      
      const totalMonthlySpend = result.monthlyData.reduce((sum, m) => sum + m.totalCost, 0);
      result.averageMonthlySpend = result.monthlyData.length > 0 ? totalMonthlySpend / result.monthlyData.length : 0;
      result.projectedYearlySpend = result.averageMonthlySpend * 12;
      result.quarterlyProjection = result.averageMonthlySpend * 3;
      result.currentRunRate = result.averageMonthlySpend * 12;
      
      // Set monthsTracked to the actual number of months we have data for
      result.monthsTracked = result.monthlyData.length;
      
      // Find highest spending month
      const highestMonth = result.monthlyData.reduce((max, month) => 
        month.totalCost > max.totalCost ? month : max
      );
      result.highestSpendingMonth = {
        monthName: highestMonth.date,
        totalCost: highestMonth.totalCost
      };
      
      // Find most active month using filtered sessions data
      const monthlySessionCounts = new Map();
      
      // Count filtered sessions by month
      result.sessionsData.forEach(session => {
        if (session.startTime) {
          const month = session.startTime.substring(0, 7); // YYYY-MM
          monthlySessionCounts.set(month, (monthlySessionCounts.get(month) || 0) + 1);
        }
      });
      
      // Find month with most filtered sessions
      let maxSessions = 0;
      let mostActiveMonthName = null;
      monthlySessionCounts.forEach((count, month) => {
        if (count > maxSessions) {
          maxSessions = count;
          mostActiveMonthName = month;
        }
      });
      
      result.mostActiveMonth = {
        monthName: mostActiveMonthName,
        totalSessions: maxSessions
      };
      
      // Calculate month-over-month growth rate
      if (result.monthlyData.length >= 2) {
        const currentMonth = result.monthlyData[0]; // Most recent (sorted newest first)
        const previousMonth = result.monthlyData[1]; // Previous month
        
        if (currentMonth && previousMonth && previousMonth.totalCost > 0) {
          const growthRate = ((currentMonth.totalCost - previousMonth.totalCost) / previousMonth.totalCost) * 100;
          result.monthlyGrowth = growthRate;
          result.growthTrend = growthRate;
          
          console.log(`[GROWTH] Month-over-Month: ${currentMonth.date} ($${currentMonth.totalCost}) vs ${previousMonth.date} ($${previousMonth.totalCost}) = ${growthRate.toFixed(1)}%`);
        } else {
          result.monthlyGrowth = 0;
          result.growthTrend = 0;
        }
      } else {
        // Not enough data for growth calculation
        result.monthlyGrowth = 0;
        result.growthTrend = 0;
      }
    } else {
      // If no monthly data but we have entries, still show at least 1 month
      result.monthsTracked = dbInfo.entryCount > 0 ? 1 : 0;
    }
    
    // Debug functions disabled - cost calculation working correctly
    // this.debugCostCalculation();
    // this.debugDuplicateAnalysis();
    
    // Send completion message
    parentPort.postMessage({
      type: 'progress',
      step: 'complete',
      progress: 100,
      message: `Database calculations complete! [DONE]`
    });
    
    const endTime = performance.now();
    const calcTime = endTime - startTime;
    
    console.log(`[OK] Worker: Blazing fast DB calculations completed in ${calcTime.toFixed(2)}ms!`);
    console.log(`[PERF] Performance: ${dbInfo.entryCount} entries processed in ${calcTime.toFixed(2)}ms (${(dbInfo.entryCount / calcTime * 1000).toFixed(0)} entries/sec)`);
    
    return result;
  }
  
  /**
   * Analyze session patterns to identify potential duplication issues
   */
  
  // Debug function to analyze cost discrepancies
  debugCostCalculation() {
    console.log('\n=== COST DEBUG ANALYSIS ===');
    
    // Get raw database totals
    const totalCost = this.db.getTotalCost();
    const totalTokens = this.db.getTotalTokens();
    const entryCount = this.db.getDbInfo().entryCount;
    
    console.log(`DB Total Cost: $${totalCost.toFixed(2)}`);
    console.log(`DB Total Tokens: ${totalTokens.toLocaleString()}`);
    console.log(`DB Entry Count: ${entryCount}`);
    console.log(`Average Cost per Entry: $${(totalCost / entryCount).toFixed(4)}`);
    
    // Get sample entries for manual verification
    const sampleEntries = this.db.db.prepare(`
      SELECT model, input_tokens, output_tokens, 
             cache_creation_input_tokens, cache_read_input_tokens, 
             cost, timestamp 
      FROM usage_entries 
      WHERE cost > 0 
      ORDER BY cost DESC 
      LIMIT 10
    `).all();
    
    console.log('\nTop 10 most expensive entries:');
    sampleEntries.forEach((entry, i) => {
      const totalTokensEntry = entry.input_tokens + entry.output_tokens + 
                              (entry.cache_creation_input_tokens || 0) + 
                              (entry.cache_read_input_tokens || 0);
      console.log(`${i+1}. ${entry.model}: $${entry.cost.toFixed(4)} (${totalTokensEntry.toLocaleString()} tokens)`);
    });
    
    // Cost distribution analysis
    const costBuckets = this.db.db.prepare(`
      SELECT 
        CASE 
          WHEN cost = 0 THEN '0'
          WHEN cost < 0.01 THEN '<$0.01'
          WHEN cost < 0.1 THEN '$0.01-$0.10'
          WHEN cost < 1.0 THEN '$0.10-$1.00'
          ELSE '>$1.00'
        END as bucket,
        COUNT(*) as count,
        SUM(cost) as total_cost
      FROM usage_entries 
      GROUP BY bucket
      ORDER BY total_cost DESC
    `).all();
    
    console.log('\nCost distribution:');
    costBuckets.forEach(bucket => {
      console.log(`${bucket.bucket}: ${bucket.count} entries, $${bucket.total_cost.toFixed(2)} total`);
    });
    
    console.log('=== END DEBUG ===\n');
  }
  
  // Debug function to detect duplicates and analyze cost inflation
  debugDuplicateAnalysis() {
    console.log('\n=== DUPLICATE ANALYSIS ===');
    
    // Check for exact duplicates by timestamp + session + tokens
    const duplicateCheck = this.db.db.prepare(`
      SELECT 
        timestamp, session_id, model,
        input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
        cost, COUNT(*) as count
      FROM usage_entries 
      GROUP BY timestamp, session_id, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
      HAVING COUNT(*) > 1
      ORDER BY count DESC, cost DESC
      LIMIT 10
    `).all();
    
    console.log(`Found ${duplicateCheck.length} sets of exact duplicates:`);
    duplicateCheck.forEach((dup, i) => {
      console.log(`${i+1}. ${dup.count}x duplicates: ${dup.model} $${dup.cost.toFixed(4)} (${dup.input_tokens + dup.output_tokens + (dup.cache_creation_input_tokens || 0) + (dup.cache_read_input_tokens || 0)} tokens)`);
    });
    
    // Check for near-duplicates (same session, similar time, similar tokens)
    const nearDuplicates = this.db.db.prepare(`
      SELECT 
        session_id, model,
        COUNT(*) as count,
        SUM(cost) as total_cost,
        AVG(input_tokens) as avg_input,
        AVG(output_tokens) as avg_output
      FROM usage_entries 
      GROUP BY session_id, model
      HAVING COUNT(*) > 20
      ORDER BY count DESC
      LIMIT 5
    `).all();
    
    console.log(`\nSessions with suspiciously many entries (>20):`);
    nearDuplicates.forEach((ses, i) => {
      console.log(`${i+1}. Session ${ses.session_id.substring(0,8)}: ${ses.count} entries, $${ses.total_cost.toFixed(2)} total cost`);
    });
    
    // Compare manual calculation vs stored cost for sample entries
    console.log(`\nManual cost verification (first 5 entries):`);
    const sampleEntries = this.db.db.prepare(`
      SELECT input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost, model
      FROM usage_entries 
      WHERE cost > 0
      ORDER BY cost DESC
      LIMIT 5
    `).all();
    
    sampleEntries.forEach((entry, i) => {
      // Manual calculation using dynamic pricing from model price service
      const pricing = modelPriceService.getModelPrices(entry.model);
      const inputRate = pricing.input;
      const outputRate = pricing.output;
      const cacheCreateRate = pricing.cacheWrite;
      const cacheReadRate = pricing.cacheRead;
      
      const manualCost = 
        (entry.input_tokens / 1000000) * inputRate +
        (entry.output_tokens / 1000000) * outputRate +
        ((entry.cache_creation_input_tokens || 0) / 1000000) * cacheCreateRate +
        ((entry.cache_read_input_tokens || 0) / 1000000) * cacheReadRate;
      
      const storedCost = entry.cost;
      const ratio = storedCost / manualCost;
      
      console.log(`${i+1}. Manual: $${manualCost.toFixed(4)}, Stored: $${storedCost.toFixed(4)}, Ratio: ${ratio.toFixed(2)}x`);
    });
    
    // Session ID analysis
    console.log('\n=== SESSION ID ANALYSIS ===');
    const sessionAnalysis = this.db.db.prepare(`
      SELECT 
        session_id,
        COUNT(*) as entry_count,
        SUM(cost) as session_cost,
        MIN(timestamp) as first_entry,
        MAX(timestamp) as last_entry
      FROM usage_entries 
      GROUP BY session_id 
      ORDER BY entry_count DESC 
      LIMIT 10
    `).all();
    
    console.log('Top 10 sessions by entry count:');
    sessionAnalysis.forEach((session, index) => {
      const duration = new Date(session.last_entry) - new Date(session.first_entry);
      const durationMin = Math.round(duration / (1000 * 60));
      console.log(`${index + 1}. Session ${session.session_id}: ${session.entry_count} entries, $${session.session_cost.toFixed(4)}, Duration: ${durationMin}min`);
    });
    
    // Check for potential session ID collision
    console.log('\nChecking for potential session ID patterns...');
    const fullSessionIds = this.db.db.prepare(`
      SELECT DISTINCT session_id, COUNT(*) as count
      FROM usage_entries 
      WHERE LENGTH(session_id) > 8
      GROUP BY session_id
      HAVING count > 100
      ORDER BY count DESC
      LIMIT 5
    `).all();
    
    if (fullSessionIds.length > 0) {
      console.log('Sessions with unusually high entry counts:');
      fullSessionIds.forEach(session => {
        console.log(`- ${session.session_id}: ${session.count} entries`);
      });
    }
    
    // Check for timing patterns in problematic sessions
    console.log('\n=== TIMING PATTERN ANALYSIS ===');
    const timingQuery = this.db.db.prepare(`
      SELECT 
        session_id,
        timestamp,
        cost,
        model,
        ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) as seq_num
      FROM usage_entries 
      WHERE session_id IN (
        SELECT session_id FROM usage_entries 
        GROUP BY session_id 
        ORDER BY COUNT(*) DESC 
        LIMIT 3
      )
      ORDER BY session_id, timestamp
      LIMIT 30
    `);
    
    const timingData = timingQuery.all();
    
    console.log('Sample timing patterns for top 3 problematic sessions:');
    let lastSession = '';
    let sessionCount = 1;
    timingData.forEach(row => {
      if (row.session_id !== lastSession) {
        console.log(`\n--- Session #${sessionCount}: ${row.session_id.substring(0,8)} ---`);
        lastSession = row.session_id;
        sessionCount++;
      }
      const date = new Date(row.timestamp);
      console.log(`${row.seq_num}: ${date.toISOString()} | ${row.model} | $${row.cost.toFixed(4)}`);
    });
    
    console.log('=== END SESSION ID ANALYSIS ===');
    
    console.log('=== END DUPLICATE ANALYSIS ===\n');
  }

}

// Worker message handling
if (parentPort) {
  const worker = new CoreDataWorker();
  
  parentPort.on('message', async (data) => {
    try {
      const { type, ...params } = data;
      
      if (type === 'calculateAllData') {
        const result = await worker.calculateAllData(
          params.usageEntries, 
          params.currency, 
          params.exchangeRates,
          params.billingCycleDay || 1
        );
        parentPort.postMessage({ type: 'result', data: result });
      }
    } catch (error) {
      console.error('Worker error:', error);
      parentPort.postMessage({ 
        type: 'error', 
        error: error.message,
        stack: error.stack 
      });
    }
  });
}

module.exports = CoreDataWorker;