import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importSwim26Manifest } from '../services/Swim26ManifestImporter';
import { buildSwim26Manifest } from '../services/Swim26ManifestService';
import { DEFAULT_ENVIRONMENT } from '../types/environment';

test('imports a valid live handoff manifest sample', () => {
  const manifestPath = path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json');
  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  const result = importSwim26Manifest(manifest);

  assert.equal(result.ok, true);
  assert.ok(result.scene);
  assert.equal(result.scene?.nodes.length, 1);
  assert.equal(result.scene?.nodes[0].assetRef?.type, 'url');
  assert.equal(result.scene?.environment?.presetId, 'pool-competition');
  assert.equal(result.errors.length, 0);
});

test('rejects malformed manifests with blocking validation errors', () => {
  const invalid = JSON.stringify({
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [{ id: 'bad', transform: { position: [0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#000000' },
      paths: [],
    },
  });
  const result = importSwim26Manifest(invalid as any);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(issue => issue.path.includes('position')));
});

test('emits warnings for recoverable missing fields', () => {
  const noAssetRef = buildSwim26Manifest({
    models: [{
      id: 'm1',
      name: 'No Asset Ref',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      url: '',
    } as any],
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const result = importSwim26Manifest(noAssetRef);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some(issue => issue.path.includes('assetRef')));
});

test('treats invalid json as blocking parse failure', () => {
  const result = importSwim26Manifest('{ not-json }');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(issue => issue.message.includes('valid JSON')));
});

test('drops editor-only and malformed runtime fields instead of poisoning imported scene', () => {
  const manifest = {
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          id: 'obj-1',
          name: 'Marker',
          layerId: 'editor-layer',
          prefabId: 'editor-prefab',
          assetRef: { type: 'unknown', value: '/bad.glb' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: { opacity: 2, roughness: -1, metalness: 2, emissiveColor: 22 },
          tags: ['lane', 42],
          metadata: 'bad-metadata',
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#000000' },
      paths: [
        { id: 'path-good', type: 'camera', points: [[0, 0, 0], [1, 1, 1]] },
        { id: 'path-bad', type: 'camera', points: [[0, 0], [1, 1, 1]] },
      ],
    },
    runtimeOwned: ['Gameplay systems'],
    unsupported: ['Runtime scripting'],
  } as any;

  const result = importSwim26Manifest(manifest);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some(issue => issue.path.includes('layerId')));
  assert.ok(result.warnings.some(issue => issue.path.includes('assetRef.type')));
  assert.ok(result.warnings.some(issue => issue.path.includes('material.opacity')));
  assert.equal(result.scene?.nodes[0].assetRef, undefined);
  assert.deepEqual(result.scene?.nodes[0].tags, []);
  assert.deepEqual(result.scene?.nodes[0].metadata, {});
  assert.equal(result.scene?.paths.length, 1);
});

test('blocks manifest with invalid runtime contract identity', () => {
  const result = importSwim26Manifest({
    version: '2.0.0',
    runtime: 'three',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: { objects: [], environment: { presetId: 'pool', intensity: 1, backgroundColor: '#000' }, paths: [] },
    runtimeOwned: [],
    unsupported: [],
  } as any);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(issue => issue.path === 'version'));
  assert.ok(result.errors.some(issue => issue.path === 'runtime'));
});
