/**
 * Result Type Pattern for Dragon-UI
 * Type-safe error handling with Ok/Err pattern
 *
 * @module lib/result
 */

'use strict';

/**
 * Result type symbols
 */
const RESULT_TYPE = {
  OK: Symbol('Ok'),
  ERR: Symbol('Err')
};

/**
 * Result base class
 */
class Result {
  constructor(type, value) {
    this._type = type;
    this._value = value;
    Object.freeze(this);
  }

  /**
   * Check if result is Ok
   * @returns {boolean}
   */
  isOk() {
    return this._type === RESULT_TYPE.OK;
  }

  /**
   * Check if result is Err
   * @returns {boolean}
   */
  isErr() {
    return this._type === RESULT_TYPE.ERR;
  }

  /**
   * Get the Ok value
   * @returns {any}
   * @throws {Error} If result is Err
   */
  unwrap() {
    if (this.isErr()) {
      throw new Error(`Called unwrap on an Err value: ${this._value}`);
    }
    return this._value;
  }

  /**
   * Get the Ok value or default
   * @param {any} defaultValue
   * @returns {any}
   */
  unwrapOr(defaultValue) {
    return this.isOk() ? this._value : defaultValue;
  }

  /**
   * Get the Ok value or compute default
   * @param {Function} fn
   * @returns {any}
   */
  unwrapOrElse(fn) {
    return this.isOk() ? this._value : fn(this._value);
  }

  /**
   * Get the Err value
   * @returns {any}
   * @throws {Error} If result is Ok
   */
  unwrapErr() {
    if (this.isOk()) {
      throw new Error(`Called unwrapErr on an Ok value: ${this._value}`);
    }
    return this._value;
  }

  /**
   * Expect Ok value with custom error message
   * @param {string} message
   * @returns {any}
   */
  expect(message) {
    if (this.isErr()) {
      throw new Error(`${message}: ${this._value}`);
    }
    return this._value;
  }

  /**
   * Expect Err value with custom error message
   * @param {string} message
   * @returns {any}
   */
  expectErr(message) {
    if (this.isOk()) {
      throw new Error(`${message}: ${this._value}`);
    }
    return this._value;
  }

  /**
   * Map the Ok value
   * @param {Function} fn
   * @returns {Result}
   */
  map(fn) {
    if (this.isOk()) {
      return Ok(fn(this._value));
    }
    return this;
  }

  /**
   * Map the Err value
   * @param {Function} fn
   * @returns {Result}
   */
  mapErr(fn) {
    if (this.isErr()) {
      return Err(fn(this._value));
    }
    return this;
  }

  /**
   * Map Ok value or return default
   * @param {any} defaultValue
   * @param {Function} fn
   * @returns {any}
   */
  mapOr(defaultValue, fn) {
    if (this.isOk()) {
      return fn(this._value);
    }
    return defaultValue;
  }

  /**
   * Map Ok value or compute default
   * @param {Function} defaultFn
   * @param {Function} fn
   * @returns {any}
   */
  mapOrElse(defaultFn, fn) {
    if (this.isOk()) {
      return fn(this._value);
    }
    return defaultFn(this._value);
  }

  /**
   * Chain Results (flatMap)
   * @param {Function} fn - Function returning Result
   * @returns {Result}
   */
  andThen(fn) {
    if (this.isOk()) {
      return fn(this._value);
    }
    return this;
  }

  /**
   * Chain on Err
   * @param {Function} fn - Function returning Result
   * @returns {Result}
   */
  orElse(fn) {
    if (this.isErr()) {
      return fn(this._value);
    }
    return this;
  }

  /**
   * Return other if Ok, else return Err
   * @param {Result} other
   * @returns {Result}
   */
  and(other) {
    if (this.isOk()) {
      return other;
    }
    return this;
  }

  /**
   * Return self if Ok, else return other
   * @param {Result} other
   * @returns {Result}
   */
  or(other) {
    if (this.isOk()) {
      return this;
    }
    return other;
  }

  /**
   * Check if Ok value matches predicate
   * @param {Function} predicate
   * @returns {boolean}
   */
  contains(predicate) {
    return this.isOk() && predicate(this._value);
  }

  /**
   * Check if Err value matches predicate
   * @param {Function} predicate
   * @returns {boolean}
   */
  containsErr(predicate) {
    return this.isErr() && predicate(this._value);
  }

  /**
   * Match pattern for Result
   * @param {Object} patterns - { ok: Function, err: Function }
   * @returns {any}
   */
  match(patterns) {
    if (this.isOk()) {
      return patterns.ok(this._value);
    }
    return patterns.err(this._value);
  }

  /**
   * Tap into Ok value without changing result
   * @param {Function} fn
   * @returns {Result}
   */
  tap(fn) {
    if (this.isOk()) {
      fn(this._value);
    }
    return this;
  }

  /**
   * Tap into Err value without changing result
   * @param {Function} fn
   * @returns {Result}
   */
  tapErr(fn) {
    if (this.isErr()) {
      fn(this._value);
    }
    return this;
  }

  /**
   * Convert to Option (lose error info)
   * @returns {any|null}
   */
  ok() {
    return this.isOk() ? this._value : null;
  }

  /**
   * Convert Err to Option
   * @returns {any|null}
   */
  err() {
    return this.isErr() ? this._value : null;
  }

  /**
   * Convert to Promise
   * @returns {Promise}
   */
  toPromise() {
    if (this.isOk()) {
      return Promise.resolve(this._value);
    }
    return Promise.reject(this._value);
  }

  /**
   * Serialize to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      type: this.isOk() ? 'Ok' : 'Err',
      value: this._value
    };
  }

  /**
   * String representation
   * @returns {string}
   */
  toString() {
    const type = this.isOk() ? 'Ok' : 'Err';
    return `${type}(${JSON.stringify(this._value)})`;
  }
}

/**
 * Create an Ok result
 * @param {any} value
 * @returns {Result}
 */
function Ok(value) {
  return new Result(RESULT_TYPE.OK, value);
}

/**
 * Create an Err result
 * @param {any} error
 * @returns {Result}
 */
function Err(error) {
  return new Result(RESULT_TYPE.ERR, error);
}

/**
 * Wrap a function that might throw into a Result
 * @param {Function} fn
 * @returns {Result}
 */
function tryCatch(fn) {
  try {
    return Ok(fn());
  } catch (error) {
    return Err(error);
  }
}

/**
 * Wrap an async function that might throw into a Promise<Result>
 * @param {Function} fn - Async function
 * @returns {Promise<Result>}
 */
async function tryCatchAsync(fn) {
  try {
    const result = await fn();
    return Ok(result);
  } catch (error) {
    return Err(error);
  }
}

/**
 * Wrap a Promise into a Promise<Result>
 * @param {Promise} promise
 * @returns {Promise<Result>}
 */
async function fromPromise(promise) {
  try {
    const result = await promise;
    return Ok(result);
  } catch (error) {
    return Err(error);
  }
}

/**
 * Combine multiple Results into one
 * @param {Result[]} results
 * @returns {Result<any[]>}
 */
function all(results) {
  const values = [];

  for (const result of results) {
    if (result.isErr()) {
      return result;
    }
    values.push(result.unwrap());
  }

  return Ok(values);
}

/**
 * Get first Ok result or last Err
 * @param {Result[]} results
 * @returns {Result}
 */
function any(results) {
  let lastErr = null;

  for (const result of results) {
    if (result.isOk()) {
      return result;
    }
    lastErr = result;
  }

  return lastErr || Err('No results provided');
}

/**
 * Partition results into [oks, errs]
 * @param {Result[]} results
 * @returns {[any[], any[]]}
 */
function partition(results) {
  const oks = [];
  const errs = [];

  for (const result of results) {
    if (result.isOk()) {
      oks.push(result.unwrap());
    } else {
      errs.push(result.unwrapErr());
    }
  }

  return [oks, errs];
}

/**
 * Create Result from nullable value
 * @param {any} value
 * @param {any} error - Error to use if null/undefined
 * @returns {Result}
 */
function fromNullable(value, error = 'Value is null or undefined') {
  if (value === null || value === undefined) {
    return Err(error);
  }
  return Ok(value);
}

/**
 * Create Result from boolean predicate
 * @param {boolean} condition
 * @param {any} okValue
 * @param {any} errValue
 * @returns {Result}
 */
function fromPredicate(condition, okValue, errValue) {
  return condition ? Ok(okValue) : Err(errValue);
}

/**
 * Check if value is a Result
 * @param {any} value
 * @returns {boolean}
 */
function isResult(value) {
  return value instanceof Result;
}

module.exports = {
  Result,
  Ok,
  Err,
  tryCatch,
  tryCatchAsync,
  fromPromise,
  fromNullable,
  fromPredicate,
  all,
  any,
  partition,
  isResult,
  RESULT_TYPE
};

// ============================================
// In-Source Tests (vitest)
// ============================================
// To run: npm run test
// These tests are included in the source file and run by vitest
// when import.meta.vitest is defined

if (typeof globalThis !== 'undefined' && globalThis.VITEST_WORKER_ID !== undefined) {
  const { describe, it, expect } = require('vitest');

  describe('Result Type Pattern', () => {
    describe('Ok', () => {
      it('should create Ok result', () => {
        const result = Ok(42);
        expect(result.isOk()).toBe(true);
        expect(result.isErr()).toBe(false);
        expect(result.unwrap()).toBe(42);
      });

      it('should map Ok value', () => {
        const result = Ok(5).map(x => x * 2);
        expect(result.unwrap()).toBe(10);
      });

      it('should chain Ok with andThen', () => {
        const result = Ok(5).andThen(x => Ok(x + 1));
        expect(result.unwrap()).toBe(6);
      });
    });

    describe('Err', () => {
      it('should create Err result', () => {
        const result = Err('error');
        expect(result.isOk()).toBe(false);
        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe('error');
      });

      it('should not map Err value', () => {
        const result = Err('error').map(x => x * 2);
        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe('error');
      });

      it('should mapErr on Err', () => {
        const result = Err('error').mapErr(e => e.toUpperCase());
        expect(result.unwrapErr()).toBe('ERROR');
      });
    });

    describe('tryCatch', () => {
      it('should return Ok for successful function', () => {
        const result = tryCatch(() => 42);
        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(42);
      });

      it('should return Err for throwing function', () => {
        const result = tryCatch(() => { throw new Error('fail'); });
        expect(result.isErr()).toBe(true);
      });
    });

    describe('fromNullable', () => {
      it('should return Ok for non-null value', () => {
        const result = fromNullable(42);
        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(42);
      });

      it('should return Err for null', () => {
        const result = fromNullable(null);
        expect(result.isErr()).toBe(true);
      });

      it('should return Err for undefined', () => {
        const result = fromNullable(undefined);
        expect(result.isErr()).toBe(true);
      });
    });

    describe('all', () => {
      it('should combine Ok results', () => {
        const result = all([Ok(1), Ok(2), Ok(3)]);
        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toEqual([1, 2, 3]);
      });

      it('should return first Err', () => {
        const result = all([Ok(1), Err('fail'), Ok(3)]);
        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe('fail');
      });
    });

    describe('any', () => {
      it('should return first Ok', () => {
        const result = any([Err('e1'), Ok(2), Err('e3')]);
        expect(result.isOk()).toBe(true);
        expect(result.unwrap()).toBe(2);
      });

      it('should return last Err if all fail', () => {
        const result = any([Err('e1'), Err('e2')]);
        expect(result.isErr()).toBe(true);
        expect(result.unwrapErr()).toBe('e2');
      });
    });

    describe('partition', () => {
      it('should separate Oks and Errs', () => {
        const [oks, errs] = partition([Ok(1), Err('e1'), Ok(2), Err('e2')]);
        expect(oks).toEqual([1, 2]);
        expect(errs).toEqual(['e1', 'e2']);
      });
    });

    describe('match', () => {
      it('should call ok handler for Ok', () => {
        const result = Ok(5).match({
          ok: v => v * 2,
          err: () => 0
        });
        expect(result).toBe(10);
      });

      it('should call err handler for Err', () => {
        const result = Err('error').match({
          ok: () => 0,
          err: e => e.length
        });
        expect(result).toBe(5);
      });
    });

    describe('unwrapOr', () => {
      it('should return value for Ok', () => {
        expect(Ok(42).unwrapOr(0)).toBe(42);
      });

      it('should return default for Err', () => {
        expect(Err('error').unwrapOr(0)).toBe(0);
      });
    });
  });
}
