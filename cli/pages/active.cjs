/**
 * CLI Active Page (CommonJS)
 * Active session exactly like electron UI
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

function createProgressBar(value, maxValue, width = 30) {
  const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return colors.success('█'.repeat(filled)) + colors.inactive('░'.repeat(empty));
}

async function showActivePage(dataAdapter, settings) {
  console.log(showPageHeader('Active Session', 'Real-time session monitoring and current activity'));
  
  try {
    const loadingStop = showLoading('Loading active session data...');
    const data = await dataAdapter.getActiveData();
    loadingStop();
    
    if (!data.activeSession || !data.isActive) {
      console.log('  ' + colors.subtitle('No active session'));
      console.log('  ' + colors.subtitle('Session data will appear here when you start using Claude'));
      console.log('');
      return;
    }

    // Header info (like electron)
    console.log(colors.success(`🔴 ACTIVE SESSION • ${data.activeSession.currency}`));
    console.log('─'.repeat(50));
    console.log('');
    
    // Session Progress (3 progress bars exactly like Electron UI)
    const duration = data.activeSession.duration || 0; // Duration in minutes from database
    const totalSessionTime = 300; // 5 hours = 300 minutes (fixed limit)
    const timeLeft = Math.max(0, totalSessionTime - duration);
    
    // Use Electron UI formula: (duration / (duration + timeLeft)) * 100
    const sessionProgress = duration && timeLeft ? (duration / (duration + timeLeft)) * 100 : 0;
    
    // Token burn rate calculation (exactly like Electron UI)
    const currentTokens = data.activeSession.totalTokens || 0;
    const tokenBurnRate = duration > 0 ? Math.round(currentTokens / duration) : 0;
    
    // Use Electron UI threshold: 150,000 tokens/min for high activity
    const highActivityThreshold = 150000;
    const usageProgress = Math.min(100, (tokenBurnRate / highActivityThreshold) * 100);
    
    // Projection calculations (exactly like Electron UI)
    const projectedTokens = tokenBurnRate > 0 ? Math.round(tokenBurnRate * totalSessionTime) : 0;
    const projectionProgress = projectedTokens > 0 ? Math.min(100, (currentTokens / projectedTokens) * 100) : 0;
    
    console.log(colors.primary('📊 Session Progress'));
    console.log('─'.repeat(50));
    console.log('');
    
    // 1. Session Progress Bar
    const sessionBar = createProgressBar(sessionProgress, 100, 30);
    console.log(`${colors.primary('Session:')}    ${sessionBar} ${sessionProgress.toFixed(1)}%`);
    console.log(`             Started: ${formatDate(data.activeSession.startTime)} | Remaining: ${timeLeft}m`);
    console.log('');
    
    // 2. Token Usage Bar  
    const usageBar = createProgressBar(usageProgress, 100, 30);
    console.log(`${colors.primary('Usage:')}      ${usageBar} ${formatNumber(currentTokens)} tokens`);
    console.log(`             Burn Rate: ${formatNumber(tokenBurnRate)}/min ${tokenBurnRate > 150 ? '[HIGH]' : '[NORMAL]'} | Cost: ${formatCurrency(data.activeSession.totalCost || 0, data.activeSession.currency)}`);
    console.log('');
    
    // 3. Projection Bar
    const costPerToken = currentTokens > 0 ? (data.activeSession.totalCost || 0) / currentTokens : 0;
    const projectedCost = projectedTokens * costPerToken;
    const projectionBar = createProgressBar(projectionProgress, 100, 30);
    console.log(`${colors.primary('Projection:')} ${projectionBar} ${formatNumber(projectedTokens)} tokens`);
    console.log(`             Status: ${tokenBurnRate > 150 ? '[HIGH BURN]' : '[ON TRACK]'} | Projected: ${formatCurrency(projectedCost, data.activeSession.currency)}`);
    console.log('');
    
    // Session Overview (2 cards like electron)
    console.log(colors.primary('📋 Session Overview'));
    console.log('─'.repeat(50));
    console.log('');
    
    const sessionInfo = [
      ['Session Cost', formatCurrency(data.activeSession.totalCost || 0, data.activeSession.currency)],
      ['Tokens Used', formatNumber(currentTokens)],
      ['Session Progress', `${sessionProgress.toFixed(1)}%`],
      ['Status', colors.success('ACTIVE')],
      ['Session ID', data.activeSession.sessionId ? data.activeSession.sessionId.substring(0, 12) + '...' : 'Unknown'],
      ['Last Activity', formatDate(data.activeSession.lastActivity)]
    ];
    
    const infoTable = createTable(['Property', 'Value'], sessionInfo, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(infoTable);
    console.log('');
    
    // Performance & Projections
    console.log(colors.primary('📈 Performance & Projections'));
    console.log('─'.repeat(50));
    console.log('');
    
    const performance = [
      ['Token Burn Rate', `${formatNumber(tokenBurnRate)} tokens/min`],
      ['Cost per Token', costPerToken > 0 ? `$${(costPerToken * 1000000).toFixed(2)}/M` : '$0.00'],
      ['Projected Tokens', formatNumber(projectedTokens)],
      ['Projected Cost', formatCurrency(projectedCost, data.activeSession.currency)],
      ['Time Remaining', `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m`],
      ['Activity Level', tokenBurnRate > 150 ? 'HIGH' : 'NORMAL']
    ];
    
    const perfTable = createTable(['Metric', 'Value'], performance, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(perfTable);
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading active session data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showActivePage;