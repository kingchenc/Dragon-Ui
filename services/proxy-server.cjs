/**
 * Proxy Server for Dragon-UI
 * HTTP/HTTPS reverse proxy with streaming support for Claude API
 *
 * @module services/proxy-server
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const EventEmitter = require('events');
const { getLoadBalancer, ACCOUNT_STATUS } = require('./load-balancer.cjs');
const crypto = require('crypto');

/**
 * Default proxy configuration
 */
const DEFAULT_CONFIG = {
  port: 8787,
  host: '127.0.0.1',
  targetHost: 'api.anthropic.com',
  targetPort: 443,
  useHttps: true,
  timeout: 300000, // 5 minutes for long requests
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 50,
  requestTimeout: 60000,
  streamingTimeout: 300000,
  enableCors: true,
  corsOrigin: '*',
  logRequests: true,
  retryOnRateLimit: true,
  maxRetries: 3,
  retryDelay: 1000
};

/**
 * Rate limit response patterns
 */
const RATE_LIMIT_PATTERNS = {
  statusCode: 429,
  headers: ['x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'],
  bodyPatterns: [
    /rate.?limit/i,
    /too.?many.?requests/i,
    /quota.?exceeded/i,
    /overloaded/i
  ]
};

/**
 * Error response patterns
 */
const ERROR_PATTERNS = {
  unauthorized: [401],
  forbidden: [403],
  notFound: [404],
  serverError: [500, 502, 503, 504]
};

/**
 * Create HTTPS agent with keep-alive
 * @param {Object} config
 * @returns {https.Agent}
 */
function createAgent(config) {
  return new https.Agent({
    keepAlive: config.keepAlive,
    keepAliveMsecs: config.keepAliveMsecs,
    maxSockets: config.maxSockets,
    timeout: config.timeout
  });
}

/**
 * Generate unique request ID
 * @returns {string}
 */
function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Parse rate limit headers
 * @param {Object} headers - Response headers
 * @returns {Object} - Parsed rate limit info
 */
function parseRateLimitHeaders(headers) {
  const info = {
    limited: false,
    remaining: null,
    resetTime: null,
    retryAfter: null
  };

  if (headers['x-ratelimit-remaining']) {
    info.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    info.limited = info.remaining === 0;
  }

  if (headers['x-ratelimit-reset']) {
    info.resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
  }

  if (headers['retry-after']) {
    const retryAfter = headers['retry-after'];
    if (/^\d+$/.test(retryAfter)) {
      info.retryAfter = parseInt(retryAfter, 10) * 1000;
    } else {
      info.retryAfter = new Date(retryAfter).getTime() - Date.now();
    }
  }

  return info;
}

/**
 * Check if response body indicates rate limit
 * @param {string} body - Response body
 * @returns {boolean}
 */
function isRateLimitBody(body) {
  if (!body) return false;
  return RATE_LIMIT_PATTERNS.bodyPatterns.some(pattern => pattern.test(body));
}

/**
 * Proxy Request class
 */
class ProxyRequest {
  constructor(req, res, config, requestId) {
    this.req = req;
    this.res = res;
    this.config = config;
    this.requestId = requestId;
    this.startTime = Date.now();
    this.accountId = null;
    this.retryCount = 0;
    this.bytesReceived = 0;
    this.bytesSent = 0;
    this.isStreaming = false;
    this.aborted = false;
  }

  /**
   * Get request duration
   * @returns {number}
   */
  getDuration() {
    return Date.now() - this.startTime;
  }

  /**
   * Get request metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      requestId: this.requestId,
      method: this.req.method,
      url: this.req.url,
      accountId: this.accountId,
      duration: this.getDuration(),
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
      retryCount: this.retryCount,
      isStreaming: this.isStreaming
    };
  }
}

/**
 * Proxy Server class
 */
class ProxyServer extends EventEmitter {
  /**
   * Create a proxy server
   * @param {Object} config
   */
  constructor(config = {}) {
    super();

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadBalancer = getLoadBalancer();
    this.server = null;
    this.agent = createAgent(this.config);
    this.activeRequests = new Map();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      retriedRequests: 0,
      bytesReceived: 0,
      bytesSent: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Start the proxy server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.server.on('clientError', (error, socket) => {
        this.emit('client_error', error);
        if (socket.writable) {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.emit('listening', {
          host: this.config.host,
          port: this.config.port
        });
        resolve();
      });
    });
  }

  /**
   * Stop the proxy server
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      // Abort all active requests
      for (const [requestId, proxyReq] of this.activeRequests) {
        proxyReq.aborted = true;
        if (!proxyReq.res.headersSent) {
          proxyReq.res.writeHead(503, { 'Content-Type': 'application/json' });
          proxyReq.res.end(JSON.stringify({ error: 'Server shutting down' }));
        }
      }

      this.server.close(() => {
        this.agent.destroy();
        this.emit('closed');
        resolve();
      });
    });
  }

  /**
   * Handle incoming request
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async handleRequest(req, res) {
    const requestId = generateRequestId();
    const proxyReq = new ProxyRequest(req, res, this.config, requestId);

    this.activeRequests.set(requestId, proxyReq);
    this.stats.totalRequests++;

    // Add CORS headers
    if (this.config.enableCors) {
      this.setCorsHeaders(res);
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      this.activeRequests.delete(requestId);
      return;
    }

    // Log request start
    if (this.config.logRequests) {
      this.emit('request_start', {
        requestId,
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers)
      });
    }

    try {
      await this.proxyRequest(proxyReq);
    } catch (error) {
      this.handleError(proxyReq, error);
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Set CORS headers
   * @param {http.ServerResponse} res
   */
  setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Session-ID, anthropic-version');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Account-ID');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * Sanitize headers for logging
   * @param {Object} headers
   * @returns {Object}
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Extract session ID from request
   * @param {http.IncomingMessage} req
   * @returns {string|null}
   */
  extractSessionId(req) {
    // Check header first
    if (req.headers['x-session-id']) {
      return req.headers['x-session-id'];
    }

    // Check query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.searchParams.has('session_id')) {
      return url.searchParams.get('session_id');
    }

    return null;
  }

  /**
   * Proxy the request to target
   * @param {ProxyRequest} proxyReq
   */
  async proxyRequest(proxyReq) {
    const { req, res, config, requestId } = proxyReq;

    // Get session ID for sticky routing
    const sessionId = this.extractSessionId(req);

    // Select account from load balancer
    const account = this.loadBalancer.selectAccount({ sessionId });

    if (!account) {
      throw new Error('No available accounts');
    }

    proxyReq.accountId = account.id;
    this.loadBalancer.startConnection(account.id);

    // Collect request body
    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
      proxyReq.bytesReceived += chunk.length;
    }
    const body = Buffer.concat(bodyChunks);

    // Check if streaming request
    proxyReq.isStreaming = this.isStreamingRequest(req, body);

    // Perform the proxied request
    await this.performProxyRequest(proxyReq, account, body, sessionId);
  }

  /**
   * Check if request is for streaming
   * @param {http.IncomingMessage} req
   * @param {Buffer} body
   * @returns {boolean}
   */
  isStreamingRequest(req, body) {
    // Check Accept header
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      return true;
    }

    // Check request body for stream: true
    if (body.length > 0) {
      try {
        const parsed = JSON.parse(body.toString());
        return parsed.stream === true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Perform the actual proxied request
   * @param {ProxyRequest} proxyReq
   * @param {Account} account
   * @param {Buffer} body
   * @param {string|null} sessionId
   */
  async performProxyRequest(proxyReq, account, body, sessionId) {
    const { req, res, config, requestId } = proxyReq;

    return new Promise((resolve, reject) => {
      const targetUrl = new URL(req.url, `https://${config.targetHost}`);

      const options = {
        hostname: config.targetHost,
        port: config.targetPort,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: this.buildTargetHeaders(req, account, body),
        agent: this.agent,
        timeout: proxyReq.isStreaming ? config.streamingTimeout : config.requestTimeout
      };

      const proxyRequest = https.request(options, (proxyResponse) => {
        this.handleProxyResponse(proxyReq, proxyResponse, account, body, sessionId)
          .then(resolve)
          .catch(reject);
      });

      proxyRequest.on('error', async (error) => {
        // Try failover
        if (config.retryOnRateLimit && proxyReq.retryCount < config.maxRetries) {
          proxyReq.retryCount++;
          this.stats.retriedRequests++;

          this.loadBalancer.recordFailure(account.id, error.message, false);
          const failoverAccount = this.loadBalancer.getFailoverAccount(account.id, sessionId);

          if (failoverAccount) {
            this.emit('failover', {
              requestId,
              from: account.id,
              to: failoverAccount.id,
              reason: error.message
            });

            await new Promise(r => setTimeout(r, config.retryDelay * proxyReq.retryCount));

            try {
              await this.performProxyRequest(proxyReq, failoverAccount, body, sessionId);
              resolve();
            } catch (retryError) {
              reject(retryError);
            }
            return;
          }
        }

        reject(error);
      });

      proxyRequest.on('timeout', () => {
        proxyRequest.destroy();
        reject(new Error('Request timeout'));
      });

      // Write request body
      if (body.length > 0) {
        proxyRequest.write(body);
      }
      proxyRequest.end();
    });
  }

  /**
   * Build headers for target request
   * @param {http.IncomingMessage} req
   * @param {Account} account
   * @param {Buffer} body
   * @returns {Object}
   */
  buildTargetHeaders(req, account, body) {
    const headers = { ...req.headers };

    // Remove hop-by-hop headers
    delete headers['host'];
    delete headers['connection'];
    delete headers['keep-alive'];
    delete headers['proxy-authenticate'];
    delete headers['proxy-authorization'];
    delete headers['te'];
    delete headers['trailers'];
    delete headers['transfer-encoding'];
    delete headers['upgrade'];

    // Set correct host
    headers['host'] = this.config.targetHost;

    // Set authorization from account
    if (account.apiKey) {
      headers['x-api-key'] = account.apiKey;
      headers['authorization'] = `Bearer ${account.apiKey}`;
    }

    // Set content length
    if (body.length > 0) {
      headers['content-length'] = body.length.toString();
    }

    return headers;
  }

  /**
   * Handle proxy response
   * @param {ProxyRequest} proxyReq
   * @param {http.IncomingMessage} proxyResponse
   * @param {Account} account
   * @param {Buffer} body
   * @param {string|null} sessionId
   */
  async handleProxyResponse(proxyReq, proxyResponse, account, body, sessionId) {
    const { req, res, config, requestId } = proxyReq;

    // Check for rate limit
    const rateLimitInfo = parseRateLimitHeaders(proxyResponse.headers);
    const isRateLimited = proxyResponse.statusCode === RATE_LIMIT_PATTERNS.statusCode;

    if (isRateLimited) {
      this.stats.rateLimitedRequests++;

      // Calculate cooldown duration
      const cooldownDuration = rateLimitInfo.retryAfter ||
                               (rateLimitInfo.resetTime ? rateLimitInfo.resetTime - Date.now() : 3600000);

      this.loadBalancer.recordFailure(account.id, 'Rate limited', true);

      this.emit('rate_limited', {
        requestId,
        accountId: account.id,
        resetTime: rateLimitInfo.resetTime,
        retryAfter: rateLimitInfo.retryAfter
      });

      // Try failover if enabled
      if (config.retryOnRateLimit && proxyReq.retryCount < config.maxRetries) {
        proxyReq.retryCount++;
        this.stats.retriedRequests++;

        const failoverAccount = this.loadBalancer.getFailoverAccount(account.id, sessionId);

        if (failoverAccount) {
          this.emit('failover', {
            requestId,
            from: account.id,
            to: failoverAccount.id,
            reason: 'Rate limited'
          });

          await new Promise(r => setTimeout(r, config.retryDelay * proxyReq.retryCount));

          await this.performProxyRequest(proxyReq, failoverAccount, body, sessionId);
          return;
        }
      }
    }

    // Build response headers
    const responseHeaders = { ...proxyResponse.headers };
    delete responseHeaders['transfer-encoding']; // Let Node.js handle this

    // Add custom headers
    responseHeaders['x-request-id'] = requestId;
    responseHeaders['x-account-id'] = account.id;

    if (rateLimitInfo.remaining !== null) {
      responseHeaders['x-ratelimit-remaining'] = rateLimitInfo.remaining.toString();
    }

    // Write response head
    res.writeHead(proxyResponse.statusCode, proxyResponse.statusMessage, responseHeaders);

    // Stream response
    if (proxyReq.isStreaming) {
      await this.streamResponse(proxyReq, proxyResponse, account);
    } else {
      await this.bufferResponse(proxyReq, proxyResponse, account);
    }

    // Record success/failure
    if (proxyResponse.statusCode >= 200 && proxyResponse.statusCode < 300) {
      this.loadBalancer.recordSuccess(account.id);
      this.stats.successfulRequests++;
    } else if (!isRateLimited) {
      this.loadBalancer.recordFailure(account.id, `HTTP ${proxyResponse.statusCode}`, false);
      this.stats.failedRequests++;
    }

    // Update stats
    this.stats.bytesReceived += proxyReq.bytesReceived;
    this.stats.bytesSent += proxyReq.bytesSent;
    this.updateAvgResponseTime(proxyReq.getDuration());

    // End connection tracking
    this.loadBalancer.endConnection(account.id);

    // Log completion
    if (this.config.logRequests) {
      this.emit('request_complete', proxyReq.getMetadata());
    }
  }

  /**
   * Stream response to client
   * @param {ProxyRequest} proxyReq
   * @param {http.IncomingMessage} proxyResponse
   * @param {Account} account
   */
  async streamResponse(proxyReq, proxyResponse, account) {
    const { res } = proxyReq;

    return new Promise((resolve, reject) => {
      let responseBody = '';

      proxyResponse.on('data', (chunk) => {
        if (proxyReq.aborted) return;

        proxyReq.bytesSent += chunk.length;
        responseBody += chunk.toString();

        // Write immediately for streaming
        res.write(chunk);

        this.emit('stream_chunk', {
          requestId: proxyReq.requestId,
          accountId: account.id,
          chunkSize: chunk.length
        });
      });

      proxyResponse.on('end', () => {
        if (!proxyReq.aborted) {
          res.end();
        }

        // Check for rate limit in body (some APIs return 200 with rate limit message)
        if (isRateLimitBody(responseBody)) {
          this.loadBalancer.recordFailure(account.id, 'Rate limit in response body', true);
          this.emit('rate_limited_body', {
            requestId: proxyReq.requestId,
            accountId: account.id
          });
        }

        resolve();
      });

      proxyResponse.on('error', (error) => {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Upstream error' }));
        }
        reject(error);
      });
    });
  }

  /**
   * Buffer response and send at once
   * @param {ProxyRequest} proxyReq
   * @param {http.IncomingMessage} proxyResponse
   * @param {Account} account
   */
  async bufferResponse(proxyReq, proxyResponse, account) {
    const { res } = proxyReq;

    return new Promise((resolve, reject) => {
      const chunks = [];

      proxyResponse.on('data', (chunk) => {
        if (proxyReq.aborted) return;
        chunks.push(chunk);
        proxyReq.bytesSent += chunk.length;
      });

      proxyResponse.on('end', () => {
        if (proxyReq.aborted) {
          resolve();
          return;
        }

        const responseBody = Buffer.concat(chunks);

        // Check for rate limit in body
        if (isRateLimitBody(responseBody.toString())) {
          this.loadBalancer.recordFailure(account.id, 'Rate limit in response body', true);
          this.emit('rate_limited_body', {
            requestId: proxyReq.requestId,
            accountId: account.id
          });
        }

        res.end(responseBody);
        resolve();
      });

      proxyResponse.on('error', (error) => {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: 'Upstream error' }));
        }
        reject(error);
      });
    });
  }

  /**
   * Handle request error
   * @param {ProxyRequest} proxyReq
   * @param {Error} error
   */
  handleError(proxyReq, error) {
    const { res, requestId, accountId } = proxyReq;

    this.stats.failedRequests++;

    if (accountId) {
      this.loadBalancer.recordFailure(accountId, error.message, false);
      this.loadBalancer.endConnection(accountId);
    }

    this.emit('request_error', {
      requestId,
      accountId,
      error: error.message,
      duration: proxyReq.getDuration()
    });

    if (!res.headersSent) {
      const statusCode = error.message === 'No available accounts' ? 503 : 502;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: error.message,
        requestId
      }));
    }
  }

  /**
   * Update average response time
   * @param {number} duration
   */
  updateAvgResponseTime(duration) {
    const total = this.stats.successfulRequests + this.stats.failedRequests;
    if (total === 0) {
      this.stats.avgResponseTime = duration;
    } else {
      this.stats.avgResponseTime =
        (this.stats.avgResponseTime * (total - 1) + duration) / total;
    }
  }

  /**
   * Get server statistics
   * @returns {Object}
   */
  getStats() {
    const lbStats = this.loadBalancer.getStats();

    return {
      proxy: {
        ...this.stats,
        activeRequests: this.activeRequests.size,
        uptime: this.server ? process.uptime() : 0
      },
      loadBalancer: lbStats
    };
  }

  /**
   * Get active requests
   * @returns {Object[]}
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.values()).map(r => r.getMetadata());
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      retriedRequests: 0,
      bytesReceived: 0,
      bytesSent: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Check if server is running
   * @returns {boolean}
   */
  isRunning() {
    return this.server !== null && this.server.listening;
  }

  /**
   * Get server info
   * @returns {Object}
   */
  getInfo() {
    return {
      host: this.config.host,
      port: this.config.port,
      targetHost: this.config.targetHost,
      targetPort: this.config.targetPort,
      running: this.isRunning(),
      config: {
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
        enableCors: this.config.enableCors,
        logRequests: this.config.logRequests
      }
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create Proxy Server instance
 * @param {Object} [config]
 * @returns {ProxyServer}
 */
function getProxyServer(config) {
  if (!instance) {
    instance = new ProxyServer(config);
  }
  return instance;
}

module.exports = {
  ProxyServer,
  ProxyRequest,
  getProxyServer,
  parseRateLimitHeaders,
  isRateLimitBody,
  RATE_LIMIT_PATTERNS,
  ERROR_PATTERNS,
  DEFAULT_CONFIG
};
