/**
 * JQ Processor for Dragon-UI
 * JSON query and transformation using jq-like syntax
 *
 * @module cli/utils/jq-processor
 */

'use strict';

/**
 * Token types for jq expression parsing
 */
const TOKEN_TYPE = {
  DOT: 'DOT',
  IDENTIFIER: 'IDENTIFIER',
  BRACKET_OPEN: 'BRACKET_OPEN',
  BRACKET_CLOSE: 'BRACKET_CLOSE',
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  PIPE: 'PIPE',
  COMMA: 'COMMA',
  COLON: 'COLON',
  QUESTION: 'QUESTION',
  STAR: 'STAR',
  PAREN_OPEN: 'PAREN_OPEN',
  PAREN_CLOSE: 'PAREN_CLOSE',
  OPERATOR: 'OPERATOR',
  KEYWORD: 'KEYWORD',
  EOF: 'EOF'
};

/**
 * Built-in jq functions
 */
const BUILTIN_FUNCTIONS = {
  // Array functions
  length: (val) => {
    if (Array.isArray(val)) return val.length;
    if (typeof val === 'string') return val.length;
    if (typeof val === 'object' && val !== null) return Object.keys(val).length;
    return null;
  },

  keys: (val) => {
    if (typeof val === 'object' && val !== null) {
      return Object.keys(val);
    }
    return null;
  },

  keys_unsorted: (val) => {
    if (typeof val === 'object' && val !== null) {
      return Object.keys(val);
    }
    return null;
  },

  values: (val) => {
    if (typeof val === 'object' && val !== null) {
      return Object.values(val);
    }
    return null;
  },

  has: (val, key) => {
    if (typeof val === 'object' && val !== null) {
      return key in val;
    }
    return false;
  },

  in: (val, obj) => {
    if (typeof obj === 'object' && obj !== null) {
      return val in obj;
    }
    return false;
  },

  map: (val, fn) => {
    if (Array.isArray(val)) {
      return val.map(fn);
    }
    return null;
  },

  select: (val, predicate) => {
    if (predicate(val)) {
      return val;
    }
    return undefined; // Filter out
  },

  empty: () => undefined,

  error: (msg) => {
    throw new Error(msg || 'error');
  },

  // Type functions
  type: (val) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  },

  isnull: (val) => val === null,
  isboolean: (val) => typeof val === 'boolean',
  isnumber: (val) => typeof val === 'number',
  isstring: (val) => typeof val === 'string',
  isarray: (val) => Array.isArray(val),
  isobject: (val) => typeof val === 'object' && val !== null && !Array.isArray(val),

  // String functions
  ascii_downcase: (val) => typeof val === 'string' ? val.toLowerCase() : val,
  ascii_upcase: (val) => typeof val === 'string' ? val.toUpperCase() : val,

  ltrimstr: (val, str) => {
    if (typeof val === 'string' && val.startsWith(str)) {
      return val.slice(str.length);
    }
    return val;
  },

  rtrimstr: (val, str) => {
    if (typeof val === 'string' && val.endsWith(str)) {
      return val.slice(0, -str.length);
    }
    return val;
  },

  startswith: (val, str) => typeof val === 'string' && val.startsWith(str),
  endswith: (val, str) => typeof val === 'string' && val.endsWith(str),
  contains: (val, str) => {
    if (typeof val === 'string') return val.includes(str);
    if (Array.isArray(val)) return val.includes(str);
    return false;
  },

  split: (val, sep) => typeof val === 'string' ? val.split(sep) : val,
  join: (val, sep) => Array.isArray(val) ? val.join(sep) : val,

  test: (val, pattern) => {
    if (typeof val === 'string') {
      const regex = new RegExp(pattern);
      return regex.test(val);
    }
    return false;
  },

  match: (val, pattern) => {
    if (typeof val === 'string') {
      const regex = new RegExp(pattern);
      const match = val.match(regex);
      if (match) {
        return {
          offset: match.index,
          length: match[0].length,
          string: match[0],
          captures: match.slice(1).map((c, i) => ({
            offset: match.index + match[0].indexOf(c),
            length: c ? c.length : 0,
            string: c || '',
            name: null
          }))
        };
      }
    }
    return null;
  },

  // Number functions
  floor: (val) => typeof val === 'number' ? Math.floor(val) : val,
  ceil: (val) => typeof val === 'number' ? Math.ceil(val) : val,
  round: (val) => typeof val === 'number' ? Math.round(val) : val,
  sqrt: (val) => typeof val === 'number' ? Math.sqrt(val) : val,
  fabs: (val) => typeof val === 'number' ? Math.abs(val) : val,

  // Array functions
  first: (val) => Array.isArray(val) && val.length > 0 ? val[0] : null,
  last: (val) => Array.isArray(val) && val.length > 0 ? val[val.length - 1] : null,
  nth: (val, n) => Array.isArray(val) ? val[n] : null,

  flatten: (val, depth = 1) => {
    if (Array.isArray(val)) {
      return val.flat(depth);
    }
    return val;
  },

  reverse: (val) => {
    if (Array.isArray(val)) return [...val].reverse();
    if (typeof val === 'string') return val.split('').reverse().join('');
    return val;
  },

  sort: (val) => {
    if (Array.isArray(val)) {
      return [...val].sort((a, b) => {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
    }
    return val;
  },

  sort_by: (val, key) => {
    if (Array.isArray(val)) {
      return [...val].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
        return String(aVal).localeCompare(String(bVal));
      });
    }
    return val;
  },

  unique: (val) => {
    if (Array.isArray(val)) {
      return [...new Set(val.map(v => JSON.stringify(v)))].map(v => JSON.parse(v));
    }
    return val;
  },

  unique_by: (val, key) => {
    if (Array.isArray(val)) {
      const seen = new Set();
      return val.filter(item => {
        const k = item[key];
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    return val;
  },

  group_by: (val, key) => {
    if (Array.isArray(val)) {
      const groups = new Map();
      for (const item of val) {
        const k = JSON.stringify(item[key]);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(item);
      }
      return Array.from(groups.values());
    }
    return val;
  },

  max: (val) => {
    if (Array.isArray(val) && val.length > 0) {
      return Math.max(...val.filter(v => typeof v === 'number'));
    }
    return null;
  },

  min: (val) => {
    if (Array.isArray(val) && val.length > 0) {
      return Math.min(...val.filter(v => typeof v === 'number'));
    }
    return null;
  },

  add: (val) => {
    if (Array.isArray(val)) {
      if (val.length === 0) return null;
      if (typeof val[0] === 'number') {
        return val.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
      }
      if (typeof val[0] === 'string') {
        return val.join('');
      }
      if (Array.isArray(val[0])) {
        return val.flat();
      }
    }
    return val;
  },

  // Object functions
  to_entries: (val) => {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      return Object.entries(val).map(([key, value]) => ({ key, value }));
    }
    return val;
  },

  from_entries: (val) => {
    if (Array.isArray(val)) {
      const obj = {};
      for (const entry of val) {
        if (entry.key !== undefined && entry.value !== undefined) {
          obj[entry.key] = entry.value;
        } else if (entry.name !== undefined && entry.value !== undefined) {
          obj[entry.name] = entry.value;
        }
      }
      return obj;
    }
    return val;
  },

  with_entries: (val, fn) => {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const entries = Object.entries(val).map(([key, value]) => fn({ key, value }));
      const obj = {};
      for (const entry of entries) {
        if (entry && entry.key !== undefined) {
          obj[entry.key] = entry.value;
        }
      }
      return obj;
    }
    return val;
  },

  // Path functions
  getpath: (val, path) => {
    let current = val;
    for (const key of path) {
      if (current === null || current === undefined) return null;
      current = current[key];
    }
    return current;
  },

  setpath: (val, path, value) => {
    if (path.length === 0) return value;
    const result = JSON.parse(JSON.stringify(val));
    let current = result;
    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined) {
        current[path[i]] = typeof path[i + 1] === 'number' ? [] : {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    return result;
  },

  delpaths: (val, paths) => {
    let result = JSON.parse(JSON.stringify(val));
    for (const path of paths.sort((a, b) => b.length - a.length)) {
      if (path.length === 0) continue;
      let current = result;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
        if (current === undefined) break;
      }
      if (current !== undefined) {
        if (Array.isArray(current)) {
          current.splice(path[path.length - 1], 1);
        } else {
          delete current[path[path.length - 1]];
        }
      }
    }
    return result;
  },

  // Conversion functions
  tostring: (val) => {
    if (val === null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  },

  tonumber: (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      if (!isNaN(num)) return num;
    }
    return null;
  },

  // Date functions
  now: () => Date.now() / 1000,

  todate: (val) => {
    if (typeof val === 'number') {
      return new Date(val * 1000).toISOString();
    }
    return val;
  },

  fromdate: (val) => {
    if (typeof val === 'string') {
      return new Date(val).getTime() / 1000;
    }
    return val;
  },

  strftime: (val, format) => {
    if (typeof val === 'number') {
      const date = new Date(val * 1000);
      return format
        .replace('%Y', date.getFullYear())
        .replace('%m', String(date.getMonth() + 1).padStart(2, '0'))
        .replace('%d', String(date.getDate()).padStart(2, '0'))
        .replace('%H', String(date.getHours()).padStart(2, '0'))
        .replace('%M', String(date.getMinutes()).padStart(2, '0'))
        .replace('%S', String(date.getSeconds()).padStart(2, '0'));
    }
    return val;
  },

  // Format functions
  tojson: (val) => JSON.stringify(val),
  fromjson: (val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return val;
  },

  // Utility
  debug: (val) => {
    console.error('DEBUG:', JSON.stringify(val, null, 2));
    return val;
  },

  env: (val) => process.env[val] || null,

  not: (val) => !val,
  and: (a, b) => a && b,
  or: (a, b) => a || b
};

/**
 * Tokenize jq expression
 * @param {string} expr
 * @returns {Array}
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Dot
    if (char === '.') {
      tokens.push({ type: TOKEN_TYPE.DOT, value: '.' });
      i++;
      continue;
    }

    // Brackets
    if (char === '[') {
      tokens.push({ type: TOKEN_TYPE.BRACKET_OPEN, value: '[' });
      i++;
      continue;
    }
    if (char === ']') {
      tokens.push({ type: TOKEN_TYPE.BRACKET_CLOSE, value: ']' });
      i++;
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: TOKEN_TYPE.PAREN_OPEN, value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: TOKEN_TYPE.PAREN_CLOSE, value: ')' });
      i++;
      continue;
    }

    // Pipe
    if (char === '|') {
      tokens.push({ type: TOKEN_TYPE.PIPE, value: '|' });
      i++;
      continue;
    }

    // Comma
    if (char === ',') {
      tokens.push({ type: TOKEN_TYPE.COMMA, value: ',' });
      i++;
      continue;
    }

    // Colon
    if (char === ':') {
      tokens.push({ type: TOKEN_TYPE.COLON, value: ':' });
      i++;
      continue;
    }

    // Question mark (optional operator)
    if (char === '?') {
      tokens.push({ type: TOKEN_TYPE.QUESTION, value: '?' });
      i++;
      continue;
    }

    // Star (iterator)
    if (char === '*') {
      tokens.push({ type: TOKEN_TYPE.STAR, value: '*' });
      i++;
      continue;
    }

    // Operators
    if (char === '=' || char === '!' || char === '<' || char === '>') {
      let op = char;
      if (expr[i + 1] === '=') {
        op += '=';
        i++;
      }
      tokens.push({ type: TOKEN_TYPE.OPERATOR, value: op });
      i++;
      continue;
    }

    if (char === '+' || char === '-' || char === '/' || char === '%') {
      tokens.push({ type: TOKEN_TYPE.OPERATOR, value: char });
      i++;
      continue;
    }

    // String literals
    if (char === '"') {
      let str = '';
      i++;
      while (i < expr.length && expr[i] !== '"') {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          i++;
          const escapeChar = expr[i];
          switch (escapeChar) {
            case 'n': str += '\n'; break;
            case 't': str += '\t'; break;
            case 'r': str += '\r'; break;
            case '"': str += '"'; break;
            case '\\': str += '\\'; break;
            default: str += escapeChar;
          }
        } else {
          str += expr[i];
        }
        i++;
      }
      tokens.push({ type: TOKEN_TYPE.STRING, value: str });
      i++; // Skip closing quote
      continue;
    }

    // Numbers
    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(expr[i + 1]))) {
      let num = char;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: TOKEN_TYPE.NUMBER, value: parseFloat(num) });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i];
        i++;
      }

      // Check for keywords
      const keywords = ['and', 'or', 'not', 'if', 'then', 'else', 'end', 'as', 'def', 'null', 'true', 'false'];
      if (keywords.includes(id)) {
        tokens.push({ type: TOKEN_TYPE.KEYWORD, value: id });
      } else {
        tokens.push({ type: TOKEN_TYPE.IDENTIFIER, value: id });
      }
      continue;
    }

    // Unknown character - skip
    i++;
  }

  tokens.push({ type: TOKEN_TYPE.EOF, value: null });
  return tokens;
}

/**
 * JQ Processor class
 */
class JQProcessor {
  constructor() {
    this.functions = { ...BUILTIN_FUNCTIONS };
  }

  /**
   * Process a jq expression on data
   * @param {any} data - Input data
   * @param {string} expression - jq expression
   * @returns {any} - Processed result
   */
  process(data, expression) {
    if (!expression || expression === '.') {
      return data;
    }

    const tokens = tokenize(expression);
    return this.evaluate(data, tokens);
  }

  /**
   * Evaluate tokens against data
   * @param {any} data
   * @param {Array} tokens
   * @returns {any}
   */
  evaluate(data, tokens) {
    let result = data;
    let i = 0;

    while (i < tokens.length && tokens[i].type !== TOKEN_TYPE.EOF) {
      const token = tokens[i];

      // Handle pipe - chain operations
      if (token.type === TOKEN_TYPE.PIPE) {
        i++;
        continue;
      }

      // Handle dot accessor
      if (token.type === TOKEN_TYPE.DOT) {
        i++;

        // Check for array iterator .[]
        if (tokens[i] && tokens[i].type === TOKEN_TYPE.BRACKET_OPEN) {
          i++;
          if (tokens[i] && tokens[i].type === TOKEN_TYPE.BRACKET_CLOSE) {
            // .[] - iterate array
            i++;
            if (Array.isArray(result)) {
              result = result;
            } else if (typeof result === 'object' && result !== null) {
              result = Object.values(result);
            }
            continue;
          } else {
            // .[n] or .["key"] - specific index
            const indexResult = this.parseIndex(tokens, i, result);
            result = indexResult.value;
            i = indexResult.nextIndex;
            continue;
          }
        }

        // Check for identifier after dot
        if (tokens[i] && tokens[i].type === TOKEN_TYPE.IDENTIFIER) {
          const key = tokens[i].value;
          i++;

          // Check for optional operator
          const optional = tokens[i] && tokens[i].type === TOKEN_TYPE.QUESTION;
          if (optional) i++;

          if (result === null || result === undefined) {
            result = optional ? null : undefined;
          } else if (typeof result === 'object') {
            result = result[key];
            if (result === undefined && !optional) {
              result = null;
            }
          } else {
            result = optional ? null : undefined;
          }
          continue;
        }

        continue;
      }

      // Handle bracket accessor
      if (token.type === TOKEN_TYPE.BRACKET_OPEN) {
        i++;
        const indexResult = this.parseIndex(tokens, i, result);
        result = indexResult.value;
        i = indexResult.nextIndex;
        continue;
      }

      // Handle function calls
      if (token.type === TOKEN_TYPE.IDENTIFIER) {
        const fnName = token.value;
        i++;

        if (this.functions[fnName]) {
          // Check for arguments in parentheses
          if (tokens[i] && tokens[i].type === TOKEN_TYPE.PAREN_OPEN) {
            i++;
            const args = [];
            while (tokens[i] && tokens[i].type !== TOKEN_TYPE.PAREN_CLOSE) {
              if (tokens[i].type === TOKEN_TYPE.STRING) {
                args.push(tokens[i].value);
              } else if (tokens[i].type === TOKEN_TYPE.NUMBER) {
                args.push(tokens[i].value);
              } else if (tokens[i].type === TOKEN_TYPE.IDENTIFIER) {
                args.push(tokens[i].value);
              }
              i++;
              if (tokens[i] && tokens[i].type === TOKEN_TYPE.COMMA) {
                i++;
              }
            }
            i++; // Skip closing paren

            result = this.functions[fnName](result, ...args);
          } else {
            result = this.functions[fnName](result);
          }
        }
        continue;
      }

      // Handle keywords
      if (token.type === TOKEN_TYPE.KEYWORD) {
        if (token.value === 'null') {
          result = null;
          i++;
          continue;
        }
        if (token.value === 'true') {
          result = true;
          i++;
          continue;
        }
        if (token.value === 'false') {
          result = false;
          i++;
          continue;
        }
        if (token.value === 'not') {
          result = !result;
          i++;
          continue;
        }
      }

      // Handle operators
      if (token.type === TOKEN_TYPE.OPERATOR) {
        const op = token.value;
        i++;

        // Get right operand
        let rightValue;
        if (tokens[i].type === TOKEN_TYPE.NUMBER) {
          rightValue = tokens[i].value;
          i++;
        } else if (tokens[i].type === TOKEN_TYPE.STRING) {
          rightValue = tokens[i].value;
          i++;
        } else if (tokens[i].type === TOKEN_TYPE.KEYWORD) {
          if (tokens[i].value === 'null') rightValue = null;
          else if (tokens[i].value === 'true') rightValue = true;
          else if (tokens[i].value === 'false') rightValue = false;
          i++;
        } else if (tokens[i].type === TOKEN_TYPE.DOT) {
          // Parse the right side expression
          const rightTokens = tokens.slice(i);
          rightValue = this.evaluate(data, rightTokens);
          // Skip to end
          while (i < tokens.length && tokens[i].type !== TOKEN_TYPE.EOF &&
                 tokens[i].type !== TOKEN_TYPE.PIPE) {
            i++;
          }
        }

        switch (op) {
          case '==': result = result === rightValue; break;
          case '!=': result = result !== rightValue; break;
          case '<': result = result < rightValue; break;
          case '<=': result = result <= rightValue; break;
          case '>': result = result > rightValue; break;
          case '>=': result = result >= rightValue; break;
          case '+':
            if (typeof result === 'number' && typeof rightValue === 'number') {
              result = result + rightValue;
            } else if (typeof result === 'string') {
              result = result + String(rightValue);
            } else if (Array.isArray(result) && Array.isArray(rightValue)) {
              result = [...result, ...rightValue];
            }
            break;
          case '-':
            if (typeof result === 'number' && typeof rightValue === 'number') {
              result = result - rightValue;
            }
            break;
          case '*':
            if (typeof result === 'number' && typeof rightValue === 'number') {
              result = result * rightValue;
            }
            break;
          case '/':
            if (typeof result === 'number' && typeof rightValue === 'number') {
              result = result / rightValue;
            }
            break;
          case '%':
            if (typeof result === 'number' && typeof rightValue === 'number') {
              result = result % rightValue;
            }
            break;
        }
        continue;
      }

      i++;
    }

    return result;
  }

  /**
   * Parse index expression
   * @param {Array} tokens
   * @param {number} startIndex
   * @param {any} data
   * @returns {Object}
   */
  parseIndex(tokens, startIndex, data) {
    let i = startIndex;
    let value = data;

    // Number index
    if (tokens[i].type === TOKEN_TYPE.NUMBER) {
      const index = tokens[i].value;
      i++;
      if (tokens[i].type === TOKEN_TYPE.BRACKET_CLOSE) {
        i++;
      }
      if (Array.isArray(value)) {
        value = index < 0 ? value[value.length + index] : value[index];
      } else {
        value = null;
      }
      return { value, nextIndex: i };
    }

    // String index
    if (tokens[i].type === TOKEN_TYPE.STRING) {
      const key = tokens[i].value;
      i++;
      if (tokens[i].type === TOKEN_TYPE.BRACKET_CLOSE) {
        i++;
      }
      if (typeof value === 'object' && value !== null) {
        value = value[key];
      } else {
        value = null;
      }
      return { value, nextIndex: i };
    }

    // Range [start:end]
    if (tokens[i].type === TOKEN_TYPE.COLON ||
        (tokens[i].type === TOKEN_TYPE.NUMBER && tokens[i + 1]?.type === TOKEN_TYPE.COLON)) {
      let start = 0;
      let end = undefined;

      if (tokens[i].type === TOKEN_TYPE.NUMBER) {
        start = tokens[i].value;
        i++;
      }

      if (tokens[i].type === TOKEN_TYPE.COLON) {
        i++;
        if (tokens[i].type === TOKEN_TYPE.NUMBER) {
          end = tokens[i].value;
          i++;
        }
      }

      if (tokens[i].type === TOKEN_TYPE.BRACKET_CLOSE) {
        i++;
      }

      if (Array.isArray(value)) {
        value = value.slice(start, end);
      } else if (typeof value === 'string') {
        value = value.slice(start, end);
      }
      return { value, nextIndex: i };
    }

    // Empty brackets [] - iterate
    if (tokens[i].type === TOKEN_TYPE.BRACKET_CLOSE) {
      i++;
      if (Array.isArray(value)) {
        return { value, nextIndex: i };
      }
      if (typeof value === 'object' && value !== null) {
        return { value: Object.values(value), nextIndex: i };
      }
      return { value: [], nextIndex: i };
    }

    return { value, nextIndex: i };
  }

  /**
   * Add custom function
   * @param {string} name
   * @param {Function} fn
   */
  addFunction(name, fn) {
    this.functions[name] = fn;
  }

  /**
   * Process and format output
   * @param {any} data
   * @param {string} expression
   * @param {Object} options
   * @returns {string}
   */
  processAndFormat(data, expression, options = {}) {
    const result = this.process(data, expression);

    if (options.raw && typeof result === 'string') {
      return result;
    }

    if (options.compact) {
      return JSON.stringify(result);
    }

    return JSON.stringify(result, null, 2);
  }
}

// Singleton instance
let instance = null;

/**
 * Get JQ Processor instance
 * @returns {JQProcessor}
 */
function getJQProcessor() {
  if (!instance) {
    instance = new JQProcessor();
  }
  return instance;
}

/**
 * Process jq expression (convenience function)
 * @param {any} data
 * @param {string} expression
 * @returns {any}
 */
function jq(data, expression) {
  return getJQProcessor().process(data, expression);
}

module.exports = {
  JQProcessor,
  getJQProcessor,
  jq,
  tokenize,
  BUILTIN_FUNCTIONS,
  TOKEN_TYPE
};
