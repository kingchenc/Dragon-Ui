/**
 * SQLite Database Service
 * High-performance database for usage entries with indexing and fast queries
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor(dbPath = './usage.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.insertStmt = null;
    this.repairAttempted = false; // Flag um Auto-Repair nur einmal auszuführen
    this.init();
  }

  init() {
    console.log('[DB] DB: Initializing SQLite database...');
    
    try {
      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Test database integrity
      const integrityCheck = this.db.pragma('integrity_check');
      if (integrityCheck[0].integrity_check !== 'ok') {
        console.log('[REPAIR] DB: Database integrity check failed, attempting auto-repair...');
        this.autoRepairDatabase();
        return;
      }
      
      // Enable WAL mode for better performance
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('foreign_keys = ON');
      
      this.createTables();
      this.prepareStatements();
      
      console.log('[OK] DB: Database initialized successfully');
      
    } catch (error) {
      if (error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) {
        console.log('[REPAIR] DB: Database corrupted, attempting auto-repair...');
        this.autoRepairDatabase();
      } else {
        throw error;
      }
    }
  }

  createTables() {
    // Create usage_entries table with all necessary fields
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        session_id TEXT NOT NULL,
        full_session_id TEXT,
        model TEXT,
        project TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_creation_input_tokens INTEGER DEFAULT 0,
        cache_read_input_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        file_path TEXT,
        uuid TEXT,
        cwd TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(timestamp, session_id, file_path) ON CONFLICT IGNORE
      )
    `);

    // Add cache token columns if they don't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE usage_entries ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
    
    try {
      this.db.exec(`ALTER TABLE usage_entries ADD COLUMN cache_read_input_tokens INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Create high-performance indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_id ON usage_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON usage_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_project ON usage_entries(project);
      CREATE INDEX IF NOT EXISTS idx_model ON usage_entries(model);
      CREATE INDEX IF NOT EXISTS idx_timestamp_session ON usage_entries(timestamp, session_id);
      CREATE INDEX IF NOT EXISTS idx_cost ON usage_entries(cost);
    `);

    console.log('[OK] DB: Tables and indexes created');
  }

  prepareStatements() {
    // Prepare frequently used statements for better performance
    this.insertStmt = this.db.prepare(`
      INSERT INTO usage_entries (
        timestamp, session_id, full_session_id, model, project,
        input_tokens, output_tokens, cache_creation_input_tokens, 
        cache_read_input_tokens, total_tokens, cost, file_path, uuid, cwd
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getLastTimestampStmt = this.db.prepare(`
      SELECT MAX(timestamp) as last_timestamp FROM usage_entries
    `);

    this.getSessionStmt = this.db.prepare(`
      SELECT * FROM usage_entries WHERE session_id = ? ORDER BY timestamp ASC
    `);

    this.getAllEntriesStmt = this.db.prepare(`
      SELECT * FROM usage_entries ORDER BY timestamp ASC
    `);

    // UPDATE statements
    this.updateEntryStmt = this.db.prepare(`
      UPDATE usage_entries 
      SET cost = ?, input_tokens = ?, output_tokens = ?, total_tokens = ?, 
          cache_creation_input_tokens = ?, cache_read_input_tokens = ?
      WHERE id = ?
    `);

    this.updateEntryCostStmt = this.db.prepare(`
      UPDATE usage_entries SET cost = ? WHERE id = ?
    `);

    this.updateProjectStmt = this.db.prepare(`
      UPDATE usage_entries SET project = ? WHERE session_id = ?
    `);

    console.log('[OK] DB: Prepared statements ready');
  }

  // INSERT operations
  insertEntry(entry) {
    try {
      // Session-aware timestamp validation before database insert
      let validatedTimestamp = entry.timestamp;
      if (!entry.timestamp || typeof entry.timestamp !== 'string') {
        console.log(`[DB] 🚨 Invalid timestamp at insert, using current time: ${entry.timestamp}`);
        validatedTimestamp = new Date().toISOString();
      } else {
        const date = new Date(entry.timestamp);
        if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
          console.log(`[DB] 🚨 Corrupt timestamp at insert, using current time: ${entry.timestamp} -> ${validatedTimestamp}`);
          validatedTimestamp = new Date().toISOString();
        } else {
          // Session-based validation: Check if timestamp makes sense for this session
          if (entry.session_id) {
            const sessionValidation = this.validateTimestampForSession(entry.session_id, entry.timestamp);
            if (!sessionValidation.valid) {
              console.log(`[DB] 🚨 Session ${entry.session_id}: Timestamp ${entry.timestamp} conflicts with session timeline. ${sessionValidation.reason}`);
              validatedTimestamp = sessionValidation.suggestedTimestamp || new Date().toISOString();
            }
          }
        }
      }
      
      this.insertStmt.run(
        validatedTimestamp,
        entry.sessionId,
        entry.fullSessionId,
        entry.model,
        entry.project,
        entry.input_tokens || 0,
        entry.output_tokens || 0,
        entry.cache_creation_input_tokens || 0,
        entry.cache_read_input_tokens || 0,
        entry.total_tokens || 0,
        entry.cost || 0,
        entry.file,
        entry.uuid,
        entry.cwd
      );
      return true;
    } catch (error) {
      if ((error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) && !this.repairAttempted) {
        console.log('[REPAIR] DB: Corruption detected in insertEntry, triggering auto-repair...');
        this.repairAttempted = true;
        this.autoRepairDatabase();
        // Nach Repair erneut versuchen
        try {
          this.insertStmt.run(
            validatedTimestamp,
            entry.sessionId,
            entry.fullSessionId,
            entry.model,
            entry.project,
            entry.input_tokens || 0,
            entry.output_tokens || 0,
            entry.cache_creation_input_tokens || 0,
            entry.cache_read_input_tokens || 0,
            entry.total_tokens || 0,
            entry.cost || 0,
            entry.file,
            entry.uuid,
            entry.cwd
          );
          return true;
        } catch (retryError) {
          console.log('[REPAIR] DB: Still failing after repair in insertEntry');
          return false;
        }
      }
      
      if (error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) {
        console.log('[REPAIR] DB: Corruption detected but repair already attempted, skipping entry');
        return false;
      }
      
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.warn('[WARN] DB: Insert error:', error.message);
      }
      return false;
    }
  }

  insertBatch(entries) {
    console.log(`[DB] DB: Inserting ${entries.length} entries in batch...`);
    
    const transaction = this.db.transaction((entries) => {
      let inserted = 0;
      for (const entry of entries) {
        if (this.insertEntry(entry)) {
          inserted++;
        }
      }
      return inserted;
    });

    const inserted = transaction(entries);
    console.log(`[OK] DB: Inserted ${inserted} new entries (${entries.length - inserted} duplicates skipped)`);
    return inserted;
  }

  // SELECT queries
  getLastTimestamp() {
    try {
      const result = this.getLastTimestampStmt.get();
      return result?.last_timestamp || null;
    } catch (error) {
      if ((error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) && !this.repairAttempted) {
        console.log('[REPAIR] DB: Corruption detected in getLastTimestamp, triggering auto-repair...');
        this.repairAttempted = true;
        this.autoRepairDatabase();
        // Nach Repair erneut versuchen
        try {
          const result = this.getLastTimestampStmt.get();
          return result?.last_timestamp || null;
        } catch (retryError) {
          console.log('[REPAIR] DB: Still failing after repair, returning null');
          return null;
        }
      }
      
      if (error.code === 'SQLITE_CORRUPT' || error.message.includes('malformed')) {
        console.log('[REPAIR] DB: Corruption detected but repair already attempted, returning null');
        return null;
      }
      
      throw error;
    }
  }

  getAllEntries() {
    return this.getAllEntriesStmt.all();
  }

  getEntriesAfter(timestamp) {
    const stmt = this.db.prepare(`
      SELECT * FROM usage_entries 
      WHERE timestamp > ? 
      ORDER BY timestamp ASC
    `);
    return stmt.all(timestamp);
  }

  getSessionEntries(sessionId) {
    return this.getSessionStmt.all(sessionId);
  }

  getRecentEntries(minutesAgo = 30) {
    const timestamp = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM usage_entries 
      WHERE timestamp > ? 
      ORDER BY timestamp DESC
    `);
    return stmt.all(timestamp);
  }

  // Aggregation queries for fast calculations
  getTotalCost() {
    const stmt = this.db.prepare('SELECT SUM(cost) as total FROM usage_entries');
    return stmt.get()?.total || 0;
  }

  getTotalTokens() {
    const stmt = this.db.prepare(`
      SELECT SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total 
      FROM usage_entries
    `);
    return stmt.get()?.total || 0;
  }

  getSessionStats() {
    const stmt = this.db.prepare(`
      WITH session_segments AS (
        SELECT 
          session_id,
          timestamp,
          cost,
          input_tokens,
          output_tokens,
          COALESCE(cache_creation_input_tokens, 0) as cache_creation_input_tokens,
          COALESCE(cache_read_input_tokens, 0) as cache_read_input_tokens,
          project,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) - 1 as row_num,
          CAST((julianday(timestamp) - julianday(MIN(timestamp) OVER (PARTITION BY session_id))) * 24 * 60 AS INTEGER) as minutes_from_start,
          CAST(((julianday(timestamp) - julianday(MIN(timestamp) OVER (PARTITION BY session_id))) * 24 * 60) / 300 AS INTEGER) as segment_num
        FROM usage_entries
      )
      SELECT 
        session_id || '_' || segment_num as session_id,
        COUNT(*) as entry_count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        MIN(timestamp) as start_time,
        MAX(timestamp) as end_time,
        project
      FROM session_segments
      GROUP BY session_id, segment_num
      ORDER BY start_time DESC
    `);
    return stmt.all();
  }

  getProjectStats() {
    const stmt = this.db.prepare(`
      SELECT 
        project,
        COUNT(*) as entry_count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE project IS NOT NULL AND project != ''
      GROUP BY project
      ORDER BY total_cost DESC
    `);
    return stmt.all();
  }

  getMonthlyStats(billingCycleDay = 1) {
    if (billingCycleDay === 1) {
      // Use original calendar month logic for day 1 (optimization)
      const stmt = this.db.prepare(`
        SELECT 
          strftime('%Y-%m', timestamp) as month,
          COUNT(*) as entry_count,
          SUM(cost) as total_cost,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
          COUNT(DISTINCT session_id) as session_count,
          COUNT(DISTINCT date(timestamp)) as active_days
        FROM usage_entries 
        WHERE timestamp IS NOT NULL 
          AND timestamp != '' 
          AND date(timestamp) >= '2020-01-01'
          AND date(timestamp) <= date('now', '+1 day')
          AND strftime('%Y-%m', timestamp) IS NOT NULL
          AND strftime('%Y-%m', timestamp) != ''
          AND CAST(strftime('%Y', timestamp) AS INTEGER) >= 2020
        GROUP BY strftime('%Y-%m', timestamp)
        ORDER BY month DESC
      `);
      const result = stmt.all();
      console.log(`[DB] Monthly stats query returned ${result.length} periods:`, result.map(r => ({ month: r.month, cost: r.total_cost, entries: r.entry_count })));
      
      // Debug: Check for any suspicious timestamps in the database
      const debugStmt = this.db.prepare(`
        SELECT strftime('%Y-%m', timestamp) as month, COUNT(*) as count, MIN(timestamp) as first_ts, MAX(timestamp) as last_ts
        FROM usage_entries 
        GROUP BY strftime('%Y-%m', timestamp)
        HAVING strftime('%Y-%m', timestamp) LIKE '2001%' OR strftime('%Y-%m', timestamp) LIKE '1970%'
      `);
      const suspiciousEntries = debugStmt.all();
      if (suspiciousEntries.length > 0) {
        console.log(`[DB] 🚨 FOUND SUSPICIOUS ENTRIES:`, suspiciousEntries);
      }
      
      return result;
    } else {
      // Use custom billing cycle logic
      return this.getBillingPeriodStats(billingCycleDay);
    }
  }

  /**
   * Get stats grouped by billing periods instead of calendar months
   */
  getBillingPeriodStats(billingCycleDay = 1, periodCount = 12) {
    // Get all entries first
    const allEntries = this.db.prepare(`
      SELECT timestamp, cost, input_tokens, output_tokens, 
             cache_creation_input_tokens, cache_read_input_tokens, session_id
      FROM usage_entries 
      WHERE timestamp IS NOT NULL 
        AND timestamp != '' 
        AND date(timestamp) >= '2020-01-01'
        AND date(timestamp) <= date('now', '+1 day')
      ORDER BY timestamp DESC
    `).all();

    // Group entries by billing periods
    const periodMap = new Map();
    
    for (const entry of allEntries) {
      const entryDate = new Date(entry.timestamp);
      
      // Skip entries with invalid dates or dates before 2020
      if (isNaN(entryDate.getTime()) || entryDate.getFullYear() < 2020) {
        continue;
      }
      
      const billingPeriod = this.getBillingPeriodForDate(entryDate, billingCycleDay);
      
      if (!periodMap.has(billingPeriod.key)) {
        periodMap.set(billingPeriod.key, {
          month: billingPeriod.key,
          billing_period_start: billingPeriod.start.toISOString(),
          billing_period_end: billingPeriod.end.toISOString(),
          billing_period_label: billingPeriod.label,
          entry_count: 0,
          total_cost: 0,
          total_tokens: 0,
          session_ids: new Set(),
          dates: new Set()
        });
      }
      
      const period = periodMap.get(billingPeriod.key);
      period.entry_count++;
      period.total_cost += entry.cost || 0;
      period.total_tokens += (entry.input_tokens || 0) + (entry.output_tokens || 0) + 
                           (entry.cache_creation_input_tokens || 0) + (entry.cache_read_input_tokens || 0);
      period.session_ids.add(entry.session_id);
      period.dates.add(entry.timestamp.split('T')[0]); // Add date only
    }
    
    // Convert to array and finalize counts
    const periods = Array.from(periodMap.values()).map(period => ({
      month: period.month,
      billing_period_start: period.billing_period_start,
      billing_period_end: period.billing_period_end,
      billing_period_label: period.billing_period_label,
      entry_count: period.entry_count,
      total_cost: period.total_cost,
      total_tokens: period.total_tokens,
      session_count: period.session_ids.size,
      active_days: period.dates.size
    }));
    
    // Sort by period start date (most recent first) and limit
    return periods
      .sort((a, b) => new Date(b.billing_period_start).getTime() - new Date(a.billing_period_start).getTime())
      .slice(0, periodCount);
  }

  /**
   * Get billing period for a specific date
   */
  getBillingPeriodForDate(date, billingCycleDay) {
    const targetDate = new Date(date);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    // Calculate period start
    let periodStart = new Date(year, month, billingCycleDay);
    
    // If we haven't reached this month's billing day yet, use previous month
    if (day < billingCycleDay) {
      periodStart = new Date(year, month - 1, billingCycleDay);
    }
    
    // Handle months with fewer days (e.g., Feb 30th -> Feb 28th)
    if (periodStart.getDate() !== billingCycleDay && billingCycleDay > 28) {
      // Get the last day of the target month properly
      const targetMonth = day < billingCycleDay ? month - 1 : month;
      const targetYear = targetMonth < 0 ? year - 1 : year;
      const adjustedMonth = targetMonth < 0 ? 11 : targetMonth;
      
      // Get last day of the month by going to first day of next month and subtracting 1
      periodStart = new Date(targetYear, adjustedMonth + 1, 0);
    }
    
    // Calculate period end
    let periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, billingCycleDay);
    if (periodEnd.getDate() !== billingCycleDay && billingCycleDay > 28) {
      // Get last day of next month properly
      periodEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0);
    }
    periodEnd = new Date(periodEnd.getTime() - 1); // One day before next cycle
    
    return {
      start: periodStart,
      end: periodEnd,
      key: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(billingCycleDay).padStart(2, '0')}`,
      label: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    };
  }

  getDailyFinancialStats(days = 30) {
    // Simple calendar day grouping: All financial activity per day
    const stmt = this.db.prepare(`
      SELECT 
        date(timestamp) as date,
        SUM(cost) as total_cost,
        COUNT(DISTINCT session_id) as session_count,
        COUNT(*) as entry_count,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE timestamp IS NOT NULL 
        AND timestamp != '' 
        AND date(timestamp) >= '2020-01-01'
        AND timestamp >= datetime('now', '-${days} days')
      GROUP BY date(timestamp)
      ORDER BY date ASC
    `);
    const result = stmt.all();
    console.log(`[DB] 💰 Daily financial stats (calendar day based) for last ${days} days: ${result.length} entries`);
    
    // Calculate running total for enhanced chart
    let runningTotal = 0;
    const enhancedResult = result.map(day => {
      runningTotal += day.total_cost || 0;
      return {
        ...day,
        running_total: runningTotal
      };
    });
    
    console.log(`[DB] Enhanced with running totals: $0 -> $${runningTotal.toFixed(2)}`);
    return enhancedResult;
  }

  getDailyStats(days = 7) {
    // Generate complete date range first
    const dateRange = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateRange.push(date.toISOString().split('T')[0]);
    }
    
    // Get actual usage data
    const stmt = this.db.prepare(`
      SELECT 
        date(timestamp) as date,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        COUNT(DISTINCT model) as model_count,
        GROUP_CONCAT(DISTINCT model) as models,
        COUNT(*) as entry_count,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE timestamp >= datetime('now', '-${days} days')
        AND timestamp IS NOT NULL 
        AND date(timestamp) >= '2020-01-01'
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `);
    
    const usageData = stmt.all().reduce((acc, row) => {
      acc[row.date] = {
        ...row,
        models: row.models ? row.models.split(',').filter(m => m && m.trim()) : []
      };
      return acc;
    }, {});
    
    // Fill in complete date range with zeros for missing days
    const dailyData = dateRange.map(date => {
      return usageData[date] || {
        date,
        total_cost: 0,
        total_tokens: 0,
        session_count: 0,
        model_count: 0,
        models: [],
        entry_count: 0,
        first_activity: null,
        last_activity: null
      };
    });
    
    console.log(`[DB] 📅 Daily stats (calendar day based): ${dailyData.length} days, complete ${days}-day range`);
    
    return dailyData;
  }

  /**
   * Get current billing period data (replaces "monthly" data for custom cycles)
   */
  getCurrentBillingPeriodData(billingCycleDay = 1) {
    const currentPeriod = this.getBillingPeriodForDate(new Date(), billingCycleDay);
    
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as entry_count,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens), 0) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        COUNT(DISTINCT date(timestamp)) as active_days,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE timestamp >= ? AND timestamp <= ?
    `);
    
    const result = stmt.get(currentPeriod.start.toISOString(), currentPeriod.end.toISOString());
    
    if (!result || result.entry_count === 0) {
      return null;
    }
    
    return {
      period_key: currentPeriod.key,
      period_label: currentPeriod.label,
      period_start: currentPeriod.start.toISOString(),
      period_end: currentPeriod.end.toISOString(),
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      sessionCount: result.session_count || 0,
      activeDays: result.active_days || 0,
      entryCount: result.entry_count || 0,
      firstActivity: result.first_activity,
      lastActivity: result.last_activity,
      isCurrent: true
    };
  }

  // Session-start-date-based grouping for correct daily attribution
  getTodayDataBySessionStart() {
    // Get sessions that STARTED today and sum ALL their costs/tokens
    const stmt = this.db.prepare(`
      SELECT 
        date('now') as date,
        COALESCE(SUM(all_entries.cost), 0) as total_cost,
        COALESCE(SUM(all_entries.input_tokens + all_entries.output_tokens + all_entries.cache_creation_input_tokens + all_entries.cache_read_input_tokens), 0) as total_tokens,
        COUNT(DISTINCT sessions_started_today.session_id) as session_count,
        COUNT(DISTINCT all_entries.model) as model_count,
        COUNT(*) as entry_count,
        MIN(all_entries.timestamp) as first_activity,
        MAX(all_entries.timestamp) as last_activity
      FROM (
        SELECT DISTINCT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now')
      ) sessions_started_today
      LEFT JOIN usage_entries all_entries ON sessions_started_today.session_id = all_entries.session_id
    `);
    const result = stmt.get();
    
    if (!result || result.session_count === 0) {
      return null;
    }
    
    // Get models list for sessions that started today
    const modelsStmt = this.db.prepare(`
      SELECT DISTINCT all_entries.model 
      FROM (
        SELECT DISTINCT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now')
      ) sessions_started_today
      LEFT JOIN usage_entries all_entries ON sessions_started_today.session_id = all_entries.session_id
      WHERE all_entries.model IS NOT NULL
    `);
    const models = modelsStmt.all().map(row => row.model);
    
    return {
      date: result.date,
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      sessionCount: result.session_count || 0,
      modelCount: result.model_count || 0,
      models: models,
      entryCount: result.entry_count || 0,
      firstActivity: result.first_activity,
      lastActivity: result.last_activity
    };
  }

  getYesterdayDataBySessionStart() {
    // Get sessions that STARTED yesterday and sum ALL their costs/tokens
    const stmt = this.db.prepare(`
      SELECT 
        date('now', '-1 day') as date,
        COALESCE(SUM(all_entries.cost), 0) as total_cost,
        COALESCE(SUM(all_entries.input_tokens + all_entries.output_tokens + all_entries.cache_creation_input_tokens + all_entries.cache_read_input_tokens), 0) as total_tokens,
        COUNT(DISTINCT sessions_started_yesterday.session_id) as session_count,
        COUNT(DISTINCT all_entries.model) as model_count,
        COUNT(*) as entry_count,
        MIN(all_entries.timestamp) as first_activity,
        MAX(all_entries.timestamp) as last_activity
      FROM (
        SELECT DISTINCT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now', '-1 day')
      ) sessions_started_yesterday
      LEFT JOIN usage_entries all_entries ON sessions_started_yesterday.session_id = all_entries.session_id
    `);
    const result = stmt.get();
    
    if (!result || result.session_count === 0) {
      return null;
    }
    
    // Get models list for sessions that started yesterday
    const modelsStmt = this.db.prepare(`
      SELECT DISTINCT all_entries.model 
      FROM (
        SELECT DISTINCT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now', '-1 day')
      ) sessions_started_yesterday
      LEFT JOIN usage_entries all_entries ON sessions_started_yesterday.session_id = all_entries.session_id
      WHERE all_entries.model IS NOT NULL
    `);
    const models = modelsStmt.all().map(row => row.model);
    
    return {
      date: result.date,
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      sessionCount: result.session_count || 0,
      modelCount: result.model_count || 0,
      models: models,
      entryCount: result.entry_count || 0,
      firstActivity: result.first_activity,
      lastActivity: result.last_activity
    };
  }

  getDailyStatsBySessionStart(days = 7) {
    // Get daily stats where sessions are attributed to their START date
    const stmt = this.db.prepare(`
      SELECT 
        session_start_dates.start_date as date,
        COALESCE(SUM(all_entries.cost), 0) as total_cost,
        COALESCE(SUM(all_entries.input_tokens + all_entries.output_tokens + all_entries.cache_creation_input_tokens + all_entries.cache_read_input_tokens), 0) as total_tokens,
        COUNT(DISTINCT session_start_dates.session_id) as session_count,
        COUNT(DISTINCT all_entries.model) as model_count
      FROM (
        SELECT 
          session_id,
          date(MIN(timestamp)) as start_date
        FROM usage_entries 
        WHERE timestamp >= datetime('now', '-${days} days')
        GROUP BY session_id
      ) session_start_dates
      LEFT JOIN usage_entries all_entries ON session_start_dates.session_id = all_entries.session_id
      WHERE session_start_dates.start_date >= date('now', '-${days} days')
      GROUP BY session_start_dates.start_date
      ORDER BY session_start_dates.start_date DESC
    `);
    
    const dailyData = stmt.all();
    
    // For each day, get the models used by sessions that started that day
    const enhancedDailyData = dailyData.map(day => {
      const modelsStmt = this.db.prepare(`
        SELECT DISTINCT all_entries.model 
        FROM (
          SELECT session_id
          FROM usage_entries 
          GROUP BY session_id 
          HAVING date(MIN(timestamp)) = ?
        ) sessions_started_this_day
        LEFT JOIN usage_entries all_entries ON sessions_started_this_day.session_id = all_entries.session_id
        WHERE all_entries.model IS NOT NULL
      `);
      const models = modelsStmt.all(day.date).map(row => row.model);
      
      return {
        ...day,
        models: models,
        model_count: models.length
      };
    });

    // Ensure we always have exactly 7 days (fill missing days with zeros)
    const today = new Date();
    const fullDailyData = [];
    
    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i); // Go back in time: today, yesterday, etc.
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Find existing data for this date
      const existingData = enhancedDailyData.find(d => d.date === dateStr);
      
      if (existingData) {
        fullDailyData.push(existingData);
      } else {
        // Add zero data for missing days
        fullDailyData.push({
          date: dateStr,
          total_cost: 0,
          total_tokens: 0,
          session_count: 0,
          model_count: 0,
          models: []
        });
      }
    }
    
    // Return in chronological order (oldest first) for the activity chart
    return fullDailyData.reverse();
  }

  // UPDATE operations
  updateEntry(id, updates) {
    try {
      this.updateEntryStmt.run(
        updates.cost || 0,
        updates.input_tokens || 0,
        updates.output_tokens || 0,
        updates.total_tokens || 0,
        updates.cache_creation_input_tokens || 0,
        updates.cache_read_input_tokens || 0,
        id
      );
      return true;
    } catch (error) {
      console.warn('[WARN] DB: Update entry error:', error.message);
      return false;
    }
  }

  updateEntryCost(id, newCost) {
    try {
      this.updateEntryCostStmt.run(newCost, id);
      return true;
    } catch (error) {
      console.warn('[WARN] DB: Update cost error:', error.message);
      return false;
    }
  }

  updateSessionProject(sessionId, newProject) {
    try {
      const result = this.updateProjectStmt.run(newProject, sessionId);
      console.log(`[OK] DB: Updated ${result.changes} entries for session ${sessionId} to project "${newProject}"`);
      return result.changes;
    } catch (error) {
      console.warn('[WARN] DB: Update project error:', error.message);
      return 0;
    }
  }

  // Batch update operations
  updateBatch(updates) {
    console.log(`[INFO] DB: Batch updating ${updates.length} entries...`);
    
    const transaction = this.db.transaction((updates) => {
      let updated = 0;
      for (const update of updates) {
        if (this.updateEntry(update.id, update.data)) {
          updated++;
        }
      }
      return updated;
    });

    const updated = transaction(updates);
    console.log(`[OK] DB: Updated ${updated} entries`);
    return updated;
  }

  // Utility methods
  getEntryCount() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM usage_entries');
    return stmt.get()?.count || 0;
  }

  getDbSize() {
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  // Maintenance
  vacuum() {
    console.log('🧹 DB: Running VACUUM to optimize database...');
    this.db.exec('VACUUM');
    console.log('[OK] DB: Database optimized');
  }

  // Clear all data from database
  clearAllData() {
    // Clear usage entries table
    const deleteUsageStmt = this.db.prepare('DELETE FROM usage_entries');
    deleteUsageStmt.run();
    
    // Reset auto-increment counter  
    this.db.exec("DELETE FROM sqlite_sequence WHERE name = 'usage_entries'");
    
    console.log('[DATABASE] All data cleared from database');
    return true;
  }

  cleanupCorruptedTimestamps() {
    try {
      // Step 1: Clean up obviously corrupted timestamps
      const stmt = this.db.prepare(`
        DELETE FROM usage_entries 
        WHERE timestamp IS NULL 
           OR timestamp = '' 
           OR date(timestamp) < '2020-01-01'
           OR date(timestamp) IS NULL
           OR strftime('%Y', timestamp) = '1970'
           OR strftime('%Y', timestamp) = '2001'
      `);
      const basicCleanup = stmt.run();
      console.log(`[DB] Basic cleanup: ${basicCleanup.changes} corrupted timestamp entries`);
      
      // Step 2: Session ID-based validation and cleanup
      const sessionValidation = this.validateSessionTimestamps();
      
      return basicCleanup.changes + sessionValidation;
    } catch (error) {
      console.error('[ERR] Failed to cleanup corrupted timestamps:', error);
      return 0;
    }
  }

  validateTimestampForSession(sessionId, timestamp) {
    try {
      // Get existing entries for this session
      const sessionStmt = this.db.prepare(`
        SELECT timestamp, strftime('%Y', timestamp) as year
        FROM usage_entries 
        WHERE session_id = ?
        ORDER BY timestamp
      `);
      const sessionEntries = sessionStmt.all(sessionId);
      
      if (sessionEntries.length === 0) {
        // New session - timestamp is valid
        return { valid: true };
      }
      
      const entryDate = new Date(timestamp);
      const entryYear = entryDate.getFullYear();
      
      // Check if year makes sense
      if (entryYear < 2020 || entryYear > new Date().getFullYear() + 1) {
        return {
          valid: false,
          reason: `Invalid year ${entryYear}`,
          suggestedTimestamp: new Date().toISOString()
        };
      }
      
      // Get session's valid timestamp range
      const validEntries = sessionEntries.filter(entry => {
        const year = parseInt(entry.year);
        return year >= 2020 && year <= new Date().getFullYear() + 1;
      });
      
      if (validEntries.length > 0) {
        const sessionStart = new Date(validEntries[0].timestamp);
        const sessionEnd = new Date(validEntries[validEntries.length - 1].timestamp);
        
        // Check if new timestamp is within reasonable session bounds (max 24 hours gap)
        const maxGapMs = 24 * 60 * 60 * 1000; // 24 hours
        const timeSinceStart = entryDate.getTime() - sessionStart.getTime();
        const timeSinceEnd = entryDate.getTime() - sessionEnd.getTime();
        
        if (timeSinceStart < -maxGapMs) {
          return {
            valid: false,
            reason: `Timestamp too far before session start (${Math.abs(timeSinceStart / (60 * 60 * 1000)).toFixed(1)}h gap)`,
            suggestedTimestamp: new Date().toISOString()
          };
        }
        
        if (timeSinceEnd > maxGapMs) {
          return {
            valid: false,
            reason: `Timestamp too far after session end (${(timeSinceEnd / (60 * 60 * 1000)).toFixed(1)}h gap)`,
            suggestedTimestamp: new Date().toISOString()
          };
        }
      }
      
      return { valid: true };
      
    } catch (error) {
      console.error('[ERR] Session timestamp validation error:', error);
      return { valid: true }; // Default to valid on error
    }
  }

  validateSessionTimestamps() {
    try {
      console.log('[DB] 🔍 Starting session-based timestamp validation...');
      
      // Get all sessions with their timestamp ranges
      const sessionStmt = this.db.prepare(`
        SELECT 
          session_id,
          COUNT(*) as entry_count,
          MIN(timestamp) as first_timestamp,
          MAX(timestamp) as last_timestamp,
          julianday(MAX(timestamp)) - julianday(MIN(timestamp)) as session_duration_days
        FROM usage_entries 
        WHERE session_id IS NOT NULL 
        GROUP BY session_id
        HAVING session_duration_days > 30  -- Sessions longer than 30 days are suspicious
      `);
      
      const suspiciousSessions = sessionStmt.all();
      let cleanedCount = 0;
      
      for (const session of suspiciousSessions) {
        console.log(`[DB] 🚨 Suspicious session ${session.session_id}: ${session.session_duration_days} days duration`);
        
        // Get all entries for this session
        const entriesStmt = this.db.prepare(`
          SELECT id, timestamp, strftime('%Y', timestamp) as year
          FROM usage_entries 
          WHERE session_id = ?
          ORDER BY timestamp
        `);
        const entries = entriesStmt.all(session.session_id);
        
        // Find corrupted entries (wrong year) within valid sessions
        const corruptedEntries = entries.filter(entry => {
          const year = parseInt(entry.year);
          return year < 2020 || year > new Date().getFullYear() + 1;
        });
        
        if (corruptedEntries.length > 0) {
          console.log(`[DB] 💡 Session ${session.session_id}: Found ${corruptedEntries.length} entries with corrupted timestamps`);
          
          // Calculate session's most likely timestamp range from valid entries
          const validEntries = entries.filter(entry => {
            const year = parseInt(entry.year);
            return year >= 2020 && year <= new Date().getFullYear() + 1;
          });
          
          if (validEntries.length > 0) {
            // Fix corrupted entries by interpolating based on valid session data
            const sessionStart = new Date(validEntries[0].timestamp);
            const sessionEnd = new Date(validEntries[validEntries.length - 1].timestamp);
            
            console.log(`[DB] 🔧 Fixing ${corruptedEntries.length} corrupted entries in session ${session.session_id}`);
            
            const deleteStmt = this.db.prepare('DELETE FROM usage_entries WHERE id = ?');
            for (const corruptedEntry of corruptedEntries) {
              deleteStmt.run(corruptedEntry.id);
              cleanedCount++;
            }
            
            console.log(`[DB] ✅ Session ${session.session_id}: Removed ${corruptedEntries.length} corrupted entries`);
          } else {
            // No valid entries in session - remove entire session
            console.log(`[DB] 🗑️ Session ${session.session_id}: No valid entries, removing entire session`);
            const deleteSessionStmt = this.db.prepare('DELETE FROM usage_entries WHERE session_id = ?');
            const result = deleteSessionStmt.run(session.session_id);
            cleanedCount += result.changes;
          }
        }
      }
      
      console.log(`[DB] ✅ Session validation completed: ${cleanedCount} corrupted entries fixed`);
      return cleanedCount;
      
    } catch (error) {
      console.error('[ERR] Session timestamp validation failed:', error);
      return 0;
    }
  }

  // Refresh database by clearing and reloading data
  refreshDatabase() {
    // Clear existing data
    this.clearAllData();
    
    console.log('[DATABASE] Database refreshed, ready for new data');
    return true;
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('[INFO] DB: Database connection closed');
    }
  }

  // Performance testing
  performanceTest() {
    console.log('🏁 DB: Running performance tests...');
    
    const tests = [
      () => this.getTotalCost(),
      () => this.getTotalTokens(), 
      () => this.getSessionStats(),
      () => this.getProjectStats(),
      () => this.getMonthlyStats(),
      () => this.getDailyStats(30)
    ];
    
    const testNames = ['Total Cost', 'Total Tokens', 'Session Stats', 'Project Stats', 'Monthly Stats', 'Daily Stats'];
    const results = [];
    
    tests.forEach((test, i) => {
      const start = performance.now();
      const result = test();
      const time = performance.now() - start;
      results.push({ name: testNames[i], time: time.toFixed(2), result: Array.isArray(result) ? result.length : result });
      console.log(`  ${testNames[i]}: ${time.toFixed(2)}ms`);
    });
    
    return results;
  }

  // Debug info
  getDbInfo() {
    const entryCount = this.getEntryCount();
    const dbSize = this.getDbSize();
    const lastTimestamp = this.getLastTimestamp();
    
    return {
      entryCount,
      dbSizeMB: (dbSize / 1024 / 1024).toFixed(2),
      lastTimestamp,
      dbPath: this.dbPath
    };
  }

  // Daily usage specific methods
  getTodayData() {
    const stmt = this.db.prepare(`
      SELECT 
        date('now') as date,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT model) as model_count,
        COUNT(*) as entry_count,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE date(timestamp) = date('now')
    `);
    const result = stmt.get();
    
    if (!result || result.total_cost === null) {
      return null;
    }
    
    // Count sessions that STARTED today (not just have activity today)
    const sessionCountStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT session_id) as session_count
      FROM usage_entries 
      WHERE session_id IN (
        SELECT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now')
      )
      AND date(timestamp) = date('now')
    `);
    const sessionCountResult = sessionCountStmt.get();
    
    // Get models list for today
    const modelsStmt = this.db.prepare(`
      SELECT DISTINCT model 
      FROM usage_entries 
      WHERE date(timestamp) = date('now') AND model IS NOT NULL
    `);
    const models = modelsStmt.all().map(row => row.model);
    
    return {
      date: result.date,
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      sessionCount: sessionCountResult.session_count || 0,
      modelCount: result.model_count || 0,
      models: models,
      entryCount: result.entry_count || 0,
      firstActivity: result.first_activity,
      lastActivity: result.last_activity
    };
  }

  getYesterdayData() {
    const stmt = this.db.prepare(`
      SELECT 
        date('now', '-1 day') as date,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT model) as model_count,
        COUNT(*) as entry_count,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE date(timestamp) = date('now', '-1 day')
    `);
    const result = stmt.get();
    
    if (!result || result.total_cost === null) {
      return null;
    }
    
    // Count sessions that STARTED yesterday (not just have activity yesterday)
    const sessionCountStmt = this.db.prepare(`
      SELECT COUNT(DISTINCT session_id) as session_count
      FROM usage_entries 
      WHERE session_id IN (
        SELECT session_id 
        FROM usage_entries 
        GROUP BY session_id 
        HAVING date(MIN(timestamp)) = date('now', '-1 day')
      )
      AND date(timestamp) = date('now', '-1 day')
    `);
    const sessionCountResult = sessionCountStmt.get();
    
    // Get models list for yesterday
    const modelsStmt = this.db.prepare(`
      SELECT DISTINCT model 
      FROM usage_entries 
      WHERE date(timestamp) = date('now', '-1 day') AND model IS NOT NULL
    `);
    const models = modelsStmt.all().map(row => row.model);
    
    return {
      date: result.date,
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      sessionCount: sessionCountResult.session_count || 0,
      modelCount: result.model_count || 0,
      models: models,
      entryCount: result.entry_count || 0,
      firstActivity: result.first_activity,
      lastActivity: result.last_activity
    };
  }

  getLastSessionData() {
    // Get the most recent session (by latest activity)
    const sessionStmt = this.db.prepare(`
      SELECT session_id, MAX(timestamp) as last_activity
      FROM usage_entries 
      GROUP BY session_id
      ORDER BY last_activity DESC
      LIMIT 1
    `);
    const session = sessionStmt.get();
    
    if (!session) {
      return null;
    }
    
    // Get full session data including models
    const stmt = this.db.prepare(`
      SELECT 
        session_id,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(*) as entry_count,
        MIN(timestamp) as start_time,
        MAX(timestamp) as end_time,
        project,
        GROUP_CONCAT(DISTINCT model) as models
      FROM usage_entries 
      WHERE session_id = ?
      GROUP BY session_id
    `);
    const result = stmt.get(session.session_id);
    
    if (!result) {
      return null;
    }
    
    // Calculate duration if we have both start and end
    let duration = null;
    if (result.start_time && result.end_time) {
      duration = Math.floor((new Date(result.end_time) - new Date(result.start_time)) / (1000 * 60)); // minutes
    }
    
    // Parse models
    const models = result.models ? result.models.split(',').filter(m => m) : [];
    
    return {
      sessionId: result.session_id,
      totalCost: result.total_cost || 0,
      totalTokens: result.total_tokens || 0,
      entryCount: result.entry_count || 0,
      startTime: result.start_time,
      endTime: result.end_time,
      duration: duration,
      project: result.project,
      lastActivity: result.end_time,
      models: models,
      modelCount: models.length
    };
  }

  /**
   * Auto-Repair für beschädigte SQLite-Datenbanken
   */
  autoRepairDatabase() {
    console.log('[REPAIR] DB: Starting auto-repair process...');
    
    try {
      // Schritt 1: Backup der beschädigten Datenbank erstellen
      const backupPath = this.dbPath + '.corrupted_backup_' + Date.now();
      if (fs.existsSync(this.dbPath)) {
        try {
          fs.copyFileSync(this.dbPath, backupPath);
          console.log(`[REPAIR] DB: Backup created at ${backupPath}`);
        } catch (error) {
          console.log('[REPAIR] DB: Could not create backup, proceeding with repair...');
        }
      }
      
      // Schritt 2: Versuche Daten zu retten
      let rescuedData = [];
      if (this.db) {
        try {
          // Versuche einzelne Tabellen zu lesen
          const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
          
          for (const table of tables) {
            if (table.name === 'usage_entries') {
              try {
                const data = this.db.prepare(`SELECT * FROM ${table.name}`).all();
                rescuedData = data;
                console.log(`[REPAIR] DB: Rescued ${data.length} entries from ${table.name}`);
              } catch (error) {
                console.log(`[REPAIR] DB: Could not rescue data from ${table.name}: ${error.message}`);
              }
            }
          }
          
          this.db.close();
        } catch (error) {
          console.log('[REPAIR] DB: Could not access corrupted database for rescue');
        }
      }
      
      // Schritt 3: Lösche beschädigte Datenbank
      if (fs.existsSync(this.dbPath)) {
        try {
          fs.unlinkSync(this.dbPath);
          console.log('[REPAIR] DB: Corrupted database file removed');
        } catch (error) {
          console.log('[REPAIR] DB: Could not remove corrupted database file');
        }
      }
      
      // Schritt 4: Erstelle neue Datenbank
      console.log('[REPAIR] DB: Creating new database...');
      this.db = new Database(this.dbPath);
      
      // Schritt 5: Aktiviere SQLite-Einstellungen
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('foreign_keys = ON');
      
      // Schritt 6: Erstelle Tabellen
      this.createTables();
      this.prepareStatements();
      
      // Schritt 7: Wiederherstellen der geretteten Daten
      if (rescuedData.length > 0) {
        console.log(`[REPAIR] DB: Restoring ${rescuedData.length} rescued entries...`);
        
        const transaction = this.db.transaction((entries) => {
          let restored = 0;
          for (const entry of entries) {
            try {
              // Validiere und bereinige die Daten
              const cleanedEntry = this.cleanEntryData(entry);
              if (cleanedEntry) {
                this.insertEntryDirect(cleanedEntry);
                restored++;
              }
            } catch (error) {
              // Ignoriere fehlerhafte Einträge
            }
          }
          return restored;
        });
        
        const restored = transaction(rescuedData);
        console.log(`[REPAIR] DB: Successfully restored ${restored} entries`);
      }
      
      console.log('[REPAIR] DB: Auto-repair completed successfully');
      console.log('[REPAIR] DB: Database is now ready for use');
      
    } catch (error) {
      console.error('[REPAIR] DB: Auto-repair failed:', error.message);
      
      // Fallback: Erstelle komplett neue Datenbank
      try {
        if (fs.existsSync(this.dbPath)) {
          fs.unlinkSync(this.dbPath);
        }
        
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 10000');
        this.db.pragma('foreign_keys = ON');
        
        this.createTables();
        this.prepareStatements();
        
        console.log('[REPAIR] DB: Fresh database created as fallback');
      } catch (fallbackError) {
        console.error('[REPAIR] DB: Fallback repair also failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }

  /**
   * Bereinige und validiere Entry-Daten
   */
  cleanEntryData(entry) {
    try {
      // Prüfe erforderliche Felder
      if (!entry.timestamp || !entry.session_id) {
        return null;
      }
      
      // Validiere Timestamp
      const date = new Date(entry.timestamp);
      if (isNaN(date.getTime()) || date.getFullYear() < 2020 || date.getFullYear() > new Date().getFullYear() + 1) {
        return null; // Ungültiger Timestamp
      }
      
      // Bereinige numerische Felder
      const cleanedEntry = {
        timestamp: entry.timestamp,
        session_id: entry.session_id,
        model: entry.model || 'unknown',
        project: entry.project || 'unknown',
        input_tokens: Math.max(0, parseInt(entry.input_tokens) || 0),
        output_tokens: Math.max(0, parseInt(entry.output_tokens) || 0),
        cache_creation_input_tokens: Math.max(0, parseInt(entry.cache_creation_input_tokens) || 0),
        cache_read_input_tokens: Math.max(0, parseInt(entry.cache_read_input_tokens) || 0),
        cost: Math.max(0, parseFloat(entry.cost) || 0)
      };
      
      // Berechne total_tokens
      cleanedEntry.total_tokens = cleanedEntry.input_tokens + cleanedEntry.output_tokens + 
                                   cleanedEntry.cache_creation_input_tokens + cleanedEntry.cache_read_input_tokens;
      
      return cleanedEntry;
    } catch (error) {
      return null;
    }
  }

  /**
   * Füge Entry direkt ohne Prepared Statement hinzu (für Repair)
   */
  insertEntryDirect(entry) {
    const stmt = this.db.prepare(`
      INSERT INTO usage_entries (
        timestamp, session_id, model, project,
        input_tokens, output_tokens, cache_creation_input_tokens, 
        cache_read_input_tokens, total_tokens, cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entry.timestamp,
      entry.session_id,
      entry.model,
      entry.project,
      entry.input_tokens,
      entry.output_tokens,
      entry.cache_creation_input_tokens,
      entry.cache_read_input_tokens,
      entry.total_tokens,
      entry.cost
    );
  }
}

module.exports = DatabaseService;