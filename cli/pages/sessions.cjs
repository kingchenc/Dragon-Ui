/**
 * CLI Sessions Page (CommonJS)
 * Session history exactly like electron UI
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatDuration } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showSessionsPage(dataAdapter, settings) {
  console.log(showPageHeader('Sessions', 'Session history and detailed statistics'));
  
  try {
    const loadingStop = showLoading('Loading sessions data...');
    const data = await dataAdapter.getSessionsData();
    loadingStop();
    
    if (!data.sessions || data.sessions.length === 0) {
      console.log('  ' + colors.subtitle('No session data available'));
      console.log('  ' + colors.subtitle('Session data will appear here when you start using Claude'));
      console.log('');
      return;
    }

    // Header info (like electron)
    const validSessions = data.sessions.filter(s => s.totalCost > 0).length;
    console.log(colors.primary(`⚡ ${data.summary.totalSessions} / 50 Sessions • ${validSessions} / 50 Valid • ${data.summary.currency}`));
    console.log('─'.repeat(50));
    console.log('');
    
    // Summary Stats (3 cards like electron)
    const summaryStats = [
      ['Total Sessions', `${data.summary.totalSessions} / 50`],
      ['Valid Sessions', `${validSessions} / 50`],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    // Session Insights (like electron)
    console.log(colors.primary('📊 Session Insights'));
    console.log('─'.repeat(50));
    console.log('');
    
    const avgCost = data.summary.totalSessions > 0 ? 
      (data.summary.totalCost || 0) / data.summary.totalSessions : 0;
    const avgTokens = data.summary.totalSessions > 0 ? 
      (data.summary.totalTokens || 0) / data.summary.totalSessions : 0;
    const mostRecent = data.sessions[0];
    
    const insights = [
      ['Avg Session Cost', formatCurrency(avgCost, data.summary.currency)],
      ['Avg Tokens', formatNumber(Math.round(avgTokens))],
      ['Most Recent Session', mostRecent?.startTime ? formatDate(mostRecent.startTime) : 'No sessions yet']
    ];
    
    const insightsTable = createTable(['Property', 'Value'], insights, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(insightsTable);
    console.log('');
    
    // Session History (like electron)
    console.log(colors.primary('📋 Session History'));
    console.log('─'.repeat(50));
    console.log('');
    
    const sessionRows = data.sessions.slice(0, 10).map((session, index) => {
      return [
        session.sessionId || `#${index + 1}`,
        formatCurrency(session.totalCost || 0, session.currency),
        formatNumber(session.totalTokens || 0),
        formatDuration(session.duration || 0),
        formatNumber(session.entryCount || 0),
        formatDate(session.startTime),
        session.endTime ? formatDate(session.endTime) : (index === 0 ? 'Active' : 'Unknown')
      ];
    });
    
    const sessionsTable = createTable(
      ['Session ID', 'Cost', 'Tokens', 'Duration', 'Conversations', 'Started', 'Status'], 
      sessionRows, 
      {
        style: settings.tableStyle,
        compact: settings.compactMode
      }
    );
    
    console.log(sessionsTable);
    
    if (data.sessions.length > 10) {
      console.log('');
      console.log(colors.subtitle(`Showing 10 of ${data.sessions.length} total sessions`));
    }
    
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading sessions data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showSessionsPage;