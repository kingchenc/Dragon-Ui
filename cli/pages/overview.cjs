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
    
    // Main statistics
    console.log(colors.primary('📊 Usage Statistics'));
    console.log('─'.repeat(50));
    console.log('');
    
    const statsTable = createStatsTable({
      totalCost: data.totalCost,
      totalSessions: data.totalSessions,
      totalProjects: data.totalProjects,
      totalTokens: data.totalTokens,
      activeDays: data.activeDays,
      lastActivity: data.lastActivity,
      currency: data.currency
    }, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(statsTable);
    console.log('');
    
    // Current month breakdown
    if (data.currentMonth && data.currentMonth.total_cost > 0) {
      console.log(colors.primary('📅 Current Month'));
      console.log('─'.repeat(50));
      console.log('');
      
      const monthStats = [
        ['Cost', formatCurrency(data.currentMonth.total_cost, data.currency)],
        ['Sessions', formatNumber(data.currentMonth.session_count)],
        ['Tokens', formatNumber(data.currentMonth.total_tokens)],
        ['Avg per Session', data.currentMonth.session_count > 0 ? 
          formatCurrency(data.currentMonth.total_cost / data.currentMonth.session_count, data.currency) : 
          formatCurrency(0, data.currency)]
      ];
      
      const monthTable = createTable(['Metric', 'Value'], monthStats, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(monthTable);
      console.log('');
    }
    
    // Top projects
    if (data.topProjects && data.topProjects.length > 0) {
      console.log(colors.primary('🏆 Top Projects'));
      console.log('─'.repeat(50));
      console.log('');
      
      const projectRows = data.topProjects.slice(0, 5).map(project => [
        project.project || 'Unknown',
        formatCurrency(project.total_cost || 0, data.currency),
        formatNumber(project.session_count || 0),
        formatNumber(project.total_tokens || 0),
        formatDate(project.last_activity)
      ]);
      
      const projectsTable = createTable(
        ['Project', 'Cost', 'Sessions', 'Tokens', 'Last Activity'], 
        projectRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(projectsTable);
      console.log('');
    }
    
    // Recent activity
    if (data.recentSessions && data.recentSessions.length > 0) {
      console.log(colors.primary('⚡ Recent Activity'));
      console.log('─'.repeat(50));
      console.log('');
      
      const recentRows = data.recentSessions.slice(0, 5).map(session => [
        session.session_id ? session.session_id.substring(0, 8) + '...' : 'Unknown',
        session.project || 'Unknown',
        formatCurrency(session.total_cost || 0, data.currency),
        formatNumber(session.total_tokens || 0),
        formatDate(session.start_time)
      ]);
      
      const recentTable = createTable(
        ['Session', 'Project', 'Cost', 'Tokens', 'Started'], 
        recentRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(recentTable);
      console.log('');
    }
    
    // Database info
    console.log(colors.primary('💾 Database Information'));
    console.log('─'.repeat(50));
    console.log('');
    
    const dbInfo = [
      ['Total Entries', formatNumber(data.totalEntries)],
      ['Database Size', `${data.databaseSize.toFixed(2)} MB`],
      ['Last Updated', formatDate(data.lastUpdated)],
      ['Currency', data.currency]
    ];
    
    const dbTable = createTable(['Property', 'Value'], dbInfo, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(dbTable);
    console.log('');
    
    // Quick insights
    if (data.totalSessions > 0) {
      console.log(colors.primary('💡 Quick Insights'));
      console.log('─'.repeat(50));
      console.log('');
      
      const avgCostPerSession = data.totalCost / data.totalSessions;
      const avgTokensPerSession = data.totalTokens / data.totalSessions;
      const avgCostPerToken = data.totalTokens > 0 ? data.totalCost / data.totalTokens : 0;
      const activityRate = data.activeDays > 0 && data.totalSessions > 0 ? 
        (data.activeDays / (data.totalSessions / (data.totalSessions / data.activeDays))) * 100 : 0;
      
      const insights = [
        `• Average cost per session: ${formatCurrency(avgCostPerSession, data.currency)}`,
        `• Average tokens per session: ${formatNumber(Math.round(avgTokensPerSession))}`,
        `• Cost per token: ${formatCurrency(avgCostPerToken, data.currency)}`,
        `• Activity rate: ${colors.number(activityRate.toFixed(1) + '%')} of tracked days`,
        data.lastActivity ? 
          `• Last seen: ${formatDate(data.lastActivity)}` : 
          '• No recent activity detected'
      ];
      
      insights.forEach(insight => {
        console.log('  ' + insight);
      });
      
      console.log('');
    }
    
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