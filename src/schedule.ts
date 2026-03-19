/**
 * Maps Hebrew calendar days (1-30) to Psalm chapters.
 *
 * The traditional Tehilim monthly cycle divides all 150 psalms
 * across 30 days of the Hebrew month.
 */

export type ChapterRef = {
  chapter: number;
  startVerse?: number;
  endVerse?: number;
};

/** Helper: creates ChapterRef[] for a contiguous range of whole chapters. */
function chapters(start: number, end: number): ChapterRef[] {
  const refs: ChapterRef[] = [];
  for (let ch = start; ch <= end; ch++) {
    refs.push({ chapter: ch });
  }
  return refs;
}

/** Helper: creates a single ChapterRef for a verse range within a chapter. */
function verseRange(chapter: number, start: number, end: number): ChapterRef {
  return { chapter, startVerse: start, endVerse: end };
}

/**
 * Traditional monthly Tehilim schedule.
 * Days 1-30 map to Psalms 1-150.
 */
export const DAILY_SCHEDULE: Record<number, ChapterRef[]> = {
  1: chapters(1, 9),
  2: chapters(10, 17),
  3: chapters(18, 22),
  4: chapters(23, 28),
  5: chapters(29, 34),
  6: chapters(35, 38),
  7: chapters(39, 43),
  8: chapters(44, 48),
  9: chapters(49, 54),
  10: chapters(55, 59),
  11: chapters(60, 65),
  12: chapters(66, 68),
  13: chapters(69, 71),
  14: chapters(72, 76),
  15: chapters(77, 78),
  16: chapters(79, 82),
  17: chapters(83, 87),
  18: chapters(88, 89),
  19: chapters(90, 96),
  20: chapters(97, 103),
  21: chapters(104, 105),
  22: chapters(106, 107),
  23: chapters(108, 112),
  24: chapters(113, 118),
  25: [verseRange(119, 1, 88)],
  26: [verseRange(119, 89, 176)],
  27: chapters(120, 134),
  28: chapters(135, 139),
  29: chapters(140, 144),
  30: chapters(145, 150),
};

/**
 * Returns the Hebrew day of the month (1-30) for the given date.
 * Uses the built-in Intl API with the Hebrew calendar.
 */
export function getHebrewDayOfMonth(date?: Date): number {
  const d = date ?? new Date();
  const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
    day: 'numeric',
  });
  return Number(formatter.format(d));
}

/**
 * Returns the full Hebrew date string (e.g. "כ״ה אדר ב׳ ה׳תשפ״ו").
 */
export function getHebrewDateString(date?: Date): string {
  const d = date ?? new Date();
  const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return formatter.format(d);
}

/**
 * Checks whether the given date is the last day of a Hebrew month.
 * This is determined by checking if tomorrow's Hebrew day is 1.
 */
export function isLastDayOfHebrewMonth(date?: Date): boolean {
  const d = date ?? new Date();
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getHebrewDayOfMonth(tomorrow) === 1;
}

/**
 * Returns the daily Tehilim reading for the given date.
 *
 * On day 29, if it is also the last day of the Hebrew month,
 * the readings for days 29 and 30 are combined so the entire
 * book of Tehilim is completed within the month.
 */
export function getDailyReading(date?: Date): ChapterRef[] {
  const d = date ?? new Date();
  const day = getHebrewDayOfMonth(d);

  // Clamp to valid schedule range
  const scheduleDay = Math.min(Math.max(day, 1), 30);

  if (scheduleDay === 29 && isLastDayOfHebrewMonth(d)) {
    return [...DAILY_SCHEDULE[29], ...DAILY_SCHEDULE[30]];
  }

  return DAILY_SCHEDULE[scheduleDay];
}
