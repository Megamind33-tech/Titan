/**
 * GitHub Import Integration Tests
 *
 * Tests for: Full import flow (input validation → detection → session creation)
 * Uses mocked GitHub connector to simulate repo data
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  GitHubRepoImporter,
} from '../services/GitHubRepoImporter';
import {
  GitHubConnector,
  parseGitHubReference,
} from '../services/GitHubConnector';
import {
  GitHubRepoIngestResult,
  GitHubFileContent,
} from '../types/gitHubConnector';

/**
 * Mock GitHub Connector for testing
 */
class MockGitHubConnector extends GitHubConnector {
  private repoData: Map<string, GitHubRepoIngestResult>;

  constructor() {
    super({ accessMode: 'public-only' });
    this.repoData = new Map();
  }

  registerMockRepo(owner: string, repo: string, data: GitHubRepoIngestResult) {
    this.repoData.set(`${owner}/${repo}`, data);
  }

  async ingestRepository(ref: any): Promise<GitHubRepoIngestResult> {
    const key = `${ref.owner}/${ref.repo}`;
    const data = this.repoData.get(key);

    if (!data) {
      return {
        success: false,
        branch: ref.branch || 'main',
        files: new Map(),
        errors: [{
          type: 'REPO_NOT_FOUND',
          message: `Mock: Repository ${key} not found`,
          name: 'GitHubConnectorError',
        }] as any,
        warnings: [],
      };
    }

    return data;
  }
}

const mockFile = (content: string): GitHubFileContent => ({
  path: 'test.json',
  name: 'test.json',
  content,
  encoding: 'utf-8',
  size: content.length,
});

describe('GitHub Import - Input Validation', () => {
  const importer = new GitHubRepoImporter();

  it('validates HTTPS GitHub URL', () => {
    const result = importer.validateRepoInput('https://github.com/babylonjs/Babylon.js');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reference?.owner, 'babylonjs');
    assert.strictEqual(result.reference?.repo, 'Babylon.js');
  });

  it('validates owner/repo short format', () => {
    const result = importer.validateRepoInput('babylonjs/Babylon.js');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reference?.owner, 'babylonjs');
  });

  it('rejects empty input', () => {
    const result = importer.validateRepoInput('');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects invalid URL format', () => {
    const result = importer.validateRepoInput('not a valid url');
    assert.strictEqual(result.valid, false);
  });

  it('rejects HTTP URL', () => {
    const result = importer.validateRepoInput('http://github.com/owner/repo');
    assert.strictEqual(result.valid, false);
  });

  it('handles whitespace in input', () => {
    const result = importer.validateRepoInput('  babylonjs/Babylon.js  ');
    assert.strictEqual(result.valid, true);
  });

  it('accepts subpath references for scoped imports', () => {
    const result = importer.validateRepoInput('https://github.com/owner/repo/tree/main/scenes/demo');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.reference?.branch, 'main');
    assert.strictEqual(result.reference?.subpath, 'scenes/demo');
  });

  it('rejects unsafe subpath traversal', () => {
    const result = importer.validateRepoInput('https://github.com/owner/repo/tree/main/../../secrets');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].includes('Folder path'));
  });
});

describe('GitHub Import - Preparation (Preview)', () => {
  it('prepares import from SWIM26 repo', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    const packageJson = {
      name: 'swim26-game',
      dependencies: { babylonjs: '^5.0.0' },
    };

    mockConnector.registerMockRepo('test', 'swim26-game', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'swim26-game',
        url: 'https://github.com/test/swim26-game',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['swim26.manifest.json', mockFile('{ "type": "swim26.scene-manifest" }')],
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.prepareImport('test/swim26-game');

    assert.strictEqual(result.valid, true);
    assert.ok(result.detection);
    assert.strictEqual(result.detection.isSWIM26, true);
    assert.strictEqual(result.detection.confidence, 'high');
  });

  it('reports errors for non-existent repo', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    const result = await importer.prepareImport('nonexistent/repo');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('handles invalid input in preparation', async () => {
    const importer = new GitHubRepoImporter();

    const result = await importer.prepareImport('not-a-valid-input!!!');

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('GitHub Import - Full Import Flow', () => {
  it('imports SWIM26 project and creates session', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    const packageJson = {
      name: 'my-swim26-game',
      dependencies: { babylonjs: '^5.0.0' },
    };

    mockConnector.registerMockRepo('myorg', 'my-game', {
      success: true,
      metadata: {
        owner: 'myorg',
        repo: 'my-game',
        url: 'https://github.com/myorg/my-game',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['swim26.manifest.json', mockFile('{ "type": "swim26.scene-manifest" }')],
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('myorg/my-game');

    assert.strictEqual(result.success, true);
    assert.ok(result.session);
    assert.ok(result.session!.sessionId);
    assert.ok(result.session!.projectId);
    assert.strictEqual(result.session!.profileId, 'profile.swim26.babylon.v1');
  });

  it('creates session with correct runtime target', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'game', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'game',
        url: 'https://github.com/test/game',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['swim26.manifest.json', mockFile('{}')],
        ['package.json', mockFile('{ "dependencies": { "babylonjs": "^5.0.0" } }')],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('test/game');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.session?.runtimeTarget, 'babylon');
  });

  it('includes source repo metadata in session', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'game', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'game',
        url: 'https://github.com/test/game',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'develop',
      files: new Map([
        ['swim26.manifest.json', mockFile('{}')],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('test/game');

    assert.ok(result.session?.metadata.rootPath?.includes('github:'));
    assert.ok(result.session?.metadata.rootPath?.includes('test/game'));
    assert.ok(result.session?.metadata.rootPath?.includes('develop'));
  });

  it('reports errors for failed import', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    const result = await importer.importRepository('nonexistent/repo');

    assert.strictEqual(result.success, false);
    assert.ok(!result.session);
    assert.ok(result.errors.length > 0);
  });

  it('handles invalid input gracefully', async () => {
    const importer = new GitHubRepoImporter();

    const result = await importer.importRepository('invalid!!!input');

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.length > 0);
  });

  it('honors profile hint when provided', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    // Register a generic repo (no SWIM26 markers)
    mockConnector.registerMockRepo('test', 'generic-scene', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'generic-scene',
        url: 'https://github.com/test/generic-scene',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['package.json', mockFile('{ "name": "generic-scene" }')],
      ]),
      errors: [],
      warnings: [],
    });

    // Import with explicit SWIM26 profile hint
    const result = await importer.importRepository('test/generic-scene', 'profile.swim26.babylon.v1');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.session?.profileId, 'profile.swim26.babylon.v1');
  });

  it('fails import when manifest schema is invalid', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'broken-manifest', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'broken-manifest',
        url: 'https://github.com/test/broken-manifest',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['swim26.manifest.json', mockFile(JSON.stringify({
          version: '1.0.0',
          type: 'swim26.scene-manifest',
          objects: [{ id: 'o1', name: 'Broken', transform: { position: [0, 1], rotation: [0, 0, 0], scale: [1, 1, 1] } }],
        }))],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('test/broken-manifest');

    assert.strictEqual(result.success, false);
    assert.ok(result.errors.some(error => error.includes('Manifest validation')));
    assert.strictEqual(result.session, undefined);
  });
});

describe('GitHub Import - Error Handling', () => {
  it('distinguishes between blocking and recoverable errors', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    // Repo not found = blocking
    const notFoundResult = await importer.importRepository('nonexistent/repo');
    assert.strictEqual(notFoundResult.success, false);
    assert.ok(notFoundResult.errors.some(e => e.includes('not found') || e.includes('REPO_NOT_FOUND')));
  });

  it('preserves warning messages during import', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'game', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'game',
        url: 'https://github.com/test/game',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['package.json', mockFile('{}')],
      ]),
      errors: [],
      warnings: ['Warning: manifest file not found'],
    });

    const result = await importer.importRepository('test/game');

    assert.ok(result.warnings.some(w => w.includes('manifest')));
  });

  it('extracts project name from package.json', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'mygame', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'mygame',
        url: 'https://github.com/test/mygame',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['package.json', mockFile('{ "name": "awesome-swim26-game" }')],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('test/mygame');

    assert.strictEqual(result.session?.projectName, 'awesome-swim26-game');
  });

  it('falls back to repo name if package.json has no name', async () => {
    const mockConnector = new MockGitHubConnector();
    const importer = new GitHubRepoImporter(mockConnector);

    mockConnector.registerMockRepo('test', 'mygame', {
      success: true,
      metadata: {
        owner: 'test',
        repo: 'mygame',
        url: 'https://github.com/test/mygame',
        isPrivate: false,
        defaultBranch: 'main',
      },
      branch: 'main',
      files: new Map([
        ['package.json', mockFile('{ "version": "1.0.0" }')],
      ]),
      errors: [],
      warnings: [],
    });

    const result = await importer.importRepository('test/mygame');

    assert.strictEqual(result.session?.projectName, 'mygame');
  });
});

describe('GitHub Import - Reference Parsing', () => {
  it('parses various URL formats correctly', () => {
    const testCases = [
      {
        input: 'https://github.com/babylonjs/Babylon.js',
        expectedOwner: 'babylonjs',
        expectedRepo: 'Babylon.js',
      },
      {
        input: 'babylonjs/Babylon.js',
        expectedOwner: 'babylonjs',
        expectedRepo: 'Babylon.js',
      },
      {
        input: 'https://github.com/owner/repo/tree/main',
        expectedOwner: 'owner',
        expectedRepo: 'repo',
        expectedBranch: 'main',
      },
    ];

    testCases.forEach(testCase => {
      const ref = parseGitHubReference(testCase.input);
      assert.strictEqual(ref?.owner, testCase.expectedOwner);
      assert.strictEqual(ref?.repo, testCase.expectedRepo);
      if (testCase.expectedBranch) {
        assert.strictEqual(ref?.branch, testCase.expectedBranch);
      }
    });
  });
});
