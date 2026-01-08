/**
 * Session Widgets
 * Session-related widgets: clock, ID, status
 */

const { Widget } = require('./widget-base.cjs');

class SessionClockWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'session-clock',
      name: 'Session Clock',
      description: 'Displays session duration',
      color: { fg: 'magenta', bg: null },
      cacheTimeout: 1000, // Update every second
      ...config
    });
  }

  async getValue(data) {
    const session = data.session || data.sessionDuration || '';

    // If string provided, use it directly
    if (typeof session === 'string' && session) {
      const icon = this.metadata.showIcon ? '⏱️ ' : '';
      return `${icon}${session}`;
    }

    // Calculate from start time
    const startTime = data.sessionStart || data.startTime;
    if (startTime) {
      const start = new Date(startTime);
      const now = new Date();
      const ms = now - start;
      const icon = this.metadata.showIcon ? '⏱️ ' : '';
      return `${icon}${this.formatDuration(ms)}`;
    }

    return this.metadata.showNA ? 'N/A' : '';
  }
}

class SessionIdWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'session-id',
      name: 'Session ID',
      description: 'Displays the current session ID',
      color: { fg: 'gray', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const sessionId = data.sessionId || data.session_id || '';

    if (!sessionId) {
      return this.metadata.showNA ? 'N/A' : '';
    }

    // Truncate if configured
    const maxLength = this.metadata.maxLength || 8;
    if (sessionId.length > maxLength) {
      return sessionId.substring(0, maxLength);
    }

    return sessionId;
  }
}

class SessionStatusWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'session-status',
      name: 'Session Status',
      description: 'Displays session active/inactive status',
      color: { fg: 'green', bg: null },
      ...config
    });
  }

  async getValue(data) {
    const isActive = data.isActive || data.sessionActive || data.status === 'active';

    if (isActive) {
      this.color.fg = 'green';
      return this.metadata.showIcon ? '🟢 Active' : 'Active';
    } else {
      this.color.fg = 'gray';
      return this.metadata.showIcon ? '⚪ Idle' : 'Idle';
    }
  }
}

class BlockTimerWidget extends Widget {
  constructor(config = {}) {
    super({
      id: 'block-timer',
      name: 'Block Timer',
      description: 'Displays time remaining in current 5-hour block',
      color: { fg: 'brightYellow', bg: null },
      cacheTimeout: 60000, // Update every minute
      ...config
    });
  }

  async getValue(data) {
    // Calculate current 5-hour block and time remaining
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Determine current block: 0-5, 5-10, 10-15, 15-20, 20-24
    const blockStart = Math.floor(hours / 5) * 5;
    const blockEnd = blockStart + 5;

    // Time remaining in current block
    const hoursRemaining = blockEnd - hours - 1;
    const minutesRemaining = 60 - minutes;

    // Color based on time remaining
    const totalMinutesRemaining = hoursRemaining * 60 + minutesRemaining;
    if (totalMinutesRemaining < 30) {
      this.color.fg = 'red';
    } else if (totalMinutesRemaining < 60) {
      this.color.fg = 'yellow';
    } else {
      this.color.fg = 'green';
    }

    const icon = this.metadata.showIcon ? '⏰ ' : '';
    return `${icon}${hoursRemaining}h ${minutesRemaining}m`;
  }
}

module.exports = {
  SessionClockWidget,
  SessionIdWidget,
  SessionStatusWidget,
  BlockTimerWidget
};
