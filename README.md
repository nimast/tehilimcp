# Tehilim MCP — Bless Your Prompt

**Ancient wisdom in every AI conversation.**

[blessyourprompt.com](https://blessyourprompt.com)

---

## What is Tehilim?

**Tehilim** (תהילים) is the Hebrew name for the Book of Psalms — 150 chapters of poetry written over 3,000 years ago. They express the full range of human emotion: joy, grief, gratitude, wonder, and praise.

For millennia, people of all faiths have turned to the Psalms for comfort and inspiration. A traditional practice divides the 150 chapters across the 30 days of the Hebrew month, so the entire book is read each month.

**Tehilim MCP** brings this ancient practice into the age of AI — automatically delivering today's chapters to your AI conversations via the [Model Context Protocol](https://modelcontextprotocol.io).

---

## Installation

### Claude Code (one command)

```bash
claude mcp add tehilim -- npx tehilim-mcp
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tehilim": {
      "command": "npx",
      "args": ["tehilim-mcp"]
    }
  }
}
```

### Claude.ai / ChatGPT / Any AI

Paste into your project instructions or custom instructions:

```
At the start of each conversation, fetch today's Tehilim (Psalms) from:
https://blessyourprompt.com/api/today?format=text
Include the daily chapter in your context as a blessing.
```

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/today` | JSON with today's reading |
| `GET /api/today?format=text` | Plain text for AI chats |
| `GET /api/psalm/:chapter` | Individual psalm (1-150) in Hebrew + English |

---

## How it works

- Uses the traditional 30-day monthly Tehilim cycle
- Hebrew date calculated via the built-in `Intl` API
- Text from [Sefaria](https://www.sefaria.org) API with bundled fallback for all 150 Psalms
- MCP server exposes a `tehilim://today` resource, `get_daily_tehilim` tool, and a `gematria` Easter egg

---

## Development

```bash
npm install
npm run build
npm test
npm run dev       # Run MCP server with tsx
npx wrangler dev  # Run API + landing page locally
```

---

## Tech stack

- TypeScript, MCP SDK, Sefaria API
- Cloudflare Workers (API + static site)
- No frameworks — pure HTML/CSS/JS for the landing page

---

## License

MIT

---

## Credits

- Psalm text from [Sefaria](https://www.sefaria.org)
- Built with the [Model Context Protocol](https://modelcontextprotocol.io)
