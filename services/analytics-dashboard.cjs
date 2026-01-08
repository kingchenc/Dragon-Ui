/**
 * Analytics Dashboard Service for Dragon-UI
 * Time series visualization, model breakdown, account stats, token breakdown
 *
 * @module services/analytics-dashboard
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Time period types
 */
const TIME_PERIOD = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year'
};

/**
 * Chart types
 */
const CHART_TYPE = {
  LINE: 'line',
  BAR: 'bar',
  PIE: 'pie',
  STACKED: 'stacked',
  AREA: 'area'
};

/**
 * Metric types for analytics
 */
const METRIC_TYPE = {
  COST: 'cost',
  TOKENS: 'tokens',
  SESSIONS: 'sessions',
  REQUESTS: 'requests',
  DURATION: 'duration'
};

/**
 * Analytics Dashboard class
 */
class AnalyticsDashboard {
  constructor(databaseService) {
    this.db = databaseService;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get cached data or compute fresh
   * @param {string} key
   * @param {Function} computeFn
   * @returns {any}
   */
  getCached(key, computeFn) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = computeFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  // ============================================
  // TIME SERIES DATA
  // ============================================

  /**
   * Get time series data for visualization
   * @param {Object} options
   * @returns {Object}
   */
  getTimeSeries(options = {}) {
    const {
      period = TIME_PERIOD.DAY,
      metric = METRIC_TYPE.COST,
      days = 30,
      startDate = null,
      endDate = null,
      groupBy = null
    } = options;

    const cacheKey = `timeseries_${period}_${metric}_${days}_${startDate}_${endDate}_${groupBy}`;

    return this.getCached(cacheKey, () => {
      switch (period) {
        case TIME_PERIOD.HOUR:
          return this.getHourlyTimeSeries(metric, days);
        case TIME_PERIOD.DAY:
          return this.getDailyTimeSeries(metric, days);
        case TIME_PERIOD.WEEK:
          return this.getWeeklyTimeSeries(metric, days);
        case TIME_PERIOD.MONTH:
          return this.getMonthlyTimeSeries(metric);
        default:
          return this.getDailyTimeSeries(metric, days);
      }
    });
  }

  /**
   * Get hourly time series
   * @param {string} metric
   * @param {number} hours
   * @returns {Object}
   */
  getHourlyTimeSeries(metric, hours = 24) {
    const stmt = this.db.db.prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00', timestamp) as period,
        COUNT(*) as count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        COUNT(DISTINCT session_id) as sessions,
        AVG(input_tokens + output_tokens) as avg_tokens
      FROM usage_entries
      WHERE timestamp >= datetime('now', '-${hours} hours')
        AND timestamp IS NOT NULL
        AND date(timestamp) >= '2020-01-01'
      GROUP BY strftime('%Y-%m-%d %H:00', timestamp)
      ORDER BY period ASC
    `);

    const data = stmt.all();
    return this.formatTimeSeriesResult(data, metric, 'hourly');
  }

  /**
   * Get daily time series
   * @param {string} metric
   * @param {number} days
   * @returns {Object}
   */
  getDailyTimeSeries(metric, days = 30) {
    const stmt = this.db.db.prepare(`
      SELECT
        date(timestamp) as period,
        COUNT(*) as count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_creation_input_tokens) as cache_creation_tokens,
        SUM(cache_read_input_tokens) as cache_read_tokens,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT model) as models
      FROM usage_entries
      WHERE timestamp >= datetime('now', '-${days} days')
        AND timestamp IS NOT NULL
        AND date(timestamp) >= '2020-01-01'
      GROUP BY date(timestamp)
      ORDER BY period ASC
    `);

    const data = stmt.all();

    // Fill missing days with zeros
    const filledData = this.fillMissingPeriods(data, days, 'day');
    return this.formatTimeSeriesResult(filledData, metric, 'daily');
  }

  /**
   * Get weekly time series
   * @param {string} metric
   * @param {number} weeks
   * @returns {Object}
   */
  getWeeklyTimeSeries(metric, weeks = 12) {
    const days = weeks * 7;
    const stmt = this.db.db.prepare(`
      SELECT
        strftime('%Y-W%W', timestamp) as period,
        date(timestamp, 'weekday 0', '-6 days') as week_start,
        COUNT(*) as count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_creation_input_tokens) as cache_creation_tokens,
        SUM(cache_read_input_tokens) as cache_read_tokens,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT date(timestamp)) as active_days
      FROM usage_entries
      WHERE timestamp >= datetime('now', '-${days} days')
        AND timestamp IS NOT NULL
        AND date(timestamp) >= '2020-01-01'
      GROUP BY strftime('%Y-W%W', timestamp)
      ORDER BY period ASC
    `);

    const data = stmt.all();
    return this.formatTimeSeriesResult(data, metric, 'weekly');
  }

  /**
   * Get monthly time series
   * @param {string} metric
   * @returns {Object}
   */
  getMonthlyTimeSeries(metric) {
    const stmt = this.db.db.prepare(`
      SELECT
        strftime('%Y-%m', timestamp) as period,
        COUNT(*) as count,
        SUM(cost) as total_cost,
        SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        SUM(cache_creation_input_tokens) as cache_creation_tokens,
        SUM(cache_read_input_tokens) as cache_read_tokens,
        COUNT(DISTINCT session_id) as sessions,
        COUNT(DISTINCT date(timestamp)) as active_days
      FROM usage_entries
      WHERE timestamp IS NOT NULL
        AND date(timestamp) >= '2020-01-01'
      GROUP BY strftime('%Y-%m', timestamp)
      ORDER BY period ASC
    `);

    const data = stmt.all();
    return this.formatTimeSeriesResult(data, metric, 'monthly');
  }

  /**
   * Fill missing periods with zero values
   * @param {Array} data
   * @param {number} count
   * @param {string} period
   * @returns {Array}
   */
  fillMissingPeriods(data, count, period) {
    const dataMap = new Map(data.map(d => [d.period, d]));
    const result = [];
    const now = new Date();

    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now);

      if (period === 'day') {
        date.setDate(date.getDate() - i);
      } else if (period === 'hour') {
        date.setHours(date.getHours() - i);
      }

      const key = period === 'day'
        ? date.toISOString().split('T')[0]
        : date.toISOString().slice(0, 13) + ':00';

      const existing = dataMap.get(key);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          period: key,
          count: 0,
          total_cost: 0,
          total_tokens: 0,
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_tokens: 0,
          cache_read_tokens: 0,
          sessions: 0,
          models: 0
        });
      }
    }

    return result;
  }

  /**
   * Format time series result
   * @param {Array} data
   * @param {string} metric
   * @param {string} granularity
   * @returns {Object}
   */
  formatTimeSeriesResult(data, metric, granularity) {
    const labels = data.map(d => d.period);
    let values;
    let total = 0;
    let average = 0;
    let min = 0;
    let max = 0;

    switch (metric) {
      case METRIC_TYPE.COST:
        values = data.map(d => d.total_cost || 0);
        break;
      case METRIC_TYPE.TOKENS:
        values = data.map(d => d.total_tokens || 0);
        break;
      case METRIC_TYPE.SESSIONS:
        values = data.map(d => d.sessions || 0);
        break;
      case METRIC_TYPE.REQUESTS:
        values = data.map(d => d.count || 0);
        break;
      default:
        values = data.map(d => d.total_cost || 0);
    }

    total = values.reduce((a, b) => a + b, 0);
    average = values.length > 0 ? total / values.length : 0;
    min = Math.min(...values);
    max = Math.max(...values);

    // Calculate running total
    let runningTotal = 0;
    const cumulative = values.map(v => {
      runningTotal += v;
      return runningTotal;
    });

    // Calculate trend (simple linear regression slope)
    const trend = this.calculateTrend(values);

    return {
      labels,
      values,
      cumulative,
      granularity,
      metric,
      statistics: {
        total,
        average: Math.round(average * 100) / 100,
        min,
        max,
        trend,
        trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'
      },
      raw: data
    };
  }

  /**
   * Calculate trend using simple linear regression
   * @param {Array} values
   * @returns {number}
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;

    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Math.round(slope * 1000) / 1000;
  }

  // ============================================
  // MODEL BREAKDOWN
  // ============================================

  /**
   * Get model breakdown statistics
   * @param {Object} options
   * @returns {Object}
   */
  getModelBreakdown(options = {}) {
    const { days = 30, sortBy = 'cost' } = options;
    const cacheKey = `model_breakdown_${days}_${sortBy}`;

    return this.getCached(cacheKey, () => {
      const stmt = this.db.db.prepare(`
        SELECT
          model,
          COUNT(*) as request_count,
          COUNT(DISTINCT session_id) as session_count,
          SUM(cost) as total_cost,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(cache_creation_input_tokens) as cache_creation_tokens,
          SUM(cache_read_input_tokens) as cache_read_tokens,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
          AVG(cost) as avg_cost_per_request,
          MIN(timestamp) as first_used,
          MAX(timestamp) as last_used
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
          AND date(timestamp) >= '2020-01-01'
          AND model IS NOT NULL
        GROUP BY model
        ORDER BY total_cost DESC
      `);

      const models = stmt.all();
      const totalCost = models.reduce((sum, m) => sum + (m.total_cost || 0), 0);
      const totalTokens = models.reduce((sum, m) => sum + (m.total_tokens || 0), 0);

      // Calculate percentages
      const modelsWithPercentage = models.map(model => ({
        ...model,
        cost_percentage: totalCost > 0 ? ((model.total_cost || 0) / totalCost * 100).toFixed(2) : 0,
        token_percentage: totalTokens > 0 ? ((model.total_tokens || 0) / totalTokens * 100).toFixed(2) : 0,
        avg_cost_per_request: Math.round((model.avg_cost_per_request || 0) * 10000) / 10000
      }));

      // Sort by specified field
      const sortedModels = [...modelsWithPercentage].sort((a, b) => {
        switch (sortBy) {
          case 'cost': return (b.total_cost || 0) - (a.total_cost || 0);
          case 'tokens': return (b.total_tokens || 0) - (a.total_tokens || 0);
          case 'requests': return (b.request_count || 0) - (a.request_count || 0);
          case 'sessions': return (b.session_count || 0) - (a.session_count || 0);
          default: return (b.total_cost || 0) - (a.total_cost || 0);
        }
      });

      // Create pie chart data
      const pieData = {
        labels: sortedModels.map(m => m.model || 'Unknown'),
        values: sortedModels.map(m => sortBy === 'cost' ? m.total_cost : m.total_tokens),
        colors: this.generateColors(sortedModels.length)
      };

      return {
        models: sortedModels,
        totals: {
          cost: totalCost,
          tokens: totalTokens,
          requests: models.reduce((sum, m) => sum + (m.request_count || 0), 0),
          sessions: new Set(models.flatMap(m => m.session_count)).size
        },
        pieChart: pieData,
        period: `${days} days`
      };
    });
  }

  /**
   * Get model usage over time
   * @param {Object} options
   * @returns {Object}
   */
  getModelUsageOverTime(options = {}) {
    const { days = 30, topModels = 5 } = options;
    const cacheKey = `model_usage_time_${days}_${topModels}`;

    return this.getCached(cacheKey, () => {
      // Get top models first
      const topStmt = this.db.db.prepare(`
        SELECT model, SUM(cost) as total_cost
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND model IS NOT NULL
        GROUP BY model
        ORDER BY total_cost DESC
        LIMIT ${topModels}
      `);

      const topModelsList = topStmt.all().map(m => m.model);

      // Get daily breakdown for each model
      const stmt = this.db.db.prepare(`
        SELECT
          date(timestamp) as period,
          model,
          SUM(cost) as cost,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as tokens
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND model IN (${topModelsList.map(() => '?').join(',')})
        GROUP BY date(timestamp), model
        ORDER BY period ASC
      `);

      const data = stmt.all(...topModelsList);

      // Transform into series format
      const series = {};
      for (const model of topModelsList) {
        series[model] = [];
      }

      const dates = [...new Set(data.map(d => d.period))].sort();
      for (const date of dates) {
        for (const model of topModelsList) {
          const entry = data.find(d => d.period === date && d.model === model);
          series[model].push(entry ? entry.cost : 0);
        }
      }

      return {
        labels: dates,
        series,
        models: topModelsList,
        chartType: CHART_TYPE.STACKED
      };
    });
  }

  // ============================================
  // TOKEN BREAKDOWN
  // ============================================

  /**
   * Get token breakdown analysis
   * @param {Object} options
   * @returns {Object}
   */
  getTokenBreakdown(options = {}) {
    const { days = 30 } = options;
    const cacheKey = `token_breakdown_${days}`;

    return this.getCached(cacheKey, () => {
      const stmt = this.db.db.prepare(`
        SELECT
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(cache_creation_input_tokens) as cache_creation_tokens,
          SUM(cache_read_input_tokens) as cache_read_tokens,
          COUNT(*) as total_requests,
          COUNT(DISTINCT session_id) as total_sessions
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
          AND date(timestamp) >= '2020-01-01'
      `);

      const totals = stmt.get();

      const totalTokens = (totals.input_tokens || 0) +
                          (totals.output_tokens || 0) +
                          (totals.cache_creation_tokens || 0) +
                          (totals.cache_read_tokens || 0);

      const breakdown = {
        input: {
          count: totals.input_tokens || 0,
          percentage: totalTokens > 0 ? ((totals.input_tokens || 0) / totalTokens * 100).toFixed(2) : 0,
          label: 'Input Tokens'
        },
        output: {
          count: totals.output_tokens || 0,
          percentage: totalTokens > 0 ? ((totals.output_tokens || 0) / totalTokens * 100).toFixed(2) : 0,
          label: 'Output Tokens'
        },
        cacheCreation: {
          count: totals.cache_creation_tokens || 0,
          percentage: totalTokens > 0 ? ((totals.cache_creation_tokens || 0) / totalTokens * 100).toFixed(2) : 0,
          label: 'Cache Creation'
        },
        cacheRead: {
          count: totals.cache_read_tokens || 0,
          percentage: totalTokens > 0 ? ((totals.cache_read_tokens || 0) / totalTokens * 100).toFixed(2) : 0,
          label: 'Cache Read'
        }
      };

      // Daily token breakdown
      const dailyStmt = this.db.db.prepare(`
        SELECT
          date(timestamp) as period,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(cache_creation_input_tokens) as cache_creation_tokens,
          SUM(cache_read_input_tokens) as cache_read_tokens
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
        GROUP BY date(timestamp)
        ORDER BY period ASC
      `);

      const dailyData = dailyStmt.all();

      // Calculate cache efficiency
      const totalCacheTokens = (totals.cache_creation_tokens || 0) + (totals.cache_read_tokens || 0);
      const cacheEfficiency = totalCacheTokens > 0
        ? ((totals.cache_read_tokens || 0) / totalCacheTokens * 100).toFixed(2)
        : 0;

      // Calculate input/output ratio
      const ioRatio = totals.output_tokens > 0
        ? ((totals.input_tokens || 0) / totals.output_tokens).toFixed(2)
        : 0;

      return {
        breakdown,
        totals: {
          total: totalTokens,
          requests: totals.total_requests,
          sessions: totals.total_sessions,
          avgPerRequest: totals.total_requests > 0
            ? Math.round(totalTokens / totals.total_requests)
            : 0
        },
        metrics: {
          cacheEfficiency: parseFloat(cacheEfficiency),
          inputOutputRatio: parseFloat(ioRatio),
          cacheHitRate: totalTokens > 0
            ? ((totals.cache_read_tokens || 0) / totalTokens * 100).toFixed(2)
            : 0
        },
        daily: dailyData,
        pieChart: {
          labels: ['Input', 'Output', 'Cache Creation', 'Cache Read'],
          values: [
            totals.input_tokens || 0,
            totals.output_tokens || 0,
            totals.cache_creation_tokens || 0,
            totals.cache_read_tokens || 0
          ],
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
        },
        period: `${days} days`
      };
    });
  }

  // ============================================
  // ACCOUNT PERFORMANCE
  // ============================================

  /**
   * Get account performance statistics
   * @param {Object} options
   * @returns {Object}
   */
  getAccountPerformance(options = {}) {
    const { days = 30, accountId = null } = options;
    const cacheKey = `account_performance_${days}_${accountId}`;

    return this.getCached(cacheKey, () => {
      // Get session-level performance metrics
      const sessionStmt = this.db.db.prepare(`
        SELECT
          session_id,
          project,
          COUNT(*) as request_count,
          SUM(cost) as total_cost,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
          MIN(timestamp) as start_time,
          MAX(timestamp) as end_time,
          GROUP_CONCAT(DISTINCT model) as models
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
          AND date(timestamp) >= '2020-01-01'
        GROUP BY session_id
        ORDER BY total_cost DESC
      `);

      const sessions = sessionStmt.all();

      // Calculate session durations
      const sessionsWithDuration = sessions.map(session => {
        const start = new Date(session.start_time);
        const end = new Date(session.end_time);
        const durationMs = end - start;
        const durationMinutes = Math.round(durationMs / 60000);

        return {
          ...session,
          duration_minutes: durationMinutes,
          avg_cost_per_minute: durationMinutes > 0
            ? (session.total_cost / durationMinutes).toFixed(6)
            : 0,
          models: session.models ? session.models.split(',') : []
        };
      });

      // Aggregate statistics
      const totalCost = sessions.reduce((sum, s) => sum + (s.total_cost || 0), 0);
      const totalTokens = sessions.reduce((sum, s) => sum + (s.total_tokens || 0), 0);
      const totalRequests = sessions.reduce((sum, s) => sum + (s.request_count || 0), 0);
      const totalDuration = sessionsWithDuration.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      // Project breakdown
      const projectMap = new Map();
      for (const session of sessionsWithDuration) {
        const project = session.project || 'Unknown';
        const existing = projectMap.get(project) || { cost: 0, tokens: 0, sessions: 0 };
        existing.cost += session.total_cost || 0;
        existing.tokens += session.total_tokens || 0;
        existing.sessions += 1;
        projectMap.set(project, existing);
      }

      const projects = Array.from(projectMap.entries())
        .map(([name, data]) => ({
          name,
          ...data,
          cost_percentage: totalCost > 0 ? (data.cost / totalCost * 100).toFixed(2) : 0
        }))
        .sort((a, b) => b.cost - a.cost);

      return {
        sessions: sessionsWithDuration.slice(0, 100), // Top 100 sessions
        projects,
        summary: {
          totalSessions: sessions.length,
          totalCost,
          totalTokens,
          totalRequests,
          totalDuration,
          avgCostPerSession: sessions.length > 0 ? (totalCost / sessions.length).toFixed(4) : 0,
          avgTokensPerSession: sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0,
          avgDurationPerSession: sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0,
          avgCostPerMinute: totalDuration > 0 ? (totalCost / totalDuration).toFixed(6) : 0
        },
        period: `${days} days`
      };
    });
  }

  // ============================================
  // COMPREHENSIVE DASHBOARD DATA
  // ============================================

  /**
   * Get all dashboard data in a single call
   * @param {Object} options
   * @returns {Object}
   */
  getDashboardData(options = {}) {
    const { days = 30 } = options;

    return {
      timeSeries: {
        cost: this.getTimeSeries({ period: TIME_PERIOD.DAY, metric: METRIC_TYPE.COST, days }),
        tokens: this.getTimeSeries({ period: TIME_PERIOD.DAY, metric: METRIC_TYPE.TOKENS, days }),
        sessions: this.getTimeSeries({ period: TIME_PERIOD.DAY, metric: METRIC_TYPE.SESSIONS, days })
      },
      modelBreakdown: this.getModelBreakdown({ days }),
      tokenBreakdown: this.getTokenBreakdown({ days }),
      accountPerformance: this.getAccountPerformance({ days }),
      summary: this.getSummaryStats({ days }),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get summary statistics
   * @param {Object} options
   * @returns {Object}
   */
  getSummaryStats(options = {}) {
    const { days = 30 } = options;
    const cacheKey = `summary_stats_${days}`;

    return this.getCached(cacheKey, () => {
      const stmt = this.db.db.prepare(`
        SELECT
          COUNT(*) as total_requests,
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT model) as total_models,
          COUNT(DISTINCT project) as total_projects,
          COUNT(DISTINCT date(timestamp)) as active_days,
          SUM(cost) as total_cost,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
          AVG(cost) as avg_cost_per_request,
          MIN(timestamp) as first_activity,
          MAX(timestamp) as last_activity
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
          AND date(timestamp) >= '2020-01-01'
      `);

      const stats = stmt.get();

      // Get comparison with previous period
      const prevStmt = this.db.db.prepare(`
        SELECT
          SUM(cost) as total_cost,
          SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
          COUNT(DISTINCT session_id) as total_sessions
        FROM usage_entries
        WHERE timestamp >= datetime('now', '-${days * 2} days')
          AND timestamp < datetime('now', '-${days} days')
          AND timestamp IS NOT NULL
          AND date(timestamp) >= '2020-01-01'
      `);

      const prevStats = prevStmt.get();

      // Calculate changes
      const costChange = prevStats.total_cost > 0
        ? ((stats.total_cost - prevStats.total_cost) / prevStats.total_cost * 100).toFixed(2)
        : 0;

      const tokenChange = prevStats.total_tokens > 0
        ? ((stats.total_tokens - prevStats.total_tokens) / prevStats.total_tokens * 100).toFixed(2)
        : 0;

      const sessionChange = prevStats.total_sessions > 0
        ? ((stats.total_sessions - prevStats.total_sessions) / prevStats.total_sessions * 100).toFixed(2)
        : 0;

      return {
        current: {
          requests: stats.total_requests || 0,
          sessions: stats.total_sessions || 0,
          models: stats.total_models || 0,
          projects: stats.total_projects || 0,
          activeDays: stats.active_days || 0,
          cost: stats.total_cost || 0,
          tokens: stats.total_tokens || 0,
          avgCostPerRequest: Math.round((stats.avg_cost_per_request || 0) * 10000) / 10000,
          firstActivity: stats.first_activity,
          lastActivity: stats.last_activity
        },
        comparison: {
          costChange: parseFloat(costChange),
          tokenChange: parseFloat(tokenChange),
          sessionChange: parseFloat(sessionChange),
          previousPeriod: {
            cost: prevStats.total_cost || 0,
            tokens: prevStats.total_tokens || 0,
            sessions: prevStats.total_sessions || 0
          }
        },
        period: `${days} days`
      };
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate color palette
   * @param {number} count
   * @returns {Array}
   */
  generateColors(count) {
    const baseColors = [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
      '#6366f1', // indigo
      '#84cc16', // lime
      '#06b6d4', // cyan
      '#ef4444', // red
      '#a855f7'  // purple
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(baseColors[i % baseColors.length]);
    }
    return colors;
  }

  /**
   * Format number for display
   * @param {number} value
   * @param {string} type
   * @returns {string}
   */
  formatNumber(value, type = 'number') {
    if (type === 'cost') {
      return '$' + value.toFixed(4);
    }
    if (type === 'tokens') {
      if (value >= 1000000) {
        return (value / 1000000).toFixed(2) + 'M';
      }
      if (value >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
      }
      return value.toString();
    }
    return value.toLocaleString();
  }

  /**
   * Export dashboard data to JSON
   * @param {string} filePath
   * @param {Object} options
   */
  exportToJSON(filePath, options = {}) {
    const data = this.getDashboardData(options);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  /**
   * Generate ASCII chart for terminal
   * @param {Array} values
   * @param {Object} options
   * @returns {string}
   */
  generateAsciiChart(values, options = {}) {
    const { width = 60, height = 10, char = '█' } = options;

    if (values.length === 0) return '';

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const lines = [];
    for (let row = height - 1; row >= 0; row--) {
      let line = '';
      const threshold = min + (range * row / (height - 1));

      for (let col = 0; col < Math.min(values.length, width); col++) {
        const value = values[Math.floor(col * values.length / width)];
        line += value >= threshold ? char : ' ';
      }
      lines.push(line);
    }

    return lines.join('\n');
  }
}

// Singleton instance
let instance = null;

/**
 * Get Analytics Dashboard instance
 * @param {Object} databaseService
 * @returns {AnalyticsDashboard}
 */
function getAnalyticsDashboard(databaseService) {
  if (!instance && databaseService) {
    instance = new AnalyticsDashboard(databaseService);
  }
  return instance;
}

module.exports = {
  AnalyticsDashboard,
  getAnalyticsDashboard,
  TIME_PERIOD,
  CHART_TYPE,
  METRIC_TYPE
};
