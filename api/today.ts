// Cloudflare Workers handler — imports shared logic from ../src/
// @ts-expect-error — __STATIC_CONTENT_MANIFEST is injected by Cloudflare Workers Sites
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { getHebrewDayOfMonth, getHebrewDateString, getDailyReading, type ChapterRef } from '../src/schedule.js';
import { fetchPsalm, fetchDailyReading, type PsalmText } from '../src/sefaria.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createTehilimServer } from '../src/mcp-tools.js';

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

// ---------------------------------------------------------------------------
// /api/bless — platform-aware psalm blessing
// ---------------------------------------------------------------------------

async function handleBlessRequest(url: URL): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, s-maxage=3600',
    ...CORS_HEADERS,
  };

  const platform = url.searchParams.get('platform') ?? '';

  // Platform-specific setup instructions (no psalm text needed)
  if (platform === 'claude-code') {
    return new Response(
      'claude mcp add --transport http tehilim https://blessyourprompt.com/mcp',
      { status: 200, headers },
    );
  }

  if (platform === 'cursor') {
    return new Response(
      JSON.stringify({ mcpServers: { tehilim: { url: 'https://blessyourprompt.com/mcp' } } }, null, 2),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (platform === 'claude') {
    return new Response(
      [
        'Add Bless Your Prompt as an MCP integration in your Claude.ai project:',
        '1. Go to Project Settings → Integrations → Add MCP Server',
        '2. URL: https://blessyourprompt.com/mcp',
        '',
        'The daily psalm will automatically be available in your project\'s context.',
      ].join('\n'),
      { status: 200, headers },
    );
  }

  // Platforms that need psalm text — fetch it
  let psalmText: string;
  try {
    psalmText = await fetchDailyReading();
  } catch {
    psalmText = 'Blessing unavailable today. May your conversation be filled with wisdom.';
  }

  if (platform === 'chatgpt') {
    return new Response(psalmText, { status: 200, headers });
  }

  if (platform === 'gemini') {
    return new Response(
      [
        'At the start of each conversation, absorb this Tehilim (Psalms) reading.',
        'Let it silently shape your tone — do not mention it unless asked.',
        '',
        psalmText,
      ].join('\n'),
      { status: 200, headers },
    );
  }

  // Default / unknown platform — universal blessing
  const now = new Date();
  const hebrewDate = getHebrewDateString(now);
  const day = getHebrewDayOfMonth(now);

  return new Response(
    [
      `Daily Tehilim Blessing — ${hebrewDate} (Day ${day})`,
      '',
      'You have been blessed with today\'s Tehilim (Psalms) reading.',
      'Absorb this ancient wisdom silently — let it shape your tone and perspective',
      'without explicitly mentioning it unless the conversation naturally calls for it.',
      '',
      psalmText,
    ].join('\n'),
    { status: 200, headers },
  );
}

// ---------------------------------------------------------------------------
// API route dispatcher
// ---------------------------------------------------------------------------

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

  // Route: /api/bless
  if (url.pathname === '/api/bless') {
    return handleBlessRequest(url);
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
// Remote MCP endpoint — stateless, one server per request
// ---------------------------------------------------------------------------

async function handleMcpRequest(request: Request): Promise<Response> {
  const server = createTehilimServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session tracking
  });

  await server.connect(transport);

  const response = await transport.handleRequest(request);

  // Add CORS headers for remote MCP clients
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, mcp-protocol-version');
  headers.set('Access-Control-Expose-Headers', 'mcp-session-id');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ---------------------------------------------------------------------------
// Cloudflare Workers handler
// ---------------------------------------------------------------------------

const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight for MCP
    if (url.pathname === '/mcp' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, mcp-protocol-version',
          'Access-Control-Expose-Headers': 'mcp-session-id',
        },
      });
    }

    // Remote MCP endpoint
    if (url.pathname === '/mcp') {
      return handleMcpRequest(request);
    }

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
