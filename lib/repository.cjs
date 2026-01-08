/**
 * Repository Pattern Implementation for Dragon-UI
 * Generic repository base class and specific implementations
 *
 * @module lib/repository
 */

'use strict';

/**
 * Base Repository Interface
 * Abstract class defining repository contract
 */
class BaseRepository {
  constructor(db) {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository is abstract and cannot be instantiated directly');
    }
    this.db = db;
  }

  /**
   * Find by ID
   * @param {string|number} id
   * @returns {Object|null}
   */
  findById(id) {
    throw new Error('Method findById must be implemented');
  }

  /**
   * Find all
   * @param {Object} options
   * @returns {Array}
   */
  findAll(options = {}) {
    throw new Error('Method findAll must be implemented');
  }

  /**
   * Find by criteria
   * @param {Object} criteria
   * @returns {Array}
   */
  findBy(criteria) {
    throw new Error('Method findBy must be implemented');
  }

  /**
   * Find one by criteria
   * @param {Object} criteria
   * @returns {Object|null}
   */
  findOneBy(criteria) {
    throw new Error('Method findOneBy must be implemented');
  }

  /**
   * Create entity
   * @param {Object} data
   * @returns {Object}
   */
  create(data) {
    throw new Error('Method create must be implemented');
  }

  /**
   * Update entity
   * @param {string|number} id
   * @param {Object} data
   * @returns {Object}
   */
  update(id, data) {
    throw new Error('Method update must be implemented');
  }

  /**
   * Delete entity
   * @param {string|number} id
   * @returns {boolean}
   */
  delete(id) {
    throw new Error('Method delete must be implemented');
  }

  /**
   * Count entities
   * @param {Object} criteria
   * @returns {number}
   */
  count(criteria = {}) {
    throw new Error('Method count must be implemented');
  }

  /**
   * Check if entity exists
   * @param {string|number} id
   * @returns {boolean}
   */
  exists(id) {
    return this.findById(id) !== null;
  }
}

/**
 * Account Repository
 * Manages proxy accounts and their credentials
 */
class AccountRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'proxy_accounts';
    this.ensureTable();
  }

  ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        session_key TEXT,
        priority INTEGER DEFAULT 50,
        enabled INTEGER DEFAULT 1,
        rate_limited INTEGER DEFAULT 0,
        rate_limit_reset TEXT,
        last_used TEXT,
        request_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapToEntity(row) : null;
  }

  findAll(options = {}) {
    const { orderBy = 'priority DESC', limit = null, offset = 0 } = options;
    let sql = `SELECT * FROM ${this.tableName} ORDER BY ${orderBy}`;
    if (limit) {
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }
    const stmt = this.db.prepare(sql);
    return stmt.all().map(row => this.mapToEntity(row));
  }

  findBy(criteria) {
    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${key} = ?`);
      values.push(value);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ${whereClause}`);
    return stmt.all(...values).map(row => this.mapToEntity(row));
  }

  findOneBy(criteria) {
    const results = this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }

  findEnabled() {
    return this.findBy({ enabled: 1 });
  }

  findAvailable() {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE enabled = 1 AND (rate_limited = 0 OR rate_limit_reset < datetime('now'))
      ORDER BY priority DESC
    `);
    return stmt.all().map(row => this.mapToEntity(row));
  }

  create(data) {
    const id = data.id || this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (id, name, email, session_key, priority, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name || 'Account',
      data.email || null,
      data.sessionKey || null,
      data.priority || 50,
      data.enabled !== false ? 1 : 0
    );

    return this.findById(id);
  }

  update(id, data) {
    const sets = [];
    const values = [];

    const allowedFields = [
      'name', 'email', 'session_key', 'priority', 'enabled',
      'rate_limited', 'rate_limit_reset', 'last_used',
      'request_count', 'success_count', 'fail_count',
      'total_tokens', 'total_cost'
    ];

    for (const [key, value] of Object.entries(data)) {
      const dbKey = this.toSnakeCase(key);
      if (allowedFields.includes(dbKey)) {
        sets.push(`${dbKey} = ?`);
        values.push(value);
      }
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(criteria = {}) {
    if (Object.keys(criteria).length === 0) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      return stmt.get().count;
    }

    const conditions = [];
    const values = [];
    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${key} = ?`);
      values.push(value);
    }

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`);
    return stmt.get(...values).count;
  }

  recordUsage(id, tokens, cost, success = true) {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET request_count = request_count + 1,
          ${success ? 'success_count = success_count + 1' : 'fail_count = fail_count + 1'},
          total_tokens = total_tokens + ?,
          total_cost = total_cost + ?,
          last_used = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(tokens, cost, id);
  }

  markRateLimited(id, resetTime) {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET rate_limited = 1, rate_limit_reset = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(resetTime, id);
  }

  clearRateLimit(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET rate_limited = 0, rate_limit_reset = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
  }

  getStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN rate_limited = 1 THEN 1 ELSE 0 END) as rate_limited,
        SUM(request_count) as total_requests,
        SUM(success_count) as total_success,
        SUM(fail_count) as total_fail,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
      FROM ${this.tableName}
    `);
    return stmt.get();
  }

  mapToEntity(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      sessionKey: row.session_key,
      priority: row.priority,
      enabled: row.enabled === 1,
      rateLimited: row.rate_limited === 1,
      rateLimitReset: row.rate_limit_reset,
      lastUsed: row.last_used,
      requestCount: row.request_count,
      successCount: row.success_count,
      failCount: row.fail_count,
      totalTokens: row.total_tokens,
      totalCost: row.total_cost,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  generateId() {
    return `acc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Request Repository
 * Manages request logs and history
 */
class RequestRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'request_logs';
    this.ensureTable();
  }

  ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        account_id TEXT,
        session_id TEXT,
        method TEXT,
        url TEXT,
        path TEXT,
        status_code INTEGER,
        status TEXT,
        duration INTEGER,
        request_size INTEGER,
        response_size INTEGER,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cached_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        failover_attempts INTEGER DEFAULT 0,
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_request_logs_account ON ${this.tableName}(account_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_session ON ${this.tableName}(session_id);
      CREATE INDEX IF NOT EXISTS idx_request_logs_created ON ${this.tableName}(created_at);
      CREATE INDEX IF NOT EXISTS idx_request_logs_model ON ${this.tableName}(model);
    `);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapToEntity(row) : null;
  }

  findAll(options = {}) {
    const { orderBy = 'created_at DESC', limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset).map(row => this.mapToEntity(row));
  }

  findBy(criteria) {
    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(criteria)) {
      const dbKey = this.toSnakeCase(key);
      conditions.push(`${dbKey} = ?`);
      values.push(value);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC LIMIT 100`);
    return stmt.all(...values).map(row => this.mapToEntity(row));
  }

  findOneBy(criteria) {
    const results = this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }

  findByAccount(accountId, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(accountId, limit).map(row => this.mapToEntity(row));
  }

  findBySession(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(sessionId).map(row => this.mapToEntity(row));
  }

  findRecent(minutes = 60) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE created_at > datetime('now', '-${minutes} minutes')
      ORDER BY created_at DESC
    `);
    return stmt.all().map(row => this.mapToEntity(row));
  }

  findFailed(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE status = 'failed' OR status_code >= 400
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit).map(row => this.mapToEntity(row));
  }

  create(data) {
    const id = data.id || this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (
        id, account_id, session_id, method, url, path,
        status_code, status, duration, request_size, response_size,
        model, input_tokens, output_tokens, cached_tokens, cost,
        failover_attempts, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.accountId || null,
      data.sessionId || null,
      data.method || 'GET',
      data.url || '',
      data.path || '',
      data.statusCode || null,
      data.status || 'pending',
      data.duration || null,
      data.requestSize || 0,
      data.responseSize || 0,
      data.model || null,
      data.inputTokens || 0,
      data.outputTokens || 0,
      data.cachedTokens || 0,
      data.cost || 0,
      data.failoverAttempts || 0,
      data.error || null
    );

    return this.findById(id);
  }

  update(id, data) {
    const sets = [];
    const values = [];

    const allowedFields = [
      'status_code', 'status', 'duration', 'request_size', 'response_size',
      'model', 'input_tokens', 'output_tokens', 'cached_tokens', 'cost',
      'failover_attempts', 'error'
    ];

    for (const [key, value] of Object.entries(data)) {
      const dbKey = this.toSnakeCase(key);
      if (allowedFields.includes(dbKey)) {
        sets.push(`${dbKey} = ?`);
        values.push(value);
      }
    }

    if (sets.length === 0) return this.findById(id);

    values.push(id);
    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(criteria = {}) {
    if (Object.keys(criteria).length === 0) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      return stmt.get().count;
    }

    const conditions = [];
    const values = [];
    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${this.toSnakeCase(key)} = ?`);
      values.push(value);
    }

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`);
    return stmt.get(...values).count;
  }

  getStats(days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(duration) as avg_duration,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cached_tokens) as total_cached_tokens,
        SUM(cost) as total_cost,
        SUM(failover_attempts) as total_failovers
      FROM ${this.tableName}
      WHERE created_at > datetime('now', '-${days} days')
    `);
    return stmt.get();
  }

  getStatsByModel(days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        model,
        COUNT(*) as count,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cost) as cost,
        AVG(duration) as avg_duration
      FROM ${this.tableName}
      WHERE created_at > datetime('now', '-${days} days')
        AND model IS NOT NULL
      GROUP BY model
      ORDER BY cost DESC
    `);
    return stmt.all();
  }

  getStatsByAccount(days = 30) {
    const stmt = this.db.prepare(`
      SELECT
        account_id,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(cost) as cost,
        AVG(duration) as avg_duration
      FROM ${this.tableName}
      WHERE created_at > datetime('now', '-${days} days')
        AND account_id IS NOT NULL
      GROUP BY account_id
      ORDER BY count DESC
    `);
    return stmt.all();
  }

  deleteOlderThan(days) {
    const stmt = this.db.prepare(`
      DELETE FROM ${this.tableName}
      WHERE created_at < datetime('now', '-${days} days')
    `);
    const result = stmt.run();
    return result.changes;
  }

  mapToEntity(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      sessionId: row.session_id,
      method: row.method,
      url: row.url,
      path: row.path,
      statusCode: row.status_code,
      status: row.status,
      duration: row.duration,
      requestSize: row.request_size,
      responseSize: row.response_size,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      cachedTokens: row.cached_tokens,
      cost: row.cost,
      failoverAttempts: row.failover_attempts,
      error: row.error,
      createdAt: row.created_at
    };
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  generateId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * Stats Repository
 * Manages aggregated statistics
 */
class StatsRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'stats_snapshots';
    this.ensureTable();
  }

  ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        period TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_stats_type_period ON ${this.tableName}(type, period);
    `);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapToEntity(row) : null;
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset).map(row => this.mapToEntity(row));
  }

  findBy(criteria) {
    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${key} = ?`);
      values.push(value);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC`);
    return stmt.all(...values).map(row => this.mapToEntity(row));
  }

  findOneBy(criteria) {
    const results = this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }

  findByType(type, limit = 100) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(type, limit).map(row => this.mapToEntity(row));
  }

  findByPeriod(period) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE period = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(period).map(row => this.mapToEntity(row));
  }

  create(data) {
    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (type, period, data)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      data.type,
      data.period,
      typeof data.data === 'string' ? data.data : JSON.stringify(data.data)
    );

    return this.findById(result.lastInsertRowid);
  }

  update(id, data) {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET data = ?
      WHERE id = ?
    `);
    stmt.run(typeof data.data === 'string' ? data.data : JSON.stringify(data.data), id);
    return this.findById(id);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(criteria = {}) {
    if (Object.keys(criteria).length === 0) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      return stmt.get().count;
    }

    const conditions = [];
    const values = [];
    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${key} = ?`);
      values.push(value);
    }

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`);
    return stmt.get(...values).count;
  }

  saveSnapshot(type, period, data) {
    return this.create({ type, period, data });
  }

  getLatestSnapshot(type) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(type);
    return row ? this.mapToEntity(row) : null;
  }

  mapToEntity(row) {
    let parsedData;
    try {
      parsedData = JSON.parse(row.data);
    } catch {
      parsedData = row.data;
    }

    return {
      id: row.id,
      type: row.type,
      period: row.period,
      data: parsedData,
      createdAt: row.created_at
    };
  }
}

/**
 * Agent Preference Repository
 * Manages agent model preferences
 */
class AgentPreferenceRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'agent_preferences';
    this.ensureTable();
  }

  ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        workspace TEXT,
        system_prompt_hash TEXT,
        preferred_model TEXT,
        color TEXT,
        icon TEXT,
        metadata TEXT,
        use_count INTEGER DEFAULT 0,
        last_used TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_agent_pref_workspace ON ${this.tableName}(workspace);
      CREATE INDEX IF NOT EXISTS idx_agent_pref_hash ON ${this.tableName}(system_prompt_hash);
    `);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? this.mapToEntity(row) : null;
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      ORDER BY use_count DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset).map(row => this.mapToEntity(row));
  }

  findBy(criteria) {
    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(criteria)) {
      const dbKey = this.toSnakeCase(key);
      conditions.push(`${dbKey} = ?`);
      values.push(value);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} ${whereClause}`);
    return stmt.all(...values).map(row => this.mapToEntity(row));
  }

  findOneBy(criteria) {
    const results = this.findBy(criteria);
    return results.length > 0 ? results[0] : null;
  }

  findByWorkspace(workspace) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE workspace = ?
      ORDER BY use_count DESC
    `);
    return stmt.all(workspace).map(row => this.mapToEntity(row));
  }

  findByPromptHash(hash) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE system_prompt_hash = ?
    `);
    const row = stmt.get(hash);
    return row ? this.mapToEntity(row) : null;
  }

  create(data) {
    const id = data.id || this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (
        id, name, workspace, system_prompt_hash,
        preferred_model, color, icon, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.workspace || null,
      data.systemPromptHash || null,
      data.preferredModel || null,
      data.color || null,
      data.icon || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return this.findById(id);
  }

  update(id, data) {
    const sets = [];
    const values = [];

    const allowedFields = [
      'name', 'workspace', 'system_prompt_hash',
      'preferred_model', 'color', 'icon', 'metadata'
    ];

    for (const [key, value] of Object.entries(data)) {
      const dbKey = this.toSnakeCase(key);
      if (allowedFields.includes(dbKey)) {
        sets.push(`${dbKey} = ?`);
        if (dbKey === 'metadata' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  count(criteria = {}) {
    if (Object.keys(criteria).length === 0) {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
      return stmt.get().count;
    }

    const conditions = [];
    const values = [];
    for (const [key, value] of Object.entries(criteria)) {
      conditions.push(`${this.toSnakeCase(key)} = ?`);
      values.push(value);
    }

    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${conditions.join(' AND ')}`);
    return stmt.get(...values).count;
  }

  recordUsage(id) {
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName}
      SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(id);
  }

  mapToEntity(row) {
    let metadata;
    try {
      metadata = row.metadata ? JSON.parse(row.metadata) : null;
    } catch {
      metadata = null;
    }

    return {
      id: row.id,
      name: row.name,
      workspace: row.workspace,
      systemPromptHash: row.system_prompt_hash,
      preferredModel: row.preferred_model,
      color: row.color,
      icon: row.icon,
      metadata,
      useCount: row.use_count,
      lastUsed: row.last_used,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  generateId() {
    return `agent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

module.exports = {
  BaseRepository,
  AccountRepository,
  RequestRepository,
  StatsRepository,
  AgentPreferenceRepository
};
