import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchPsalm, fetchDailyReading } from "./sefaria.js";

const server = new McpServer({
  name: "tehilim-mcp",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Resource: tehilim://today
// Auto-populates Claude's context with today's full Tehilim reading.
// ---------------------------------------------------------------------------

server.resource(
  "daily-tehilim",
  "tehilim://today",
  async (uri) => {
    const text = await fetchDailyReading();
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/plain",
        text,
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_daily_tehilim
// Returns today's Tehilim reading with optional date override.
// ---------------------------------------------------------------------------

server.tool(
  "get_daily_tehilim",
  {
    date: z.string().optional().describe("ISO date string to override today's date"),
  },
  async ({ date }) => {
    const targetDate = date ? new Date(date) : undefined;
    const text = await fetchDailyReading(targetDate);
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: gematria
// Calculate the gematria (Hebrew numerology) of a word and discover its
// connected Psalm.
// ---------------------------------------------------------------------------

const GEMATRIA_VALUES: Record<string, number> = {
  "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
  "י": 10, "כ": 20, "ך": 20, "ל": 30, "מ": 40, "ם": 40, "נ": 50, "ן": 50,
  "ס": 60, "ע": 70, "פ": 80, "ף": 80, "צ": 90, "ץ": 90,
  "ק": 100, "ר": 200, "ש": 300, "ת": 400,
};

function calculateGematria(text: string): number {
  let total = 0;
  for (const char of text) {
    total += GEMATRIA_VALUES[char] ?? 0;
  }
  return total;
}

server.tool(
  "gematria",
  "Calculate the gematria (Hebrew numerology) of a word and discover its connected Psalm. Enter any Hebrew word to find its numerical value and the Psalm chapter it maps to.",
  {
    text: z.string().max(1000).describe("A Hebrew word or phrase"),
  },
  async ({ text }) => {
    const value = calculateGematria(text);
    if (value === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No Hebrew letters found in the input. Please enter a Hebrew word or phrase.",
        }],
      };
    }
    const chapter = ((value - 1) % 150) + 1;
    const psalm = await fetchPsalm(chapter);

    const lines: string[] = [];
    lines.push(`# Gematria: ${text}`);
    lines.push("");
    lines.push(`**Gematria value:** ${value}`);
    lines.push(`**Mapped to Psalm:** ${chapter}`);
    lines.push("");
    lines.push(`# ${psalm.heRef}`);
    lines.push(`## ${psalm.ref}`);
    lines.push("");

    const verseCount = Math.max(psalm.hebrew.length, psalm.english.length);
    for (let i = 0; i < verseCount; i++) {
      const verseNum = i + 1;
      const heVerse = psalm.hebrew[i] ?? "";
      const enVerse = psalm.english[i] ?? "";
      lines.push(`**${verseNum}.** ${heVerse}`);
      lines.push(`*${verseNum}. ${enVerse}*`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Server start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
