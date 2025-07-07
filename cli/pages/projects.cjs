/**
 * CLI Projects Page (CommonJS)
 * Project statistics and breakdown
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate, formatPercentage } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showProjectsPage(dataAdapter, settings) {
  console.log(showPageHeader('Projects Overview', 'Project-wise usage statistics and costs'));
  
  try {
    const loadingStop = showLoading('Loading projects data...');
    const data = await dataAdapter.getProjectsData();
    loadingStop();
    
    // Summary stats
    console.log(colors.primary('📁 Projects Summary'));
    console.log('─'.repeat(50));
    console.log('');
    
    const summaryStats = [
      ['Total Projects', formatNumber(data.summary.totalProjects || 0)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Total Sessions', formatNumber(data.summary.totalSessions || 0)],
      ['Total Tokens', formatNumber(data.summary.totalTokens || 0)],
      ['Avg Cost/Project', data.summary.totalProjects > 0 ? 
        formatCurrency((data.summary.totalCost || 0) / data.summary.totalProjects, data.summary.currency) : 
        formatCurrency(0, data.summary.currency)]
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    if (data.projects && data.projects.length > 0) {
      // Detailed projects table
      console.log(colors.primary('📊 Project Details'));
      console.log('─'.repeat(50));
      console.log('');
      
      // Sort projects by cost (descending)
      const sortedProjects = data.projects.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));
      
      const projectRows = sortedProjects.map((project, index) => {
        const costPercentage = data.summary.totalCost > 0 ? 
          ((project.totalCost || 0) / data.summary.totalCost) * 100 : 0;
        
        return [
          `${index + 1}. ${project.name}`,
          formatCurrency(project.totalCost || 0, project.currency),
          formatPercentage(project.totalCost || 0, data.summary.totalCost),
          formatNumber(project.sessionCount || 0),
          formatNumber(project.totalTokens || 0),
          formatCurrency(project.avgCostPerSession || 0, project.currency),
          formatDate(project.lastActivity)
        ];
      });
      
      const projectsTable = createTable(
        ['Project', 'Total Cost', '%', 'Sessions', 'Tokens', 'Avg/Session', 'Last Activity'], 
        projectRows, 
        {
          style: settings.tableStyle,
          compact: settings.compactMode
        }
      );
      
      console.log(projectsTable);
      console.log('');
      
      // Top performers
      console.log(colors.primary('🏆 Top Performers'));
      console.log('─'.repeat(50));
      console.log('');
      
      const topByCost = sortedProjects[0];
      const topBySessions = sortedProjects.sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0))[0];
      const topByTokens = sortedProjects.sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))[0];
      const mostRecent = sortedProjects.sort((a, b) => 
        new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)
      )[0];
      
      const topPerformers = [
        ['Highest Cost', topByCost?.name || 'N/A', formatCurrency(topByCost?.totalCost || 0, data.summary.currency)],
        ['Most Sessions', topBySessions?.name || 'N/A', formatNumber(topBySessions?.sessionCount || 0)],
        ['Most Tokens', topByTokens?.name || 'N/A', formatNumber(topByTokens?.totalTokens || 0)],
        ['Most Recent', mostRecent?.name || 'N/A', formatDate(mostRecent?.lastActivity)]
      ];
      
      const topTable = createTable(['Category', 'Project', 'Value'], topPerformers, {
        style: settings.tableStyle,
        compact: settings.compactMode
      });
      
      console.log(topTable);
      console.log('');
      
      // Distribution insights
      if (data.projects.length >= 3) {
        console.log(colors.primary('📈 Distribution Analysis'));
        console.log('─'.repeat(50));
        console.log('');
        
        // Calculate quartiles
        const costs = data.projects.map(p => p.totalCost || 0).sort((a, b) => b - a);
        const totalCost = data.summary.totalCost || 0;
        
        const top25Percent = costs.slice(0, Math.ceil(costs.length * 0.25));
        const top50Percent = costs.slice(0, Math.ceil(costs.length * 0.5));
        
        const top25Cost = top25Percent.reduce((sum, cost) => sum + cost, 0);
        const top50Cost = top50Percent.reduce((sum, cost) => sum + cost, 0);
        
        const insights = [
          `• Top 25% of projects account for ${formatPercentage(top25Cost, totalCost)} of total cost`,
          `• Top 50% of projects account for ${formatPercentage(top50Cost, totalCost)} of total cost`,
          `• Average cost per project: ${formatCurrency(totalCost / data.projects.length, data.summary.currency)}`,
          `• Cost concentration: ${top25Cost > totalCost * 0.8 ? colors.warning('High') : top25Cost > totalCost * 0.6 ? colors.info('Medium') : colors.success('Low')}`,
          `• Active projects: ${data.projects.filter(p => p.lastActivity && new Date() - new Date(p.lastActivity) < 7 * 24 * 60 * 60 * 1000).length}/${data.projects.length}`
        ];
        
        insights.forEach(insight => {
          console.log('  ' + insight);
        });
        
        console.log('');
      }
      
    } else {
      console.log(colors.subtitle('No projects found. Start using Claude Code to see project statistics.'));
      console.log('');
      
      console.log(colors.info('ℹ Projects are automatically detected from your usage patterns:'));
      console.log('  • Each unique working directory becomes a project');
      console.log('  • Costs and usage are grouped by project');
      console.log('  • Statistics update in real-time');
      console.log('');
    }
    
  } catch (error) {
    console.log(colors.error('✗ Error loading projects data: ' + error.message));
    console.log('');
    console.log(colors.subtitle('This might indicate:'));
    console.log('  • Database connection issues');
    console.log('  • No project data available yet');
    console.log('  • Service initialization problems');
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showProjectsPage;