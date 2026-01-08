/**
 * Load Balancer Service for Dragon-UI
 * Handles multi-account request distribution and failover
 *
 * @module services/load-balancer
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Load balancing strategy constants
 */
const STRATEGIES = {
  ROUND_ROBIN: 'round-robin',
  LEAST_CONNECTIONS: 'least-connections',
  WEIGHTED: 'weighted',
  SESSION_STICKY: 'session-sticky',
  RANDOM: 'random'
};

/**
 * Account status constants
 */
const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  RATE_LIMITED: 'rate-limited',
  ERROR: 'error',
  DISABLED: 'disabled'
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  strategy: STRATEGIES.SESSION_STICKY,
  sessionStickyDuration: 5 * 60 * 60 * 1000, // 5 hours
  rateLimitCooldown: 60 * 60 * 1000,          // 1 hour
  maxRetries: 3,
  retryDelay: 1000,
  healthCheckInterval: 60 * 1000               // 1 minute
};

/**
 * Account class for load balancing
 */
class Account {
  /**
   * Create an account
   * @param {Object} config
   * @param {string} config.id - Account identifier
   * @param {string} config.apiKey - API key or access token
   * @param {number} [config.priority=50] - Priority (0-100, higher = preferred)
   * @param {number} [config.weight=1] - Weight for weighted distribution
   * @param {boolean} [config.enabled=true] - Whether account is enabled
   */
  constructor(config) {
    this.id = config.id;
    this.apiKey = config.apiKey;
    this.priority = config.priority || 50;
    this.weight = config.weight || 1;
    this.enabled = config.enabled !== false;

    // Runtime state
    this.status = ACCOUNT_STATUS.ACTIVE;
    this.activeConnections = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.lastUsed = null;
    this.lastError = null;
    this.lastErrorTime = null;
    this.rateLimitedUntil = null;
    this.rateLimitResetTime = null;
  }

  /**
   * Check if account is available for requests
   * @returns {boolean}
   */
  isAvailable() {
    if (!this.enabled) return false;
    if (this.status === ACCOUNT_STATUS.DISABLED) return false;
    if (this.status === ACCOUNT_STATUS.RATE_LIMITED) {
      if (this.rateLimitedUntil && Date.now() < this.rateLimitedUntil) {
        return false;
      }
      // Rate limit expired, reset status
      this.status = ACCOUNT_STATUS.ACTIVE;
      this.rateLimitedUntil = null;
    }
    return true;
  }

  /**
   * Mark account as rate limited
   * @param {number} [duration] - Duration in ms (default: 1 hour)
   * @param {number} [resetTime] - Unix timestamp when limit resets
   */
  markRateLimited(duration = 3600000, resetTime = null) {
    this.status = ACCOUNT_STATUS.RATE_LIMITED;
    this.rateLimitedUntil = Date.now() + duration;
    this.rateLimitResetTime = resetTime;
    this.lastError = 'Rate limited';
    this.lastErrorTime = new Date().toISOString();
  }

  /**
   * Mark account as errored
   * @param {string} error - Error message
   */
  markError(error) {
    this.status = ACCOUNT_STATUS.ERROR;
    this.lastError = error;
    this.lastErrorTime = new Date().toISOString();
    this.failedRequests++;
  }

  /**
   * Reset error state
   */
  resetError() {
    if (this.status === ACCOUNT_STATUS.ERROR) {
      this.status = ACCOUNT_STATUS.ACTIVE;
    }
    this.lastError = null;
    this.lastErrorTime = null;
  }

  /**
   * Record a successful request
   */
  recordSuccess() {
    this.totalRequests++;
    this.successfulRequests++;
    this.lastUsed = new Date().toISOString();
    if (this.status === ACCOUNT_STATUS.ERROR) {
      this.status = ACCOUNT_STATUS.ACTIVE;
    }
  }

  /**
   * Record a failed request
   * @param {string} error - Error message
   */
  recordFailure(error) {
    this.totalRequests++;
    this.failedRequests++;
    this.lastError = error;
    this.lastErrorTime = new Date().toISOString();
  }

  /**
   * Get success rate
   * @returns {number} - Success rate (0-1)
   */
  getSuccessRate() {
    if (this.totalRequests === 0) return 1;
    return this.successfulRequests / this.totalRequests;
  }

  /**
   * Get time until rate limit expires
   * @returns {number|null} - Milliseconds until available, or null if not rate limited
   */
  getTimeUntilAvailable() {
    if (this.status !== ACCOUNT_STATUS.RATE_LIMITED) return null;
    if (!this.rateLimitedUntil) return null;
    return Math.max(0, this.rateLimitedUntil - Date.now());
  }

  /**
   * Serialize account for storage
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      priority: this.priority,
      weight: this.weight,
      enabled: this.enabled,
      status: this.status,
      activeConnections: this.activeConnections,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: this.getSuccessRate(),
      lastUsed: this.lastUsed,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      rateLimitedUntil: this.rateLimitedUntil
    };
  }
}

/**
 * Session class for sticky session routing
 */
class Session {
  constructor(sessionId, accountId) {
    this.sessionId = sessionId;
    this.accountId = accountId;
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
    this.requestCount = 0;
  }

  /**
   * Check if session has expired
   * @param {number} ttl - TTL in milliseconds
   * @returns {boolean}
   */
  isExpired(ttl) {
    return (Date.now() - this.createdAt) > ttl;
  }

  /**
   * Record session usage
   */
  touch() {
    this.lastUsed = Date.now();
    this.requestCount++;
  }
}

/**
 * Load Balancer class
 */
class LoadBalancer extends EventEmitter {
  /**
   * Create a load balancer
   * @param {Object} config
   */
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accounts = new Map();
    this.sessions = new Map();
    this.roundRobinIndex = 0;
    this.healthCheckInterval = null;
  }

  /**
   * Add an account
   * @param {Object} accountConfig
   * @returns {Account}
   */
  addAccount(accountConfig) {
    const account = new Account(accountConfig);
    this.accounts.set(account.id, account);
    this.emit('account_added', account);
    return account;
  }

  /**
   * Remove an account
   * @param {string} accountId
   * @returns {boolean}
   */
  removeAccount(accountId) {
    const removed = this.accounts.delete(accountId);
    if (removed) {
      // Clean up sessions using this account
      for (const [sessionId, session] of this.sessions) {
        if (session.accountId === accountId) {
          this.sessions.delete(sessionId);
        }
      }
      this.emit('account_removed', accountId);
    }
    return removed;
  }

  /**
   * Get an account
   * @param {string} accountId
   * @returns {Account|null}
   */
  getAccount(accountId) {
    return this.accounts.get(accountId) || null;
  }

  /**
   * Get all accounts
   * @returns {Account[]}
   */
  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  /**
   * Get available accounts
   * @returns {Account[]}
   */
  getAvailableAccounts() {
    return this.getAllAccounts().filter(a => a.isAvailable());
  }

  /**
   * Select an account for a request
   * @param {Object} options
   * @param {string} [options.sessionId] - Session ID for sticky routing
   * @param {string} [options.preferredAccountId] - Preferred account
   * @returns {Account|null}
   */
  selectAccount(options = {}) {
    const { sessionId, preferredAccountId } = options;

    // Check for existing sticky session
    if (sessionId && this.config.strategy === STRATEGIES.SESSION_STICKY) {
      const session = this.sessions.get(sessionId);
      if (session && !session.isExpired(this.config.sessionStickyDuration)) {
        const account = this.accounts.get(session.accountId);
        if (account && account.isAvailable()) {
          session.touch();
          return account;
        }
      }
    }

    // Check preferred account
    if (preferredAccountId) {
      const preferred = this.accounts.get(preferredAccountId);
      if (preferred && preferred.isAvailable()) {
        this.createOrUpdateSession(sessionId, preferred.id);
        return preferred;
      }
    }

    // Get available accounts
    const available = this.getAvailableAccounts();
    if (available.length === 0) {
      this.emit('no_accounts_available');
      return null;
    }

    // Select based on strategy
    let selected;
    switch (this.config.strategy) {
      case STRATEGIES.ROUND_ROBIN:
        selected = this.selectRoundRobin(available);
        break;
      case STRATEGIES.LEAST_CONNECTIONS:
        selected = this.selectLeastConnections(available);
        break;
      case STRATEGIES.WEIGHTED:
        selected = this.selectWeighted(available);
        break;
      case STRATEGIES.RANDOM:
        selected = this.selectRandom(available);
        break;
      case STRATEGIES.SESSION_STICKY:
      default:
        // For new sessions, use priority-based selection
        selected = this.selectByPriority(available);
        break;
    }

    // Create sticky session
    if (sessionId && selected) {
      this.createOrUpdateSession(sessionId, selected.id);
    }

    return selected;
  }

  /**
   * Round-robin selection
   * @private
   */
  selectRoundRobin(accounts) {
    // Sort by priority first
    const sorted = accounts.sort((a, b) => b.priority - a.priority);
    const index = this.roundRobinIndex % sorted.length;
    this.roundRobinIndex++;
    return sorted[index];
  }

  /**
   * Least connections selection
   * @private
   */
  selectLeastConnections(accounts) {
    return accounts.reduce((min, acc) =>
      acc.activeConnections < min.activeConnections ? acc : min
    );
  }

  /**
   * Weighted selection
   * @private
   */
  selectWeighted(accounts) {
    const totalWeight = accounts.reduce((sum, acc) => sum + acc.weight, 0);
    let random = Math.random() * totalWeight;

    for (const account of accounts) {
      random -= account.weight;
      if (random <= 0) {
        return account;
      }
    }

    return accounts[accounts.length - 1];
  }

  /**
   * Random selection
   * @private
   */
  selectRandom(accounts) {
    return accounts[Math.floor(Math.random() * accounts.length)];
  }

  /**
   * Priority-based selection
   * @private
   */
  selectByPriority(accounts) {
    // Sort by priority (higher first), then by success rate
    const sorted = accounts.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.getSuccessRate() - a.getSuccessRate();
    });
    return sorted[0];
  }

  /**
   * Create or update a sticky session
   * @private
   */
  createOrUpdateSession(sessionId, accountId) {
    if (!sessionId) return;

    let session = this.sessions.get(sessionId);
    if (session) {
      session.accountId = accountId;
      session.touch();
    } else {
      session = new Session(sessionId, accountId);
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Record a successful request
   * @param {string} accountId
   */
  recordSuccess(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.recordSuccess();
      this.emit('request_success', accountId);
    }
  }

  /**
   * Record a failed request
   * @param {string} accountId
   * @param {string} error
   * @param {boolean} [isRateLimit=false]
   */
  recordFailure(accountId, error, isRateLimit = false) {
    const account = this.accounts.get(accountId);
    if (!account) return;

    if (isRateLimit) {
      account.markRateLimited(this.config.rateLimitCooldown);
      this.emit('account_rate_limited', accountId);
    } else {
      account.recordFailure(error);
      this.emit('request_failure', { accountId, error });
    }
  }

  /**
   * Start connection tracking
   * @param {string} accountId
   */
  startConnection(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.activeConnections++;
    }
  }

  /**
   * End connection tracking
   * @param {string} accountId
   */
  endConnection(accountId) {
    const account = this.accounts.get(accountId);
    if (account && account.activeConnections > 0) {
      account.activeConnections--;
    }
  }

  /**
   * Get next available account after failure
   * @param {string} excludeAccountId - Account to exclude
   * @param {string} [sessionId] - Session ID
   * @returns {Account|null}
   */
  getFailoverAccount(excludeAccountId, sessionId) {
    const available = this.getAvailableAccounts()
      .filter(a => a.id !== excludeAccountId);

    if (available.length === 0) {
      return null;
    }

    const selected = this.selectByPriority(available);

    // Update session to use new account
    if (sessionId && selected) {
      this.createOrUpdateSession(sessionId, selected.id);
    }

    this.emit('failover', { from: excludeAccountId, to: selected.id });
    return selected;
  }

  /**
   * Start health check scheduler
   */
  startHealthCheck() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Run immediately
    this.performHealthCheck();
  }

  /**
   * Stop health check scheduler
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check on all accounts
   */
  performHealthCheck() {
    const now = Date.now();

    // Check rate-limited accounts
    for (const account of this.accounts.values()) {
      if (account.status === ACCOUNT_STATUS.RATE_LIMITED) {
        if (account.rateLimitedUntil && now >= account.rateLimitedUntil) {
          account.status = ACCOUNT_STATUS.ACTIVE;
          account.rateLimitedUntil = null;
          this.emit('account_recovered', account.id);
        }
      }
    }

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.isExpired(this.config.sessionStickyDuration)) {
        this.sessions.delete(sessionId);
      }
    }

    this.emit('health_check_complete', this.getStats());
  }

  /**
   * Get load balancer statistics
   * @returns {Object}
   */
  getStats() {
    const accounts = this.getAllAccounts();
    const available = this.getAvailableAccounts();
    const rateLimited = accounts.filter(a => a.status === ACCOUNT_STATUS.RATE_LIMITED);
    const errored = accounts.filter(a => a.status === ACCOUNT_STATUS.ERROR);

    const totalRequests = accounts.reduce((sum, a) => sum + a.totalRequests, 0);
    const successfulRequests = accounts.reduce((sum, a) => sum + a.successfulRequests, 0);
    const failedRequests = accounts.reduce((sum, a) => sum + a.failedRequests, 0);

    return {
      strategy: this.config.strategy,
      totalAccounts: accounts.length,
      availableAccounts: available.length,
      rateLimitedAccounts: rateLimited.length,
      erroredAccounts: errored.length,
      activeSessions: this.sessions.size,
      totalRequests,
      successfulRequests,
      failedRequests,
      overallSuccessRate: totalRequests > 0 ? successfulRequests / totalRequests : 1,
      accounts: accounts.map(a => a.toJSON())
    };
  }

  /**
   * Set load balancing strategy
   * @param {string} strategy
   */
  setStrategy(strategy) {
    if (Object.values(STRATEGIES).includes(strategy)) {
      this.config.strategy = strategy;
      this.emit('strategy_changed', strategy);
    } else {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
  }

  /**
   * Enable an account
   * @param {string} accountId
   * @returns {boolean}
   */
  enableAccount(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.enabled = true;
      account.status = ACCOUNT_STATUS.ACTIVE;
      this.emit('account_enabled', accountId);
      return true;
    }
    return false;
  }

  /**
   * Disable an account
   * @param {string} accountId
   * @returns {boolean}
   */
  disableAccount(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.enabled = false;
      account.status = ACCOUNT_STATUS.DISABLED;
      this.emit('account_disabled', accountId);
      return true;
    }
    return false;
  }

  /**
   * Update account priority
   * @param {string} accountId
   * @param {number} priority
   * @returns {boolean}
   */
  updatePriority(accountId, priority) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.priority = Math.max(0, Math.min(100, priority));
      return true;
    }
    return false;
  }

  /**
   * Reset account statistics
   * @param {string} accountId
   * @returns {boolean}
   */
  resetStats(accountId) {
    const account = this.accounts.get(accountId);
    if (account) {
      account.totalRequests = 0;
      account.successfulRequests = 0;
      account.failedRequests = 0;
      account.lastError = null;
      account.lastErrorTime = null;
      return true;
    }
    return false;
  }

  /**
   * Clear all sessions
   */
  clearSessions() {
    this.sessions.clear();
    this.emit('sessions_cleared');
  }

  /**
   * Export configuration
   * @returns {Object}
   */
  exportConfig() {
    return {
      config: this.config,
      accounts: this.getAllAccounts().map(a => ({
        id: a.id,
        priority: a.priority,
        weight: a.weight,
        enabled: a.enabled
      }))
    };
  }

  /**
   * Import configuration
   * @param {Object} data
   */
  importConfig(data) {
    if (data.config) {
      this.config = { ...DEFAULT_CONFIG, ...data.config };
    }
    if (data.accounts) {
      for (const acc of data.accounts) {
        if (this.accounts.has(acc.id)) {
          const existing = this.accounts.get(acc.id);
          existing.priority = acc.priority || existing.priority;
          existing.weight = acc.weight || existing.weight;
          existing.enabled = acc.enabled !== false;
        }
      }
    }
  }

  /**
   * Close the load balancer
   */
  close() {
    this.stopHealthCheck();
    this.sessions.clear();
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create Load Balancer instance
 * @param {Object} [config]
 * @returns {LoadBalancer}
 */
function getLoadBalancer(config) {
  if (!instance) {
    instance = new LoadBalancer(config);
  }
  return instance;
}

module.exports = {
  LoadBalancer,
  Account,
  Session,
  getLoadBalancer,
  STRATEGIES,
  ACCOUNT_STATUS,
  DEFAULT_CONFIG
};
