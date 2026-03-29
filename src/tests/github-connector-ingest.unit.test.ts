import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { GitHubConnector } from '../services/GitHubConnector';

const originalFetch = global.fetch;

describe('GitHubConnector ingestRepository', () => {
  beforeEach(() => {
    (global as any).fetch = undefined;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not treat README-only repos as importable', async () => {
    const connector = new GitHubConnector({ accessMode: 'public-only' });

    const fetchMock = async (url: string) => {
      if (url.includes('/repos/test/readme-only') && !url.includes('/contents/')) {
        return new Response(JSON.stringify({
          private: false,
          default_branch: 'main',
          description: 'repo',
          topics: [],
          language: 'TypeScript',
          stargazers_count: 0,
          updated_at: new Date().toISOString(),
        }), { status: 200 });
      }

      if (url.includes('/contents/')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url.includes('/README.md')) {
        return new Response('# Demo', { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    };

    (global as any).fetch = fetchMock;

    const result = await connector.ingestRepository({
      url: 'https://github.com/test/readme-only',
      owner: 'test',
      repo: 'readme-only',
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(error => error.message.includes('No supported import files')));
  });

  it('scopes raw file fetches to subpath when provided', async () => {
    const connector = new GitHubConnector({ accessMode: 'public-only' });
    const requestedUrls: string[] = [];

    (global as any).fetch = async (url: string) => {
      requestedUrls.push(url);

      if (url.includes('/repos/test/scoped') && !url.includes('/contents/')) {
        return new Response(JSON.stringify({
          private: false,
          default_branch: 'main',
          description: 'repo',
          topics: [],
          language: 'TypeScript',
          stargazers_count: 0,
          updated_at: new Date().toISOString(),
        }), { status: 200 });
      }

      if (url.includes('/contents/scenes/arena')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }

      if (url.includes('/scenes/arena/package.json')) {
        return new Response('{\"name\":\"scoped-project\"}', { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    };

    const result = await connector.ingestRepository({
      url: 'https://github.com/test/scoped',
      owner: 'test',
      repo: 'scoped',
      branch: 'main',
      subpath: 'scenes/arena',
    });

    assert.strictEqual(result.success, true);
    assert.ok(requestedUrls.some(url => url.includes('/scenes/arena/package.json')));
  });
});

