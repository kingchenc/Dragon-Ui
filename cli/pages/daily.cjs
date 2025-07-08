/**
 * CLI Daily Page (CommonJS)
 * Daily usage exactly like electron UI
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showDailyPage(dataAdapter, settings) {
  console.log(showPageHeader('Daily Usage', 'Day-by-day usage patterns and activity'));
  
  try {
    const loadingStop = showLoading('Loading daily data...');
    const data = await dataAdapter.getDailyData();
    loadingStop();
    
    if (!data.days || data.days.length === 0) {
      console.log('  ' + colors.subtitle('No daily data available'));
      console.log('  ' + colors.subtitle('Daily data will appear here when you start using Claude'));
      console.log('');
      return;
    }

    // Header info (like electron)
    console.log(colors.primary(`🕒 ${data.summary.totalDays} Days Tracked • ${data.summary.activeDays} Active Days • ${data.summary.currency}`));
    console.log('─'.repeat(50));
    console.log('');
    
    // Today vs Yesterday (2 cards like electron)
    const sortedDays = data.days.sort((a, b) => new Date(b.date) - new Date(a.date));
    const today = sortedDays.find(d => {
      const dayDate = new Date(d.date);
      const todayDate = new Date();
      return dayDate.toDateString() === todayDate.toDateString();
    });
    const yesterday = sortedDays.find(d => {
      const dayDate = new Date(d.date);
      const yesterdayDate = new Date(Date.now() - 86400000);
      return dayDate.toDateString() === yesterdayDate.toDateString();
    });
    const lastActive = sortedDays.find(d => (d.totalCost || 0) > 0);
    
    const todayVsYesterday = [
      ['Today', formatCurrency(today?.totalCost || 0, data.summary.currency), 
       formatNumber(today?.totalTokens || 0), 
       formatNumber(today?.sessionCount || 0), 
       formatNumber(today?.modelCount || 0)],
      ['Yesterday/Last', formatCurrency((yesterday || lastActive)?.totalCost || 0, data.summary.currency), 
       formatNumber((yesterday || lastActive)?.totalTokens || 0), 
       formatNumber((yesterday || lastActive)?.sessionCount || 0), 
       formatNumber((yesterday || lastActive)?.modelCount || 0)]
    ];
    
    const todayTable = createTable(['Period', 'Cost', 'Tokens', 'Sessions', 'Models'], todayVsYesterday, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(todayTable);
    console.log('');
    
    // Usage Summary (3 cards like electron)
    console.log(colors.primary('📊 Usage Summary'));
    console.log('─'.repeat(50));
    console.log('');
    
    const activityRate = data.summary.totalDays > 0 ? 
      Math.round((data.summary.activeDays / data.summary.totalDays) * 100) : 0;
    
    const usageSummary = [
      ['Total Cost (Last 7 Days)', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Daily Average', formatCurrency(data.summary.avgDailyCost || 0, data.summary.currency)],
      ['Activity Rate', `${activityRate}% (${data.summary.activeDays} / ${data.summary.totalDays} days)`]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], usageSummary, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    // Daily Breakdown (like electron)
    console.log(colors.primary(`📅 Daily History (Last ${Math.min(30, data.days.length)} Days)`));
    console.log('─'.repeat(50));
    console.log('');
    
    const dayRows = sortedDays.slice(0, 10).map((day, index) => {
      const dayDate = new Date(day.date);
      const isToday = dayDate.toDateString() === new Date().toDateString();
      const isYesterday = dayDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
      
      let dateLabel = dayDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
      
      if (isToday) dateLabel += ' (Today)';
      else if (isYesterday) dateLabel += ' (Yesterday)';
      
      const hasActivity = (day.totalCost || 0) > 0;
      
      return [
        dateLabel,
        hasActivity ? formatCurrency(day.totalCost || 0, day.currency) : '$0.00',
        hasActivity ? formatNumber(day.totalTokens || 0) : '0',
        hasActivity ? formatNumber(day.sessionCount || 0) : '0',
        hasActivity ? formatNumber(day.modelCount || 0) : '0'
      ];
    });
    
    const daysTable = createTable(
      ['Date', 'Cost', 'Tokens', 'Sessions', 'Models'], 
      dayRows, 
      {
        style: settings.tableStyle,
        compact: settings.compactMode
      }
    );
    
    console.log(daysTable);
    
    if (data.days.length > 10) {
      console.log('');
      console.log(colors.subtitle(`Showing 10 of ${data.days.length} total days`));
    }
    
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading daily data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showDailyPage;