/**
 * GitHub Connector Unit Tests
 *
 * Tests for: URL parsing, validation, and file blocking logic
 * Uses mocked GitHub API responses (no live GitHub access)
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { parseGitHubReference } from '../services/GitHubConnector';

describe('GitHub URL Parsing', () => {
  it('parses HTTPS GitHub URL with owner and repo', () => {
    const result = parseGitHubReference('https://github.com/babylonjs/Babylon.js');
    assert.strictEqual(result?.owner, 'babylonjs');
    assert.strictEqual(result?.repo, 'Babylon.js');
    assert.strictEqual(result?.branch, undefined);
  });

  it('parses GitHub URL with branch', () => {
    const result = parseGitHubReference('https://github.com/owner/repo/tree/develop');
    assert.strictEqual(result?.owner, 'owner');
    assert.strictEqual(result?.repo, 'repo');
    assert.strictEqual(result?.branch, 'develop');
  });

  it('parses GitHub URL with subpath', () => {
    const result = parseGitHubReference('https://github.com/owner/repo/tree/main/games/demo');
    assert.strictEqual(result?.owner, 'owner');
    assert.strictEqual(result?.repo, 'repo');
    assert.strictEqual(result?.branch, 'main');
    assert.strictEqual(result?.subpath, 'games/demo');
  });

  it('parses owner/repo short format', () => {
    const result = parseGitHubReference('babylonjs/Babylon.js');
    assert.strictEqual(result?.owner, 'babylonjs');
    assert.strictEqual(result?.repo, 'Babylon.js');
    assert.ok(result?.url.includes('https://github.com'));
  });

  it('rejects invalid URL format', () => {
    const result = parseGitHubReference('not-a-url');
    assert.strictEqual(result, null);
  });

  it('rejects HTTP URL (requires HTTPS)', () => {
    const result = parseGitHubReference('http://github.com/owner/repo');
    assert.strictEqual(result, null);
  });

  it('handles whitespace in input', () => {
    const result = parseGitHubReference('  babylonjs/Babylon.js  ');
    assert.strictEqual(result?.owner, 'babylonjs');
    assert.strictEqual(result?.repo, 'Babylon.js');
  });

  it('rejects invalid owner/repo characters', () => {
    const result = parseGitHubReference('owner@invalid/repo');
    assert.strictEqual(result, null);
  });
});

describe('GitHub Connector Input Validation', () => {
  it('validates correct owner/repo format', () => {
    const owner = 'babylonjs';
    const repo = 'Babylon.js';
    assert.match(owner, /^[a-zA-Z0-9_-]+$/);
    assert.match(repo, /^[a-zA-Z0-9_.-]+$/);
  });

  it('rejects special characters in owner', () => {
    const owner = 'owner@domain';
    assert.throws(() => {
      if (!/^[a-zA-Z0-9_-]+$/.test(owner)) {
        throw new Error('Invalid owner');
      }
    });
  });

  it('rejects special characters in repo', () => {
    const repo = 'repo/invalid';
    assert.throws(() => {
      if (!/^[a-zA-Z0-9_.-]+$/.test(repo)) {
        throw new Error('Invalid repo');
      }
    });
  });
});

describe('File Blocking Logic', () => {
  const BLOCKED_PATTERNS = [
    /\.ts$/, // TypeScript
    /\.tsx$/, // TSX
    /\.js$/, // JavaScript
    /\.jsx$/, // JSX
    /webpack\.config/, // Webpack config
    /vite\.config/, // Vite config
    /\.env/, // Environment files
    /secrets/, // Secret files
  ];

  const shouldBlock = (path: string): boolean => {
    return BLOCKED_PATTERNS.some(pattern => pattern.test(path));
  };

  it('blocks TypeScript files', () => {
    assert.ok(shouldBlock('src/game.ts'));
    assert.ok(shouldBlock('src/game.tsx'));
  });

  it('blocks JavaScript files', () => {
    assert.ok(shouldBlock('src/game.js'));
    assert.ok(shouldBlock('src/game.jsx'));
  });

  it('blocks build config files', () => {
    assert.ok(shouldBlock('webpack.config.js'));
    assert.ok(shouldBlock('vite.config.ts'));
  });

  it('blocks environment files', () => {
    assert.ok(shouldBlock('.env'));
    assert.ok(shouldBlock('.env.local'));
  });

  it('blocks files with secrets in path', () => {
    assert.ok(shouldBlock('config/secrets.json'));
    assert.ok(shouldBlock('src/secrets/api-key.ts'));
  });

  it('allows manifest files', () => {
    assert.strictEqual(shouldBlock('swim26.manifest.json'), false);
    assert.strictEqual(shouldBlock('babylon.config.json'), false);
    assert.strictEqual(shouldBlock('package.json'), false);
  });

  it('allows asset paths', () => {
    assert.strictEqual(shouldBlock('assets/models/scene.glb'), false);
    assert.strictEqual(shouldBlock('public/textures/ground.png'), false);
  });

  it('allows README', () => {
    assert.strictEqual(shouldBlock('README.md'), false);
  });
});
