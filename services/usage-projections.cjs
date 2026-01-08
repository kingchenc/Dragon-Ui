'use strict';

var BLOCK_DURATION_MS = 5 * 60 * 60 * 1000;
var HOURS_PER_DAY = 24;
var DAYS_PER_WEEK = 7;
var DAYS_PER_MONTH = 30;

function UsageProjections(options) {
  options = options || {};
  this.dataPoints = [];
  this.maxDataPoints = options.maxDataPoints || 100;
  this.costPerToken = options.costPerToken || 0.00001;
}

UsageProjections.prototype.addDataPoint = function(tokens, cost, timestamp) {
  var now = timestamp || Date.now();
  
  this.dataPoints.push({
    tokens: tokens,
    cost: cost,
    timestamp: now
  });

  while (this.dataPoints.length > this.maxDataPoints) {
    this.dataPoints.shift();
  }
};

UsageProjections.prototype.calculateRate = function() {
  if (this.dataPoints.length < 2) {
    return { tokensPerHour: 0, costPerHour: 0 };
  }

  var oldest = this.dataPoints[0];
  var newest = this.dataPoints[this.dataPoints.length - 1];
  var hoursDiff = (newest.timestamp - oldest.timestamp) / 3600000;

  if (hoursDiff <= 0) {
    return { tokensPerHour: 0, costPerHour: 0 };
  }

  var tokensDiff = newest.tokens - oldest.tokens;
  var costDiff = newest.cost - oldest.cost;

  return {
    tokensPerHour: tokensDiff / hoursDiff,
    costPerHour: costDiff / hoursDiff
  };
};

UsageProjections.prototype.getBlockProjection = function(blockStartTime) {
  var now = Date.now();
  var blockEnd = blockStartTime + BLOCK_DURATION_MS;
  var remainingMs = blockEnd - now;

  if (remainingMs <= 0) {
    return { remainingTime: 0, projectedTokens: 0, projectedCost: 0 };
  }

  var rate = this.calculateRate();
  var remainingHours = remainingMs / 3600000;

  return {
    remainingTime: remainingMs,
    remainingHours: remainingHours,
    projectedTokens: Math.round(rate.tokensPerHour * remainingHours),
    projectedCost: rate.costPerHour * remainingHours,
    formattedRemaining: this._formatDuration(remainingMs)
  };
};

UsageProjections.prototype.getHourlyForecast = function(hours) {
  hours = hours || 1;
  var rate = this.calculateRate();

  return {
    hours: hours,
    projectedTokens: Math.round(rate.tokensPerHour * hours),
    projectedCost: rate.costPerHour * hours
  };
};

UsageProjections.prototype.getDailyForecast = function() {
  var rate = this.calculateRate();

  return {
    projectedTokens: Math.round(rate.tokensPerHour * HOURS_PER_DAY),
    projectedCost: rate.costPerHour * HOURS_PER_DAY
  };
};

UsageProjections.prototype.getWeeklyForecast = function() {
  var daily = this.getDailyForecast();

  return {
    projectedTokens: daily.projectedTokens * DAYS_PER_WEEK,
    projectedCost: daily.projectedCost * DAYS_PER_WEEK
  };
};

UsageProjections.prototype.getMonthlyForecast = function() {
  var daily = this.getDailyForecast();

  return {
    projectedTokens: daily.projectedTokens * DAYS_PER_MONTH,
    projectedCost: daily.projectedCost * DAYS_PER_MONTH
  };
};

UsageProjections.prototype.getBudgetStatus = function(monthlyBudget) {
  var monthly = this.getMonthlyForecast();

  return {
    budget: monthlyBudget,
    projected: monthly.projectedCost,
    remaining: monthlyBudget - monthly.projectedCost,
    percentUsed: (monthly.projectedCost / monthlyBudget) * 100,
    onTrack: monthly.projectedCost <= monthlyBudget
  };
};

UsageProjections.prototype.getTrend = function() {
  if (this.dataPoints.length < 10) {
    return { trend: 'insufficient_data', slope: 0 };
  }

  var midpoint = Math.floor(this.dataPoints.length / 2);
  var firstHalf = this.dataPoints.slice(0, midpoint);
  var secondHalf = this.dataPoints.slice(midpoint);

  var firstAvgRate = this._calculateAverageRate(firstHalf);
  var secondAvgRate = this._calculateAverageRate(secondHalf);

  var slope = secondAvgRate - firstAvgRate;

  if (slope > 0.1) {
    return { trend: 'increasing', slope: slope };
  } else if (slope < -0.1) {
    return { trend: 'decreasing', slope: slope };
  }
  return { trend: 'stable', slope: slope };
};

UsageProjections.prototype._calculateAverageRate = function(points) {
  if (points.length < 2) return 0;
  var total = 0;
  for (var i = 1; i < points.length; i++) {
    var timeDiff = (points[i].timestamp - points[i-1].timestamp) / 3600000;
    if (timeDiff > 0) {
      total += (points[i].tokens - points[i-1].tokens) / timeDiff;
    }
  }
  return total / (points.length - 1);
};

UsageProjections.prototype._formatDuration = function(ms) {
  var hours = Math.floor(ms / 3600000);
  var minutes = Math.floor((ms % 3600000) / 60000);
  var seconds = Math.floor((ms % 60000) / 1000);

  if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  } else if (minutes > 0) {
    return minutes + 'm ' + seconds + 's';
  }
  return seconds + 's';
};

UsageProjections.prototype.reset = function() {
  this.dataPoints = [];
};

UsageProjections.prototype.getStats = function() {
  var rate = this.calculateRate();
  var trend = this.getTrend();

  return {
    dataPoints: this.dataPoints.length,
    tokensPerHour: Math.round(rate.tokensPerHour),
    costPerHour: rate.costPerHour,
    trend: trend.trend,
    slope: trend.slope
  };
};

var _instance = null;
function getUsageProjections(opts) {
  if (!_instance) _instance = new UsageProjections(opts || {});
  return _instance;
}

module.exports = {
  UsageProjections: UsageProjections,
  getUsageProjections: getUsageProjections,
  BLOCK_DURATION_MS: BLOCK_DURATION_MS
};
