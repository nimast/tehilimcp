import { describe, it, expect } from 'vitest';

const BASE_URL = process.env.API_BASE_URL ?? 'https://blessyourprompt.com';

describe('API Integration', () => {
  describe('GET /api/today', () => {
    it('returns today\'s psalms as JSON', async () => {
      const res = await fetch(`${BASE_URL}/api/today`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const json = await res.json();
      expect(json.hebrewDate).toBeDefined();
      expect(json.day).toBeGreaterThanOrEqual(1);
      expect(json.day).toBeLessThanOrEqual(30);
      expect(json.psalms.length).toBeGreaterThan(0);

      const psalm = json.psalms[0];
      expect(psalm.chapter).toBeGreaterThanOrEqual(1);
      expect(psalm.hebrew.length).toBeGreaterThan(0);
      expect(psalm.english.length).toBeGreaterThan(0);
    });

    it('returns plain text with ?format=text', async () => {
      const res = await fetch(`${BASE_URL}/api/today?format=text`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');

      const text = await res.text();
      expect(text).toContain('Daily Tehilim');
      expect(text).toContain('Psalm');
    });
  });

  describe('GET /api/psalm/:chapter', () => {
    it('returns Psalm 23 as JSON', async () => {
      const res = await fetch(`${BASE_URL}/api/psalm/23`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.chapter).toBe(23);
      expect(json.ref).toContain('Psalms');
      expect(json.hebrew.length).toBeGreaterThan(0);
      expect(json.english.length).toBeGreaterThan(0);
    });

    it('returns Psalm 23 as plain text', async () => {
      const res = await fetch(`${BASE_URL}/api/psalm/23?format=text`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('Psalm 23');
    });

    it('returns 400 for invalid chapter', async () => {
      const res = await fetch(`${BASE_URL}/api/psalm/0`);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('Invalid chapter');
    });

    it('returns 400 for chapter > 150', async () => {
      const res = await fetch(`${BASE_URL}/api/psalm/999`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-numeric path', async () => {
      const res = await fetch(`${BASE_URL}/api/psalm/abc`);
      expect(res.status).toBe(404);
    });
  });

  describe('Landing page', () => {
    it('serves HTML at root', async () => {
      const res = await fetch(BASE_URL);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('Tehilim');
    });
  });

  describe('GET /api/bless', () => {
    it('returns default blessing with psalm text', async () => {
      const res = await fetch(`${BASE_URL}/api/bless`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');
      expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
      expect(res.headers.get('access-control-allow-origin')).toBe('*');

      const text = await res.text();
      expect(text).toContain('Tehilim Blessing');
      expect(text).toContain('Psalm');
    });

    it('returns raw psalm text for chatgpt platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=chatgpt`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('Psalm');
      expect(text).not.toContain('Add Bless Your Prompt');
    });

    it('returns CLI command for claude-code platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=claude-code`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('claude mcp add');
      expect(text).toContain('blessyourprompt.com/mcp');
    });

    it('returns JSON config for cursor platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=cursor`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');

      const json = await res.json();
      expect(json.mcpServers.tehilim.url).toBe('https://blessyourprompt.com/mcp');
    });

    it('returns MCP setup instructions for claude platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=claude`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('MCP');
      expect(text).toContain('blessyourprompt.com/mcp');
    });

    it('returns gemini instructions for gemini platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=gemini`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('Tehilim');
      expect(text).toContain('Psalm');
    });

    it('falls back to default for unknown platform', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=foobar`);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('blessed');
      expect(text).toContain('Psalm');
    });

    it('has CORS headers on all responses', async () => {
      const res = await fetch(`${BASE_URL}/api/bless?platform=chatgpt`);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('CORS', () => {
    it('returns Access-Control-Allow-Origin header on API', async () => {
      const res = await fetch(`${BASE_URL}/api/today`);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });
});
