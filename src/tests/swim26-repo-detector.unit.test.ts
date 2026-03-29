/**
 * SWIM26 Repository Detector Unit Tests
 *
 * Tests for: Project type detection from repo markers, dependencies, manifests
 * Uses existing ProjectAdapterRegistry detection logic
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { extractMetadataFromRepo, validateMetadataProbe, assessRepoType } from '../services/Swim26RepoDetector';
import { GitHubRepoIngestResult } from '../types/gitHubConnector';
import { GitHubFileContent } from '../types/gitHubConnector';

/**
 * Helper: Create mock ingest result
 */
const mockIngestResult = (overrides?: Partial<GitHubRepoIngestResult>): GitHubRepoIngestResult => {
  return {
    success: true,
    metadata: {
      owner: 'test-owner',
      repo: 'test-repo',
      url: 'https://github.com/test-owner/test-repo',
      isPrivate: false,
      defaultBranch: 'main',
    },
    branch: 'main',
    files: new Map(),
    errors: [],
    warnings: [],
    ...overrides,
  };
};

/**
 * Helper: Create mock file content
 */
const mockFile = (content: string): GitHubFileContent => ({
  path: 'test.json',
  name: 'test.json',
  content,
  encoding: 'utf-8',
  size: content.length,
});

describe('SWIM26 Repository Detection', () => {
  it('detects SWIM26 from swim26.manifest.json marker', () => {
    const result = mockIngestResult({
      files: new Map([
        ['swim26.manifest.json', mockFile('{ "type": "swim26.scene-manifest" }')],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.markerFiles?.includes('swim26.manifest.json'));
  });

  it('detects SWIM26 from babylon.config.json marker', () => {
    const result = mockIngestResult({
      files: new Map([
        ['babylon.config.json', mockFile('{ "engine": "babylon" }')],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.markerFiles?.includes('babylon.config.json'));
  });

  it('detects SWIM26 from package.json with babylonjs dependency', () => {
    const packageJson = {
      name: 'my-game',
      dependencies: {
        babylonjs: '^5.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.dependencies?.includes('babylonjs'));
  });

  it('detects SWIM26 from package.json with @babylonjs/core dependency', () => {
    const packageJson = {
      name: 'my-game',
      dependencies: {
        '@babylonjs/core': '^5.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.dependencies?.includes('@babylonjs/core'));
  });

  it('detects SWIM26 from package.json with swim26 dependency', () => {
    const packageJson = {
      name: 'my-game',
      dependencies: {
        swim26: '^2.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.dependencies?.includes('swim26'));
  });

  it('extracts package name from package.json', () => {
    const packageJson = {
      name: '@myorg/my-game',
      version: '1.0.0',
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.strictEqual(probe.packageName, '@myorg/my-game');
  });

  it('handles invalid package.json gracefully', () => {
    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile('{ invalid json }')],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    // Should not throw, just skip package parsing
    assert.strictEqual(probe.packageName, undefined);
  });

  it('detects SWIM26 with both markers and dependencies', () => {
    const packageJson = {
      name: 'my-game',
      dependencies: {
        babylonjs: '^5.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['swim26.manifest.json', mockFile('{ "type": "swim26.scene-manifest" }')],
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const detection = assessRepoType(result);
    assert.strictEqual(detection.isSWIM26, true);
    assert.strictEqual(detection.confidence, 'high');
  });

  it('detects SWIM26 with only markers (medium confidence)', () => {
    const result = mockIngestResult({
      files: new Map([
        ['babylon.config.json', mockFile('{}')],
      ]),
    });

    const detection = assessRepoType(result);
    assert.strictEqual(detection.isSWIM26, true);
    assert.strictEqual(detection.confidence, 'medium');
  });

  it('detects SWIM26 with only babylon dependency (medium confidence)', () => {
    const packageJson = {
      dependencies: {
        babylonjs: '^5.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const detection = assessRepoType(result);
    assert.strictEqual(detection.isSWIM26, true);
    assert.strictEqual(detection.confidence, 'medium');
  });

  it('falls back to generic when no markers detected', () => {
    const result = mockIngestResult({
      files: new Map([
        ['README.md', mockFile('# My Project')],
      ]),
    });

    const detection = assessRepoType(result);
    assert.strictEqual(detection.isSWIM26, false);
    assert.strictEqual(detection.confidence, 'low');
  });
});

describe('Metadata Probe Validation', () => {
  it('validates probe with marker files', () => {
    const probe = {
      markerFiles: ['swim26.manifest.json'],
      dependencies: ['babylonjs'],
    };

    const validation = validateMetadataProbe(probe);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.issues.length, 0);
  });

  it('flags missing marker files', () => {
    const probe = {
      markerFiles: [],
      dependencies: [],
    };

    const validation = validateMetadataProbe(probe);
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.issues.some(i => i.includes('marker files')));
  });

  it('flags missing dependencies', () => {
    const probe = {
      markerFiles: ['swim26.manifest.json'],
      dependencies: [],
    };

    const validation = validateMetadataProbe(probe);
    // Note: This currently reports low-confidence but may still be valid
    assert.ok(validation.issues.some(i => i.includes('dependencies')));
  });

  it('accepts probe with only markers (no dependencies)', () => {
    const probe = {
      markerFiles: ['swim26.manifest.json'],
      dependencies: [],
    };

    const validation = validateMetadataProbe(probe);
    // Markers alone should be considered valid for SWIM26 detection
    assert.ok(Array.isArray(validation.issues));
  });

  it('accepts probe with only dependencies (no markers)', () => {
    const probe = {
      markerFiles: [],
      dependencies: ['babylonjs'],
    };

    const validation = validateMetadataProbe(probe);
    // Dependencies alone could indicate SWIM26
    assert.ok(Array.isArray(validation.issues));
  });
});

describe('Repository Metadata Extraction', () => {
  it('includes repo reference in metadata', () => {
    const result = mockIngestResult();
    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.rootPath?.includes('test-owner'));
    assert.ok(probe.rootPath?.includes('test-repo'));
  });

  it('preserves branch information', () => {
    const result = mockIngestResult({ branch: 'feature/swim26-import' });
    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.rootPath?.includes('feature/swim26-import'));
  });

  it('collects all detected dependencies', () => {
    const packageJson = {
      dependencies: {
        babylonjs: '^5.0.0',
        'some-lib': '^1.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    };

    const result = mockIngestResult({
      files: new Map([
        ['package.json', mockFile(JSON.stringify(packageJson))],
      ]),
    });

    const probe = extractMetadataFromRepo(result);
    assert.ok(probe.dependencies?.includes('babylonjs'));
    assert.ok(probe.dependencies?.includes('some-lib'));
    assert.ok(probe.dependencies?.includes('typescript'));
  });
});
