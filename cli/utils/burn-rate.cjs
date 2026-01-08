/**
 * Burn Rate Calculator
 * Calculates token usage rates and provides indicators
 */

/**
 * Calculate tokens per minute
 */
function calculateBurnRate(recentTokens, timeSpanMinutes) {
  if (timeSpanMinutes <= 0) return 0;
  return Math.round(recentTokens / timeSpanMinutes);
}

/**
 * Calculate cost per minute
 */
function calculateCostRate(recentCost, timeSpanMinutes) {
  if (timeSpanMinutes <= 0) return 0;
  return recentCost / timeSpanMinutes;
}

/**
 * Get burn rate indicator icon and level
 */
function getBurnRateIndicator(tokensPerMinute) {
  if (tokensPerMinute >= 2000) {
    return { icon: '\uD83D\uDD25', level: 'extreme', label: 'Extreme' }; // 🔥
  }
  if (tokensPerMinute >= 1000) {
    return { icon: '\uD83D\uDD25', level: 'high', label: 'High' }; // 🔥
  }
  if (tokensPerMinute >= 500) {
    return { icon: '\u26A1', level: 'moderate', label: 'Moderate' }; // ⚡
  }
  if (tokensPerMinute >= 100) {
    return { icon: '\u23F1\uFE0F', level: 'low', label: 'Low' }; // ⏱️
  }
  return { icon: '\uD83D\uDCA4', level: 'idle', label: 'Idle' }; // 💤
}

/**
 * Get context usage indicator
 */
function getContextIndicator(usedTokens, maxTokens) {
  const percentage = (usedTokens / maxTokens) * 100;

  if (percentage >= 90) {
    return { icon: '\uD83D\uDD34', level: 'critical', label: 'Critical', color: 'red' }; // 🔴
  }
  if (percentage >= 80) {
    return { icon: '\uD83D\uDFE0', level: 'warning', label: 'Warning', color: 'yellow' }; // 🟠
  }
  if (percentage >= 50) {
    return { icon: '\uD83D\uDFE1', level: 'moderate', label: 'Moderate', color: 'yellow' }; // 🟡
  }
  return { icon: '\uD83D\uDFE2', level: 'normal', label: 'Normal', color: 'green' }; // 🟢
}

/**
 * Calculate session burn rate from history
 */
function calculateSessionBurnRate(sessionData) {
  if (!sessionData || !sessionData.startTime) {
    return { tokensPerMinute: 0, costPerMinute: 0, indicator: getBurnRateIndicator(0) };
  }

  const startTime = new Date(sessionData.startTime);
  const now = new Date();
  const durationMinutes = (now - startTime) / (1000 * 60);

  if (durationMinutes <= 0) {
    return { tokensPerMinute: 0, costPerMinute: 0, indicator: getBurnRateIndicator(0) };
  }

  const totalTokens = (sessionData.tokensIn || 0) + (sessionData.tokensOut || 0);
  const totalCost = sessionData.cost || 0;

  const tokensPerMinute = calculateBurnRate(totalTokens, durationMinutes);
  const costPerMinute = calculateCostRate(totalCost, durationMinutes);
  const indicator = getBurnRateIndicator(tokensPerMinute);

  return {
    tokensPerMinute,
    costPerMinute,
    indicator,
    durationMinutes: Math.round(durationMinutes),
    totalTokens,
    totalCost
  };
}

/**
 * Calculate recent burn rate (last N minutes)
 */
function calculateRecentBurnRate(recentMessages, windowMinutes = 5) {
  if (!recentMessages || recentMessages.length === 0) {
    return { tokensPerMinute: 0, costPerMinute: 0, indicator: getBurnRateIndicator(0) };
  }

  const now = new Date();
  const windowStart = new Date(now - windowMinutes * 60 * 1000);

  // Filter messages within window
  const messagesInWindow = recentMessages.filter(msg => {
    const msgTime = new Date(msg.timestamp || msg.created_at);
    return msgTime >= windowStart;
  });

  if (messagesInWindow.length === 0) {
    return { tokensPerMinute: 0, costPerMinute: 0, indicator: getBurnRateIndicator(0) };
  }

  // Calculate totals
  let totalTokens = 0;
  let totalCost = 0;

  for (const msg of messagesInWindow) {
    totalTokens += (msg.tokensIn || msg.input_tokens || 0);
    totalTokens += (msg.tokensOut || msg.output_tokens || 0);
    totalCost += (msg.cost || 0);
  }

  // Calculate actual time span
  const firstMsg = new Date(messagesInWindow[0].timestamp || messagesInWindow[0].created_at);
  const lastMsg = new Date(messagesInWindow[messagesInWindow.length - 1].timestamp || messagesInWindow[messagesInWindow.length - 1].created_at);
  const actualMinutes = Math.max(1, (lastMsg - firstMsg) / (1000 * 60));

  const tokensPerMinute = calculateBurnRate(totalTokens, actualMinutes);
  const costPerMinute = calculateCostRate(totalCost, actualMinutes);
  const indicator = getBurnRateIndicator(tokensPerMinute);

  return {
    tokensPerMinute,
    costPerMinute,
    indicator,
    messageCount: messagesInWindow.length,
    windowMinutes: actualMinutes
  };
}

/**
 * Format burn rate for display
 */
function formatBurnRate(tokensPerMinute) {
  if (tokensPerMinute >= 1000) {
    return `${(tokensPerMinute / 1000).toFixed(1)}k/min`;
  }
  return `${tokensPerMinute}/min`;
}

/**
 * Format cost rate for display
 */
function formatCostRate(costPerMinute) {
  if (costPerMinute >= 1) {
    return `$${costPerMinute.toFixed(2)}/min`;
  }
  return `$${(costPerMinute * 60).toFixed(2)}/hr`;
}

module.exports = {
  calculateBurnRate,
  calculateCostRate,
  getBurnRateIndicator,
  getContextIndicator,
  calculateSessionBurnRate,
  calculateRecentBurnRate,
  formatBurnRate,
  formatCostRate
};
