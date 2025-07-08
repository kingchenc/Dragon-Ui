/**
 * CLI Projects Page (CommonJS)
 * Project statistics exactly like electron UI
 */

const { colors } = require('../components/colors.cjs');
const { createTable } = require('../components/table.cjs');
const { formatCurrency, formatNumber, formatDate } = require('../components/formatting.cjs');
const { showPageHeader, showLoading } = require('../utils/navigation.cjs');

async function showProjectsPage(dataAdapter, settings) {
  console.log(showPageHeader('Projects', 'Project breakdown and analytics'));
  
  try {
    const loadingStop = showLoading('Loading projects data...');
    const data = await dataAdapter.getProjectsData();
    loadingStop();
    
    if (!data.projects || data.projects.length === 0) {
      console.log('  ' + colors.subtitle('No project data available'));
      console.log('  ' + colors.subtitle('Project data will appear here when you start using Claude'));
      console.log('');
      return;
    }

    // Header info (like electron)
    console.log(colors.primary(`📁 ${data.summary.totalProjects} Projects • ${data.summary.currency}`));
    console.log('─'.repeat(50));
    console.log('');
    
    // Summary Stats (3 cards like electron)
    const summaryStats = [
      ['Total Projects', formatNumber(data.summary.totalProjects || 0)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Most Active', data.projects[0]?.name || 'N/A']
    ];
    
    const summaryTable = createTable(['Metric', 'Value'], summaryStats, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(summaryTable);
    console.log('');
    
    // Project Insights (like electron)
    console.log(colors.primary('🔍 Project Insights'));
    console.log('─'.repeat(50));
    console.log('');
    
    const mostActive = data.projects[0];
    const avgPerProject = data.summary.totalProjects > 0 ? 
      (data.summary.totalCost || 0) / data.summary.totalProjects : 0;
    
    const insights = [
      ['Most Active Project', mostActive?.name || 'N/A'],
      ['Sessions', formatNumber(mostActive?.sessionCount || 0)],
      ['Cost', formatCurrency(mostActive?.totalCost || 0, data.summary.currency)],
      ['Projects Tracked', formatNumber(data.summary.totalProjects)],
      ['Total Cost', formatCurrency(data.summary.totalCost || 0, data.summary.currency)],
      ['Avg per Project', formatCurrency(avgPerProject, data.summary.currency)]
    ];
    
    const insightsTable = createTable(['Property', 'Value'], insights, {
      style: settings.tableStyle,
      compact: settings.compactMode
    });
    
    console.log(insightsTable);
    console.log('');
    
    // Projects Breakdown (like electron)
    console.log(colors.primary('📊 Project Breakdown'));
    console.log('─'.repeat(50));
    console.log('');
    
    // Sort projects by cost (descending)
    const sortedProjects = data.projects.sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));
    
    const projectRows = sortedProjects.map((project, index) => {
      const percentage = data.summary.totalCost > 0 ? 
        (((project.totalCost || 0) / data.summary.totalCost) * 100).toFixed(1) : '0.0';
      
      return [
        project.name || `Project ${index + 1}`,
        formatCurrency(project.totalCost || 0, project.currency),
        formatNumber(project.totalTokens || 0),
        formatNumber(project.sessionCount || 0),
        formatCurrency(project.avgCostPerSession || 0, project.currency),
        `${percentage}%`,
        formatDate(project.lastActivity)
      ];
    });
    
    const projectsTable = createTable(
      ['Project', 'Cost', 'Tokens', 'Sessions', 'Avg/Session', '% Total', 'Last Activity'], 
      projectRows, 
      {
        style: settings.tableStyle,
        compact: settings.compactMode
      }
    );
    
    console.log(projectsTable);
    console.log('');
    
  } catch (error) {
    console.log(colors.error('✗ Error loading projects data: ' + error.message));
    console.log('');
  }
  
  console.log(colors.subtitle('Commands: [0] Menu [1] Overview [2] Projects [3] Sessions [4] Monthly [5] Daily [6] Active [r] Refresh [q] Quit'));
}

module.exports = showProjectsPage;