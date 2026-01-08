/**
 * Real-time Dashboard Service for Dragon-UI
 * Live request streaming with SSE/WebSocket updates
 *
 * @module services/realtime-dashboard
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Event types for real-time updates
 */
const EVENT_TYPE = {
  REQUEST_START: 'request:start',
  REQUEST_COMPLETE: 'request:complete',
  REQUEST_FAIL: 'request:fail',
  STATS_UPDATE: 'stats:update',
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  RATE_LIMIT: 'rate:limit',
  HEARTBEAT: 'heartbeat'
};

/**
 * Dashboard state
 */
const DASHBOARD_STATE = {
  STOPPED: 'stopped',
  RUNNING: 'running',
  PAUSED: 'paused'
};

/**
 * Real-time event stream
 */
class EventStream extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
    this.eventId = 0;
  }

  /**
   * Emit event to all subscribers
   * @param {string} type
   * @param {Object} data
   */
  broadcast(type, data) {
    const event = {
      id: ++this.eventId,
      type,
      data,
      timestamp: new Date().toISOString()
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to all subscribers
    this.emit('event', event);

    // Notify each subscriber
    for (const [id, subscriber] of this.subscribers) {
      try {
        subscriber.callback(event);
      } catch (error) {
        console.error(`[EventStream] Error notifying subscriber ${id}:`, error.message);
      }
    }
  }

  /**
   * Subscribe to events
   * @param {Function} callback
   * @returns {string}
   */
  subscribe(callback) {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.subscribers.set(id, {
      id,
      callback,
      subscribedAt: new Date().toISOString()
    });
    return id;
  }

  /**
   * Unsubscribe from events
   * @param {string} id
   */
  unsubscribe(id) {
    this.subscribers.delete(id);
  }

  /**
   * Get recent events
   * @param {number} count
   * @returns {Array}
   */
  getRecentEvents(count = 50) {
    return this.eventHistory.slice(-count);
  }

  /**
   * Get events after specific ID
   * @param {number} afterId
   * @returns {Array}
   */
  getEventsAfter(afterId) {
    return this.eventHistory.filter(e => e.id > afterId);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
  }

  /**
   * Get subscriber count
   * @returns {number}
   */
  getSubscriberCount() {
    return this.subscribers.size;
  }
}

/**
 * Real-time statistics tracker
 */
class RealtimeStats {
  constructor() {
    this.reset();
    this.history = [];
    this.maxHistorySize = 60; // 60 snapshots (30 minutes at 30s intervals)
  }

  /**
   * Reset statistics
   */
  reset() {
    this.startTime = Date.now();
    this.requests = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0
    };
    this.tokens = {
      input: 0,
      output: 0,
      cached: 0
    };
    this.cost = 0;
    this.responseTime = {
      total: 0,
      count: 0,
      min: Infinity,
      max: 0
    };
    this.byModel = new Map();
    this.byStatus = new Map();
    this.activeRequests = new Map();
  }

  /**
   * Record request start
   * @param {Object} request
   */
  recordRequestStart(request) {
    this.requests.total++;
    this.requests.pending++;
    this.activeRequests.set(request.id, {
      ...request,
      startTime: Date.now()
    });
  }

  /**
   * Record request complete
   * @param {Object} request
   */
  recordRequestComplete(request) {
    this.requests.pending = Math.max(0, this.requests.pending - 1);

    if (request.statusCode >= 200 && request.statusCode < 400) {
      this.requests.success++;
    } else {
      this.requests.failed++;
    }

    // Update response time
    if (request.duration) {
      this.responseTime.total += request.duration;
      this.responseTime.count++;
      this.responseTime.min = Math.min(this.responseTime.min, request.duration);
      this.responseTime.max = Math.max(this.responseTime.max, request.duration);
    }

    // Update tokens
    if (request.tokens) {
      this.tokens.input += request.tokens.input || 0;
      this.tokens.output += request.tokens.output || 0;
      this.tokens.cached += request.tokens.cached || 0;
    }

    // Update cost
    if (request.cost) {
      this.cost += request.cost;
    }

    // Update model stats
    if (request.model) {
      const modelStats = this.byModel.get(request.model) || { count: 0, cost: 0, tokens: 0 };
      modelStats.count++;
      modelStats.cost += request.cost || 0;
      modelStats.tokens += (request.tokens?.input || 0) + (request.tokens?.output || 0);
      this.byModel.set(request.model, modelStats);
    }

    // Update status stats
    if (request.statusCode) {
      const statusCount = this.byStatus.get(request.statusCode) || 0;
      this.byStatus.set(request.statusCode, statusCount + 1);
    }

    // Remove from active
    this.activeRequests.delete(request.id);
  }

  /**
   * Record request failure
   * @param {Object} request
   */
  recordRequestFail(request) {
    this.requests.pending = Math.max(0, this.requests.pending - 1);
    this.requests.failed++;

    if (request.duration) {
      this.responseTime.total += request.duration;
      this.responseTime.count++;
    }

    this.activeRequests.delete(request.id);
  }

  /**
   * Get current snapshot
   * @returns {Object}
   */
  getSnapshot() {
    const uptime = Date.now() - this.startTime;
    const avgResponseTime = this.responseTime.count > 0
      ? this.responseTime.total / this.responseTime.count
      : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      requests: { ...this.requests },
      tokens: { ...this.tokens },
      cost: this.cost,
      responseTime: {
        avg: Math.round(avgResponseTime),
        min: this.responseTime.min === Infinity ? 0 : this.responseTime.min,
        max: this.responseTime.max
      },
      requestsPerMinute: uptime > 0 ? (this.requests.total / (uptime / 60000)).toFixed(2) : 0,
      successRate: this.requests.total > 0
        ? ((this.requests.success / this.requests.total) * 100).toFixed(2)
        : 0,
      byModel: Object.fromEntries(this.byModel),
      byStatus: Object.fromEntries(this.byStatus),
      activeRequests: this.activeRequests.size
    };
  }

  /**
   * Take snapshot and store in history
   */
  takeSnapshot() {
    const snapshot = this.getSnapshot();
    this.history.push(snapshot);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return snapshot;
  }

  /**
   * Get history
   * @param {number} count
   * @returns {Array}
   */
  getHistory(count = 60) {
    return this.history.slice(-count);
  }

  /**
   * Format duration
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

/**
 * Real-time Dashboard Server
 */
class RealtimeDashboard {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3001,
      host: options.host || '127.0.0.1',
      refreshInterval: options.refreshInterval || 30000, // 30 seconds
      heartbeatInterval: options.heartbeatInterval || 15000, // 15 seconds
      ...options
    };

    this.state = DASHBOARD_STATE.STOPPED;
    this.server = null;
    this.eventStream = new EventStream();
    this.stats = new RealtimeStats();
    this.sseClients = new Set();
    this.intervals = {
      refresh: null,
      heartbeat: null
    };
  }

  /**
   * Start the dashboard server
   * @returns {Promise<void>}
   */
  async start() {
    if (this.state === DASHBOARD_STATE.RUNNING) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        this.state = DASHBOARD_STATE.RUNNING;
        this.startIntervals();
        console.log(`[RealtimeDashboard] Server running on http://${this.options.host}:${this.options.port}`);
        resolve();
      });

      this.server.on('error', (error) => {
        console.error('[RealtimeDashboard] Server error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Stop the dashboard server
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.state === DASHBOARD_STATE.STOPPED) {
      return;
    }

    // Stop intervals
    this.stopIntervals();

    // Close all SSE connections
    for (const client of this.sseClients) {
      try {
        client.end();
      } catch (e) {
        // Ignore
      }
    }
    this.sseClients.clear();

    // Close server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.state = DASHBOARD_STATE.STOPPED;
          console.log('[RealtimeDashboard] Server stopped');
          resolve();
        });
      } else {
        this.state = DASHBOARD_STATE.STOPPED;
        resolve();
      }
    });
  }

  /**
   * Start periodic intervals
   */
  startIntervals() {
    // Stats refresh interval
    this.intervals.refresh = setInterval(() => {
      const snapshot = this.stats.takeSnapshot();
      this.eventStream.broadcast(EVENT_TYPE.STATS_UPDATE, snapshot);
      this.broadcastSSE(EVENT_TYPE.STATS_UPDATE, snapshot);
    }, this.options.refreshInterval);

    // Heartbeat interval
    this.intervals.heartbeat = setInterval(() => {
      this.broadcastSSE(EVENT_TYPE.HEARTBEAT, {
        timestamp: new Date().toISOString(),
        subscribers: this.sseClients.size
      });
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop periodic intervals
   */
  stopIntervals() {
    if (this.intervals.refresh) {
      clearInterval(this.intervals.refresh);
      this.intervals.refresh = null;
    }
    if (this.intervals.heartbeat) {
      clearInterval(this.intervals.heartbeat);
      this.intervals.heartbeat = null;
    }
  }

  /**
   * Handle HTTP request
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleRequest(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Route handling
    switch (pathname) {
      case '/':
        this.serveHomepage(res);
        break;
      case '/events':
        this.handleSSE(req, res);
        break;
      case '/stats':
        this.handleStats(res);
        break;
      case '/stats/history':
        this.handleStatsHistory(res, url);
        break;
      case '/events/recent':
        this.handleRecentEvents(res, url);
        break;
      case '/health':
        this.handleHealth(res);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * Serve homepage with dashboard HTML
   * @param {http.ServerResponse} res
   */
  serveHomepage(res) {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Handle SSE connection
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial data
    const initialData = {
      type: 'connected',
      stats: this.stats.getSnapshot(),
      events: this.eventStream.getRecentEvents(20)
    };
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);

    // Add to clients
    this.sseClients.add(res);

    // Handle disconnect
    req.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  /**
   * Broadcast to all SSE clients
   * @param {string} type
   * @param {Object} data
   */
  broadcastSSE(type, data) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

    for (const client of this.sseClients) {
      try {
        client.write(`data: ${message}\n\n`);
      } catch (error) {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Handle stats request
   * @param {http.ServerResponse} res
   */
  handleStats(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.stats.getSnapshot()));
  }

  /**
   * Handle stats history request
   * @param {http.ServerResponse} res
   * @param {URL} url
   */
  handleStatsHistory(res, url) {
    const count = parseInt(url.searchParams.get('count') || '60', 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.stats.getHistory(count)));
  }

  /**
   * Handle recent events request
   * @param {http.ServerResponse} res
   * @param {URL} url
   */
  handleRecentEvents(res, url) {
    const count = parseInt(url.searchParams.get('count') || '50', 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.eventStream.getRecentEvents(count)));
  }

  /**
   * Handle health check
   * @param {http.ServerResponse} res
   */
  handleHealth(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      state: this.state,
      uptime: Date.now() - this.stats.startTime,
      clients: this.sseClients.size
    }));
  }

  /**
   * Record request event
   * @param {string} type
   * @param {Object} request
   */
  recordRequest(type, request) {
    switch (type) {
      case 'start':
        this.stats.recordRequestStart(request);
        this.eventStream.broadcast(EVENT_TYPE.REQUEST_START, request);
        this.broadcastSSE(EVENT_TYPE.REQUEST_START, request);
        break;
      case 'complete':
        this.stats.recordRequestComplete(request);
        this.eventStream.broadcast(EVENT_TYPE.REQUEST_COMPLETE, request);
        this.broadcastSSE(EVENT_TYPE.REQUEST_COMPLETE, request);
        break;
      case 'fail':
        this.stats.recordRequestFail(request);
        this.eventStream.broadcast(EVENT_TYPE.REQUEST_FAIL, request);
        this.broadcastSSE(EVENT_TYPE.REQUEST_FAIL, request);
        break;
    }
  }

  /**
   * Record rate limit event
   * @param {Object} data
   */
  recordRateLimit(data) {
    this.eventStream.broadcast(EVENT_TYPE.RATE_LIMIT, data);
    this.broadcastSSE(EVENT_TYPE.RATE_LIMIT, data);
  }

  /**
   * Generate dashboard HTML
   * @returns {string}
   */
  generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dragon UI - Real-time Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2rem;
      color: #38bdf8;
      margin-bottom: 10px;
    }
    .header .status {
      font-size: 0.9rem;
      color: #64748b;
    }
    .status.connected { color: #22c55e; }
    .status.disconnected { color: #ef4444; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .card h3 {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .card .value {
      font-size: 2rem;
      font-weight: bold;
      color: #38bdf8;
    }
    .card .subvalue {
      font-size: 0.875rem;
      color: #64748b;
      margin-top: 5px;
    }
    .card.success .value { color: #22c55e; }
    .card.warning .value { color: #f59e0b; }
    .card.error .value { color: #ef4444; }
    .events {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .events h3 {
      margin-bottom: 15px;
      color: #94a3b8;
    }
    .event-list {
      max-height: 400px;
      overflow-y: auto;
    }
    .event {
      padding: 10px;
      border-bottom: 1px solid #334155;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .event:last-child { border-bottom: none; }
    .event .time { color: #64748b; margin-right: 10px; }
    .event .type { color: #38bdf8; margin-right: 10px; }
    .event.request\\:start .type { color: #22c55e; }
    .event.request\\:complete .type { color: #38bdf8; }
    .event.request\\:fail .type { color: #ef4444; }
    .chart {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #334155;
      margin-bottom: 20px;
    }
    .sparkline {
      display: flex;
      align-items: flex-end;
      height: 60px;
      gap: 2px;
    }
    .sparkline .bar {
      flex: 1;
      background: #38bdf8;
      min-height: 2px;
      border-radius: 2px 2px 0 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Dragon UI Real-time Dashboard</h1>
    <div class="status disconnected" id="status">Connecting...</div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Total Requests</h3>
      <div class="value" id="total-requests">0</div>
      <div class="subvalue" id="requests-per-min">0 req/min</div>
    </div>
    <div class="card success">
      <h3>Success Rate</h3>
      <div class="value" id="success-rate">0%</div>
      <div class="subvalue" id="success-count">0 successful</div>
    </div>
    <div class="card warning">
      <h3>Active Requests</h3>
      <div class="value" id="active-requests">0</div>
      <div class="subvalue">pending</div>
    </div>
    <div class="card">
      <h3>Total Cost</h3>
      <div class="value" id="total-cost">$0.00</div>
      <div class="subvalue" id="uptime">Uptime: 0s</div>
    </div>
    <div class="card">
      <h3>Total Tokens</h3>
      <div class="value" id="total-tokens">0</div>
      <div class="subvalue" id="token-breakdown">I: 0 / O: 0</div>
    </div>
    <div class="card">
      <h3>Avg Response Time</h3>
      <div class="value" id="avg-response">0ms</div>
      <div class="subvalue" id="response-range">Min: 0ms / Max: 0ms</div>
    </div>
  </div>

  <div class="chart">
    <h3 style="color: #94a3b8; margin-bottom: 15px;">Request Rate (Last 60 Updates)</h3>
    <div class="sparkline" id="sparkline"></div>
  </div>

  <div class="events">
    <h3>Live Events</h3>
    <div class="event-list" id="events"></div>
  </div>

  <script>
    const eventsDiv = document.getElementById('events');
    const statusDiv = document.getElementById('status');
    const sparklineDiv = document.getElementById('sparkline');
    const history = [];
    let eventSource;

    function formatNumber(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
      return n.toLocaleString();
    }

    function updateStats(stats) {
      document.getElementById('total-requests').textContent = formatNumber(stats.requests.total);
      document.getElementById('requests-per-min').textContent = stats.requestsPerMinute + ' req/min';
      document.getElementById('success-rate').textContent = stats.successRate + '%';
      document.getElementById('success-count').textContent = formatNumber(stats.requests.success) + ' successful';
      document.getElementById('active-requests').textContent = stats.activeRequests;
      document.getElementById('total-cost').textContent = '$' + stats.cost.toFixed(4);
      document.getElementById('uptime').textContent = 'Uptime: ' + stats.uptimeFormatted;
      document.getElementById('total-tokens').textContent = formatNumber(stats.tokens.input + stats.tokens.output);
      document.getElementById('token-breakdown').textContent = 'I: ' + formatNumber(stats.tokens.input) + ' / O: ' + formatNumber(stats.tokens.output);
      document.getElementById('avg-response').textContent = stats.responseTime.avg + 'ms';
      document.getElementById('response-range').textContent = 'Min: ' + stats.responseTime.min + 'ms / Max: ' + stats.responseTime.max + 'ms';

      // Update sparkline
      history.push(stats.requests.total);
      if (history.length > 60) history.shift();
      updateSparkline();
    }

    function updateSparkline() {
      const max = Math.max(...history, 1);
      sparklineDiv.innerHTML = history.map(v =>
        '<div class="bar" style="height: ' + Math.max(2, (v / max) * 60) + 'px"></div>'
      ).join('');
    }

    function addEvent(event) {
      const div = document.createElement('div');
      div.className = 'event ' + event.type.replace(':', '\\\\:');
      div.innerHTML = '<span class="time">' + new Date(event.timestamp).toLocaleTimeString() + '</span>' +
                      '<span class="type">' + event.type + '</span>' +
                      '<span class="data">' + (event.data.model || event.data.id || '') + '</span>';
      eventsDiv.insertBefore(div, eventsDiv.firstChild);
      if (eventsDiv.children.length > 100) {
        eventsDiv.removeChild(eventsDiv.lastChild);
      }
    }

    function connect() {
      eventSource = new EventSource('/events');

      eventSource.onopen = () => {
        statusDiv.textContent = 'Connected';
        statusDiv.className = 'status connected';
      };

      eventSource.onmessage = (e) => {
        const message = JSON.parse(e.data);

        if (message.stats) {
          updateStats(message.stats);
        }

        if (message.events) {
          message.events.forEach(addEvent);
        }

        if (message.type === 'stats:update') {
          updateStats(message.data);
        } else if (message.type && message.type.startsWith('request:')) {
          addEvent(message);
        }
      };

      eventSource.onerror = () => {
        statusDiv.textContent = 'Disconnected - Reconnecting...';
        statusDiv.className = 'status disconnected';
        eventSource.close();
        setTimeout(connect, 3000);
      };
    }

    connect();
  </script>
</body>
</html>`;
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return {
      state: this.state,
      port: this.options.port,
      host: this.options.host,
      clients: this.sseClients.size,
      stats: this.stats.getSnapshot()
    };
  }
}

// Singleton instance
let instance = null;

/**
 * Get Real-time Dashboard instance
 * @param {Object} options
 * @returns {RealtimeDashboard}
 */
function getRealtimeDashboard(options) {
  if (!instance) {
    instance = new RealtimeDashboard(options);
  }
  return instance;
}

module.exports = {
  RealtimeDashboard,
  EventStream,
  RealtimeStats,
  getRealtimeDashboard,
  EVENT_TYPE,
  DASHBOARD_STATE
};
