import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchPsalm, fetchDailyReading } from "./sefaria.js";

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

/**
 * Creates and configures an MCP server with all Tehilim tools and resources.
 * Used by both the stdio server (src/index.ts) and the HTTP endpoint (api/today.ts).
 */
export function createTehilimServer(): McpServer {
  const server = new McpServer({
    name: "tehilim-mcp",
    version: "1.0.0",
  });

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

  return server;
}
