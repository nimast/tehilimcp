# TODOS

## Deferred

### Add `/api/psalm/:chapter` HTTP endpoint
**What:** Expose specific Psalm lookup over HTTP (GET /api/psalm/23 → Psalm 23 in Hebrew + English).
**Why:** The MCP server already has `get_psalm` tool; this exposes the same logic over HTTP for non-MCP consumers.
**Pros:** Completes the API surface. Useful for any AI chat or app that wants a specific Psalm.
**Cons:** ~20 lines of code. Needs a second Vercel serverless function file or route handling in api/today.ts.
**Context:** Design doc includes this in the API spec. Deferred from v1 to focus on the daily reading use case. The shared sefaria.ts already supports fetching by chapter — just needs an HTTP wrapper.
**Depends on:** v1 API endpoint working.
