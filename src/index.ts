import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchPsalm, fetchDailyReading, type PsalmText } from "./sefaria.js";

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
// Returns today's Tehilim reading with optional language filter and date.
// ---------------------------------------------------------------------------

server.tool(
  "get_daily_tehilim",
  {
    language: z.enum(["hebrew", "english", "both"]).optional().default("both"),
    date: z.string().optional().describe("ISO date string to override today's date"),
  },
  async ({ language: _language, date }) => {
    const targetDate = date ? new Date(date) : undefined;
    const text = await fetchDailyReading(targetDate);
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_psalm
// Look up any specific Psalm by chapter number (1-150).
// ---------------------------------------------------------------------------

server.tool(
  "get_psalm",
  {
    chapter: z.number().int().min(1).max(150).describe("Psalm chapter number (1-150)"),
    language: z.enum(["hebrew", "english", "both"]).optional().default("both"),
  },
  async ({ chapter, language }) => {
    const psalm = await fetchPsalm(chapter);
    const text = formatPsalm(psalm, chapter, language);
    return { content: [{ type: "text" as const, text }] };
  }
);

// ---------------------------------------------------------------------------
// Formatting helper for get_psalm
// ---------------------------------------------------------------------------

function formatPsalm(
  psalm: PsalmText,
  _chapter: number,
  language: "hebrew" | "english" | "both",
): string {
  const lines: string[] = [];

  lines.push(`# ${psalm.heRef}`);
  lines.push(`## ${psalm.ref}`);
  lines.push("");

  const verseCount = Math.max(psalm.hebrew.length, psalm.english.length);

  for (let i = 0; i < verseCount; i++) {
    const verseNum = i + 1;
    const heVerse = psalm.hebrew[i] ?? "";
    const enVerse = psalm.english[i] ?? "";

    if (language === "hebrew" || language === "both") {
      lines.push(`**${verseNum}.** ${heVerse}`);
    }
    if (language === "english" || language === "both") {
      lines.push(`*${verseNum}. ${enVerse}*`);
    }
    if (language === "both") {
      lines.push("");
    }
  }

  return lines.join("\n");
}

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
