/**
 * Tests for Result Type Pattern
 * @module lib/result.test
 */

'use strict';

const { describe, it, expect } = require('vitest');
const {
  Ok,
  Err,
  tryCatch,
  tryCatchAsync,
  fromNullable,
  fromPredicate,
  all,
  any,
  partition,
  isResult
} = require('./result.cjs');

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

    it('should not change on mapErr', () => {
      const result = Ok(5).mapErr(() => 'error');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(5);
    });

    it('should throw on unwrapErr', () => {
      expect(() => Ok(5).unwrapErr()).toThrow();
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

    it('should throw on unwrap', () => {
      expect(() => Err('error').unwrap()).toThrow();
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
      expect(result.unwrapErr()).toBeInstanceOf(Error);
    });
  });

  describe('tryCatchAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('should return Err for throwing async function', async () => {
      const result = await tryCatchAsync(async () => { throw new Error('fail'); });
      expect(result.isErr()).toBe(true);
    });
  });

  describe('fromNullable', () => {
    it('should return Ok for non-null value', () => {
      const result = fromNullable(42);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    it('should return Ok for zero', () => {
      const result = fromNullable(0);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(0);
    });

    it('should return Ok for empty string', () => {
      const result = fromNullable('');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('');
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

  describe('fromPredicate', () => {
    it('should return Ok when predicate is true', () => {
      const result = fromPredicate(true, 'success', 'failure');
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe('success');
    });

    it('should return Err when predicate is false', () => {
      const result = fromPredicate(false, 'success', 'failure');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('failure');
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

    it('should handle empty array', () => {
      const result = all([]);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([]);
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

    it('should return first Ok if multiple', () => {
      const result = any([Ok(1), Ok(2)]);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(1);
    });
  });

  describe('partition', () => {
    it('should separate Oks and Errs', () => {
      const [oks, errs] = partition([Ok(1), Err('e1'), Ok(2), Err('e2')]);
      expect(oks).toEqual([1, 2]);
      expect(errs).toEqual(['e1', 'e2']);
    });

    it('should handle all Oks', () => {
      const [oks, errs] = partition([Ok(1), Ok(2)]);
      expect(oks).toEqual([1, 2]);
      expect(errs).toEqual([]);
    });

    it('should handle all Errs', () => {
      const [oks, errs] = partition([Err('e1'), Err('e2')]);
      expect(oks).toEqual([]);
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

  describe('unwrapOrElse', () => {
    it('should return value for Ok', () => {
      expect(Ok(42).unwrapOrElse(() => 0)).toBe(42);
    });

    it('should return computed default for Err', () => {
      expect(Err('error').unwrapOrElse(e => e.length)).toBe(5);
    });
  });

  describe('or', () => {
    it('should return self for Ok', () => {
      const result = Ok(1).or(Ok(2));
      expect(result.unwrap()).toBe(1);
    });

    it('should return other for Err', () => {
      const result = Err('e').or(Ok(2));
      expect(result.unwrap()).toBe(2);
    });
  });

  describe('and', () => {
    it('should return other for Ok', () => {
      const result = Ok(1).and(Ok(2));
      expect(result.unwrap()).toBe(2);
    });

    it('should return self for Err', () => {
      const result = Err('e').and(Ok(2));
      expect(result.unwrapErr()).toBe('e');
    });
  });

  describe('isResult', () => {
    it('should return true for Ok', () => {
      expect(isResult(Ok(1))).toBe(true);
    });

    it('should return true for Err', () => {
      expect(isResult(Err('e'))).toBe(true);
    });

    it('should return false for plain object', () => {
      expect(isResult({})).toBe(false);
    });

    it('should return false for null', () => {
      expect(isResult(null)).toBe(false);
    });
  });

  describe('tap', () => {
    it('should call function for Ok and return self', () => {
      let tapped = null;
      const result = Ok(5).tap(v => { tapped = v; });
      expect(tapped).toBe(5);
      expect(result.unwrap()).toBe(5);
    });

    it('should not call function for Err', () => {
      let tapped = null;
      const result = Err('e').tap(v => { tapped = v; });
      expect(tapped).toBe(null);
      expect(result.unwrapErr()).toBe('e');
    });
  });

  describe('tapErr', () => {
    it('should not call function for Ok', () => {
      let tapped = null;
      const result = Ok(5).tapErr(e => { tapped = e; });
      expect(tapped).toBe(null);
      expect(result.unwrap()).toBe(5);
    });

    it('should call function for Err and return self', () => {
      let tapped = null;
      const result = Err('e').tapErr(e => { tapped = e; });
      expect(tapped).toBe('e');
      expect(result.unwrapErr()).toBe('e');
    });
  });

  describe('toPromise', () => {
    it('should resolve for Ok', async () => {
      const value = await Ok(42).toPromise();
      expect(value).toBe(42);
    });

    it('should reject for Err', async () => {
      await expect(Err('error').toPromise()).rejects.toBe('error');
    });
  });

  describe('toJSON', () => {
    it('should serialize Ok', () => {
      expect(Ok(42).toJSON()).toEqual({ type: 'Ok', value: 42 });
    });

    it('should serialize Err', () => {
      expect(Err('error').toJSON()).toEqual({ type: 'Err', value: 'error' });
    });
  });

  describe('toString', () => {
    it('should stringify Ok', () => {
      expect(Ok(42).toString()).toBe('Ok(42)');
    });

    it('should stringify Err', () => {
      expect(Err('error').toString()).toBe('Err("error")');
    });
  });
});
