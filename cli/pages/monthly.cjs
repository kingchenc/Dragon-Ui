/**
 * CLI Monthly Page (CommonJS)
 * Monthly usage exactly like electron UI
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showMonthlyPage(dataAdapter, settings) {
  console.log(showPageHeader('Monthly Usage', 'Month-by-month usage statistics and trends'));
  
  try {
    const loadingStop = showLoading('Loading monthly data...');
    const data = await dataAdapter.getMonthlyData();
    loadingStop();
    
    if (!data.months || data.months.length === 0) {
      console.log('  ' + colors.subtitle('No monthly data available'));
      console.log('  ' + colors.subtitle('Monthly data will appear here when you start using Claude'));
      console.log('');
      return;
    }

    // Header info (like electron)
    console.log(colors.primary(`📅 ${data.summary.totalMonths} Months Tracked • Budget Tracking • ${data.summary.currency}`));
    console.log('─'.repeat(50));
    console.log('');
    
    // Summary Stats (4 cards like electron)
    const currentMonth = data.months[0];
    const avgMonthly = data.summary.totalMonths > 0 ? 
      (data.summary.totalCost || 0) / data.summary.totalMonths : 0;
    const projectedYearly = avgMonthly * 12;
    
    const summaryStats = [
      ['Current Month', formatCurrency(currentMonth?.totalCost || 0, data.summary.currency)],
      ['Monthly Average', formatCurrency(avgMonthly, data.summary.currency)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Projected Yearly', formatCurrency(projectedYearly, data.summary.currency)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    // Monthly Breakdown (like electron)
    console.log(colors.primary('📊 Monthly Breakdown'));
    console.log('─'.repeat(50));
    console.log('');
    
    // Sort months by date (most recent first)
    const sortedMonths = data.months.sort((a, b) => 
      new Date(b.month + '-01') - new Date(a.month + '-01')
    );
    
    const monthRows = sortedMonths.map((month, index) => {
      const monthDate = new Date(month.month + '-01');
      const monthName = monthDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      const avgSessionCost = month.sessionCount > 0 ? 
        (month.totalCost || 0) / month.sessionCount : 0;
      const tokensPerSession = month.sessionCount > 0 ? 
        (month.totalTokens || 0) / month.sessionCount : 0;
      const dailyAvg = month.activeDays > 0 ? 
        (month.totalCost || 0) / month.activeDays : 0;
      
      return [
        index === 0 ? `${monthName} (Current)` : monthName,
        formatCurrency(month.totalCost || 0, month.currency),
        formatCurrency(dailyAvg, month.currency),
        formatNumber(month.totalTokens || 0),
        `${month.activeDays || 0} / ${month.activeDays || 0}`,
        formatCurrency(avgSessionCost, month.currency),
        formatNumber(Math.round(tokensPerSession))
      ];
    });
    
    const monthsTable = createTable(
      ['Month', 'Cost', 'Daily Avg', 'Tokens', 'Active Days', 'Avg Session Cost', 'Tokens/Session'], 
      monthRows, 
      {
        style: settings.tableStyle,
        compact: settings.compactMode
      }
    );
    
    console.log(monthsTable);
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading monthly data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showMonthlyPage;