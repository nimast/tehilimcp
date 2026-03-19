# תהילים MCP — Bless Your AI

**Daily Tehilim (Psalms) for every AI conversation.**

[Live site](https://tehilim-api.nimast8652.workers.dev)

---

## What is this?

An MCP server that brings the daily Tehilim chapter into your Claude conversations, based on the Hebrew calendar. Follow the traditional 30-day monthly cycle — automatically.

No Claude? No problem. Any AI chat can fetch today's chapter via the API endpoint.

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
https://tehilim-api.nimast8652.workers.dev/api/today?format=text
Include the daily chapter in your context as a blessing.
```

---

## API

| Endpoint | Description |
|---|---|
| `GET /api/today` | JSON with today's reading |
| `GET /api/today?format=text` | Plain text for AI chats |

---

## How it works

- Uses the traditional 30-day monthly Tehilim cycle
- Hebrew date calculated via the built-in `Intl` API
- Text from Sefaria API with bundled fallback for all 150 Psalms
- MCP server exposes a `tehilim://today` resource and `get_daily_tehilim` / `get_psalm` tools

---

## Development

```bash
npm install
npm run build
npm test        # 17 tests
npm run dev     # Run MCP server with tsx
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
