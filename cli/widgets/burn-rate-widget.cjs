'use strict';

var RATE_THRESHOLDS = {
  HIGH: 1000,
  MODERATE: 500,
  LOW: 0
};

var CONTEXT_THRESHOLDS = {
  HIGH: 80,
  MEDIUM: 50,
  LOW: 0
};

var INDICATORS = {
  TOKEN_HIGH: { icon: '🔥', label: 'High', color: 'red' },
  TOKEN_MODERATE: { icon: '⚡', label: 'Moderate', color: 'yellow' },
  TOKEN_LOW: { icon: '⏱️', label: 'Low', color: 'green' },
  CONTEXT_HIGH: { icon: '🔴', label: 'Critical', color: 'red' },
  CONTEXT_MEDIUM: { icon: '🟡', label: 'Warning', color: 'yellow' },
  CONTEXT_LOW: { icon: '🟢', label: 'OK', color: 'green' }
};

function BurnRateWidget(options) {
  options = options || {};
  this.id = 'burn-rate';
  this.name = 'Burn Rate';
  this.category = 'usage';
  this.tokenHistory = [];
  this.historySize = options.historySize || 60;
  this.lastUpdate = 0;
}

BurnRateWidget.prototype.calculateTokenRate = function(totalTokens, timestamp) {
  var now = timestamp || Date.now();
  
  this.tokenHistory.push({ tokens: totalTokens, time: now });
  
  while (this.tokenHistory.length > this.historySize) {
    this.tokenHistory.shift();
  }

  if (this.tokenHistory.length < 2) return 0;

  var oldest = this.tokenHistory[0];
  var newest = this.tokenHistory[this.tokenHistory.length - 1];
  var timeDiff = (newest.time - oldest.time) / 60000;

  if (timeDiff <= 0) return 0;

  return (newest.tokens - oldest.tokens) / timeDiff;
};

BurnRateWidget.prototype.getTokenRateIndicator = function(rate) {
  if (rate >= RATE_THRESHOLDS.HIGH) {
    return INDICATORS.TOKEN_HIGH;
  } else if (rate >= RATE_THRESHOLDS.MODERATE) {
    return INDICATORS.TOKEN_MODERATE;
  }
  return INDICATORS.TOKEN_LOW;
};

BurnRateWidget.prototype.getContextIndicator = function(usagePercent) {
  if (usagePercent >= CONTEXT_THRESHOLDS.HIGH) {
    return INDICATORS.CONTEXT_HIGH;
  } else if (usagePercent >= CONTEXT_THRESHOLDS.MEDIUM) {
    return INDICATORS.CONTEXT_MEDIUM;
  }
  return INDICATORS.CONTEXT_LOW;
};

BurnRateWidget.prototype.render = function(data) {
  var rate = this.calculateTokenRate(data.totalTokens || 0, data.timestamp);
  var tokenIndicator = this.getTokenRateIndicator(rate);
  
  var contextPercent = 0;
  if (data.contextLength && data.maxContext) {
    contextPercent = (data.contextLength / data.maxContext) * 100;
  }
  var contextIndicator = this.getContextIndicator(contextPercent);

  return {
    tokenRate: Math.round(rate),
    tokenIndicator: tokenIndicator,
    contextPercent: Math.round(contextPercent),
    contextIndicator: contextIndicator,
    display: tokenIndicator.icon + ' ' + Math.round(rate) + '/min ' + contextIndicator.icon
  };
};

BurnRateWidget.prototype.reset = function() {
  this.tokenHistory = [];
  this.lastUpdate = 0;
};

BurnRateWidget.prototype.getMetadata = function() {
  return {
    id: this.id,
    name: this.name,
    category: this.category,
    description: 'Shows token consumption rate and context usage indicators'
  };
};

function createBurnRateWidget(options) {
  return new BurnRateWidget(options);
}

module.exports = {
  BurnRateWidget: BurnRateWidget,
  createBurnRateWidget: createBurnRateWidget,
  RATE_THRESHOLDS: RATE_THRESHOLDS,
  CONTEXT_THRESHOLDS: CONTEXT_THRESHOLDS,
  INDICATORS: INDICATORS
};
