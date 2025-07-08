/**
 * CLI Database Service using sql.js (CommonJS)
 * Pure JavaScript SQLite - no native compilation needed
 */

const initSqlJs = require('sql.js');
const path = require('path');
const os = require('os');
const fs = require('fs');

class CLIDatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.dbPath = this.getDbPath();
  }

  getDbPath() {
    const fs = require('fs');
    
    // Try multiple possible database locations, including npm global location
    const possiblePaths = [
      // NPM Global package location (where Electron UI runs from)
      path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'dragon-ui-claude', 'usage.db'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'dragon-ui-claude', 'usage.db'),
      
      // Development locations
      path.join(process.cwd(), 'usage.db'),                    // Same directory as CLI
      path.join(__dirname, '..', 'usage.db'),                  // Parent directory (Dragon-Ui)
      path.join(process.cwd(), '..', 'usage.db'),              // Parent of current directory
      'usage.db',                                               // Relative to current working directory
      
      // User data directories
      path.join(os.homedir(), 'usage.db'),                    // User home directory
      path.join(os.homedir(), '.dragon-ui', 'usage.db'),      // User data directory
      path.join(process.env.APPDATA || '', 'dragon-ui', 'usage.db'), // Windows AppData
      path.join(process.env.LOCALAPPDATA || '', 'dragon-ui', 'usage.db'), // Windows LocalAppData
      
      // Other possible locations
      path.join(__dirname, '..', '..', 'usage.db'),           // Two levels up
      path.join('C:', 'temp', 'usage.db'),                    // Temp directory
      path.join('C:', 'Users', process.env.USERNAME || '', 'Desktop', 'usage.db'), // Desktop
      
      // Try to find npm global prefix location dynamically
      ...((() => {
        try {
          const { execSync } = require('child_process');
          const npmGlobalPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
          return [
            path.join(npmGlobalPrefix, 'node_modules', 'dragon-ui-claude', 'usage.db'),
            path.join(npmGlobalPrefix, 'usage.db')
          ];
        } catch (e) {
          return [];
        }
      })())
    ];
    
    let dbPath = null;
    let newestDb = null;
    let newestTime = 0;
    
    // Find the most recently modified database file (silent search)
    for (const testPath of possiblePaths) {
      const fullPath = path.resolve(testPath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        
        // Use the most recently modified database
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          newestDb = fullPath;
          this.lastDbModTime = newestTime;
        }
      }
    }
    
    if (newestDb) {
      return newestDb;
    } else {
      this.lastDbModTime = 0;
      return path.join(process.cwd(), 'usage.db'); // Fallback
    }
  }

  /**
   * Check if database has been updated since last read
   */
  isDatabaseUpdated() {
    try {
      if (!fs.existsSync(this.dbPath)) return false;
      
      const stats = fs.statSync(this.dbPath);
      const currentModTime = stats.mtime.getTime();
      
      if (currentModTime > this.lastDbModTime) {
        this.lastDbModTime = currentModTime;
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh database if it has been updated
   */
  async refreshIfNeeded() {
    if (this.isDatabaseUpdated()) {
      // Close current database
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      
      // Wait briefly for any file system sync
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Reinitialize with fresh data
      await this.init();
    }
  }

  async init() {
    try {
      // Initialize sql.js
      this.SQL = await initSqlJs();
      
      // Read existing database file or create new
      let filebuffer;
      if (fs.existsSync(this.dbPath)) {
        filebuffer = fs.readFileSync(this.dbPath);
      } else {
        throw new Error('Database not found. Please run the Electron version first to create the database.');
      }
      
      // Create database instance
      this.db = new this.SQL.Database(filebuffer);
      
    } catch (error) {
      throw error;
    }
  }

  async getSessionStats() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const query = `
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
    `;

    const stmt = this.db.prepare(query);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row);
    }
    stmt.free();
    
    return result;
  }

  async getProjectStats() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const query = `
      SELECT 
        project,
        COUNT(*) as entry_count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + 
            COALESCE(cache_creation_input_tokens, 0) + 
            COALESCE(cache_read_input_tokens, 0)) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE project IS NOT NULL 
      GROUP BY project 
      ORDER BY total_cost DESC
    `;

    const stmt = this.db.prepare(query);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row);
    }
    stmt.free();
    
    return result;
  }

  async getMonthlyStats() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const query = `
      SELECT 
        strftime('%Y-%m', timestamp) as month,
        SUM(cost) as total_cost,
        COUNT(*) as entry_count,
        SUM(input_tokens + output_tokens + 
            COALESCE(cache_creation_input_tokens, 0) + 
            COALESCE(cache_read_input_tokens, 0)) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        COUNT(DISTINCT DATE(timestamp)) as active_days
      FROM usage_entries 
      GROUP BY strftime('%Y-%m', timestamp) 
      ORDER BY month DESC
    `;

    const stmt = this.db.prepare(query);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row);
    }
    stmt.free();
    
    return result;
  }

  async getDailyStats(days = 30) {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const query = `
      SELECT 
        DATE(timestamp) as date,
        SUM(cost) as total_cost,
        COUNT(*) as entry_count,
        SUM(input_tokens + output_tokens + 
            COALESCE(cache_creation_input_tokens, 0) + 
            COALESCE(cache_read_input_tokens, 0)) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        MIN(timestamp) as first_activity,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE DATE(timestamp) >= DATE('now', '-${days} days')
      GROUP BY DATE(timestamp) 
      ORDER BY date DESC
    `;

    const stmt = this.db.prepare(query);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row);
    }
    stmt.free();
    
    return result;
  }

  async getDbInfo() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const results = {};
    
    // Get entry count
    let stmt = this.db.prepare('SELECT COUNT(*) as entryCount FROM usage_entries');
    stmt.step();
    results.entryCount = stmt.getAsObject().entryCount;
    stmt.free();
    
    // Get session count
    stmt = this.db.prepare('SELECT COUNT(DISTINCT session_id) as sessionCount FROM usage_entries');
    stmt.step();
    results.sessionCount = stmt.getAsObject().sessionCount;
    stmt.free();
    
    // Get project count
    stmt = this.db.prepare('SELECT COUNT(DISTINCT project) as projectCount FROM usage_entries WHERE project IS NOT NULL');
    stmt.step();
    results.projectCount = stmt.getAsObject().projectCount;
    stmt.free();
    
    // Get file size
    try {
      const stats = fs.statSync(this.dbPath);
      results.dbSizeMB = stats.size / (1024 * 1024);
    } catch (error) {
      results.dbSizeMB = 0;
    }
    
    return results;
  }

  async getRealSessionCount() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const stmt = this.db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM usage_entries');
    stmt.step();
    const result = stmt.getAsObject().count;
    stmt.free();
    return result;
  }

  async getSessionModels(sessionId) {
    // Extract the base session ID (remove segment suffix if present)
    const baseSessionId = sessionId.includes('_') ? sessionId.split('_')[0] : sessionId;
    
    const query = `
      SELECT DISTINCT model 
      FROM usage_entries 
      WHERE session_id = ? AND model IS NOT NULL
      ORDER BY model
    `;
    
    const stmt = this.db.prepare(query);
    stmt.bind([baseSessionId]);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row.model);
    }
    stmt.free();
    
    return result;
  }

  async getAllModels() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    const query = `
      SELECT DISTINCT model 
      FROM usage_entries 
      WHERE model IS NOT NULL
      ORDER BY model
    `;
    
    const stmt = this.db.prepare(query);
    const result = [];
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push(row.model);
    }
    stmt.free();
    
    return result;
  }

  async getCurrentSessionInfo() {
    // Check for database updates before querying
    await this.refreshIfNeeded();
    
    // Check for any entries in the last 30 minutes (same as electron)
    const query = `
      SELECT 
        session_id,
        project,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + 
            COALESCE(cache_creation_input_tokens, 0) + 
            COALESCE(cache_read_input_tokens, 0)) as total_tokens,
        COUNT(*) as entry_count,
        MIN(timestamp) as session_start,
        MAX(timestamp) as last_activity
      FROM usage_entries 
      WHERE timestamp > datetime('now', '-30 minutes')
      GROUP BY session_id 
      ORDER BY last_activity DESC
      LIMIT 1
    `;
    
    const stmt = this.db.prepare(query);
    let result = null;
    
    if (stmt.step()) {
      result = stmt.getAsObject();
      // Also calculate duration in minutes
      if (result.session_start) {
        const startTime = new Date(result.session_start);
        const now = new Date();
        result.duration = Math.floor((now - startTime) / 60000); // minutes
      }
    }
    stmt.free();
    
    return result;
  }

  /**
   * Get last processed timestamp from database
   */
  getLastTimestamp() {
    try {
      const stmt = this.db.prepare('SELECT MAX(timestamp) as last_timestamp FROM usage_entries');
      stmt.step();
      const result = stmt.getAsObject();
      stmt.free();
      return result.last_timestamp;
    } catch (error) {
      return null;
    }
  }

  /**
   * Insert a single entry into database
   */
  insertEntry(entry) {
    try {
      // Use INSERT OR IGNORE to handle duplicates gracefully
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO usage_entries (
          timestamp, session_id, model, project,
          input_tokens, output_tokens, cache_creation_input_tokens, 
          cache_read_input_tokens, cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        entry.timestamp,
        entry.session_id,
        entry.model,
        entry.project,
        entry.input_tokens || 0,
        entry.output_tokens || 0,
        entry.cache_creation_input_tokens || 0,
        entry.cache_read_input_tokens || 0,
        entry.cost || 0
      ]);
      
      stmt.free();
      
      // Save to file after insert (for sql.js persistence)
      this.saveToFile();
      return true;
    } catch (error) {
      // Silent error - might be database lock or other issue
      return false;
    }
  }

  /**
   * Insert batch of entries
   */
  insertBatch(entries) {
    try {
      for (const entry of entries) {
        this.insertEntry(entry);
      }
      
      // Save database to file after batch insert (important for sql.js!)
      this.saveToFile();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save database to file (required for sql.js persistence)
   */
  saveToFile() {
    try {
      if (this.db && this.dbPath) {
        const data = this.db.export();
        const fs = require('fs');
        fs.writeFileSync(this.dbPath, data);
      }
    } catch (error) {
      // Silent error
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = CLIDatabaseService;