/**
 * Projections Utility
 * Calculates cost and token projections
 */

/**
 * Calculate 5-hour block boundaries
 */
function getBlockBoundaries() {
  const now = new Date();
  const currentHour = now.getHours();
  const blockStart = Math.floor(currentHour / 5) * 5;
  const blockEnd = blockStart + 5;

  const startTime = new Date(now);
  startTime.setHours(blockStart, 0, 0, 0);

  const endTime = new Date(now);
  endTime.setHours(blockEnd, 0, 0, 0);

  // Handle wrap to next day
  if (blockEnd >= 24) {
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(blockEnd - 24, 0, 0, 0);
  }

  return {
    start: startTime,
    end: endTime,
    blockIndex: Math.floor(currentHour / 5),
    elapsedMinutes: (now - startTime) / (1000 * 60),
    remainingMinutes: (endTime - now) / (1000 * 60),
    totalMinutes: 5 * 60
  };
}

/**
 * Project cost to end of current block
 */
function projectBlockEnd(currentCost, elapsedMinutes, blockDurationMinutes = 300) {
  if (elapsedMinutes <= 0) return currentCost;

  const costPerMinute = currentCost / elapsedMinutes;
  const remainingMinutes = blockDurationMinutes - elapsedMinutes;

  if (remainingMinutes <= 0) return currentCost;

  const projectedAdditional = costPerMinute * remainingMinutes;
  return currentCost + projectedAdditional;
}

/**
 * Estimate per-hour cost
 */
function estimatePerHour(totalCost, durationMinutes) {
  if (durationMinutes <= 0) return 0;

  const costPerMinute = totalCost / durationMinutes;
  return costPerMinute * 60;
}

/**
 * Estimate per-hour tokens
 */
function estimateTokensPerHour(totalTokens, durationMinutes) {
  if (durationMinutes <= 0) return 0;

  const tokensPerMinute = totalTokens / durationMinutes;
  return Math.round(tokensPerMinute * 60);
}

/**
 * Project context exhaustion
 */
function projectContextExhaustion(usedTokens, tokensPerMinute, maxTokens) {
  if (tokensPerMinute <= 0) return null;

  const remainingTokens = maxTokens - usedTokens;
  if (remainingTokens <= 0) return { minutes: 0, exhausted: true };

  const minutesUntilExhaustion = remainingTokens / tokensPerMinute;

  return {
    minutes: Math.round(minutesUntilExhaustion),
    exhausted: false,
    formatted: formatMinutes(minutesUntilExhaustion)
  };
}

/**
 * Format minutes as time string
 */
function formatMinutes(minutes) {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Calculate daily projection
 */
function projectDailyCost(currentCost, elapsedMinutesToday) {
  if (elapsedMinutesToday <= 0) return currentCost;

  const costPerMinute = currentCost / elapsedMinutesToday;
  const remainingMinutesToday = (24 * 60) - elapsedMinutesToday;

  return currentCost + (costPerMinute * remainingMinutesToday);
}

/**
 * Calculate session projections
 */
function calculateSessionProjections(sessionData, model = 'claude-sonnet-4.5') {
  if (!sessionData || !sessionData.startTime) {
    return {
      perHourCost: 0,
      perHourTokens: 0,
      blockProjection: 0,
      contextExhaustion: null
    };
  }

  const startTime = new Date(sessionData.startTime);
  const now = new Date();
  const durationMinutes = (now - startTime) / (1000 * 60);

  const totalTokens = (sessionData.tokensIn || 0) + (sessionData.tokensOut || 0);
  const totalCost = sessionData.cost || 0;

  // Get block info
  const block = getBlockBoundaries();

  // Calculate projections
  const perHourCost = estimatePerHour(totalCost, durationMinutes);
  const perHourTokens = estimateTokensPerHour(totalTokens, durationMinutes);

  // Block projection (using block elapsed time, not session time)
  const blockProjection = projectBlockEnd(totalCost, block.elapsedMinutes);

  // Context exhaustion
  const tokensPerMinute = durationMinutes > 0 ? totalTokens / durationMinutes : 0;
  const maxTokens = 160000; // Default usable context
  const contextExhaustion = projectContextExhaustion(
    sessionData.contextUsed || totalTokens,
    tokensPerMinute,
    maxTokens
  );

  return {
    perHourCost,
    perHourTokens,
    blockProjection,
    contextExhaustion,
    durationMinutes: Math.round(durationMinutes),
    block: {
      index: block.blockIndex,
      elapsedMinutes: Math.round(block.elapsedMinutes),
      remainingMinutes: Math.round(block.remainingMinutes)
    }
  };
}

/**
 * Format cost projection
 */
function formatCostProjection(cost) {
  if (cost >= 100) {
    return `$${cost.toFixed(0)}`;
  }
  if (cost >= 10) {
    return `$${cost.toFixed(1)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Get block time remaining
 */
function getBlockTimeRemaining() {
  const block = getBlockBoundaries();
  return {
    minutes: Math.round(block.remainingMinutes),
    formatted: formatMinutes(block.remainingMinutes),
    blockIndex: block.blockIndex,
    blockLabel: `Block ${block.blockIndex + 1} (${Math.floor(block.blockIndex * 5)}:00-${Math.floor((block.blockIndex + 1) * 5)}:00)`
  };
}

/**
 * Calculate trend (increasing, decreasing, stable)
 */
function calculateTrend(recentData, windowMinutes = 10) {
  if (!recentData || recentData.length < 2) {
    return { direction: 'stable', change: 0 };
  }

  // Split into two halves
  const midpoint = Math.floor(recentData.length / 2);
  const firstHalf = recentData.slice(0, midpoint);
  const secondHalf = recentData.slice(midpoint);

  // Calculate average rates
  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.tokens || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.tokens || 0), 0) / secondHalf.length;

  const change = secondAvg - firstAvg;
  const percentChange = firstAvg > 0 ? (change / firstAvg) * 100 : 0;

  if (percentChange > 20) {
    return { direction: 'increasing', change: percentChange, icon: '\u2197\uFE0F' }; // ↗️
  }
  if (percentChange < -20) {
    return { direction: 'decreasing', change: percentChange, icon: '\u2198\uFE0F' }; // ↘️
  }
  return { direction: 'stable', change: percentChange, icon: '\u2194\uFE0F' }; // ↔️
}

module.exports = {
  getBlockBoundaries,
  projectBlockEnd,
  estimatePerHour,
  estimateTokensPerHour,
  projectContextExhaustion,
  projectDailyCost,
  calculateSessionProjections,
  formatCostProjection,
  formatMinutes,
  getBlockTimeRemaining,
  calculateTrend
};
