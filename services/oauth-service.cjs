/**
 * OAuth Service for Dragon-UI
 * Handles PKCE authentication, token management, and auto-refresh
 *
 * @module services/oauth-service
 */

'use strict';

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const EventEmitter = require('events');

/**
 * OAuth configuration constants
 */
const CONFIG = {
  // PKCE Configuration
  CODE_VERIFIER_LENGTH: 64,           // 64 bytes = 512 bits
  CODE_VERIFIER_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',
  STATE_LENGTH: 32,

  // Token Configuration
  REFRESH_BUFFER_MS: 30 * 60 * 1000,  // 30 minutes before expiry
  SESSION_TTL_MS: 10 * 60 * 1000,     // 10 minutes for OAuth sessions
  HEALTH_CHECK_INTERVAL: 10 * 60 * 1000, // 10 minutes

  // Anthropic OAuth Configuration
  ANTHROPIC_AUTH_URL: 'https://console.anthropic.com/oauth/authorize',
  ANTHROPIC_TOKEN_URL: 'https://api.anthropic.com/v1/oauth/token',
  ANTHROPIC_REVOKE_URL: 'https://api.anthropic.com/v1/oauth/revoke',

  // Local callback server
  CALLBACK_PORT: 8742,
  CALLBACK_PATH: '/oauth/callback',

  // Health states
  HEALTH_STATES: {
    HEALTHY: 'healthy',
    EXPIRING: 'expiring',
    EXPIRED: 'expired',
    ERROR: 'error',
    UNKNOWN: 'unknown'
  }
};

/**
 * Generate a cryptographically secure code verifier for PKCE
 * @returns {string} Code verifier (43-128 characters)
 */
function generateCodeVerifier() {
  const buffer = crypto.randomBytes(CONFIG.CODE_VERIFIER_LENGTH);
  let verifier = '';
  for (let i = 0; i < buffer.length; i++) {
    verifier += CONFIG.CODE_VERIFIER_CHARS[buffer[i] % CONFIG.CODE_VERIFIER_CHARS.length];
  }
  return verifier;
}

/**
 * Generate code challenge from verifier using SHA-256
 * @param {string} verifier - Code verifier
 * @returns {string} Base64url encoded code challenge
 */
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/**
 * Generate a random state parameter
 * @returns {string} Random state string
 */
function generateState() {
  return crypto.randomBytes(CONFIG.STATE_LENGTH).toString('hex');
}

/**
 * OAuth Token class
 */
class OAuthToken {
  constructor(data) {
    this.accessToken = data.access_token || data.accessToken;
    this.refreshToken = data.refresh_token || data.refreshToken;
    this.tokenType = data.token_type || data.tokenType || 'Bearer';
    this.expiresIn = data.expires_in || data.expiresIn;
    this.expiresAt = data.expires_at || data.expiresAt || this.calculateExpiresAt();
    this.scope = data.scope || '';
    this.accountId = data.account_id || data.accountId;
    this.createdAt = data.created_at || data.createdAt || new Date().toISOString();
    this.lastRefreshAt = data.last_refresh_at || data.lastRefreshAt;
    this.lastRefreshError = data.last_refresh_error || data.lastRefreshError;
  }

  calculateExpiresAt() {
    if (!this.expiresIn) return null;
    return new Date(Date.now() + (this.expiresIn * 1000)).toISOString();
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date(this.expiresAt) < new Date();
  }

  isExpiring() {
    if (!this.expiresAt) return false;
    const expiryTime = new Date(this.expiresAt).getTime();
    return (expiryTime - Date.now()) < CONFIG.REFRESH_BUFFER_MS;
  }

  getHealth() {
    if (this.lastRefreshError) {
      return CONFIG.HEALTH_STATES.ERROR;
    }
    if (this.isExpired()) {
      return CONFIG.HEALTH_STATES.EXPIRED;
    }
    if (this.isExpiring()) {
      return CONFIG.HEALTH_STATES.EXPIRING;
    }
    return CONFIG.HEALTH_STATES.HEALTHY;
  }

  getTimeUntilExpiry() {
    if (!this.expiresAt) return null;
    return Math.max(0, new Date(this.expiresAt).getTime() - Date.now());
  }

  toJSON() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenType: this.tokenType,
      expiresIn: this.expiresIn,
      expiresAt: this.expiresAt,
      scope: this.scope,
      accountId: this.accountId,
      createdAt: this.createdAt,
      lastRefreshAt: this.lastRefreshAt,
      lastRefreshError: this.lastRefreshError
    };
  }
}

/**
 * OAuth Session class for tracking in-progress OAuth flows
 */
class OAuthSession {
  constructor(data) {
    this.id = data.id || crypto.randomBytes(16).toString('hex');
    this.state = data.state;
    this.codeVerifier = data.codeVerifier;
    this.codeChallenge = data.codeChallenge;
    this.redirectUri = data.redirectUri;
    this.accountId = data.accountId;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || new Date(Date.now() + CONFIG.SESSION_TTL_MS).toISOString();
  }

  isExpired() {
    return new Date(this.expiresAt) < new Date();
  }
}

/**
 * OAuth Service class
 */
class OAuthService extends EventEmitter {
  /**
   * Create a new OAuth Service
   * @param {Object} options
   * @param {string} [options.dbPath] - Path to database
   * @param {string} [options.clientId] - OAuth client ID
   * @param {string} [options.clientSecret] - OAuth client secret (optional for PKCE)
   */
  constructor(options = {}) {
    super();

    const defaultDbPath = path.join(
      os.homedir(),
      '.dragon-ui',
      'oauth.db'
    );

    this.dbPath = options.dbPath || defaultDbPath;
    this.clientId = options.clientId || process.env.DRAGON_UI_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.DRAGON_UI_CLIENT_SECRET;
    this.db = null;
    this.healthCheckInterval = null;
    this.callbackServer = null;

    this.init();
  }

  /**
   * Initialize the database
   */
  init() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');

      this.createTables();
      this.prepareStatements();

    } catch (error) {
      throw new Error(`Failed to initialize OAuth database: ${error.message}`);
    }
  }

  /**
   * Create database tables
   */
  createTables() {
    // OAuth tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type TEXT DEFAULT 'Bearer',
        expires_in INTEGER,
        expires_at DATETIME,
        scope TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_refresh_at DATETIME,
        last_refresh_error TEXT
      )
    `);

    // OAuth sessions table (for in-progress flows)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL UNIQUE,
        code_verifier TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        redirect_uri TEXT,
        account_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_account ON oauth_tokens(account_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
      CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
      CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);
    `);
  }

  /**
   * Prepare SQL statements
   */
  prepareStatements() {
    this.stmts = {
      // Token operations
      insertToken: this.db.prepare(`
        INSERT INTO oauth_tokens (account_id, access_token, refresh_token, token_type, expires_in, expires_at, scope)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
          token_type = excluded.token_type,
          expires_in = excluded.expires_in,
          expires_at = excluded.expires_at,
          scope = excluded.scope,
          updated_at = CURRENT_TIMESTAMP
      `),

      getToken: this.db.prepare(`
        SELECT * FROM oauth_tokens WHERE account_id = ?
      `),

      getAllTokens: this.db.prepare(`
        SELECT * FROM oauth_tokens ORDER BY created_at DESC
      `),

      updateTokenRefresh: this.db.prepare(`
        UPDATE oauth_tokens
        SET last_refresh_at = CURRENT_TIMESTAMP,
            last_refresh_error = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `),

      updateTokenError: this.db.prepare(`
        UPDATE oauth_tokens
        SET last_refresh_error = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE account_id = ?
      `),

      deleteToken: this.db.prepare(`
        DELETE FROM oauth_tokens WHERE account_id = ?
      `),

      getExpiringTokens: this.db.prepare(`
        SELECT * FROM oauth_tokens
        WHERE expires_at IS NOT NULL
          AND datetime(expires_at) < datetime('now', '+30 minutes')
          AND datetime(expires_at) > datetime('now')
      `),

      getExpiredTokens: this.db.prepare(`
        SELECT * FROM oauth_tokens
        WHERE expires_at IS NOT NULL
          AND datetime(expires_at) <= datetime('now')
      `),

      // Session operations
      insertSession: this.db.prepare(`
        INSERT INTO oauth_sessions (id, state, code_verifier, code_challenge, redirect_uri, account_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      getSessionByState: this.db.prepare(`
        SELECT * FROM oauth_sessions WHERE state = ?
      `),

      deleteSession: this.db.prepare(`
        DELETE FROM oauth_sessions WHERE id = ?
      `),

      deleteExpiredSessions: this.db.prepare(`
        DELETE FROM oauth_sessions WHERE datetime(expires_at) < datetime('now')
      `),

      cleanupSessions: this.db.prepare(`
        DELETE FROM oauth_sessions WHERE datetime(expires_at) < datetime('now')
      `)
    };
  }

  /**
   * Start OAuth authorization flow
   * @param {Object} options
   * @param {string} [options.accountId] - Account identifier
   * @param {string[]} [options.scopes] - Requested scopes
   * @returns {Promise<{authUrl: string, session: OAuthSession}>}
   */
  async startAuthFlow(options = {}) {
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    // Create callback URI
    const redirectUri = `http://localhost:${CONFIG.CALLBACK_PORT}${CONFIG.CALLBACK_PATH}`;

    // Create session
    const session = new OAuthSession({
      state,
      codeVerifier,
      codeChallenge,
      redirectUri,
      accountId: options.accountId
    });

    // Store session
    this.stmts.insertSession.run(
      session.id,
      session.state,
      session.codeVerifier,
      session.codeChallenge,
      session.redirectUri,
      session.accountId,
      session.expiresAt
    );

    // Build authorization URL
    const authUrl = this.buildAuthUrl({
      clientId: this.clientId,
      redirectUri,
      state,
      codeChallenge,
      scopes: options.scopes || ['read', 'write']
    });

    return { authUrl, session };
  }

  /**
   * Build OAuth authorization URL
   * @private
   */
  buildAuthUrl(params) {
    const url = new URL(CONFIG.ANTHROPIC_AUTH_URL);
    url.searchParams.set('client_id', params.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (params.scopes) {
      url.searchParams.set('scope', params.scopes.join(' '));
    }
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code
   * @param {string} state - State parameter
   * @returns {Promise<OAuthToken>}
   */
  async exchangeCode(code, state) {
    // Get session by state
    const sessionRow = this.stmts.getSessionByState.get(state);
    if (!sessionRow) {
      throw new Error('Invalid state parameter - session not found');
    }

    const session = new OAuthSession({
      id: sessionRow.id,
      state: sessionRow.state,
      codeVerifier: sessionRow.code_verifier,
      codeChallenge: sessionRow.code_challenge,
      redirectUri: sessionRow.redirect_uri,
      accountId: sessionRow.account_id,
      createdAt: sessionRow.created_at,
      expiresAt: sessionRow.expires_at
    });

    if (session.isExpired()) {
      this.stmts.deleteSession.run(session.id);
      throw new Error('OAuth session expired');
    }

    // Exchange code for tokens
    const tokenResponse = await this.requestTokens({
      grantType: 'authorization_code',
      code,
      redirectUri: session.redirectUri,
      codeVerifier: session.codeVerifier
    });

    // Create token object
    const token = new OAuthToken({
      ...tokenResponse,
      accountId: session.accountId || tokenResponse.account_id || 'default'
    });

    // Store token
    this.storeToken(token);

    // Delete session
    this.stmts.deleteSession.run(session.id);

    this.emit('token_acquired', token);
    return token;
  }

  /**
   * Request tokens from OAuth server
   * @private
   */
  async requestTokens(params) {
    return new Promise((resolve, reject) => {
      const url = new URL(CONFIG.ANTHROPIC_TOKEN_URL);

      const body = new URLSearchParams();
      body.set('grant_type', params.grantType);
      body.set('client_id', this.clientId);

      if (params.code) {
        body.set('code', params.code);
        body.set('redirect_uri', params.redirectUri);
        body.set('code_verifier', params.codeVerifier);
      }

      if (params.refreshToken) {
        body.set('refresh_token', params.refreshToken);
      }

      if (this.clientSecret) {
        body.set('client_secret', this.clientSecret);
      }

      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body.toString())
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(json.error_description || json.error || 'Token request failed'));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(new Error('Invalid token response'));
          }
        });
      });

      req.on('error', reject);
      req.write(body.toString());
      req.end();
    });
  }

  /**
   * Store token in database
   * @param {OAuthToken} token
   */
  storeToken(token) {
    this.stmts.insertToken.run(
      token.accountId,
      token.accessToken,
      token.refreshToken,
      token.tokenType,
      token.expiresIn,
      token.expiresAt,
      token.scope
    );
  }

  /**
   * Get token for account
   * @param {string} accountId
   * @returns {OAuthToken|null}
   */
  getToken(accountId) {
    const row = this.stmts.getToken.get(accountId);
    if (!row) return null;

    return new OAuthToken({
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenType: row.token_type,
      expiresIn: row.expires_in,
      expiresAt: row.expires_at,
      scope: row.scope,
      accountId: row.account_id,
      createdAt: row.created_at,
      lastRefreshAt: row.last_refresh_at,
      lastRefreshError: row.last_refresh_error
    });
  }

  /**
   * Get all tokens
   * @returns {OAuthToken[]}
   */
  getAllTokens() {
    const rows = this.stmts.getAllTokens.all();
    return rows.map(row => new OAuthToken({
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenType: row.token_type,
      expiresIn: row.expires_in,
      expiresAt: row.expires_at,
      scope: row.scope,
      accountId: row.account_id,
      createdAt: row.created_at,
      lastRefreshAt: row.last_refresh_at,
      lastRefreshError: row.last_refresh_error
    }));
  }

  /**
   * Refresh a token
   * @param {string} accountId
   * @returns {Promise<OAuthToken>}
   */
  async refreshToken(accountId) {
    const token = this.getToken(accountId);
    if (!token) {
      throw new Error(`No token found for account: ${accountId}`);
    }

    if (!token.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const tokenResponse = await this.requestTokens({
        grantType: 'refresh_token',
        refreshToken: token.refreshToken
      });

      const newToken = new OAuthToken({
        ...tokenResponse,
        accountId,
        refreshToken: tokenResponse.refresh_token || token.refreshToken
      });

      this.storeToken(newToken);
      this.stmts.updateTokenRefresh.run(accountId);

      this.emit('token_refreshed', newToken);
      return newToken;

    } catch (error) {
      this.stmts.updateTokenError.run(error.message, accountId);
      this.emit('token_refresh_error', { accountId, error });
      throw error;
    }
  }

  /**
   * Revoke a token
   * @param {string} accountId
   * @returns {Promise<boolean>}
   */
  async revokeToken(accountId) {
    const token = this.getToken(accountId);
    if (!token) {
      return false;
    }

    try {
      // Revoke on server
      await this.revokeTokenOnServer(token.accessToken);
    } catch (error) {
      // Log but continue to delete locally
      console.error('Failed to revoke token on server:', error.message);
    }

    // Delete locally
    this.stmts.deleteToken.run(accountId);
    this.emit('token_revoked', accountId);
    return true;
  }

  /**
   * Revoke token on OAuth server
   * @private
   */
  async revokeTokenOnServer(accessToken) {
    return new Promise((resolve, reject) => {
      const url = new URL(CONFIG.ANTHROPIC_REVOKE_URL);

      const body = new URLSearchParams();
      body.set('token', accessToken);
      body.set('client_id', this.clientId);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body.toString())
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error('Revocation failed'));
          } else {
            resolve(true);
          }
        });
      });

      req.on('error', reject);
      req.write(body.toString());
      req.end();
    });
  }

  /**
   * Start health check scheduler
   */
  startHealthCheck() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.checkAndRefreshTokens();
    }, CONFIG.HEALTH_CHECK_INTERVAL);

    // Run immediately
    this.checkAndRefreshTokens();
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
   * Check and refresh expiring tokens
   */
  async checkAndRefreshTokens() {
    const expiringTokens = this.stmts.getExpiringTokens.all();

    for (const row of expiringTokens) {
      try {
        await this.refreshToken(row.account_id);
      } catch (error) {
        this.emit('auto_refresh_error', {
          accountId: row.account_id,
          error
        });
      }
    }

    // Cleanup expired sessions
    this.stmts.cleanupSessions.run();
  }

  /**
   * Get token health status
   * @param {string} accountId
   * @returns {Object}
   */
  getTokenHealth(accountId) {
    const token = this.getToken(accountId);
    if (!token) {
      return {
        accountId,
        status: CONFIG.HEALTH_STATES.UNKNOWN,
        hasToken: false
      };
    }

    return {
      accountId,
      status: token.getHealth(),
      hasToken: true,
      expiresAt: token.expiresAt,
      timeUntilExpiry: token.getTimeUntilExpiry(),
      lastRefreshAt: token.lastRefreshAt,
      lastRefreshError: token.lastRefreshError
    };
  }

  /**
   * Get all token health statuses
   * @returns {Object[]}
   */
  getAllTokenHealth() {
    const tokens = this.getAllTokens();
    return tokens.map(token => ({
      accountId: token.accountId,
      status: token.getHealth(),
      expiresAt: token.expiresAt,
      timeUntilExpiry: token.getTimeUntilExpiry(),
      lastRefreshAt: token.lastRefreshAt,
      lastRefreshError: token.lastRefreshError
    }));
  }

  /**
   * Start local callback server for OAuth
   * @returns {Promise<{port: number, url: string}>}
   */
  async startCallbackServer() {
    return new Promise((resolve, reject) => {
      if (this.callbackServer) {
        resolve({
          port: CONFIG.CALLBACK_PORT,
          url: `http://localhost:${CONFIG.CALLBACK_PORT}${CONFIG.CALLBACK_PATH}`
        });
        return;
      }

      this.callbackServer = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost:${CONFIG.CALLBACK_PORT}`);

        if (url.pathname === CONFIG.CALLBACK_PATH) {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>OAuth Error</h1><p>${error}</p></body></html>`);
            this.emit('oauth_error', error);
            return;
          }

          if (code && state) {
            this.exchangeCode(code, state)
              .then(token => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: system-ui; text-align: center; padding: 50px;">
                      <h1 style="color: green;">Authorization Successful!</h1>
                      <p>You can close this window now.</p>
                      <script>setTimeout(() => window.close(), 3000)</script>
                    </body>
                  </html>
                `);
                this.emit('oauth_success', token);
              })
              .catch(err => {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<html><body><h1>Error</h1><p>${err.message}</p></body></html>`);
                this.emit('oauth_error', err);
              });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Invalid Request</h1></body></html>');
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.callbackServer.listen(CONFIG.CALLBACK_PORT, () => {
        resolve({
          port: CONFIG.CALLBACK_PORT,
          url: `http://localhost:${CONFIG.CALLBACK_PORT}${CONFIG.CALLBACK_PATH}`
        });
      });

      this.callbackServer.on('error', reject);
    });
  }

  /**
   * Stop callback server
   */
  stopCallbackServer() {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  /**
   * Get database info
   * @returns {Object}
   */
  getDbInfo() {
    const tokenCount = this.db.prepare('SELECT COUNT(*) as count FROM oauth_tokens').get();
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM oauth_sessions').get();
    const healthyCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM oauth_tokens
      WHERE expires_at IS NULL OR datetime(expires_at) > datetime('now', '+30 minutes')
    `).get();

    return {
      totalTokens: tokenCount?.count || 0,
      activeSessions: sessionCount?.count || 0,
      healthyTokens: healthyCount?.count || 0,
      dbPath: this.dbPath
    };
  }

  /**
   * Close the service
   */
  close() {
    this.stopHealthCheck();
    this.stopCallbackServer();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create OAuth Service instance
 * @param {Object} [options]
 * @returns {OAuthService}
 */
function getOAuthService(options) {
  if (!instance) {
    instance = new OAuthService(options);
  }
  return instance;
}

module.exports = {
  OAuthService,
  OAuthToken,
  OAuthSession,
  getOAuthService,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  CONFIG
};
