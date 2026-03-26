import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * npm integration test — verifies that `npx @hashemeta/tehilimcp` installs
 * from the registry and runs a working MCP server.
 *
 * Run with: npm run test:npm
 * Requires: @hashemeta/tehilimcp to be published on npm
 *
 * Note: must run from outside the project directory (npx resolves
 * the local package otherwise). We use a temp dir as cwd.
 */

describe('npm Integration', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tehilim-npm-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('@hashemeta/tehilimcp is published and installable', () => {
    const output = execSync('npm view @hashemeta/tehilimcp version', {
      encoding: 'utf-8',
      timeout: 15000,
      cwd: tmpDir,
    }).trim();

    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  }, 20000);

  it('npx @hashemeta/tehilimcp starts an MCP server that responds', async () => {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@hashemeta/tehilimcp'],
      cwd: tmpDir,
    });

    const client = new Client({
      name: 'npm-integration-test',
      version: '1.0.0',
    });

    try {
      await client.connect(transport);

      // Verify MCP handshake + tool listing
      const result = await client.listTools();
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('get_daily_tehilim');
      expect(toolNames).toContain('gematria');

      // Verify a tool actually works
      const gematria = await client.callTool({
        name: 'gematria',
        arguments: { text: 'שלום' },
      });
      const text = ((gematria.content as any[])[0] as { type: string; text: string }).text;
      expect(text).toContain('376');
    } finally {
      await client.close();
    }
  }, 60000);
});
