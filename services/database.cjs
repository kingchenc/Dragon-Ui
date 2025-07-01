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
    this.init();
  }

  init() {
    console.log('[DB] DB: Initializing SQLite database...');
    
    // Create database connection
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('foreign_keys = ON');
    
    this.createTables();
    this.prepareStatements();
    
    console.log('[OK] DB: Database initialized successfully');
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
      // Final timestamp validation before database insert
      let validatedTimestamp = entry.timestamp;
      if (!entry.timestamp || typeof entry.timestamp !== 'string') {
        console.log(`[DB] 🚨 Invalid timestamp at insert, using current time: ${entry.timestamp}`);
        validatedTimestamp = new Date().toISOString();
      } else {
        const date = new Date(entry.timestamp);
        if (isNaN(date.getTime()) || date.getFullYear() < 2020) {
          console.log(`[DB] 🚨 Corrupt timestamp at insert, using current time: ${entry.timestamp} -> ${validatedTimestamp}`);
          validatedTimestamp = new Date().toISOString();
        } else if (entry.timestamp !== validatedTimestamp) {
          console.log(`[DB] ✅ Valid timestamp: ${entry.timestamp}`);
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
    const result = this.getLastTimestampStmt.get();
    return result?.last_timestamp || null;
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
      periodStart = new Date(year, month - (day < billingCycleDay ? 0 : -1), 0);
    }
    
    // Calculate period end
    let periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, billingCycleDay);
    if (periodEnd.getDate() !== billingCycleDay && billingCycleDay > 28) {
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
    console.log(`[DB] Daily financial stats for last ${days} days: ${result.length} entries`);
    
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
    const stmt = this.db.prepare(`
      SELECT 
        date(timestamp) as date,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT model) as model_count
      FROM usage_entries 
      WHERE timestamp >= datetime('now', '-${days} days')
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `);
    const dailyData = stmt.all();
    
    // For each day, count sessions that STARTED on that day (not just had activity)
    const enhancedDailyData = dailyData.map(day => {
      const sessionCountStmt = this.db.prepare(`
        SELECT COUNT(DISTINCT session_id) as session_count
        FROM usage_entries 
        WHERE session_id IN (
          SELECT session_id 
          FROM usage_entries 
          GROUP BY session_id 
          HAVING date(MIN(timestamp)) = ?
        )
        AND date(timestamp) = ?
      `);
      const sessionResult = sessionCountStmt.get(day.date, day.date);
      
      return {
        ...day,
        session_count: sessionResult.session_count || 0
      };
    });
    
    return enhancedDailyData;
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
      const stmt = this.db.prepare(`
        DELETE FROM usage_entries 
        WHERE timestamp IS NULL 
           OR timestamp = '' 
           OR date(timestamp) < '2020-01-01'
           OR date(timestamp) IS NULL
           OR strftime('%Y', timestamp) = '1970'
           OR strftime('%Y', timestamp) = '2001'
      `);
      const result = stmt.run();
      console.log(`[DB] Cleaned up ${result.changes} corrupted timestamp entries`);
      return result.changes;
    } catch (error) {
      console.error('[ERR] Failed to cleanup corrupted timestamps:', error);
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
}

module.exports = DatabaseService;