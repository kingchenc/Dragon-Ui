'use strict';
const { EventEmitter } = require('events');

var BATCH_INTERVAL = 100;
var MAX_QUEUE_SIZE = 1000;

class AsyncDbWriter extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    this.db = options.db;
    this.batchInterval = options.batchInterval || BATCH_INTERVAL;
    this.maxQueueSize = options.maxQueueSize || MAX_QUEUE_SIZE;
    this.queue = [];
    this.timer = null;
    this.isProcessing = false;
    this.metrics = { written: 0, batches: 0, errors: 0 };
  }

  write(operation, callback) {
    if (this.queue.length >= this.maxQueueSize) {
      var err = new Error('Queue full');
      if (callback) callback(err);
      this.emit('error', err);
      return false;
    }

    this.queue.push({ operation: operation, callback: callback, timestamp: Date.now() });
    this._scheduleFlush();
    return true;
  }

  _scheduleFlush() {
    var self = this;
    if (!this.timer && !this.isProcessing) {
      this.timer = setTimeout(function() {
        self.timer = null;
        self._processQueue();
      }, this.batchInterval);
    }
  }

  _processQueue() {
    var self = this;
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    var batch = this.queue.splice(0, Math.min(100, this.queue.length));

    this._executeBatch(batch).then(function() {
      self.metrics.written += batch.length;
      self.metrics.batches++;
      batch.forEach(function(item) {
        if (item.callback) item.callback(null);
      });
      self.emit('batchComplete', { count: batch.length });
    }).catch(function(error) {
      self.metrics.errors++;
      batch.forEach(function(item) {
        if (item.callback) item.callback(error);
      });
      self.emit('error', error);
    }).finally(function() {
      self.isProcessing = false;
      if (self.queue.length > 0) self._scheduleFlush();
    });
  }

  _executeBatch(batch) {
    var self = this;
    return new Promise(function(resolve, reject) {
      if (!self.db) {
        reject(new Error('Database not configured'));
        return;
      }

      try {
        var transaction = self.db.transaction(function() {
          batch.forEach(function(item) {
            var op = item.operation;
            if (op.type === 'insert') {
              self.db.prepare(op.sql).run(op.params);
            } else if (op.type === 'update') {
              self.db.prepare(op.sql).run(op.params);
            } else if (op.type === 'delete') {
              self.db.prepare(op.sql).run(op.params);
            }
          });
        });
        transaction();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  flush() {
    var self = this;
    return new Promise(function(resolve, reject) {
      if (self.timer) {
        clearTimeout(self.timer);
        self.timer = null;
      }

      var flushAll = function() {
        if (self.queue.length === 0 && !self.isProcessing) {
          resolve(self.metrics);
          return;
        }

        if (!self.isProcessing) {
          self._processQueue();
        }

        setTimeout(flushAll, 10);
      };

      flushAll();
    });
  }

  getQueueSize() {
    return this.queue.length;
  }

  getMetrics() {
    return Object.assign({}, this.metrics, { queueSize: this.queue.length });
  }

  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    var cleared = this.queue.length;
    this.queue = [];
    return cleared;
  }

  close() {
    var self = this;
    return this.flush().then(function(metrics) {
      self.emit('closed', metrics);
      return metrics;
    });
  }
}

var _instance = null;
function getAsyncDbWriter(opts) {
  if (!_instance) _instance = new AsyncDbWriter(opts || {});
  return _instance;
}

module.exports = { AsyncDbWriter: AsyncDbWriter, getAsyncDbWriter: getAsyncDbWriter, BATCH_INTERVAL: BATCH_INTERVAL, MAX_QUEUE_SIZE: MAX_QUEUE_SIZE };
