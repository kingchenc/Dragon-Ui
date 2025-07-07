/**
 * CLI Sessions Page (CommonJS)
 * Session history and statistics
 */

const { colors } = require('../components/colors.cjs');
const { createSessionsTable, createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatDuration, formatSessionId } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showSessionsPage(dataAdapter, settings) {
  console.log(showPageHeader('Sessions Overview', 'Session history and detailed statistics'));
  
  try {
    const loadingStop = showLoading('Loading sessions data...');
    const data = await dataAdapter.getSessionsData();
    loadingStop();
    
    // Summary stats
    console.log(colors.primary('🔄 Sessions Summary'));
    console.log('─'.repeat(50));
    console.log('');
    
    const summaryStats = [
      ['Total Sessions', formatNumber(data.summary.totalSessions || 0)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Total Tokens', formatNumber(data.summary.totalTokens || 0)],
      ['Avg Cost/Session', formatCurrency(data.summary.avgCostPerSession || 0, data.summary.currency)],
      ['Avg Tokens/Session', data.summary.totalSessions > 0 ? 
        formatNumber(Math.round((data.summary.totalTokens || 0) / data.summary.totalSessions)) : 
        formatNumber(0)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    if (data.sessions && data.sessions.length > 0) {
      // Recent sessions table
      console.log(colors.primary('📋 Recent Sessions'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Show latest 20 sessions
      const recentSessions = data.sessions.slice(0, 20);
      
      const sessionRows = recentSessions.map((session, index) => [
        formatSessionId(session.sessionId),
        session.project || 'Unknown',
        formatCurrency(session.totalCost || 0, session.currency),
        formatNumber(session.totalTokens || 0),
        formatDuration(session.duration || 0),
        formatNumber(session.entryCount || 0),
        formatDate(session.startTime)
      ]);
      
      const sessionsTable = createTable(
        ['Session ID', 'Project', 'Cost', 'Tokens', 'Duration', 'Entries', 'Started'], 
        sessionRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(sessionsTable);
      
      if (data.sessions.length > 20) {
        console.log('');
        console.log(colors.subtitle(`Showing 20 of ${data.sessions.length} total sessions`));
      }
      
      console.log('');
      
      // Session analytics
      console.log(colors.primary('📊 Session Analytics'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Calculate statistics
      const costs = data.sessions.map(s => s.totalCost || 0);
      const tokens = data.sessions.map(s => s.totalTokens || 0);
      const durations = data.sessions.map(s => s.duration || 0);
      
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs.filter(c => c > 0));
      const avgCost = costs.reduce((sum, c) => sum + c, 0) / costs.length;
      
      const maxTokens = Math.max(...tokens);
      const minTokens = Math.min(...tokens.filter(t => t > 0));
      const avgTokens = tokens.reduce((sum, t) => sum + t, 0) / tokens.length;
      
      const maxDuration = Math.max(...durations);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      
      const analytics = [
        ['Highest Cost', formatCurrency(maxCost, data.summary.currency)],
        ['Lowest Cost', minCost > 0 ? formatCurrency(minCost, data.summary.currency) : formatCurrency(0, data.summary.currency)],
        ['Average Cost', formatCurrency(avgCost, data.summary.currency)],
        ['Highest Tokens', formatNumber(maxTokens)],
        ['Lowest Tokens', formatNumber(minTokens)],
        ['Average Tokens', formatNumber(Math.round(avgTokens))],
        ['Longest Session', formatDuration(maxDuration)],
        ['Average Duration', formatDuration(avgDuration)]
      ];
      
      const analyticsTable = createTable(['Metric', 'Value'], analytics, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(analyticsTable);
      console.log('');
      
      // Top sessions
      console.log(colors.primary('🏆 Top Sessions'));
      console.log('─'.repeat(50));
      console.log('');
      
      const topByCost = data.sessions.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))[0];
      const topByTokens = data.sessions.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
      const topByDuration = data.sessions.sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
      const mostRecent = data.sessions.sort((a, b) => 
        new Date(b.startTime || 0) - new Date(a.startTime || 0)
      )[0];
      
      const topSessions = [
        ['Most Expensive', formatSessionId(topByCost?.sessionId), formatCurrency(topByCost?.totalCost || 0, data.summary.currency)],
        ['Most Tokens', formatSessionId(topByTokens?.sessionId), formatNumber(topByTokens?.totalTokens || 0)],
        ['Longest Duration', formatSessionId(topByDuration?.sessionId), formatDuration(topByDuration?.duration || 0)],
        ['Most Recent', formatSessionId(mostRecent?.sessionId), formatDate(mostRecent?.startTime)]
      ];
      
      const topTable = createTable(['Category', 'Session ID', 'Value'], topSessions, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(topTable);
      console.log('');
      
      // Session patterns
      console.log(colors.primary('🔍 Session Patterns'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Group by project
      const projectGroups = {};
      data.sessions.forEach(session => {
        const project = session.project || 'Unknown';
        if (!projectGroups[project]) {
          projectGroups[project] = {
            count: 0,
            totalCost: 0,
            totalTokens: 0,
            totalDuration: 0
          };
        }
        projectGroups[project].count++;
        projectGroups[project].totalCost += session.totalCost || 0;
        projectGroups[project].totalTokens += session.totalTokens || 0;
        projectGroups[project].totalDuration += session.duration || 0;
      });
      
      // Find most active project
      const mostActiveProject = Object.entries(projectGroups)
        .sort(([,a], [,b]) => b.count - a.count)[0];
      
      // Group by model
      const modelCounts = {};
      data.sessions.forEach(session => {
        if (session.models && session.models.length > 0) {
          session.models.forEach(model => {
            modelCounts[model] = (modelCounts[model] || 0) + 1;
          });
        }
      });
      
      const topModel = Object.entries(modelCounts)
        .sort(([,a], [,b]) => b - a)[0];
      
      // Time patterns
      const today = new Date();
      const last24h = data.sessions.filter(s => 
        s.startTime && (today - new Date(s.startTime)) < 24 * 60 * 60 * 1000
      ).length;
      
      const last7days = data.sessions.filter(s => 
        s.startTime && (today - new Date(s.startTime)) < 7 * 24 * 60 * 60 * 1000
      ).length;
      
      const patterns = [
        `• Most active project: ${colors.highlight(mostActiveProject?.[0] || 'N/A')} (${formatNumber(mostActiveProject?.[1]?.count || 0)} sessions)`,
        `• Most used model: ${colors.highlight(topModel?.[0] || 'N/A')} (${formatNumber(topModel?.[1] || 0)} sessions)`,
        `• Sessions last 24h: ${formatNumber(last24h)}`,
        `• Sessions last 7 days: ${formatNumber(last7days)}`,
        `• Average session duration: ${formatDuration(avgDuration)}`,
        `• Cost efficiency: ${avgTokens > 0 ? formatCurrency((avgCost / avgTokens) * 1000, data.summary.currency) : formatCurrency(0, data.summary.currency)}/1K tokens`
      ];
      
      patterns.forEach(pattern => {
        console.log('  ' + pattern);
      });
      
      console.log('');
      
    } else {
      console.log(colors.subtitle('No sessions found. Start using Claude Code to see session history.'));
      console.log('');
      
      console.log(colors.info('ℹ Sessions track your individual coding conversations:'));
      console.log('  • Each conversation with Claude creates a session');
      console.log('  • Sessions track costs, tokens, and duration');
      console.log('  • History helps identify usage patterns');
      console.log('');
    }
    
  } catch (error) {
    console.log(colors.error('✗ Error loading sessions data: ' + error.message));
    console.log('');
    console.log(colors.subtitle('This might indicate:'));
    console.log('  • Database connection issues');
    console.log('  • No session data available yet');
    console.log('  • Service initialization problems');
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showSessionsPage;