import { describe, it, expect, beforeEach } from 'vitest';
import { SnowflakeGenerator, generateId } from '../../src/services/snowflake';

describe('Snowflake ID Generator', () => {
  describe('SnowflakeGenerator', () => {
    let generator: SnowflakeGenerator;

    beforeEach(() => {
      generator = new SnowflakeGenerator(1);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generator.generate());
      }
      expect(ids.size).toBe(1000);
    });

    it('should generate time-ordered IDs', () => {
      const id1 = generator.generate();
      const id2 = generator.generate();
      expect(BigInt(id2)).toBeGreaterThan(BigInt(id1));
    });

    it('should reject invalid worker IDs', () => {
      expect(() => new SnowflakeGenerator(-1)).toThrow();
      expect(() => new SnowflakeGenerator(1024)).toThrow();
    });

    it('should accept valid worker IDs', () => {
      expect(() => new SnowflakeGenerator(0)).not.toThrow();
      expect(() => new SnowflakeGenerator(1023)).not.toThrow();
    });
  });

  describe('parse', () => {
    it('should correctly parse generated IDs', () => {
      const generator = new SnowflakeGenerator(42);
      const id = generator.generate();
      const parsed = SnowflakeGenerator.parse(id);

      expect(parsed.workerId).toBe(42);
      expect(parsed.timestamp).toBeInstanceOf(Date);
      expect(parsed.sequence).toBeGreaterThanOrEqual(0);
    });

    it('should extract timestamp within reasonable range', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();
      
      const parsed = SnowflakeGenerator.parse(id);
      expect(parsed.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('isValid', () => {
    it('should return true for valid IDs', () => {
      const id = generateId();
      expect(SnowflakeGenerator.isValid(id)).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(SnowflakeGenerator.isValid('')).toBe(false);
      expect(SnowflakeGenerator.isValid('abc')).toBe(false);
      expect(SnowflakeGenerator.isValid('-1')).toBe(false);
    });
  });

  describe('compare', () => {
    it('should correctly compare IDs', () => {
      const generator = new SnowflakeGenerator();
      const id1 = generator.generate();
      const id2 = generator.generate();

      expect(SnowflakeGenerator.compare(id1, id2)).toBeLessThan(0);
      expect(SnowflakeGenerator.compare(id2, id1)).toBeGreaterThan(0);
      expect(SnowflakeGenerator.compare(id1, id1)).toBe(0);
    });
  });

  describe('generateId helper', () => {
    it('should generate valid IDs', () => {
      const id = generateId();
      expect(SnowflakeGenerator.isValid(id)).toBe(true);
    });

    it('should use default worker ID 0', () => {
      const id = generateId();
      const parsed = SnowflakeGenerator.parse(id);
      expect(parsed.workerId).toBe(0);
    });
  });
});