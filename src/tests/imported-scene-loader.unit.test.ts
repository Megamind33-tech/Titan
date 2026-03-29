import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { createImportSummary, loadImportedEnvironment, loadImportedObjects } from '../services/ImportedSceneLoader';
import { DEFAULT_ENVIRONMENT, POOL_COMPETITION } from '../types/environment';
import { LoadedSceneData } from '../services/Swim26ManifestLoader';

const baseScene = (environment?: unknown): LoadedSceneData => ({
  name: 'Imported Scene',
  objects: [],
  assets: [],
  paths: [],
  metadata: {},
  environment,
});

describe('ImportedSceneLoader object preview resolution', () => {
  it('keeps valid HTTPS model refs previewable', () => {
    const scene: LoadedSceneData = {
      ...baseScene(),
      metadata: { rootPath: 'github:swim26/showcase#main' },
      objects: [{
        id: 'obj-1',
        name: 'Lane Marker',
        assetRef: { type: 'url', value: 'https://cdn.example.com/models/lane.glb' },
        transform: {},
        tags: [],
      }],
    };

    const models = loadImportedObjects(scene);
    assert.equal(models.length, 1);
    assert.equal(models[0].url, 'https://cdn.example.com/models/lane.glb');
  });

  it('resolves repo-relative refs into raw GitHub URLs when metadata is present', () => {
    const scene: LoadedSceneData = {
      ...baseScene(),
      metadata: { rootPath: 'github:swim26/showcase#feature-preview' },
      objects: [{
        id: 'obj-1',
        name: 'Block',
        assetRef: { type: 'url', value: 'models/block.glb' },
        transform: {},
        tags: [],
      }],
    };

    const models = loadImportedObjects(scene);
    assert.equal(models.length, 1);
    assert.equal(models[0].url, 'https://raw.githubusercontent.com/swim26/showcase/feature-preview/models/block.glb');
  });

  it('does not create blank preview entries for missing asset refs', () => {
    const scene: LoadedSceneData = {
      ...baseScene(),
      metadata: { rootPath: 'github:swim26/showcase#main' },
      objects: [{
        id: 'obj-1',
        name: 'Broken Object',
        assetRef: { type: 'url', value: '' },
        transform: {},
        tags: [],
      }],
    };

    const models = loadImportedObjects(scene);
    assert.equal(models.length, 0);

    const summary = createImportSummary(scene, 'github:swim26/showcase#main');
    assert.equal(summary.previewReadyObjectCount, 0);
    assert.equal(summary.unresolvedObjectCount, 1);
    assert.ok(summary.warnings.some(w => w.includes('Asset reference is empty')));
  });

  it('reports unsupported asset formats explicitly in summary warnings', () => {
    const scene: LoadedSceneData = {
      ...baseScene(),
      metadata: { rootPath: 'github:swim26/showcase#main' },
      objects: [{
        id: 'obj-1',
        name: 'Script Reference',
        assetRef: { type: 'url', value: 'assets/bootstrap.js' },
        transform: {},
        tags: [],
      }],
    };

    const summary = createImportSummary(scene, 'github:swim26/showcase#main');
    assert.equal(summary.previewReadyObjectCount, 0);
    assert.equal(summary.unresolvedObjectCount, 1);
    assert.ok(summary.warnings.some(w => w.includes('not a previewable 3D format')));
  });

  it('warns when relative refs cannot be resolved because repo metadata is missing', () => {
    const scene: LoadedSceneData = {
      ...baseScene(),
      metadata: {},
      objects: [{
        id: 'obj-1',
        name: 'Unresolved Relative',
        assetRef: { type: 'url', value: 'models/missing.glb' },
        transform: {},
        tags: [],
      }],
    };

    const summary = createImportSummary(scene, 'unknown');
    assert.equal(summary.previewReadyObjectCount, 0);
    assert.equal(summary.unresolvedObjectCount, 1);
    assert.ok(summary.warnings.some(w => w.includes('cannot be resolved without GitHub repo metadata')));
  });
});

describe('ImportedSceneLoader environment mapping', () => {
  it('falls back to default when no environment payload exists', () => {
    const result = loadImportedEnvironment(baseScene(undefined), DEFAULT_ENVIRONMENT);
    assert.equal(result.id, DEFAULT_ENVIRONMENT.id);
    assert.equal(result.backgroundColor, DEFAULT_ENVIRONMENT.backgroundColor);
  });

  it('applies imported clear/sky color and intensity', () => {
    const result = loadImportedEnvironment(
      baseScene({
        clearColor: '#112233',
        intensity: 0.65,
      }),
      DEFAULT_ENVIRONMENT
    );

    assert.equal(result.backgroundType, 'color');
    assert.equal(result.backgroundColor, '#112233');
    assert.equal(result.environmentIntensity, 0.65);
  });

  it('applies supported skybox reference by mapping to editor preset', () => {
    const result = loadImportedEnvironment(
      baseScene({
        skybox: 'https://cdn.example.com/skyboxes/night_env.hdr',
      }),
      DEFAULT_ENVIRONMENT
    );

    assert.equal(result.backgroundType, 'preset');
    assert.equal(result.environmentPreset, 'night');
  });

  it('surfaces unsupported environment data as import summary warning', () => {
    const summary = createImportSummary(
      baseScene({
        skybox: 'https://cdn.example.com/skyboxes/custom_pool_final.exr',
        clearColor: 'not-a-hex-color',
        presetId: 'pool-finals-night',
      }),
      'github.com/swim26/demo'
    );

    assert.ok(summary.environmentPresent);
    assert.ok(summary.warnings.some(w => w.includes('not built in')));
    assert.ok(summary.warnings.some(w => w.includes('cannot be loaded directly')));
    assert.ok(summary.warnings.some(w => w.includes('not a supported hex value')));
  });

  it('prefers built-in SWIM26 preset IDs when available', () => {
    const result = loadImportedEnvironment(
      baseScene({
        presetId: 'pool-competition',
      }),
      DEFAULT_ENVIRONMENT
    );

    assert.equal(result.id, POOL_COMPETITION.id);
    assert.equal(result.name, POOL_COMPETITION.name);
  });
});
