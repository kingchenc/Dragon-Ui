/**
 * CLI Active Page (CommonJS)
 * Real-time session monitoring - matches Electron UI structure
 */

const { colors, createProgressBar } = require('../components/colors.cjs');
const { createTable, createKeyValueTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatDuration } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showActivePage(dataAdapter, settings) {
  console.log(showPageHeader('Active Session', 'Real-time session monitoring and current activity'));
  
  try {
    const loadingStop = showLoading('Loading active session data...');
    const data = await dataAdapter.getActiveData();
    loadingStop();
    
    // Check if we have an active session
    const hasActiveSession = data.activeSession && data.isActive;
    
    if (hasActiveSession) {
      // Extract session data
      const {
        sessionId,
        project,
        totalCost,
        totalTokens,
        duration,
        startTime,
        lastActivity,
        entryCount,
        models,
        currency
      } = data.activeSession;
      
      // Calculate session metrics (like Electron UI)
      const sessionTimeMinutes = duration ? Math.floor(duration / (1000 * 60)) : 0;
      const totalSessionTime = 300; // 5 hours = 300 minutes (standard session length)
      const timeLeft = Math.max(0, totalSessionTime - sessionTimeMinutes);
      
      // Calculate progress percentages
      const sessionProgress = totalSessionTime > 0 ? (sessionTimeMinutes / totalSessionTime) * 100 : 0;
      
      // Token burn rate (tokens per minute)
      const tokenBurnRate = sessionTimeMinutes > 0 ? Math.round(totalTokens / sessionTimeMinutes) : 0;
      const highActivityThreshold = 1000; // tokens/min for high activity
      const usageProgress = Math.min(100, (tokenBurnRate / highActivityThreshold) * 100);
      
      // Full session projections
      const projectedTokens = tokenBurnRate > 0 ? Math.round(tokenBurnRate * totalSessionTime) : 0;
      const projectionProgress = projectedTokens > 0 ? Math.min(100, (totalTokens / projectedTokens) * 100) : 0;
      
      // Cost calculations
      const costPerToken = totalTokens > 0 ? totalCost / totalTokens : 0;
      const projectedCost = projectedTokens * costPerToken;
      
      // Session status header
      console.log(colors.success('🔴 ACTIVE SESSION'));
      console.log('─'.repeat(60));
      console.log('');
      
      // 3 Progress Bars (like Electron UI)
      console.log(colors.primary('📊 Session Progress'));
      console.log('─'.repeat(50));
      console.log('');
      
      // 1. Session Progress Bar
      const sessionBar = createProgressBar(sessionProgress, 100, 30);
      console.log(`${colors.primary('Session:')} ${sessionBar} ${sessionProgress.toFixed(1)}%`);
      console.log(`         Started: ${formatDate(startTime)} | Remaining: ${timeLeft}m`);
      console.log('');
      
      // 2. Token Usage Bar  
      const usageBar = createProgressBar(usageProgress, 100, 30);
      console.log(`${colors.primary('Usage:')}   ${usageBar} ${formatNumber(totalTokens)} tokens`);
      console.log(`         Burn Rate: ${tokenBurnRate}/min ${tokenBurnRate > 100 ? '[HIGH]' : '[NORMAL]'} | Cost: ${formatCurrency(totalCost, currency)}`);
      console.log('');
      
      // 3. Projection Bar
      const projectionBar = createProgressBar(projectionProgress, 100, 30);
      console.log(`${colors.primary('Projection:')} ${projectionBar} ${formatNumber(projectedTokens)} tokens`);
      console.log(`         Status: ${tokenBurnRate > 100 ? '[HIGH BURN]' : '[ON TRACK]'} | Projected: ${formatCurrency(projectedCost, currency)}`);
      console.log('');
      console.log('');
      
      // Session Overview (2 column layout like Electron)
      console.log(colors.primary('📋 Session Overview'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Left column - Session Info
      const sessionInfo = [
        ['Session Cost', formatCurrency(totalCost, currency)],
        ['Tokens Used', formatNumber(totalTokens)],
        ['Session ID', sessionId.substring(0, 12) + '...'],
        ['Project', project || 'Unknown'],
        ['Status', colors.success('ACTIVE')],
        ['Last Activity', formatDate(lastActivity)]
      ];
      
      const sessionTable = createTable(['Metric', 'Value'], sessionInfo, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(sessionTable);
      console.log('');
      
      // Performance & Projections
      console.log(colors.primary('🚀 Performance & Projections'));
      console.log('─'.repeat(50));
      console.log('');
      
      const perfInfo = [
        ['Token Burn Rate', `${formatNumber(tokenBurnRate)}/min ${tokenBurnRate > 100 ? colors.error('[HIGH]') : colors.success('[NORMAL]')}`],
        ['Session Progress', `${sessionProgress.toFixed(1)}% (${sessionTimeMinutes}m / ${totalSessionTime}m)`],
        ['Projected Tokens', formatNumber(projectedTokens)],
        ['Projected Cost', formatCurrency(projectedCost, currency)],
        ['Cost vs Current', `+${formatCurrency(projectedCost - totalCost, currency)}`],
        ['Performance', tokenBurnRate > 100 ? colors.error('High Intensity') : colors.success('Normal Usage')]
      ];
      
      const perfTable = createTable(['Metric', 'Value'], perfInfo, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(perfTable);
      console.log('');
      
    } else if (data.activeSession) {
      // Session exists but not active
      console.log(colors.warning('⏸️  LAST SESSION (INACTIVE)'));
      console.log('─'.repeat(60));
      console.log('');
      
      const lastSessionInfo = [
        ['Session ID', data.activeSession.sessionId.substring(0, 12) + '...'],
        ['Project', data.activeSession.project || 'Unknown'],
        ['Final Cost', formatCurrency(data.activeSession.totalCost, data.activeSession.currency)],
        ['Total Tokens', formatNumber(data.activeSession.totalTokens)],
        ['Duration', formatDuration(data.activeSession.duration)],
        ['Models', data.activeSession.models.length > 0 ? data.activeSession.models.join(', ') : 'None'],
        ['Last Activity', formatDate(data.activeSession.lastActivity)]
      ];
      
      const lastTable = createTable(['Property', 'Value'], lastSessionInfo, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(lastTable);
      console.log('');
      
    } else {
      // No session
      console.log(colors.inactive('⭕ NO ACTIVE SESSION'));
      console.log('─'.repeat(60));
      console.log('');
      console.log(colors.subtitle('No active Claude Code session detected.'));
      console.log(colors.subtitle('Start using Claude Code to see real-time session data here.'));
      console.log('');
    }
    
    // Today's Summary (like Electron UI)
    if (data.todayStats && data.todayStats.totalCost > 0) {
      console.log(colors.primary('📅 Today\'s Summary'));
      console.log('─'.repeat(50));
      console.log('');
      
      const todayCost = data.todayStats.totalCost;
      const todayTokens = data.todayStats.totalTokens;
      const todaySessions = data.todayStats.sessionCount;
      
      // Progress indicators (3 bars like Electron UI)
      console.log(colors.primary('📈 Daily Progress'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Cost progress bar (against $10 threshold)
      const costThreshold = 10.0;
      const costPercentage = Math.min(100, (todayCost / costThreshold) * 100);
      const costBar = createProgressBar(costPercentage, 100, 30);
      console.log(`${colors.primary('Cost:')} ${costBar} ${formatCurrency(todayCost, data.todayStats.currency)}/${formatCurrency(costThreshold, data.todayStats.currency)}`);
      
      // Tokens progress bar (against 100K threshold)
      const tokensThreshold = 100000;
      const tokensPercentage = Math.min(100, (todayTokens / tokensThreshold) * 100);
      const tokensBar = createProgressBar(tokensPercentage, 100, 30);
      console.log(`${colors.primary('Tokens:')} ${tokensBar} ${formatNumber(todayTokens)}/${formatNumber(tokensThreshold)}`);
      
      // Sessions progress bar (against 10 sessions threshold)
      const sessionsThreshold = 10;
      const sessionsPercentage = Math.min(100, (todaySessions / sessionsThreshold) * 100);
      const sessionsBar = createProgressBar(sessionsPercentage, 100, 30);
      console.log(`${colors.primary('Sessions:')} ${sessionsBar} ${todaySessions}/${sessionsThreshold}`);
      
      console.log('');
      
      const todayTable = createTable(['Metric', 'Value'], [
        ['Total Cost', formatCurrency(todayCost, data.todayStats.currency)],
        ['Sessions', formatNumber(todaySessions)],
        ['Total Tokens', formatNumber(todayTokens)],
        ['Avg Cost/Session', todaySessions > 0 ? formatCurrency(todayCost / todaySessions, data.todayStats.currency) : formatCurrency(0, data.todayStats.currency)]
      ], {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(todayTable);
      console.log('');
    }
    
    // Live update indicator
    const updateTime = formatDate(data.lastUpdated);
    console.log(colors.subtitle(`🔄 Last updated: ${updateTime}`));
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading active session data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showActivePage;