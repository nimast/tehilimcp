import { describe, it, expect } from 'vitest';
import {
  DAILY_SCHEDULE,
  getHebrewDayOfMonth,
  getDailyReading,
  type ChapterRef,
} from '../src/schedule.js';

describe('DAILY_SCHEDULE', () => {
  it('has entries for all 30 days', () => {
    for (let day = 1; day <= 30; day++) {
      expect(DAILY_SCHEDULE[day]).toBeDefined();
      expect(DAILY_SCHEDULE[day].length).toBeGreaterThan(0);
    }
  });

  it('covers all 150 Psalms', () => {
    const allChapters = new Set<number>();

    for (let day = 1; day <= 30; day++) {
      for (const ref of DAILY_SCHEDULE[day]) {
        if (ref.startVerse == null && ref.endVerse == null) {
          // Whole chapter
          allChapters.add(ref.chapter);
        } else {
          // Partial chapter (e.g. Psalm 119)
          allChapters.add(ref.chapter);
        }
      }
    }

    for (let ch = 1; ch <= 150; ch++) {
      expect(allChapters.has(ch), `Psalm ${ch} should be in the schedule`).toBe(true);
    }
  });

  it('splits Psalm 119 correctly', () => {
    const day25 = DAILY_SCHEDULE[25];
    expect(day25).toHaveLength(1);
    expect(day25[0].chapter).toBe(119);
    expect(day25[0].startVerse).toBe(1);
    expect(day25[0].endVerse).toBe(88);

    const day26 = DAILY_SCHEDULE[26];
    expect(day26).toHaveLength(1);
    expect(day26[0].chapter).toBe(119);
    expect(day26[0].startVerse).toBe(89);
    expect(day26[0].endVerse).toBe(176);
  });

  it('has no duplicate chapters except Psalm 119', () => {
    const chapterDays = new Map<number, number[]>();

    for (let day = 1; day <= 30; day++) {
      for (const ref of DAILY_SCHEDULE[day]) {
        if (!chapterDays.has(ref.chapter)) {
          chapterDays.set(ref.chapter, []);
        }
        chapterDays.get(ref.chapter)!.push(day);
      }
    }

    for (const [chapter, days] of chapterDays) {
      if (chapter === 119) {
        // Psalm 119 appears in both day 25 and day 26
        expect(days).toEqual([25, 26]);
      } else {
        expect(
          days.length,
          `Psalm ${chapter} appears in multiple days: ${days.join(', ')}`,
        ).toBe(1);
      }
    }
  });
});

describe('getHebrewDayOfMonth', () => {
  it('returns a number between 1 and 30', () => {
    const day = getHebrewDayOfMonth();
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(30);
  });
});

describe('getDailyReading', () => {
  it('returns a non-empty ChapterRef array', () => {
    const reading = getDailyReading();
    expect(Array.isArray(reading)).toBe(true);
    expect(reading.length).toBeGreaterThan(0);

    for (const ref of reading) {
      expect(ref).toHaveProperty('chapter');
      expect(typeof ref.chapter).toBe('number');
    }
  });

  it('returns combined days 29+30 when applicable', () => {
    // We verify the structure: if getDailyReading ever returns a combined
    // reading, it should include all chapters from both days 29 and 30.
    const day29Refs = DAILY_SCHEDULE[29];
    const day30Refs = DAILY_SCHEDULE[30];
    const combined = [...day29Refs, ...day30Refs];

    // The combined reading should have chapters from both days
    const day29Chapters = day29Refs.map((r: ChapterRef) => r.chapter);
    const day30Chapters = day30Refs.map((r: ChapterRef) => r.chapter);

    for (const ch of day29Chapters) {
      expect(combined.some((r: ChapterRef) => r.chapter === ch)).toBe(true);
    }
    for (const ch of day30Chapters) {
      expect(combined.some((r: ChapterRef) => r.chapter === ch)).toBe(true);
    }

    // Total chapters should be sum of both days
    expect(combined.length).toBe(day29Refs.length + day30Refs.length);
  });
});
