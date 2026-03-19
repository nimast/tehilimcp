// Cloudflare Workers handler — self-contained, no imports from ../src/

// ---------------------------------------------------------------------------
// Hebrew date helpers
// ---------------------------------------------------------------------------

function getHebrewDayOfMonth(): number {
  const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' });
  const parts = formatter.formatToParts(new Date());
  const dayPart = parts.find(p => p.type === 'day');
  return parseInt(dayPart!.value, 10);
}

function getHebrewDateString(): string {
  return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
}

function isTomorrowNewMonth(): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' });
  const parts = formatter.formatToParts(tomorrow);
  const dayPart = parts.find(p => p.type === 'day');
  return parseInt(dayPart!.value, 10) === 1;
}

// ---------------------------------------------------------------------------
// Schedule mapping — traditional 30-day Tehilim cycle
// ---------------------------------------------------------------------------

const SCHEDULE: Record<number, [number, number]> = {
  1:[1,9],2:[10,17],3:[18,22],4:[23,28],5:[29,34],6:[35,38],7:[39,43],
  8:[44,48],9:[49,54],10:[55,59],11:[60,65],12:[66,68],13:[69,71],
  14:[72,76],15:[77,78],16:[79,82],17:[83,87],18:[88,89],19:[90,96],
  20:[97,103],21:[104,105],22:[106,107],23:[108,112],24:[113,118],
  25:[119,119],26:[119,119],27:[120,134],28:[135,139],29:[140,144],30:[145,150]
};

// ---------------------------------------------------------------------------
// Sefaria fetch helpers
// ---------------------------------------------------------------------------

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

type PsalmResult = {
  chapter: number;
  ref: string;
  heRef: string;
  hebrew: string[];
  english: string[];
};

async function fetchChapter(chapter: number, verseRange?: string): Promise<PsalmResult> {
  const sefariaRef = verseRange
    ? `Psalms.${chapter}.${verseRange}`
    : `Psalms.${chapter}`;

  const url = `https://www.sefaria.org/api/texts/${sefariaRef}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sefaria API returned ${response.status} for ${sefariaRef}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const hebrewRaw: string[] = Array.isArray(data.he) ? data.he as string[] : [data.he as string];
  const englishRaw: string[] = Array.isArray(data.text) ? data.text as string[] : [data.text as string];

  return {
    chapter,
    ref: (data.ref as string) ?? sefariaRef,
    heRef: (data.heRef as string) ?? sefariaRef,
    hebrew: hebrewRaw.map(stripHtml),
    english: englishRaw.map(stripHtml),
  };
}

async function fetchDayPsalms(day: number): Promise<PsalmResult[]> {
  const [start, end] = SCHEDULE[day];

  if (day === 25) return [await fetchChapter(119, '1-88')];
  if (day === 26) return [await fetchChapter(119, '89-176')];

  const promises: Promise<PsalmResult>[] = [];
  for (let ch = start; ch <= end; ch++) {
    promises.push(fetchChapter(ch));
  }
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Format as plain text (for AI chats)
// ---------------------------------------------------------------------------

function formatAsText(hebrewDate: string, day: number, psalms: PsalmResult[]): string {
  const lines: string[] = [];
  lines.push(`Daily Tehilim — ${hebrewDate} (Day ${day})`);
  lines.push('');

  for (const psalm of psalms) {
    lines.push(`--- ${psalm.heRef} (${psalm.ref}) ---`);
    lines.push('');
    for (let i = 0; i < psalm.hebrew.length; i++) {
      lines.push(psalm.hebrew[i]);
      lines.push(psalm.english[i] ?? '');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Cloudflare Workers handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const format = url.searchParams.get('format');

    const headers: Record<string, string> = {
      'Cache-Control': 'public, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    };

    try {
      const day = getHebrewDayOfMonth();
      const hebrewDate = getHebrewDateString();

      const daysToRead: number[] = [day];
      if (day === 29 && isTomorrowNewMonth()) {
        daysToRead.push(30);
      }

      const allPsalms: PsalmResult[] = [];
      for (const d of daysToRead) {
        const psalms = await fetchDayPsalms(d);
        allPsalms.push(...psalms);
      }

      if (format === 'text') {
        return new Response(formatAsText(hebrewDate, day, allPsalms), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      const json = {
        hebrewDate,
        day,
        psalms: allPsalms,
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
  },
};
