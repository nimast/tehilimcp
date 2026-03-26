// Cloudflare Workers handler — imports shared logic from ../src/
// @ts-expect-error — __STATIC_CONTENT_MANIFEST is injected by Cloudflare Workers Sites
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { getHebrewDayOfMonth, getHebrewDateString, getDailyReading, type ChapterRef } from '../src/schedule.js';
import { fetchPsalm, type PsalmText } from '../src/sefaria.js';

// ---------------------------------------------------------------------------
// Rate limiting — 60 requests per minute per IP
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000; // clean up every minute

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(ip: string): boolean {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Format as plain text (for AI chats)
// ---------------------------------------------------------------------------

function formatAsText(hebrewDate: string, day: number, reading: ChapterRef[], psalms: PsalmText[]): string {
  const lines: string[] = [];
  lines.push(`Daily Tehilim — ${hebrewDate} (Day ${day})`);
  lines.push('');

  for (let i = 0; i < psalms.length; i++) {
    const psalm = psalms[i];
    const ref = reading[i];
    const label = ref && ref.startVerse != null && ref.endVerse != null
      ? `Psalm ${ref.chapter}:${ref.startVerse}-${ref.endVerse}`
      : `Psalm ${ref?.chapter ?? ''}`;

    lines.push(`--- ${psalm.heRef} (${label}) ---`);
    lines.push('');
    for (let v = 0; v < psalm.hebrew.length; v++) {
      lines.push(psalm.hebrew[v]);
      lines.push(psalm.english[v] ?? '');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatPsalmAsText(psalm: PsalmText, chapter: number): string {
  const lines: string[] = [];
  lines.push(`--- ${psalm.heRef} (Psalm ${chapter}) ---`);
  lines.push('');
  for (let v = 0; v < psalm.hebrew.length; v++) {
    lines.push(psalm.hebrew[v]);
    lines.push(psalm.english[v] ?? '');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// API route handlers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
};

async function handlePsalmRequest(chapter: number, url: URL): Promise<Response> {
  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=86400',
    ...CORS_HEADERS,
  };

  if (isNaN(chapter) || chapter < 1 || chapter > 150) {
    return new Response(
      JSON.stringify({ error: 'Invalid chapter. Must be between 1 and 150.' }),
      {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }

  try {
    const psalm = await fetchPsalm(chapter);
    const format = url.searchParams.get('format');

    if (format === 'text') {
      return new Response(formatPsalmAsText(psalm, chapter), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const json = {
      chapter,
      ref: psalm.ref,
      heRef: psalm.heRef,
      hebrew: psalm.hebrew,
      english: psalm.english,
    };

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }
}

async function handleTodayRequest(url: URL): Promise<Response> {
  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=3600',
    ...CORS_HEADERS,
  };
  const format = url.searchParams.get('format');

  try {
    const now = new Date();
    const day = getHebrewDayOfMonth(now);
    const hebrewDate = getHebrewDateString(now);
    const reading = getDailyReading(now);

    const psalms = await Promise.all(
      reading.map((ref: ChapterRef) =>
        fetchPsalm(ref.chapter, {
          startVerse: ref.startVerse,
          endVerse: ref.endVerse,
        }),
      ),
    );

    if (format === 'text') {
      return new Response(formatAsText(hebrewDate, day, reading, psalms), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const json = {
      hebrewDate,
      day,
      psalms: psalms.map((psalm, i) => {
        const ref = reading[i];
        return {
          chapter: ref.chapter,
          ref: psalm.ref,
          heRef: psalm.heRef,
          hebrew: psalm.hebrew,
          english: psalm.english,
        };
      }),
    };

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      },
    );
  }
}

async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Rate limiting check
  const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? '0.0.0.0';
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too Many Requests' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '60',
          ...CORS_HEADERS,
        },
      },
    );
  }

  // Route: /api/psalm/:chapter
  const psalmMatch = url.pathname.match(/^\/api\/psalm\/(\d+)$/);
  if (psalmMatch) {
    const chapter = parseInt(psalmMatch[1], 10);
    return handlePsalmRequest(chapter, url);
  }

  // Route: /api/today
  if (url.pathname === '/api/today') {
    return handleTodayRequest(url);
  }

  return new Response('Not Found', { status: 404 });
}

// ---------------------------------------------------------------------------
// Cloudflare Workers handler
// ---------------------------------------------------------------------------

const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }

    // Static assets from docs/
    try {
      return await getAssetFromKV(
        { request, waitUntil: ctx.waitUntil.bind(ctx) },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT as KVNamespace, ASSET_MANIFEST: assetManifest },
      );
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  },
};
