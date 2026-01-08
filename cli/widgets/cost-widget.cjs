/**
 * Cost Widget
 * Displays session or total cost
 */

const { Widget } = require('./widget-base.cjs');

class CostWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'cost',
      name: 'Cost',
      description: 'Displays session or total cost',
      color: { fg: 'green', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const cost = data.cost || data.totalCost || data.sessionCost || 0;
    const currency = data.currency || this.metadata.currency || 'USD';

    // Parse cost if it's a string with symbol
    let numericCost = cost;
    if (typeof cost === 'string') {
      numericCost = parseFloat(cost.replace(/[^0-9.-]/g, '')) || 0;
    }

    const icon = this.metadata.showIcon ? '💰 ' : '';
    return `${icon}${this.formatCost(numericCost, currency)}`;
  }
}

class DailyCostWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'daily-cost',
      name: 'Daily Cost',
      description: 'Displays today\'s total cost',
      color: { fg: 'brightGreen', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const cost = data.dailyCost || data.todayCost || 0;
    const currency = data.currency || this.metadata.currency || 'USD';

    let numericCost = cost;
    if (typeof cost === 'string') {
      numericCost = parseFloat(cost.replace(/[^0-9.-]/g, '')) || 0;
    }

    const label = this.metadata.showLabel ? 'Today: ' : '';
    return `${label}${this.formatCost(numericCost, currency)}`;
  }
}

class MonthlyCostWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'monthly-cost',
      name: 'Monthly Cost',
      description: 'Displays current month\'s total cost',
      color: { fg: 'yellow', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const cost = data.monthlyCost || data.monthCost || 0;
    const currency = data.currency || this.metadata.currency || 'USD';

    let numericCost = cost;
    if (typeof cost === 'string') {
      numericCost = parseFloat(cost.replace(/[^0-9.-]/g, '')) || 0;
    }

    const label = this.metadata.showLabel ? 'Month: ' : '';
    return `${label}${this.formatCost(numericCost, currency)}`;
  }
}

module.exports = {
  CostWidget,
  DailyCostWidget,
  MonthlyCostWidget
};
