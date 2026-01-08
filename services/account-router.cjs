/**
 * Account Router Service for Dragon-UI
 * Routes requests to accounts based on sessions, priority, and availability
 *
 * @module services/account-router
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const { getLoadBalancer, STRATEGIES, ACCOUNT_STATUS } = require('./load-balancer.cjs');
const { getRateLimitTracker } = require('./rate-limit-tracker.cjs');

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  sessionDuration: 5 * 60 * 60 * 1000, // 5 hours
  sessionCleanupInterval: 10 * 60 * 1000, // 10 minutes
  preferredAccountTtl: 60 * 60 * 1000, // 1 hour
  maxSessionsPerAccount: 100,
  enableStickyRouting: true,
  enablePriorityRouting: true,
  enableFailover: true,
  failoverRetries: 3
};

/**
 * Routing decision types
 */
const ROUTING_REASON = {
  STICKY_SESSION: 'sticky_session',
  PREFERRED_ACCOUNT: 'preferred_account',
  PRIORITY_BASED: 'priority_based',
  LOAD_BALANCED: 'load_balanced',
  FAILOVER: 'failover',
  ROUND_ROBIN: 'round_robin',
  RANDOM: 'random'
};

/**
 * Session class for routing
 */
class RoutingSession {
  constructor(sessionId, accountId, metadata = {}) {
    this.sessionId = sessionId;
    this.accountId = accountId;
    this.createdAt = Date.now();
    this.lastUsed = Date.now();
    this.requestCount = 0;
    this.failoverCount = 0;
    this.metadata = metadata;
    this.previousAccounts = [];
  }

  /**
   * Check if session is expired
   * @param {number} ttl
   * @returns {boolean}
   */
  isExpired(ttl) {
    return (Date.now() - this.createdAt) > ttl;
  }

  /**
   * Update session usage
   */
  touch() {
    this.lastUsed = Date.now();
    this.requestCount++;
  }

  /**
   * Record failover to new account
   * @param {string} newAccountId
   */
  recordFailover(newAccountId) {
    if (this.accountId !== newAccountId) {
      this.previousAccounts.push({
        accountId: this.accountId,
        failedAt: Date.now()
      });
      this.accountId = newAccountId;
      this.failoverCount++;
    }
  }

  /**
   * Serialize for storage
   * @returns {Object}
   */
  toJSON() {
    return {
      sessionId: this.sessionId,
      accountId: this.accountId,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed,
      requestCount: this.requestCount,
      failoverCount: this.failoverCount,
      previousAccounts: this.previousAccounts,
      metadata: this.metadata
    };
  }
}

/**
 * Routing Decision class
 */
class RoutingDecision {
  constructor(config) {
    this.accountId = config.accountId;
    this.sessionId = config.sessionId || null;
    this.reason = config.reason;
    this.timestamp = Date.now();
    this.metadata = config.metadata || {};
    this.alternatives = config.alternatives || [];
  }

  /**
   * Serialize for logging
   * @returns {Object}
   */
  toJSON() {
    return {
      accountId: this.accountId,
      sessionId: this.sessionId,
      reason: this.reason,
      timestamp: this.timestamp,
      alternativeCount: this.alternatives.length
    };
  }
}

/**
 * Account Router class
 */
class AccountRouter extends EventEmitter {
  /**
   * Create an account router
   * @param {Object} config
   */
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadBalancer = getLoadBalancer();
    this.rateLimitTracker = getRateLimitTracker();
    this.sessions = new Map();
    this.preferredAccounts = new Map(); // userId -> { accountId, expiresAt }
    this.routingHistory = [];
    this.cleanupInterval = null;

    this.stats = {
      totalRouted: 0,
      byReason: {
        [ROUTING_REASON.STICKY_SESSION]: 0,
        [ROUTING_REASON.PREFERRED_ACCOUNT]: 0,
        [ROUTING_REASON.PRIORITY_BASED]: 0,
        [ROUTING_REASON.LOAD_BALANCED]: 0,
        [ROUTING_REASON.FAILOVER]: 0,
        [ROUTING_REASON.ROUND_ROBIN]: 0,
        [ROUTING_REASON.RANDOM]: 0
      },
      failovers: 0,
      noAccountAvailable: 0
    };
  }

  /**
   * Start cleanup scheduler
   */
  startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.sessionCleanupInterval);
  }

  /**
   * Stop cleanup scheduler
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Route a request to an account
   * @param {Object} options
   * @returns {RoutingDecision}
   */
  route(options = {}) {
    const {
      sessionId,
      userId,
      preferredAccountId,
      excludeAccounts = [],
      metadata = {}
    } = options;

    this.stats.totalRouted++;

    // Step 1: Check sticky session
    if (this.config.enableStickyRouting && sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && !session.isExpired(this.config.sessionDuration)) {
        const account = this.loadBalancer.getAccount(session.accountId);
        if (account && this.isAccountAvailable(account, excludeAccounts)) {
          session.touch();
          this.stats.byReason[ROUTING_REASON.STICKY_SESSION]++;

          return new RoutingDecision({
            accountId: session.accountId,
            sessionId,
            reason: ROUTING_REASON.STICKY_SESSION,
            metadata: { sessionRequestCount: session.requestCount },
            alternatives: this.getAlternatives(session.accountId, excludeAccounts)
          });
        }
      }
    }

    // Step 2: Check preferred account
    if (preferredAccountId) {
      const account = this.loadBalancer.getAccount(preferredAccountId);
      if (account && this.isAccountAvailable(account, excludeAccounts)) {
        this.createOrUpdateSession(sessionId, preferredAccountId, metadata);
        this.stats.byReason[ROUTING_REASON.PREFERRED_ACCOUNT]++;

        return new RoutingDecision({
          accountId: preferredAccountId,
          sessionId,
          reason: ROUTING_REASON.PREFERRED_ACCOUNT,
          alternatives: this.getAlternatives(preferredAccountId, excludeAccounts)
        });
      }
    }

    // Step 3: Check user preference
    if (userId) {
      const preference = this.preferredAccounts.get(userId);
      if (preference && preference.expiresAt > Date.now()) {
        const account = this.loadBalancer.getAccount(preference.accountId);
        if (account && this.isAccountAvailable(account, excludeAccounts)) {
          this.createOrUpdateSession(sessionId, preference.accountId, metadata);
          this.stats.byReason[ROUTING_REASON.PREFERRED_ACCOUNT]++;

          return new RoutingDecision({
            accountId: preference.accountId,
            sessionId,
            reason: ROUTING_REASON.PREFERRED_ACCOUNT,
            metadata: { source: 'user_preference' },
            alternatives: this.getAlternatives(preference.accountId, excludeAccounts)
          });
        }
      }
    }

    // Step 4: Get available accounts
    const availableAccounts = this.getAvailableAccounts(excludeAccounts);

    if (availableAccounts.length === 0) {
      this.stats.noAccountAvailable++;
      this.emit('no_accounts_available', { sessionId, excludeAccounts });

      return new RoutingDecision({
        accountId: null,
        sessionId,
        reason: 'no_accounts_available',
        metadata: {
          totalAccounts: this.loadBalancer.getAllAccounts().length,
          excludedCount: excludeAccounts.length,
          rateLimitedCount: this.rateLimitTracker.getLimitedAccounts().length
        }
      });
    }

    // Step 5: Priority-based routing
    if (this.config.enablePriorityRouting) {
      const selected = this.selectByPriority(availableAccounts);
      this.createOrUpdateSession(sessionId, selected.id, metadata);
      this.stats.byReason[ROUTING_REASON.PRIORITY_BASED]++;

      return new RoutingDecision({
        accountId: selected.id,
        sessionId,
        reason: ROUTING_REASON.PRIORITY_BASED,
        metadata: { priority: selected.priority, successRate: selected.getSuccessRate() },
        alternatives: this.getAlternatives(selected.id, excludeAccounts)
      });
    }

    // Step 6: Load balancer selection
    const selected = this.loadBalancer.selectAccount({ sessionId });
    if (selected) {
      this.createOrUpdateSession(sessionId, selected.id, metadata);
      this.stats.byReason[ROUTING_REASON.LOAD_BALANCED]++;

      return new RoutingDecision({
        accountId: selected.id,
        sessionId,
        reason: ROUTING_REASON.LOAD_BALANCED,
        alternatives: this.getAlternatives(selected.id, excludeAccounts)
      });
    }

    // Fallback: random selection
    const randomAccount = availableAccounts[Math.floor(Math.random() * availableAccounts.length)];
    this.createOrUpdateSession(sessionId, randomAccount.id, metadata);
    this.stats.byReason[ROUTING_REASON.RANDOM]++;

    return new RoutingDecision({
      accountId: randomAccount.id,
      sessionId,
      reason: ROUTING_REASON.RANDOM,
      alternatives: this.getAlternatives(randomAccount.id, excludeAccounts)
    });
  }

  /**
   * Route with failover support
   * @param {Object} options
   * @returns {RoutingDecision}
   */
  routeWithFailover(options = {}) {
    const decision = this.route(options);

    if (!decision.accountId && this.config.enableFailover) {
      // Try to find any account, even rate-limited ones close to recovery
      const allAccounts = this.loadBalancer.getAllAccounts();
      const soonestRecovery = this.findSoonestRecovery(allAccounts);

      if (soonestRecovery) {
        decision.accountId = soonestRecovery.accountId;
        decision.reason = ROUTING_REASON.FAILOVER;
        decision.metadata = {
          waitTime: soonestRecovery.timeUntilAvailable,
          warning: 'Account may be rate-limited'
        };
      }
    }

    return decision;
  }

  /**
   * Handle failover after request failure
   * @param {string} failedAccountId
   * @param {string} sessionId
   * @param {string} error
   * @returns {RoutingDecision|null}
   */
  handleFailover(failedAccountId, sessionId, error) {
    this.stats.failovers++;

    // Update session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.recordFailover(failedAccountId);
    }

    // Mark account as failed in load balancer
    this.loadBalancer.recordFailure(failedAccountId, error, error.includes('rate'));

    // Try to get alternative account
    const excludeAccounts = session ?
      [failedAccountId, ...session.previousAccounts.map(p => p.accountId)] :
      [failedAccountId];

    const decision = this.route({
      sessionId,
      excludeAccounts
    });

    if (decision.accountId) {
      decision.reason = ROUTING_REASON.FAILOVER;
      decision.metadata = {
        ...decision.metadata,
        failedAccount: failedAccountId,
        failureReason: error
      };

      this.emit('failover', {
        from: failedAccountId,
        to: decision.accountId,
        sessionId,
        error
      });
    }

    return decision;
  }

  /**
   * Check if account is available for routing
   * @param {Account} account
   * @param {string[]} excludeAccounts
   * @returns {boolean}
   */
  isAccountAvailable(account, excludeAccounts = []) {
    if (!account.isAvailable()) return false;
    if (excludeAccounts.includes(account.id)) return false;
    if (this.rateLimitTracker.isLimited(account.id)) return false;
    return true;
  }

  /**
   * Get available accounts
   * @param {string[]} excludeAccounts
   * @returns {Account[]}
   */
  getAvailableAccounts(excludeAccounts = []) {
    const rateLimited = this.rateLimitTracker.getLimitedAccounts();
    const allExcluded = [...excludeAccounts, ...rateLimited];

    return this.loadBalancer.getAllAccounts()
      .filter(a => this.isAccountAvailable(a, allExcluded));
  }

  /**
   * Select account by priority
   * @param {Account[]} accounts
   * @returns {Account}
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
   * Get alternative accounts
   * @param {string} excludeAccountId
   * @param {string[]} excludeAccounts
   * @returns {string[]}
   */
  getAlternatives(excludeAccountId, excludeAccounts = []) {
    const allExcluded = [excludeAccountId, ...excludeAccounts];
    return this.getAvailableAccounts(allExcluded)
      .slice(0, 3)
      .map(a => a.id);
  }

  /**
   * Find account with soonest rate limit recovery
   * @param {Account[]} accounts
   * @returns {Object|null}
   */
  findSoonestRecovery(accounts) {
    const rateLimited = accounts.filter(a =>
      a.status === ACCOUNT_STATUS.RATE_LIMITED && a.enabled
    );

    if (rateLimited.length === 0) return null;

    let soonest = null;
    let soonestTime = Infinity;

    for (const account of rateLimited) {
      const timeUntil = this.rateLimitTracker.getTimeUntilAvailable(account.id);
      if (timeUntil < soonestTime) {
        soonestTime = timeUntil;
        soonest = { accountId: account.id, timeUntilAvailable: timeUntil };
      }
    }

    return soonest;
  }

  /**
   * Create or update routing session
   * @param {string} sessionId
   * @param {string} accountId
   * @param {Object} metadata
   * @returns {RoutingSession}
   */
  createOrUpdateSession(sessionId, accountId, metadata = {}) {
    if (!sessionId) {
      sessionId = crypto.randomBytes(16).toString('hex');
    }

    let session = this.sessions.get(sessionId);
    if (session) {
      session.accountId = accountId;
      session.touch();
      session.metadata = { ...session.metadata, ...metadata };
    } else {
      session = new RoutingSession(sessionId, accountId, metadata);
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Get session
   * @param {string} sessionId
   * @returns {RoutingSession|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Delete session
   * @param {string} sessionId
   * @returns {boolean}
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Set user preferred account
   * @param {string} userId
   * @param {string} accountId
   * @param {number} [ttl]
   */
  setUserPreference(userId, accountId, ttl = null) {
    this.preferredAccounts.set(userId, {
      accountId,
      expiresAt: Date.now() + (ttl || this.config.preferredAccountTtl)
    });
  }

  /**
   * Clear user preference
   * @param {string} userId
   * @returns {boolean}
   */
  clearUserPreference(userId) {
    return this.preferredAccounts.delete(userId);
  }

  /**
   * Get router statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.sessions.size,
      userPreferences: this.preferredAccounts.size,
      availableAccounts: this.getAvailableAccounts().length,
      totalAccounts: this.loadBalancer.getAllAccounts().length,
      rateLimitedAccounts: this.rateLimitTracker.getLimitedAccounts().length
    };
  }

  /**
   * Get session statistics
   * @returns {Object}
   */
  getSessionStats() {
    const sessions = Array.from(this.sessions.values());
    const accountUsage = new Map();

    for (const session of sessions) {
      const count = accountUsage.get(session.accountId) || 0;
      accountUsage.set(session.accountId, count + 1);
    }

    return {
      totalSessions: sessions.length,
      activeInLastHour: sessions.filter(s =>
        (Date.now() - s.lastUsed) < 60 * 60 * 1000
      ).length,
      averageRequestsPerSession: sessions.length > 0 ?
        sessions.reduce((sum, s) => sum + s.requestCount, 0) / sessions.length : 0,
      sessionsByAccount: Object.fromEntries(accountUsage)
    };
  }

  /**
   * Cleanup expired sessions and preferences
   */
  cleanup() {
    const now = Date.now();

    // Clean sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.isExpired(this.config.sessionDuration)) {
        this.sessions.delete(sessionId);
      }
    }

    // Clean preferences
    for (const [userId, preference] of this.preferredAccounts) {
      if (preference.expiresAt <= now) {
        this.preferredAccounts.delete(userId);
      }
    }

    // Trim routing history
    if (this.routingHistory.length > 10000) {
      this.routingHistory = this.routingHistory.slice(-5000);
    }

    this.emit('cleanup_complete', {
      sessions: this.sessions.size,
      preferences: this.preferredAccounts.size
    });
  }

  /**
   * Reset router state
   */
  reset() {
    this.sessions.clear();
    this.preferredAccounts.clear();
    this.routingHistory = [];
    this.stats = {
      totalRouted: 0,
      byReason: {
        [ROUTING_REASON.STICKY_SESSION]: 0,
        [ROUTING_REASON.PREFERRED_ACCOUNT]: 0,
        [ROUTING_REASON.PRIORITY_BASED]: 0,
        [ROUTING_REASON.LOAD_BALANCED]: 0,
        [ROUTING_REASON.FAILOVER]: 0,
        [ROUTING_REASON.ROUND_ROBIN]: 0,
        [ROUTING_REASON.RANDOM]: 0
      },
      failovers: 0,
      noAccountAvailable: 0
    };

    this.emit('reset');
  }

  /**
   * Export state for persistence
   * @returns {Object}
   */
  export() {
    return {
      sessions: Array.from(this.sessions.entries()).map(([id, s]) => ({
        id,
        ...s.toJSON()
      })),
      preferences: Array.from(this.preferredAccounts.entries()),
      stats: this.getStats()
    };
  }

  /**
   * Import state from persistence
   * @param {Object} data
   */
  import(data) {
    if (data.sessions) {
      for (const sessionData of data.sessions) {
        const session = new RoutingSession(
          sessionData.sessionId,
          sessionData.accountId,
          sessionData.metadata
        );
        session.createdAt = sessionData.createdAt;
        session.lastUsed = sessionData.lastUsed;
        session.requestCount = sessionData.requestCount;
        session.failoverCount = sessionData.failoverCount;
        session.previousAccounts = sessionData.previousAccounts || [];

        if (!session.isExpired(this.config.sessionDuration)) {
          this.sessions.set(sessionData.sessionId, session);
        }
      }
    }

    if (data.preferences) {
      for (const [userId, preference] of data.preferences) {
        if (preference.expiresAt > Date.now()) {
          this.preferredAccounts.set(userId, preference);
        }
      }
    }
  }

  /**
   * Close the router
   */
  close() {
    this.stopCleanup();
    this.removeAllListeners();
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create Account Router instance
 * @param {Object} [config]
 * @returns {AccountRouter}
 */
function getAccountRouter(config) {
  if (!instance) {
    instance = new AccountRouter(config);
    instance.startCleanup();
  }
  return instance;
}

module.exports = {
  AccountRouter,
  RoutingSession,
  RoutingDecision,
  getAccountRouter,
  ROUTING_REASON,
  DEFAULT_CONFIG
};
