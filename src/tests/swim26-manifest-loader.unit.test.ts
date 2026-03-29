/**
 * SWIM26 Manifest Loader Unit Tests
 *
 * Tests for: Manifest parsing, validation, data extraction
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  loadSwim26Manifest,
  extractAssetReferences,
  extractSceneInfo,
  extractObjects,
  validateManifest,
  buildSceneDataFromManifest,
} from '../services/Swim26ManifestLoader';
import { GitHubFileContent } from '../types/gitHubConnector';

/**
 * Helper: Create mock file content
 */
const mockFile = (content: string): GitHubFileContent => ({
  path: 'swim26.manifest.json',
  name: 'swim26.manifest.json',
  content,
  encoding: 'utf-8',
  size: content.length,
});

/**
 * Helper: Create sample SWIM26 manifest
 */
const sampleManifest = () => ({
  version: '1.0.0',
  type: 'swim26.scene-manifest',
  projectType: 'swim26-babylon',
  authoredBy: 'Titan',
  sceneInfo: {
    name: 'Test Ocean Scene',
    description: 'A test scene with ocean',
    version: '1.0.0',
  },
  objects: [
    {
      id: 'obj-1',
      name: 'Ocean Floor',
      assetRef: {
        type: 'url',
        value: 'assets/models/ocean-floor.glb',
      },
      transform: {
        position: [0, -10, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      tags: ['background', 'static'],
      metadata: { receiveShadow: true },
    },
    {
      id: 'obj-2',
      name: 'Fish',
      assetRef: {
        type: 'url',
        value: 'assets/models/fish.glb',
      },
      transform: {
        position: [5, 0, 5],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      tags: ['dynamic', 'animated'],
    },
  ],
  environment: {
    skybox: 'pool-competition',
    fog: {
      enabled: true,
      density: 0.01,
    },
  },
  paths: [
    {
      id: 'path-1',
      name: 'Camera Path',
      type: 'camera',
      points: [
        { position: [0, 5, 20] },
        { position: [10, 5, 15] },
        { position: [15, 8, 10] },
      ],
    },
  ],
});

describe('Manifest Loading', () => {
  it('loads valid SWIM26 manifest', () => {
    const manifest = sampleManifest();
    const file = mockFile(JSON.stringify(manifest));

    const result = loadSwim26Manifest(file);

    assert.strictEqual(result.errors.length, 0);
    assert.ok(result.data);
    assert.strictEqual(result.data?.type, 'swim26.scene-manifest');
    assert.strictEqual(result.data?.version, '1.0.0');
  });

  it('detects invalid JSON', () => {
    const file = mockFile('{ invalid json }');

    const result = loadSwim26Manifest(file);

    assert.ok(result.errors.length > 0);
    assert.strictEqual(result.errors[0].type, 'INVALID_JSON');
  });

  it('detects invalid manifest type', () => {
    const manifest = { ...sampleManifest(), type: 'invalid-type' };
    const file = mockFile(JSON.stringify(manifest));

    const result = loadSwim26Manifest(file);

    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0].message.includes('Invalid manifest type'));
  });

  it('preserves file path in errors', () => {
    const file: GitHubFileContent = {
      path: 'subdir/manifest.json',
      name: 'manifest.json',
      content: 'invalid',
      encoding: 'utf-8',
      size: 7,
    };

    const result = loadSwim26Manifest(file);

    assert.strictEqual(result.errors[0].path, 'subdir/manifest.json');
  });
});

describe('Asset Reference Extraction', () => {
  it('extracts assets from objects', () => {
    const manifest = sampleManifest();

    const assets = extractAssetReferences(manifest);

    assert.strictEqual(assets.length, 3); // 2 objects + 1 skybox
    assert.ok(assets.some(a => a.url === 'assets/models/ocean-floor.glb'));
    assert.ok(assets.some(a => a.url === 'assets/models/fish.glb'));
    assert.ok(assets.some(a => a.url === 'pool-competition'));
  });

  it('deduplicates asset references', () => {
    const manifest = sampleManifest();
    // Add duplicate asset reference
    manifest.objects![0].assetRef!.value = 'assets/models/ocean-floor.glb';
    manifest.objects![1].assetRef!.value = 'assets/models/ocean-floor.glb';

    const assets = extractAssetReferences(manifest);

    // Should deduplicate
    const floorAssets = assets.filter(a => a.url === 'assets/models/ocean-floor.glb');
    assert.strictEqual(floorAssets.length, 1);
  });

  it('infers asset type from URL', () => {
    const manifest = sampleManifest();

    const assets = extractAssetReferences(manifest);

    const skybox = assets.find(a => a.url === 'pool-competition');
    assert.strictEqual(skybox?.type, 'environment');

    const floor = assets.find(a => a.url === 'assets/models/ocean-floor.glb');
    assert.strictEqual(floor?.type, 'model');
  });

  it('includes asset metadata', () => {
    const manifest = sampleManifest();

    const assets = extractAssetReferences(manifest);

    const floorAsset = assets.find(a => a.url === 'assets/models/ocean-floor.glb');
    assert.ok(floorAsset?.metadata);
    assert.strictEqual(floorAsset?.metadata?.receiveShadow, true);
  });

  it('handles manifest without objects', () => {
    const manifest = {
      version: '1.0.0',
      type: 'swim26.scene-manifest',
    };

    const assets = extractAssetReferences(manifest as any);

    assert.ok(Array.isArray(assets));
  });

  it('handles manifest without environment', () => {
    const manifest = { ...sampleManifest(), environment: undefined };

    const assets = extractAssetReferences(manifest);

    // Should still get assets from objects
    assert.ok(assets.length > 0);
  });
});

describe('Scene Info Extraction', () => {
  it('extracts scene name', () => {
    const manifest = sampleManifest();

    const sceneInfo = extractSceneInfo(manifest);

    assert.strictEqual(sceneInfo.name, 'Test Ocean Scene');
  });

  it('extracts scene description', () => {
    const manifest = sampleManifest();

    const sceneInfo = extractSceneInfo(manifest);

    assert.strictEqual(sceneInfo.description, 'A test scene with ocean');
  });

  it('extracts scene version', () => {
    const manifest = sampleManifest();

    const sceneInfo = extractSceneInfo(manifest);

    assert.strictEqual(sceneInfo.version, '1.0.0');
  });

  it('uses default name if missing', () => {
    const manifest = { version: '1.0.0', type: 'swim26.scene-manifest' };

    const sceneInfo = extractSceneInfo(manifest as any);

    assert.ok(sceneInfo.name);
  });
});

describe('Object Extraction', () => {
  it('extracts all objects', () => {
    const manifest = sampleManifest();

    const objects = extractObjects(manifest);

    assert.strictEqual(objects.length, 2);
  });

  it('extracts object properties', () => {
    const manifest = sampleManifest();

    const objects = extractObjects(manifest);
    const oceanFloor = objects[0];

    assert.strictEqual(oceanFloor.id, 'obj-1');
    assert.strictEqual(oceanFloor.name, 'Ocean Floor');
    assert.ok(oceanFloor.assetRef);
    assert.ok(oceanFloor.transform);
    assert.ok(oceanFloor.tags);
  });

  it('handles manifest without objects', () => {
    const manifest = { version: '1.0.0', type: 'swim26.scene-manifest' };

    const objects = extractObjects(manifest as any);

    assert.strictEqual(objects.length, 0);
  });

  it('extracts from authoredContent if present', () => {
    const manifest = {
      version: '1.0.0',
      type: 'swim26.scene-manifest',
      authoredContent: {
        objects: [
          { id: 'obj-1', name: 'Test Object' },
        ],
      },
    };

    const objects = extractObjects(manifest as any);

    assert.strictEqual(objects.length, 1);
    assert.strictEqual(objects[0].name, 'Test Object');
  });
});

describe('Manifest Validation', () => {
  it('validates complete manifest', () => {
    const manifest = sampleManifest();

    const validation = validateManifest(manifest);

    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.issues.length, 0);
  });

  it('flags missing type', () => {
    const manifest = { ...sampleManifest(), type: undefined };
    delete (manifest as any).type;

    const validation = validateManifest(manifest as any);

    assert.ok(validation.issues.some(i => i.includes('type')));
  });

  it('flags missing version', () => {
    const manifest = { ...sampleManifest(), version: undefined };
    delete (manifest as any).version;

    const validation = validateManifest(manifest as any);

    assert.ok(validation.issues.some(i => i.includes('version')));
  });

  it('warns about missing objects', () => {
    const manifest = { ...sampleManifest(), objects: [] };

    const validation = validateManifest(manifest);

    assert.ok(validation.warnings.some(w => w.includes('No scene objects')));
  });

  it('warns about missing scene name', () => {
    const manifest = { ...sampleManifest(), sceneInfo: { description: 'test' } };

    const validation = validateManifest(manifest as any);

    assert.ok(validation.warnings.some(w => w.includes('Scene name')));
  });

  it('distinguishes issues from warnings', () => {
    const manifest = { version: '1.0.0', type: 'swim26.scene-manifest', objects: [] };

    const validation = validateManifest(manifest as any);

    assert.strictEqual(validation.valid, true); // type and version present
    assert.ok(validation.warnings.length > 0); // but warnings about empty scene
  });
});

describe('Complete Scene Data Building', () => {
  it('builds LoadedSceneData from manifest', () => {
    const manifest = sampleManifest();
    const sourceMetadata = {
      rootPath: 'github:owner/repo#main',
    };

    const sceneData = buildSceneDataFromManifest(manifest, sourceMetadata);

    assert.strictEqual(sceneData.name, 'Test Ocean Scene');
    assert.strictEqual(sceneData.description, 'A test scene with ocean');
    assert.ok(sceneData.objects.length > 0);
    assert.ok(sceneData.assets.length > 0);
    assert.ok(sceneData.environment);
    assert.ok(sceneData.paths);
  });

  it('preserves source metadata in scene data', () => {
    const manifest = sampleManifest();
    const sourceMetadata = {
      rootPath: 'github:owner/repo#develop',
      packageName: 'my-swim26-game',
    };

    const sceneData = buildSceneDataFromManifest(manifest, sourceMetadata);

    assert.strictEqual(sceneData.metadata.rootPath, 'github:owner/repo#develop');
    assert.strictEqual(sceneData.metadata.packageName, 'my-swim26-game');
  });

  it('normalizes object structure', () => {
    const manifest = sampleManifest();
    const sceneData = buildSceneDataFromManifest(manifest, {});

    const firstObject = sceneData.objects[0];
    assert.ok(firstObject.id);
    assert.ok(firstObject.name);
    assert.ok(firstObject.assetRef);
    assert.ok(firstObject.transform);
  });
});
