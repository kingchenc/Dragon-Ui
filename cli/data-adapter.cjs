/**
 * CLI Data Adapter (CommonJS)
 * Bridges existing services to CLI format
 */

const path = require('path');

// Import CLI database service (uses sqlite3 instead of better-sqlite3)
const CLIDatabaseService = require('./database-cli.cjs');

class CLIDataAdapter {
  constructor(settings) {
    this.settings = settings;
    this.db = new CLIDatabaseService();
    this.lastUpdate = 0;
    this.cache = new Map();
  }

  /**
   * Initialize data services
   */
  async init() {
    try {
      // Initialize database
      if (!this.db.db) {
        await this.db.init();
      }
      
      console.log('✓ Database connected');
      return true;
    } catch (error) {
      console.error('✗ Failed to initialize data services:', error.message);
      return false;
    }
  }

  /**
   * Get overview/dashboard data
   */
  async getOverviewData() {
    try {
      const cacheKey = 'overview';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const dbInfo = await this.db.getDbInfo();
      const sessionStats = await this.db.getSessionStats();
      const projectStats = await this.db.getProjectStats();
      const monthlyStats = await this.db.getMonthlyStats();
      const dailyStats = await this.db.getDailyStats(7);

      // Calculate totals from arrays
      const totalCost = sessionStats.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const totalSessions = await this.db.getRealSessionCount(); // Get real session count, not segments
      const totalTokens = sessionStats.reduce((sum, s) => sum + (s.total_tokens || 0), 0);
      const lastActivity = sessionStats.length > 0 ? sessionStats[0].end_time : null;

      const data = {
        // Basic stats
        totalCost: totalCost,
        totalSessions: totalSessions,
        totalProjects: projectStats.length || 0,
        totalTokens: totalTokens,
        totalEntries: dbInfo.entryCount || 0,
        
        // Time-based stats
        activeDays: dailyStats.filter(d => d.total_cost > 0).length,
        lastActivity: lastActivity,
        
        // Current month
        currentMonth: monthlyStats[0] || {
          total_cost: 0,
          session_count: 0,
          total_tokens: 0
        },
        
        // Recent activity
        recentSessions: sessionStats.slice(0, 10),
        topProjects: projectStats.slice(0, 5),
        
        // Metadata
        currency: this.settings.currency,
        databaseSize: dbInfo.dbSizeMB,
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error getting overview data:', error.message);
      return this.getEmptyOverviewData();
    }
  }

  /**
   * Get projects data
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
      console.error('Error getting projects data:', error.message);
      return { projects: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get sessions data
   */
  async getSessionsData() {
    try {
      const cacheKey = 'sessions';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const sessionStats = await this.db.getSessionStats();
      // Use sessionStats as recent sessions (no separate getRecentSessions method)
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
      console.error('Error getting sessions data:', error.message);
      return { sessions: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get monthly data
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
      console.error('Error getting monthly data:', error.message);
      return { months: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get daily data
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
      console.error('Error getting daily data:', error.message);
      return { days: [], summary: {}, lastUpdated: new Date().toISOString() };
    }
  }

  /**
   * Get active session data
   */
  async getActiveData() {
    try {
      const cacheKey = 'active';
      const cached = this.getCachedData(cacheKey, 5000); // Cache for 5 seconds only
      if (cached) return cached;

      // Get latest session data using existing methods
      const sessionStats = await this.db.getSessionStats();
      const lastSession = sessionStats.length > 0 ? sessionStats[0] : null;
      const todayStats = await this.db.getDailyStats(1);
      const todayData = todayStats.length > 0 ? todayStats[0] : null;
      
      // Get models for the last session if it exists
      let sessionModels = [];
      if (lastSession) {
        sessionModels = await this.db.getSessionModels(lastSession.session_id);
      }
      
      const data = {
        activeSession: lastSession ? {
          sessionId: lastSession.session_id,
          project: lastSession.project || 'Unknown',
          totalCost: lastSession.total_cost || 0,
          totalTokens: lastSession.total_tokens || 0,
          duration: lastSession.end_time && lastSession.start_time ? 
            (new Date(lastSession.end_time) - new Date(lastSession.start_time)) : 0,
          startTime: lastSession.start_time,
          lastActivity: lastSession.end_time, // end_time is the last activity
          entryCount: lastSession.entry_count || 0,
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
        
        isActive: lastSession && lastSession.last_activity && 
          (new Date() - new Date(lastSession.last_activity)) < 300000, // 5 minutes
        
        lastUpdated: new Date().toISOString()
      };

      this.setCachedData(cacheKey, data, 5000);
      return data;
    } catch (error) {
      console.error('Error getting active data:', error.message);
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
      activeDays: 0,
      lastActivity: null,
      currentMonth: { total_cost: 0, session_count: 0, total_tokens: 0 },
      recentSessions: [],
      topProjects: [],
      currency: this.settings.currency,
      databaseSize: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Refresh all data
   */
  async refreshAll() {
    this.clearCache();
    
    // Pre-load all data
    const promises = [
      this.getOverviewData(),
      this.getProjectsData(),
      this.getSessionsData(),
      this.getMonthlyData(),
      this.getDailyData(),
      this.getActiveData()
    ];
    
    try {
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Error refreshing data:', error.message);
      return false;
    }
  }
}

module.exports = CLIDataAdapter;