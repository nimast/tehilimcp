import { describe, it, expect } from 'vitest';
import { stripHtml, fetchPsalm, fetchDailyReading } from '../src/sefaria.js';

describe('stripHtml', () => {
  it('removes bold tags', () => {
    expect(stripHtml('<b>text</b>')).toBe('text');
  });

  it('removes italic tags', () => {
    expect(stripHtml('<i>text</i>')).toBe('text');
  });

  it('removes br tags', () => {
    expect(stripHtml('text<br>more')).toBe('textmore');
  });

  it('removes span tags with attributes', () => {
    expect(stripHtml('<span class="x">text</span>')).toBe('text');
  });

  it('removes nested tags', () => {
    expect(stripHtml('<b><i>text</i></b>')).toBe('text');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('just plain text')).toBe('just plain text');
  });

  it('decodes &amp; entity', () => {
    expect(stripHtml('bread &amp; butter')).toBe('bread & butter');
  });

  it('decodes &nbsp; as space', () => {
    expect(stripHtml('word&nbsp;word')).toBe('word word');
  });

  it('decodes &thinsp; as space', () => {
    expect(stripHtml('word&thinsp;word')).toBe('word word');
  });

  it('decodes numeric entities', () => {
    expect(stripHtml('&#8217;')).toBe('\u2019'); // right single quote
  });

  it('decodes hex entities', () => {
    expect(stripHtml('&#x2019;')).toBe('\u2019'); // right single quote
  });

  it('handles combined tags and entities', () => {
    expect(stripHtml('<b>bread &amp; butter</b>')).toBe('bread & butter');
  });
});

describe('fetchPsalm', () => {
  it('returns valid structure for Psalm 23', async () => {
    const result = await fetchPsalm(23);

    expect(result).toHaveProperty('hebrew');
    expect(result).toHaveProperty('english');
    expect(result).toHaveProperty('ref');
    expect(result).toHaveProperty('heRef');

    expect(typeof result.ref).toBe('string');
    expect(typeof result.heRef).toBe('string');
    expect(Array.isArray(result.hebrew)).toBe(true);
    expect(Array.isArray(result.english)).toBe(true);
  });

  it('returns non-empty hebrew array', async () => {
    const result = await fetchPsalm(23);
    expect(result.hebrew.length).toBeGreaterThan(0);
  });

  it('returns non-empty english array', async () => {
    const result = await fetchPsalm(23);
    expect(result.english.length).toBeGreaterThan(0);
  });
});

describe('fetchPsalm fallback', () => {
  it('returns valid data for Psalm 23 even with bundled fallback', async () => {
    // Psalm 23 should always work — either from API or bundled data
    const result = await fetchPsalm(23);
    expect(result.hebrew.length).toBeGreaterThan(0);
    expect(result.english.length).toBeGreaterThan(0);
    expect(result.ref).toContain('Psalms');
  });
});

describe('fetchDailyReading', () => {
  it('returns a non-empty string', async () => {
    const result = await fetchDailyReading();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
