/**
 * CLI Monthly Page (CommonJS)
 * Monthly usage statistics and trends
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatPercentage } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showMonthlyPage(dataAdapter, settings) {
  console.log(showPageHeader('Monthly Usage', 'Month-by-month usage statistics and trends'));
  
  try {
    const loadingStop = showLoading('Loading monthly data...');
    const data = await dataAdapter.getMonthlyData();
    loadingStop();
    
    // Summary stats
    console.log(colors.primary('📅 Monthly Summary'));
    console.log('─'.repeat(50));
    console.log('');
    
    const summaryStats = [
      ['Total Months', formatNumber(data.summary.totalMonths || 0)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Total Sessions', formatNumber(data.summary.totalSessions || 0)],
      ['Total Tokens', formatNumber(data.summary.totalTokens || 0)],
      ['Avg Cost/Month', data.summary.totalMonths > 0 ? 
        formatCurrency((data.summary.totalCost || 0) / data.summary.totalMonths, data.summary.currency) : 
        formatCurrency(0, data.summary.currency)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    if (data.months && data.months.length > 0) {
      // Monthly breakdown table
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
        
        const costPercentage = data.summary.totalCost > 0 ? 
          ((month.totalCost || 0) / data.summary.totalCost) * 100 : 0;
        
        return [
          monthName,
          formatCurrency(month.totalCost || 0, month.currency),
          formatPercentage(month.totalCost || 0, data.summary.totalCost),
          formatNumber(month.sessionCount || 0),
          formatNumber(month.totalTokens || 0),
          formatNumber(month.activeDays || 0),
          formatCurrency(month.avgDailyCost || 0, month.currency)
        ];
      });
      
      const monthsTable = createTable(
        ['Month', 'Total Cost', '%', 'Sessions', 'Tokens', 'Active Days', 'Avg/Day'], 
        monthRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(monthsTable);
      console.log('');
      
      // Monthly insights
      if (data.months.length >= 2) {
        console.log(colors.primary('📈 Monthly Trends'));
        console.log('─'.repeat(50));
        console.log('');
        
        const currentMonth = sortedMonths[0];
        const previousMonth = sortedMonths[1];
        
        const costChange = currentMonth.totalCost - previousMonth.totalCost;
        const costChangePercent = previousMonth.totalCost > 0 ? 
          (costChange / previousMonth.totalCost) * 100 : 0;
        
        const sessionChange = currentMonth.sessionCount - previousMonth.sessionCount;
        const tokenChange = currentMonth.totalTokens - previousMonth.totalTokens;
        
        const trends = [
          ['Cost Change', 
            costChange >= 0 ? 
              colors.warning(`+${formatCurrency(Math.abs(costChange), currentMonth.currency)} (${costChangePercent.toFixed(1)}%)`) :
              colors.success(`-${formatCurrency(Math.abs(costChange), currentMonth.currency)} (${Math.abs(costChangePercent).toFixed(1)}%)`)
          ],
          ['Session Change', 
            sessionChange >= 0 ? 
              colors.info(`+${formatNumber(Math.abs(sessionChange))}`) :
              colors.warning(`-${formatNumber(Math.abs(sessionChange))}`)
          ],
          ['Token Change', 
            tokenChange >= 0 ? 
              colors.info(`+${formatNumber(Math.abs(tokenChange))}`) :
              colors.warning(`-${formatNumber(Math.abs(tokenChange))}`)
          ]
        ];
        
        const trendsTable = createTable(['Metric', 'Change (vs Previous Month)'], trends, {
          style: settings.tableStyle,
          compact: settings.compactMode
        });
        
        console.log(trendsTable);
        console.log('');
      }
      
      // Monthly records
      console.log(colors.primary('🏆 Monthly Records'));
      console.log('─'.repeat(50));
      console.log('');
      
      const highestCost = sortedMonths.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))[0];
      const mostSessions = sortedMonths.sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0))[0];
      const mostTokens = sortedMonths.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
      const mostActiveDays = sortedMonths.sort((a, b) => (b.activeDays || 0) - (a.activeDays || 0))[0];
      
      const formatMonth = (month) => {
        const monthDate = new Date(month + '-01');
        return monthDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
      };
      
      const records = [
        ['Highest Cost', formatMonth(highestCost?.month || ''), formatCurrency(highestCost?.totalCost || 0, data.summary.currency)],
        ['Most Sessions', formatMonth(mostSessions?.month || ''), formatNumber(mostSessions?.sessionCount || 0)],
        ['Most Tokens', formatMonth(mostTokens?.month || ''), formatNumber(mostTokens?.totalTokens || 0)],
        ['Most Active Days', formatMonth(mostActiveDays?.month || ''), formatNumber(mostActiveDays?.activeDays || 0)]
      ];
      
      const recordsTable = createTable(['Record', 'Month', 'Value'], records, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(recordsTable);
      console.log('');
      
      // Usage patterns
      console.log(colors.primary('🔍 Usage Patterns'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Calculate averages
      const avgCostPerMonth = data.summary.totalCost / data.months.length;
      const avgSessionsPerMonth = data.summary.totalSessions / data.months.length;
      const avgTokensPerMonth = data.summary.totalTokens / data.months.length;
      
      // Find consistency
      const costs = data.months.map(m => m.totalCost || 0);
      const maxCost = Math.max(...costs);
      const minCost = Math.min(...costs.filter(c => c > 0));
      const costVariability = maxCost > 0 ? ((maxCost - minCost) / maxCost) * 100 : 0;
      
      // Peak analysis
      const totalDays = data.months.reduce((sum, m) => sum + (m.activeDays || 0), 0);
      const totalPossibleDays = data.months.length * 30; // Approximate
      const activityRate = totalPossibleDays > 0 ? (totalDays / totalPossibleDays) * 100 : 0;
      
      const patterns = [
        `• Average monthly cost: ${formatCurrency(avgCostPerMonth, data.summary.currency)}`,
        `• Average sessions/month: ${formatNumber(Math.round(avgSessionsPerMonth))}`,
        `• Average tokens/month: ${formatNumber(Math.round(avgTokensPerMonth))}`,
        `• Cost variability: ${colors.number(costVariability.toFixed(1) + '%')} ${costVariability < 30 ? colors.success('(Consistent)') : costVariability < 60 ? colors.warning('(Variable)') : colors.error('(Highly Variable)')}`,
        `• Activity rate: ${colors.number(activityRate.toFixed(1) + '%')} of possible days`,
        `• Peak month: ${formatMonth(highestCost?.month || '')} (${formatCurrency(highestCost?.totalCost || 0, data.summary.currency)})`
      ];
      
      patterns.forEach(pattern => {
        console.log('  ' + pattern);
      });
      
      console.log('');
      
    } else {
      console.log(colors.subtitle('No monthly data found. Start using Claude Code to see monthly statistics.'));
      console.log('');
      
      console.log(colors.info('ℹ Monthly statistics track your usage over time:'));
      console.log('  • Costs and usage aggregated by calendar month');
      console.log('  • Trends and patterns analysis');
      console.log('  • Budget planning and forecasting');
      console.log('');
    }
    
  } catch (error) {
    console.log(colors.error('✗ Error loading monthly data: ' + error.message));
    console.log('');
    console.log(colors.subtitle('This might indicate:'));
    console.log('  • Database connection issues');
    console.log('  • No monthly data available yet');
    console.log('  • Service initialization problems');
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showMonthlyPage;