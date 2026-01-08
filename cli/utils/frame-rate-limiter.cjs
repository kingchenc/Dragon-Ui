'use strict';

var TARGET_FPS = 60;
var MIN_FRAME_TIME = 1000 / TARGET_FPS;
var MAX_FRAME_TIME = 100;

function FrameRateLimiter(options) {
  options = options || {};
  this.targetFps = options.targetFps || TARGET_FPS;
  this.minFrameTime = 1000 / this.targetFps;
  this.lastFrameTime = 0;
  this.frameCount = 0;
  this.fps = 0;
  this.fpsUpdateTime = Date.now();
  this.isThrottling = false;
  this.dirtyRegions = [];
  this.fullRedrawNeeded = true;
}

FrameRateLimiter.prototype.shouldRender = function() {
  var now = Date.now();
  var elapsed = now - this.lastFrameTime;

  if (elapsed < this.minFrameTime) {
    this.isThrottling = true;
    return false;
  }

  this.isThrottling = false;
  this.lastFrameTime = now;
  this.frameCount++;

  if (now - this.fpsUpdateTime >= 1000) {
    this.fps = this.frameCount;
    this.frameCount = 0;
    this.fpsUpdateTime = now;
  }

  return true;
};

FrameRateLimiter.prototype.markDirty = function(region) {
  if (!region) {
    this.fullRedrawNeeded = true;
    return;
  }

  for (var i = 0; i < this.dirtyRegions.length; i++) {
    if (this._regionsOverlap(this.dirtyRegions[i], region)) {
      this.dirtyRegions[i] = this._mergeRegions(this.dirtyRegions[i], region);
      return;
    }
  }

  this.dirtyRegions.push(region);
};

FrameRateLimiter.prototype._regionsOverlap = function(a, b) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
};

FrameRateLimiter.prototype._mergeRegions = function(a, b) {
  var x = Math.min(a.x, b.x);
  var y = Math.min(a.y, b.y);
  return {
    x: x,
    y: y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
};

FrameRateLimiter.prototype.getDirtyRegions = function() {
  if (this.fullRedrawNeeded) {
    this.fullRedrawNeeded = false;
    this.dirtyRegions = [];
    return null;
  }
  var regions = this.dirtyRegions;
  this.dirtyRegions = [];
  return regions;
};

FrameRateLimiter.prototype.getFPS = function() {
  return this.fps;
};

FrameRateLimiter.prototype.getStats = function() {
  return {
    fps: this.fps,
    targetFps: this.targetFps,
    isThrottling: this.isThrottling,
    dirtyRegions: this.dirtyRegions.length
  };
};

FrameRateLimiter.prototype.requestAnimationFrame = function(callback) {
  var self = this;
  var waitTime = Math.max(0, this.minFrameTime - (Date.now() - this.lastFrameTime));
  return setTimeout(function() {
    if (self.shouldRender()) {
      callback(Date.now());
    } else {
      self.requestAnimationFrame(callback);
    }
  }, waitTime);
};

FrameRateLimiter.prototype.cancelAnimationFrame = function(id) {
  clearTimeout(id);
};

function createFrameRateLimiter(options) {
  return new FrameRateLimiter(options);
}

module.exports = {
  FrameRateLimiter: FrameRateLimiter,
  createFrameRateLimiter: createFrameRateLimiter,
  TARGET_FPS: TARGET_FPS,
  MIN_FRAME_TIME: MIN_FRAME_TIME
};
