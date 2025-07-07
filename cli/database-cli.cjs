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
    // Use the same database path as the main application
    return path.join(process.cwd(), 'usage.db');
  }

  async init() {
    try {
      console.log('[CLI-DB] Initializing sql.js...');
      
      // Initialize sql.js
      this.SQL = await initSqlJs();
      
      // Read existing database file or create new
      let filebuffer;
      if (fs.existsSync(this.dbPath)) {
        filebuffer = fs.readFileSync(this.dbPath);
        console.log('[CLI-DB] Loaded existing database');
      } else {
        console.log('[CLI-DB] Database file not found - CLI requires existing database from Electron');
        throw new Error('Database not found. Please run the Electron version first to create the database.');
      }
      
      // Create database instance
      this.db = new this.SQL.Database(filebuffer);
      console.log('[CLI-DB] Connected to SQLite database');
      
    } catch (error) {
      console.error('[CLI-DB] Failed to initialize:', error.message);
      throw error;
    }
  }

  async getSessionStats() {
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

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = CLIDatabaseService;