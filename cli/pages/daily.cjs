/**
 * CLI Daily Page (CommonJS)
 * Daily usage statistics and patterns
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatPercentage } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showDailyPage(dataAdapter, settings) {
  console.log(showPageHeader('Daily Usage', 'Daily usage patterns and detailed breakdown'));
  
  try {
    const loadingStop = showLoading('Loading daily data...');
    const data = await dataAdapter.getDailyData();
    loadingStop();
    
    // Summary stats
    console.log(colors.primary('📅 Daily Summary (Last 30 Days)'));
    console.log('─'.repeat(50));
    console.log('');
    
    const summaryStats = [
      ['Total Days', formatNumber(data.summary.totalDays || 0)],
      ['Active Days', formatNumber(data.summary.activeDays || 0)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Total Sessions', formatNumber(data.summary.totalSessions || 0)],
      ['Total Tokens', formatNumber(data.summary.totalTokens || 0)],
      ['Avg Daily Cost', formatCurrency(data.summary.avgDailyCost || 0, data.summary.currency)],
      ['Activity Rate', data.summary.totalDays > 0 ? 
        formatPercentage(data.summary.activeDays, data.summary.totalDays) : 
        formatPercentage(0, 1)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    if (data.days && data.days.length > 0) {
      // Recent days breakdown
      console.log(colors.primary('📊 Recent Daily Activity'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Sort days by date (most recent first) and show last 14 days
      const sortedDays = data.days
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 14);
      
      const dayRows = sortedDays.map((day, index) => {
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
          hasActivity ? formatCurrency(day.totalCost || 0, day.currency) : colors.inactive('$0.00'),
          hasActivity ? formatNumber(day.sessionCount || 0) : colors.inactive('0'),
          hasActivity ? formatNumber(day.totalTokens || 0) : colors.inactive('0'),
          hasActivity && day.models && day.models.length > 0 ? 
            formatNumber(day.models.length) : colors.inactive('0'),
          hasActivity && day.models && day.models.length > 0 ? 
            day.models.slice(0, 2).join(', ') + (day.models.length > 2 ? '...' : '') : 
            colors.inactive('None'),
          hasActivity ? formatNumber(day.entryCount || 0) : colors.inactive('0')
        ];
      });
      
      const daysTable = createTable(
        ['Date', 'Cost', 'Sessions', 'Tokens', 'Models', 'Model Names', 'Entries'], 
        dayRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(daysTable);
      
      if (data.days.length > 14) {
        console.log('');
        console.log(colors.subtitle(`Showing 14 of ${data.days.length} total days`));
      }
      
      console.log('');
      
      // Today vs Yesterday comparison
      const today = data.days.find(d => {
        const dayDate = new Date(d.date);
        return dayDate.toDateString() === new Date().toDateString();
      });
      
      const yesterday = data.days.find(d => {
        const dayDate = new Date(d.date);
        return dayDate.toDateString() === new Date(Date.now() - 86400000).toDateString();
      });
      
      if (today || yesterday) {
        console.log(colors.primary('⚡ Today vs Yesterday'));
        console.log('─'.repeat(50));
        console.log('');
        
        const comparison = [
          ['Cost', 
            today ? formatCurrency(today.totalCost || 0, today.currency) : colors.inactive('$0.00'),
            yesterday ? formatCurrency(yesterday.totalCost || 0, yesterday.currency) : colors.inactive('$0.00')
          ],
          ['Sessions', 
            today ? formatNumber(today.sessionCount || 0) : colors.inactive('0'),
            yesterday ? formatNumber(yesterday.sessionCount || 0) : colors.inactive('0')
          ],
          ['Tokens', 
            today ? formatNumber(today.totalTokens || 0) : colors.inactive('0'),
            yesterday ? formatNumber(yesterday.totalTokens || 0) : colors.inactive('0')
          ],
          ['Models Used', 
            today && today.models ? formatNumber(today.models.length) : colors.inactive('0'),
            yesterday && yesterday.models ? formatNumber(yesterday.models.length) : colors.inactive('0')
          ]
        ];
        
        const comparisonTable = createTable(['Metric', 'Today', 'Yesterday'], comparison, {
          style: settings.tableStyle,
          compact: settings.compactMode
        });
        
        console.log(comparisonTable);
        console.log('');
      }
      
      // Weekly patterns
      console.log(colors.primary('📈 Weekly Patterns'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Group by day of week
      const weeklyStats = {};
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Initialize all days
      dayNames.forEach(day => {
        weeklyStats[day] = {
          totalCost: 0,
          totalSessions: 0,
          totalTokens: 0,
          activeDays: 0,
          days: 0
        };
      });
      
      data.days.forEach(day => {
        const dayDate = new Date(day.date);
        const dayName = dayNames[dayDate.getDay()];
        
        weeklyStats[dayName].days++;
        if ((day.totalCost || 0) > 0) {
          weeklyStats[dayName].activeDays++;
          weeklyStats[dayName].totalCost += day.totalCost || 0;
          weeklyStats[dayName].totalSessions += day.sessionCount || 0;
          weeklyStats[dayName].totalTokens += day.totalTokens || 0;
        }
      });
      
      const weeklyRows = Object.entries(weeklyStats).map(([dayName, stats]) => [
        dayName,
        formatCurrency(stats.totalCost, data.summary.currency),
        formatNumber(stats.totalSessions),
        formatNumber(stats.totalTokens),
        `${stats.activeDays}/${stats.days}`,
        stats.days > 0 ? formatPercentage(stats.activeDays, stats.days) : formatPercentage(0, 1)
      ]);
      
      const weeklyTable = createTable(
        ['Day of Week', 'Total Cost', 'Sessions', 'Tokens', 'Active/Total', 'Activity %'], 
        weeklyRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(weeklyTable);
      console.log('');
      
      // Daily records
      console.log(colors.primary('🏆 Daily Records'));
      console.log('─'.repeat(50));
      console.log('');
      
      const activeDays = data.days.filter(d => (d.totalCost || 0) > 0);
      
      if (activeDays.length > 0) {
        const highestCost = activeDays.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))[0];
        const mostSessions = activeDays.sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0))[0];
        const mostTokens = activeDays.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
        const mostModels = activeDays.sort((a, b) => 
          (b.models?.length || 0) - (a.models?.length || 0)
        )[0];
        
        const records = [
          ['Highest Cost', formatDate(highestCost?.date), formatCurrency(highestCost?.totalCost || 0, data.summary.currency)],
          ['Most Sessions', formatDate(mostSessions?.date), formatNumber(mostSessions?.sessionCount || 0)],
          ['Most Tokens', formatDate(mostTokens?.date), formatNumber(mostTokens?.totalTokens || 0)],
          ['Most Models', formatDate(mostModels?.date), formatNumber(mostModels?.models?.length || 0)]
        ];
        
        const recordsTable = createTable(['Record', 'Date', 'Value'], records, {
          style: settings.tableStyle,
          compact: settings.compactMode
        });
        
        console.log(recordsTable);
        console.log('');
      }
      
      // Usage insights
      console.log(colors.primary('🔍 Usage Insights'));
      console.log('─'.repeat(50));
      console.log('');
      
      const activeDaysCount = data.summary.activeDays || 0;
      const totalDaysCount = data.summary.totalDays || 0;
      const avgCostActiveDay = activeDaysCount > 0 ? 
        (data.summary.totalCost || 0) / activeDaysCount : 0;
      
      // Find streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      
      const recentDays = data.days
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30); // Last 30 days
      
      recentDays.forEach((day, index) => {
        const hasActivity = (day.totalCost || 0) > 0;
        
        if (hasActivity) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
          
          // Check if this is part of current streak (from today backwards)
          const dayDate = new Date(day.date);
          const daysDiff = Math.floor((new Date() - dayDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= currentStreak) {
            currentStreak = tempStreak;
          }
        } else {
          tempStreak = 0;
        }
      });
      
      // Most productive day of week
      const productiveDayOfWeek = Object.entries(weeklyStats)
        .sort(([,a], [,b]) => b.totalCost - a.totalCost)[0];
      
      const insights = [
        `• Activity rate: ${formatPercentage(activeDaysCount, totalDaysCount)} (${activeDaysCount}/${totalDaysCount} days)`,
        `• Average cost on active days: ${formatCurrency(avgCostActiveDay, data.summary.currency)}`,
        `• Current activity streak: ${colors.number(currentStreak.toString())} days`,
        `• Longest activity streak: ${colors.number(longestStreak.toString())} days`,
        `• Most productive day: ${colors.highlight(productiveDayOfWeek?.[0] || 'N/A')} (${formatCurrency(productiveDayOfWeek?.[1]?.totalCost || 0, data.summary.currency)})`,
        `• Consistency: ${activeDaysCount > totalDaysCount * 0.7 ? colors.success('High') : activeDaysCount > totalDaysCount * 0.4 ? colors.warning('Medium') : colors.error('Low')} usage frequency`
      ];
      
      insights.forEach(insight => {
        console.log('  ' + insight);
      });
      
      console.log('');
      
    } else {
      console.log(colors.subtitle('No daily data found. Start using Claude Code to see daily statistics.'));
      console.log('');
      
      console.log(colors.info('ℹ Daily statistics show your usage patterns:'));
      console.log('  • Cost and usage breakdown by day');
      console.log('  • Activity streaks and patterns');
      console.log('  • Day-of-week analysis');
      console.log('');
    }
    
  } catch (error) {
    console.log(colors.error('✗ Error loading daily data: ' + error.message));
    console.log('');
    console.log(colors.subtitle('This might indicate:'));
    console.log('  • Database connection issues');
    console.log('  • No daily data available yet');
    console.log('  • Service initialization problems');
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showDailyPage;