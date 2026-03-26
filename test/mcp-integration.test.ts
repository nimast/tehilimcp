import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

describe('MCP Server Integration', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // First, ensure the project is built
    // The dist/index.js should exist from a prior build
    const serverPath = path.resolve(__dirname, '../dist/index.js');

    transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    });

    await client.connect(transport);
  }, 30000); // 30s timeout for startup

  afterAll(async () => {
    await client?.close();
  });

  it('completes MCP handshake', () => {
    // If beforeAll succeeded, the handshake worked
    expect(client).toBeDefined();
  });

  it('lists available tools', async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t: any) => t.name);

    expect(toolNames).toContain('get_daily_tehilim');
    expect(toolNames).toContain('gematria');
    // get_psalm was removed from MCP
    expect(toolNames).not.toContain('get_psalm');
  });

  it('lists available resources', async () => {
    const result = await client.listResources();
    const uris = result.resources.map((r: any) => r.uri);

    expect(uris).toContain('tehilim://today');
  });

  it('get_daily_tehilim returns psalm text', async () => {
    const result = await client.callTool({
      name: 'get_daily_tehilim',
      arguments: {},
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content[0] as { type: string; text: string };
    expect(textContent.type).toBe('text');
    expect(textContent.text).toContain('Tehilim');
    expect(textContent.text.length).toBeGreaterThan(100);
  }, 30000);

  it('gematria tool calculates correctly', async () => {
    // שלום = ש(300) + ל(30) + ו(6) + ם(40) = 376
    // chapter = ((376 - 1) % 150) + 1 = (375 % 150) + 1 = 75 + 1 = 76
    const result = await client.callTool({
      name: 'gematria',
      arguments: { text: 'שלום' },
    });

    expect(result.content).toBeDefined();
    const textContent = result.content[0] as { type: string; text: string };
    expect(textContent.type).toBe('text');
    expect(textContent.text).toContain('376');
    expect(textContent.text).toContain('**Mapped to Psalm:** 76');
  }, 30000);

  it('gematria tool handles non-Hebrew input', async () => {
    const result = await client.callTool({
      name: 'gematria',
      arguments: { text: 'hello' },
    });

    const textContent = result.content[0] as { type: string; text: string };
    expect(textContent.text).toContain('No Hebrew letters');
  });

  it('tehilim://today resource returns content', async () => {
    const result = await client.readResource({
      uri: 'tehilim://today',
    });

    expect(result.contents).toBeDefined();
    expect(result.contents.length).toBeGreaterThan(0);
    expect(result.contents[0].text).toBeDefined();
    expect((result.contents[0].text as string).length).toBeGreaterThan(100);
  }, 30000);
});
