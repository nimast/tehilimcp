/**
 * Sefaria API client for fetching Psalm texts, with in-memory cache
 * and bundled fallback data.
 */

import { BUNDLED_PSALMS } from './psalms-data.js';
import {
  type ChapterRef,
  getDailyReading,
  getHebrewDateString,
  getHebrewDayOfMonth,
} from './schedule.js';

export type PsalmText = {
  hebrew: string[];
  english: string[];
  ref: string;
  heRef: string;
};

/** Strips HTML tags and decodes HTML entities from Sefaria API response strings. */
export function stripHtml(text: string): string {
  // Strip HTML tags
  const noTags = text.replace(/<[^>]*>/g, '');
  // Decode HTML entities
  const ENTITIES: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&thinsp;': ' ', '&ensp;': ' ', '&emsp;': ' ',
    '&ndash;': '–', '&mdash;': '—', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&hellip;': '…',
  };
  return noTags
    .replace(/&[a-zA-Z]+;/g, (match) => ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ---------------------------------------------------------------------------
// Simple in-memory cache with 1-hour TTL
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: PsalmText;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function getCached(key: string): PsalmText | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCache(key: string, data: PsalmText): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Bundled fallback
// ---------------------------------------------------------------------------

function getBundledPsalm(
  chapter: number,
  options?: { startVerse?: number; endVerse?: number },
): PsalmText | undefined {
  const entry = BUNDLED_PSALMS[String(chapter)];
  if (!entry) return undefined;

  let hebrew = entry.he;
  let english = entry.text;

  if (options?.startVerse != null && options?.endVerse != null) {
    // Sefaria arrays are 0-indexed; verses are 1-indexed
    const start = options.startVerse - 1;
    const end = options.endVerse; // slice end is exclusive
    hebrew = hebrew.slice(start, end);
    english = english.slice(start, end);
  }

  return {
    hebrew: hebrew.map(stripHtml),
    english: english.map(stripHtml),
    ref: entry.ref,
    heRef: entry.heRef,
  };
}

// ---------------------------------------------------------------------------
// Sefaria API fetch
// ---------------------------------------------------------------------------

/**
 * Fetches a single psalm (or verse range) from the Sefaria API.
 * Falls back to bundled data on network/API errors.
 */
export async function fetchPsalm(
  chapter: number,
  options?: { startVerse?: number; endVerse?: number },
): Promise<PsalmText> {
  const hasRange = options?.startVerse != null && options?.endVerse != null;
  const ref = hasRange
    ? `Psalms.${chapter}.${options!.startVerse}-${options!.endVerse}`
    : `Psalms.${chapter}`;

  // Check cache
  const cached = getCached(ref);
  if (cached) return cached;

  try {
    const url = `https://www.sefaria.org/api/texts/${ref}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sefaria API returned ${response.status}`);
    }

    const data = await response.json();

    const hebrewRaw: string[] = Array.isArray(data.he) ? data.he : [data.he];
    const englishRaw: string[] = Array.isArray(data.text)
      ? data.text
      : [data.text];

    const result: PsalmText = {
      hebrew: hebrewRaw.map(stripHtml),
      english: englishRaw.map(stripHtml),
      ref: data.ref ?? ref,
      heRef: data.heRef ?? ref,
    };

    setCache(ref, result);
    return result;
  } catch (error) {
    // Fall back to bundled data
    const bundled = getBundledPsalm(chapter, options);
    if (bundled) return bundled;

    throw new Error(
      `Failed to fetch Psalm ${ref} and no bundled data available: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Daily reading formatter
// ---------------------------------------------------------------------------

/**
 * Fetches all psalms for today's daily reading and formats them into
 * a readable markdown string with the Hebrew date, psalm numbers,
 * and text in both Hebrew and English.
 */
export async function fetchDailyReading(date?: Date): Promise<string> {
  const d = date ?? new Date();
  const hebrewDate = getHebrewDateString(d);
  const day = getHebrewDayOfMonth(d);
  const reading = getDailyReading(d);

  const texts = await Promise.all(
    reading.map((ref: ChapterRef) =>
      fetchPsalm(ref.chapter, {
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
      }),
    ),
  );

  const lines: string[] = [];
  lines.push(`# תהילים — Daily Tehilim`);
  lines.push('');
  lines.push(`**Hebrew Date:** ${hebrewDate}`);
  lines.push(`**Day of Month:** ${day}`);
  lines.push('');

  for (let i = 0; i < reading.length; i++) {
    const ref = reading[i];
    const text = texts[i];

    const label =
      ref.startVerse != null && ref.endVerse != null
        ? `Psalm ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
        : `Psalm ${ref.chapter}`;

    lines.push(`## ${label}`);
    lines.push(`*${text.heRef}*`);
    lines.push('');

    for (let v = 0; v < text.hebrew.length; v++) {
      lines.push(`**${text.hebrew[v]}**`);
      lines.push(text.english[v]);
      lines.push('');
    }
  }

  return lines.join('\n');
}
