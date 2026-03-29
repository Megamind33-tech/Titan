import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { GitHubConnector } from '../services/GitHubConnector';
import { GitHubConnectorErrorType } from '../types/gitHubConnector';

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

  it('classifies invalid token as INVALID_TOKEN', async () => {
    const connector = new GitHubConnector({ accessMode: 'authenticated', authToken: 'bad-token' });

    (global as any).fetch = async (url: string) => {
      if (url.includes('/repos/private/repo') && !url.includes('/contents/')) {
        return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await connector.ingestRepository({
      url: 'https://github.com/private/repo',
      owner: 'private',
      repo: 'repo',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errors[0]?.type, GitHubConnectorErrorType.INVALID_TOKEN);
  });

  it('classifies SSO-required token responses as SSO_AUTH_REQUIRED', async () => {
    const connector = new GitHubConnector({ accessMode: 'authenticated', authToken: 'token' });

    (global as any).fetch = async (url: string) => {
      if (url.includes('/repos/private/repo') && !url.includes('/contents/')) {
        return new Response(
          JSON.stringify({ message: 'Resource protected by organization SAML enforcement.' }),
          {
            status: 403,
            headers: { 'x-github-sso': 'required; url=https://github.com/orgs/acme/sso' },
          },
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await connector.ingestRepository({
      url: 'https://github.com/private/repo',
      owner: 'private',
      repo: 'repo',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errors[0]?.type, GitHubConnectorErrorType.SSO_AUTH_REQUIRED);
  });

  it('classifies insufficient scope as INSUFFICIENT_SCOPE', async () => {
    const connector = new GitHubConnector({ accessMode: 'authenticated', authToken: 'token' });

    (global as any).fetch = async (url: string) => {
      if (url.includes('/repos/private/repo') && !url.includes('/contents/')) {
        return new Response(JSON.stringify({ message: 'Resource not accessible by personal access token' }), { status: 403 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await connector.ingestRepository({
      url: 'https://github.com/private/repo',
      owner: 'private',
      repo: 'repo',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errors[0]?.type, GitHubConnectorErrorType.INSUFFICIENT_SCOPE);
  });

  it('keeps public rate-limit classification as RATE_LIMITED', async () => {
    const connector = new GitHubConnector({ accessMode: 'public-only' });

    (global as any).fetch = async (url: string) => {
      if (url.includes('/repos/public/repo') && !url.includes('/contents/')) {
        return new Response(JSON.stringify({ message: 'API rate limit exceeded for x.x.x.x.' }), { status: 403 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await connector.ingestRepository({
      url: 'https://github.com/public/repo',
      owner: 'public',
      repo: 'repo',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errors[0]?.type, GitHubConnectorErrorType.RATE_LIMITED);
  });
});
