'use strict';

/**
 * Powerline Auto-Alignment System
 * Features:
 * - Column alignment across lines
 * - Max width calculation
 * - Merged widget handling
 * - Padding distribution
 */

/**
 * Strip ANSI codes from string
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get visual width of string (excluding ANSI codes)
 * @param {string} str
 * @returns {number}
 */
function visualWidth(str) {
  return stripAnsi(str).length;
}

/**
 * Alignment mode
 */
const AlignMode = {
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  FILL: 'fill'
};

/**
 * Column definition
 */
class Column {
  constructor(options = {}) {
    this.id = options.id || `col-${Date.now()}`;
    this.minWidth = options.minWidth || 0;
    this.maxWidth = options.maxWidth || Infinity;
    this.align = options.align || AlignMode.LEFT;
    this.flex = options.flex || 0;
    this.padding = options.padding || 0;

    this._calculatedWidth = 0;
    this._cells = [];
  }

  /**
   * Add cell content
   * @param {string} content
   */
  addCell(content) {
    this._cells.push(content);
    const width = visualWidth(content);
    this._calculatedWidth = Math.max(this._calculatedWidth, width);
  }

  /**
   * Get calculated width
   * @returns {number}
   */
  getWidth() {
    return Math.max(
      this.minWidth,
      Math.min(this.maxWidth, this._calculatedWidth + this.padding * 2)
    );
  }

  /**
   * Clear cells
   */
  clear() {
    this._cells = [];
    this._calculatedWidth = 0;
  }
}

/**
 * Row definition
 */
class Row {
  constructor(cells = []) {
    this.cells = cells;
    this.height = 1;
    this.merged = [];
  }

  /**
   * Add cell
   * @param {string} content
   * @param {Object} [options]
   */
  addCell(content, options = {}) {
    this.cells.push({
      content,
      colspan: options.colspan || 1,
      align: options.align,
      ...options
    });
  }

  /**
   * Get cell count
   * @returns {number}
   */
  get length() {
    return this.cells.length;
  }
}

/**
 * Alignment Grid
 */
class AlignmentGrid {
  constructor(options = {}) {
    this._columns = [];
    this._rows = [];
    this._terminalWidth = options.terminalWidth || process.stdout.columns || 80;
    this._separator = options.separator || '  ';
    this._paddingChar = options.paddingChar || ' ';
  }

  /**
   * Define columns
   * @param {Array<Object>} columnDefs
   */
  defineColumns(columnDefs) {
    this._columns = columnDefs.map((def, index) => new Column({
      id: def.id || `col-${index}`,
      ...def
    }));
  }

  /**
   * Add row
   * @param {Array<string>} cells
   * @returns {Row}
   */
  addRow(cells) {
    const row = new Row(cells.map(c => ({ content: c, colspan: 1 })));
    this._rows.push(row);

    // Update column widths
    cells.forEach((cell, index) => {
      if (this._columns[index]) {
        this._columns[index].addCell(cell);
      }
    });

    return row;
  }

  /**
   * Add row with cell options
   * @param {Array<Object>} cells
   * @returns {Row}
   */
  addRowWithOptions(cells) {
    const row = new Row();
    cells.forEach(cell => {
      row.addCell(cell.content, cell);
    });
    this._rows.push(row);

    // Update column widths accounting for colspan
    let colIndex = 0;
    for (const cell of cells) {
      if (this._columns[colIndex] && cell.colspan === 1) {
        this._columns[colIndex].addCell(cell.content);
      }
      colIndex += cell.colspan || 1;
    }

    return row;
  }

  /**
   * Calculate column widths
   * @returns {Array<number>}
   */
  calculateWidths() {
    const widths = this._columns.map(col => col.getWidth());
    const separatorWidth = visualWidth(this._separator);
    const totalFixed = widths.reduce((sum, w) => sum + w, 0) +
                       (widths.length - 1) * separatorWidth;

    // Distribute remaining space to flex columns
    const remaining = this._terminalWidth - totalFixed;
    if (remaining > 0) {
      const totalFlex = this._columns.reduce((sum, col) => sum + col.flex, 0);
      if (totalFlex > 0) {
        this._columns.forEach((col, i) => {
          if (col.flex > 0) {
            const extra = Math.floor(remaining * (col.flex / totalFlex));
            widths[i] += extra;
          }
        });
      }
    }

    return widths;
  }

  /**
   * Align content within width
   * @param {string} content
   * @param {number} width
   * @param {string} align
   * @returns {string}
   */
  alignContent(content, width, align) {
    const visWidth = visualWidth(content);
    const diff = width - visWidth;

    if (diff <= 0) {
      // Truncate if needed
      return this.truncate(content, width);
    }

    switch (align) {
      case AlignMode.RIGHT:
        return this._paddingChar.repeat(diff) + content;

      case AlignMode.CENTER: {
        const left = Math.floor(diff / 2);
        const right = diff - left;
        return this._paddingChar.repeat(left) + content + this._paddingChar.repeat(right);
      }

      case AlignMode.FILL:
        // Distribute padding evenly in content spaces
        return content + this._paddingChar.repeat(diff);

      case AlignMode.LEFT:
      default:
        return content + this._paddingChar.repeat(diff);
    }
  }

  /**
   * Truncate content to width
   * @param {string} content
   * @param {number} maxWidth
   * @returns {string}
   */
  truncate(content, maxWidth) {
    if (visualWidth(content) <= maxWidth) return content;

    const stripped = stripAnsi(content);
    if (stripped.length <= maxWidth) return content;

    // Simple truncation (may break ANSI - use carefully)
    return stripped.substring(0, maxWidth - 1) + '…';
  }

  /**
   * Render grid
   * @returns {Array<string>}
   */
  render() {
    const widths = this.calculateWidths();
    const lines = [];

    for (const row of this._rows) {
      const cells = [];
      let colIndex = 0;

      for (const cell of row.cells) {
        const colspan = cell.colspan || 1;
        let cellWidth = 0;

        // Calculate total width for colspan
        for (let i = 0; i < colspan && colIndex + i < widths.length; i++) {
          cellWidth += widths[colIndex + i];
          if (i > 0) {
            cellWidth += visualWidth(this._separator);
          }
        }

        const align = cell.align || (this._columns[colIndex]?.align) || AlignMode.LEFT;
        cells.push(this.alignContent(cell.content, cellWidth, align));
        colIndex += colspan;
      }

      lines.push(cells.join(this._separator));
    }

    return lines;
  }

  /**
   * Clear grid
   */
  clear() {
    this._rows = [];
    this._columns.forEach(col => col.clear());
  }

  /**
   * Get column count
   * @returns {number}
   */
  get columnCount() {
    return this._columns.length;
  }

  /**
   * Get row count
   * @returns {number}
   */
  get rowCount() {
    return this._rows.length;
  }
}

/**
 * Quick align helper
 * @param {Array<Array<string>>} rows - 2D array of cell contents
 * @param {Object} [options]
 * @returns {Array<string>}
 */
function alignRows(rows, options = {}) {
  if (rows.length === 0) return [];

  const columnCount = Math.max(...rows.map(r => r.length));
  const grid = new AlignmentGrid(options);

  // Auto-define columns
  const columnDefs = [];
  for (let i = 0; i < columnCount; i++) {
    columnDefs.push({
      id: `col-${i}`,
      align: options.align || AlignMode.LEFT,
      flex: options.flex || 0
    });
  }
  grid.defineColumns(columnDefs);

  // Add rows
  for (const row of rows) {
    grid.addRow(row);
  }

  return grid.render();
}

/**
 * Pad string to width
 * @param {string} str
 * @param {number} width
 * @param {string} [align='left']
 * @returns {string}
 */
function padToWidth(str, width, align = 'left') {
  const grid = new AlignmentGrid();
  return grid.alignContent(str, width, align);
}

/**
 * Calculate max widths for columns
 * @param {Array<Array<string>>} rows
 * @returns {Array<number>}
 */
function calculateMaxWidths(rows) {
  if (rows.length === 0) return [];

  const columnCount = Math.max(...rows.map(r => r.length));
  const maxWidths = new Array(columnCount).fill(0);

  for (const row of rows) {
    row.forEach((cell, i) => {
      maxWidths[i] = Math.max(maxWidths[i], visualWidth(cell));
    });
  }

  return maxWidths;
}

module.exports = {
  AlignmentGrid,
  Column,
  Row,
  AlignMode,
  alignRows,
  padToWidth,
  calculateMaxWidths,
  stripAnsi,
  visualWidth
};
