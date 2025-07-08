/**
 * CLI Overview Page (CommonJS)
 * Dashboard data and statistics
 */

const { colors } = require('../components/colors.cjs');
const { createTable, createStatsTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');
const { createBox, createTwoColumnLayout } = require('../utils/screen.cjs');

async function showOverviewPage(dataAdapter, settings) {
  console.log(showPageHeader('Overview Dashboard', 'Complete usage statistics and insights'));
  
  try {
    const loadingStop = showLoading('Loading overview data...');
    const data = await dataAdapter.getOverviewData();
    loadingStop();
    
    // Main statistics (like electron overview)
    console.log(colors.primary('📊 Usage Statistics'));
    console.log('─'.repeat(50));
    console.log('');
    
    const mainStats = [
      ['Total Cost', formatCurrency(data.totalCost, data.currency)],
      ['Total Sessions', `${data.totalSessions} / 50`],
      ['Average Cost/Session', formatCurrency(data.averageCostPerSession, data.currency)],
      ['Total Tokens', formatNumber(data.totalTokens)],
      ['Status', data.status],
      ['Active Days', `${data.activeDays} / ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`],
      ['Models Used', data.models && data.models.length > 0 ? data.models.join(', ') : 'None']
    ];
    
    const statsTable = createTable(['Metric', 'Value'], mainStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(statsTable);
    console.log('');
    
    // Current Session Table
    let sessionTable = '';
    if (data.currentSession && data.currentSession.active) {
      const sessionInfo = [
        ['Started', formatDate(data.currentSession.started)],
        ['Duration', `${Math.floor(data.currentSession.duration / 60)}h ${data.currentSession.duration % 60}m`],
        ['Cost', formatCurrency(data.currentSession.cost, data.currency)],
        ['Time Left', '4h 50m'],
        ['Last Activity', formatDate(data.lastActivity)],
        ['Session ID', data.currentSession.id ? data.currentSession.id.substring(0, 8) + '...' : 'Unknown']
      ];
      
      sessionTable = createTable(['Property', 'Value'], sessionInfo, {
        style: settings.tableStyle,
        compact: true
      });
    } else {
      sessionTable = '  No active session\n  Start using Claude to begin tracking';
    }
    
    // Quick Stats Table
    const quickStats = [
      ['Total Cost', formatCurrency(data.totalCost, data.currency)],
      ['Total Tokens', formatNumber(data.totalTokens)],
      ['Sessions', `${data.totalSessions} / 50`],
      ['Avg. Tokens/Session', formatNumber(data.avgTokensPerSession)]
    ];
    
    const quickTable = createTable(['Metric', 'Value'], quickStats, {
      style: settings.tableStyle,
      compact: true
    });
    
    // Current session (separate section)
    console.log(colors.primary('⚡ Current Session'));
    console.log('─'.repeat(50));
    console.log('');
    console.log(sessionTable);
    console.log('');
    
    // Quick stats (separate section)
    console.log(colors.primary('📊 Quick Stats'));
    console.log('─'.repeat(50));
    console.log('');
    console.log(quickTable);
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading overview data: ' + error.message));
    console.log('');
    console.log(colors.subtitle('This might indicate:'));
    console.log('  • Database connection issues');
    console.log('  • No usage data available yet');
    console.log('  • Service initialization problems');
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showOverviewPage;