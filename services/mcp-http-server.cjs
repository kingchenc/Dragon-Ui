'use strict';
const http = require('http');
const { EventEmitter } = require('events');

const DEFAULT_PORT = 8080;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

class MCPHttpServer extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.port = options.port || DEFAULT_PORT;
    this.host = options.host || '0.0.0.0';
    this.server = null;
    this.tools = new Map();
    this.resources = new Map();
    this.authToken = options.authToken || null;
  }

  registerTool(name, handler, schema) {
    this.tools.set(name, { handler: handler, schema: schema || {}, name: name });
  }

  registerResource(uri, handler) {
    this.resources.set(uri, handler);
  }

  start() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.server = http.createServer(function(req, res) {
        self._handleRequest(req, res);
      });

      self.server.listen(self.port, self.host, function() {
        self.emit('started', { port: self.port, host: self.host });
        resolve({ port: self.port, host: self.host });
      });

      self.server.on('error', reject);
    });
  }

  _handleRequest(req, res) {
    var self = this;
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (this.authToken) {
      var auth = req.headers.authorization;
      if (!auth || auth !== 'Bearer ' + this.authToken) {
        res.writeHead(401, CORS_HEADERS);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    this.handleRoute(req).then(function(result) {
      res.writeHead(200, CORS_HEADERS);
      res.end(JSON.stringify(result));
    }).catch(function(error) {
      res.writeHead(error.status || 500, CORS_HEADERS);
      res.end(JSON.stringify({ error: error.message }));
    });
  }

  handleRoute(req) {
    var self = this;
    var url = new URL(req.url, 'http://' + req.headers.host);
    var path = url.pathname;

    if (path === '/tools' && req.method === 'GET') {
      var tools = Array.from(this.tools.values()).map(function(t) {
        return { name: t.name, schema: t.schema };
      });
      return Promise.resolve({ tools: tools });
    }

    if (path.startsWith('/tools/') && req.method === 'POST') {
      var name = path.slice(7);
      var tool = this.tools.get(name);
      if (!tool) {
        var err = new Error('Tool not found');
        err.status = 404;
        return Promise.reject(err);
      }
      return this.readBody(req).then(function(body) {
        return tool.handler(body);
      }).then(function(result) {
        return { result: result };
      });
    }

    if (path === '/resources' && req.method === 'GET') {
      return Promise.resolve({ resources: Array.from(this.resources.keys()) });
    }

    if (path.startsWith('/resources/') && req.method === 'GET') {
      var uri = decodeURIComponent(path.slice(11));
      var handler = this.resources.get(uri);
      if (!handler) {
        var err2 = new Error('Resource not found');
        err2.status = 404;
        return Promise.reject(err2);
      }
      return Promise.resolve(handler()).then(function(content) {
        return { content: content };
      });
    }

    if (path === '/health' && req.method === 'GET') {
      return Promise.resolve({ status: 'ok', uptime: process.uptime() });
    }

    var notFound = new Error('Not found');
    notFound.status = 404;
    return Promise.reject(notFound);
  }

  readBody(req) {
    return new Promise(function(resolve, reject) {
      var data = '';
      req.on('data', function(chunk) { data += chunk; });
      req.on('end', function() {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch (e) { resolve({}); }
      });
      req.on('error', reject);
    });
  }

  stop() {
    var self = this;
    return new Promise(function(resolve) {
      if (self.server) {
        self.server.close(function() {
          self.emit('stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStatus() {
    return {
      running: !!(this.server && this.server.listening),
      port: this.port,
      host: this.host,
      tools: this.tools.size,
      resources: this.resources.size
    };
  }
}

var _instance = null;
function getMCPHttpServer(opts) {
  if (!_instance) _instance = new MCPHttpServer(opts || {});
  return _instance;
}

module.exports = { MCPHttpServer: MCPHttpServer, getMCPHttpServer: getMCPHttpServer, DEFAULT_PORT: DEFAULT_PORT };
