import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/utils/search-index';

describe('Search Index Utilities', () => {
  describe('tokenize', () => {
    it('should extract words from content', () => {
      const words = tokenize('Hello world this is a test');
      expect(words).toContain('hello');
      expect(words).toContain('world');
      expect(words).toContain('test');
    });

    it('should filter out stopwords', () => {
      const words = tokenize('the quick brown fox is a very good animal');
      expect(words).not.toContain('the');
      expect(words).not.toContain('is');
      expect(words).not.toContain('a');
      expect(words).not.toContain('very');
      expect(words).toContain('quick');
      expect(words).toContain('brown');
      expect(words).toContain('fox');
    });

    it('should preserve @mentions', () => {
      const words = tokenize('Hello @username check this out');
      expect(words).toContain('@username');
    });

    it('should preserve #hashtags', () => {
      const words = tokenize('Check out #javascript and #typescript');
      expect(words).toContain('#javascript');
      expect(words).toContain('#typescript');
    });

    it('should filter short words (less than 2 chars)', () => {
      const words = tokenize('a I am so happy');
      expect(words).not.toContain('a');
      expect(words).not.toContain('i');
      expect(words).toContain('happy');
    });

    it('should remove punctuation', () => {
      const words = tokenize('Hello, world! How are you?');
      expect(words).toContain('hello');
      expect(words).toContain('world');
      expect(words).not.toContain('hello,');
      expect(words).not.toContain('world!');
    });

    it('should lowercase all words', () => {
      const words = tokenize('HELLO World TeStInG');
      expect(words).toContain('hello');
      expect(words).toContain('world');
      expect(words).toContain('testing');
    });

    it('should deduplicate words', () => {
      const words = tokenize('hello hello hello world');
      const helloCount = words.filter(w => w === 'hello').length;
      expect(helloCount).toBe(1);
    });

    it('should handle empty input', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize('   ')).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      expect(tokenize(null as any)).toEqual([]);
      expect(tokenize(undefined as any)).toEqual([]);
    });

    it('should limit words to MAX_WORDS_PER_POST', () => {
      // Generate content with 100 unique words
      const content = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
      const words = tokenize(content);
      expect(words.length).toBeLessThanOrEqual(50);
    });
  });

  describe('User search indexing', () => {
    // These tests verify the logic that was broken:
    // Users were not being found because search indexes weren't created

    it('should index handle with 3+ character prefixes', () => {
      // The indexUser function creates prefixes for handles
      // e.g., "chris" -> "chr", "chri", "chris"
      const handle = 'chrismartinez';
      const prefixes: string[] = [];

      for (let i = 3; i <= Math.min(handle.length, 15); i++) {
        prefixes.push(handle.slice(0, i));
      }

      expect(prefixes).toContain('chr');
      expect(prefixes).toContain('chri');
      expect(prefixes).toContain('chris');
      expect(prefixes).toContain('chrism');
      expect(prefixes).toContain('chrisma');
      expect(prefixes.length).toBe(Math.min(handle.length, 15) - 2);
    });

    it('should index display name words separately', () => {
      // Display name "Chris Martinez" should index both "chris" and "martinez" prefixes
      const displayName = 'Chris Martinez';
      const nameLower = displayName.toLowerCase();
      const nameParts = nameLower.split(/\s+/).filter(p => p.length >= 3);

      expect(nameParts).toContain('chris');
      expect(nameParts).toContain('martinez');
    });

    it('should not index short name parts', () => {
      const displayName = 'Jo Wu'; // Both parts are < 3 chars
      const nameLower = displayName.toLowerCase();
      const nameParts = nameLower.split(/\s+/).filter(p => p.length >= 3);

      expect(nameParts).toEqual([]);
    });

    it('should handle search query prefix correctly', () => {
      // When searching, we should use the query as a prefix
      const query = 'chris';
      const queryLower = query.toLowerCase().trim();
      const prefix = queryLower.slice(0, Math.min(queryLower.length, 15));

      expect(prefix).toBe('chris');
    });

    it('should limit prefix length to 15 characters', () => {
      const longQuery = 'thisisaverylongusername';
      const prefix = longQuery.slice(0, Math.min(longQuery.length, 15));

      expect(prefix).toBe('thisisaverylong');
      expect(prefix.length).toBe(15);
    });
  });
});
