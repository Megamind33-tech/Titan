import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listProjectAdapters,
  listProjectProfiles,
  selectProjectAdapter,
  validateProfileAdapterCompatibility,
  getAdapterById,
  getBridgeForAdapter,
  validateExportFormatForAdapter,
  getProjectSelectionGuidance,
} from '../services/ProjectAdapterRegistry';
import { activateProjectForEditor } from '../services/ProjectLoadService';
import { getBridgeContract, validateBridgeContract } from '../services/ProjectBridgeRegistry';
import { buildSwim26Manifest } from '../services/Swim26ManifestService';
import { DEFAULT_ENVIRONMENT } from '../types/environment';

test('adapter registry exposes generic and SWIM26 adapters', () => {
  const adapters = listProjectAdapters();
  const types = adapters.map(adapter => adapter.typeId);

  assert.ok(types.includes('titan-scene'));
  assert.ok(types.includes('swim26-babylon'));
});

test('profile lookup returns generic fallback when probe is unknown', () => {
  const selection = selectProjectAdapter({ markerFiles: ['README.md'] });

  assert.equal(selection.profile.typeId, 'titan-scene');
  assert.equal(selection.detection.mode, 'fallback');
  assert.match(selection.detection.reason, /falling back/i);
});

test('automatic detection selects SWIM26 profile when Babylon markers are present', () => {
  const selection = selectProjectAdapter({
    markerFiles: ['swim26.config.json'],
    dependencies: ['@babylonjs/core'],
  });

  assert.equal(selection.profile.typeId, 'swim26-babylon');
  assert.equal(selection.adapter.runtime, 'babylon');
  assert.equal(selection.detection.mode, 'automatic');
});

test('guided selection honors explicit profile hints', () => {
  const selection = selectProjectAdapter({ profileHint: 'swim26-babylon' });

  assert.equal(selection.profile.typeId, 'swim26-babylon');
  assert.equal(selection.detection.mode, 'guided');
});

test('bridge selection reports runtime bridge for chosen adapter', () => {
  const selection = activateProjectForEditor({ profileHint: 'swim26-babylon' });

  assert.equal(selection.bridgeId, 'babylon-swim26-bridge');
  assert.equal(getBridgeForAdapter(selection.adapter.id), selection.bridgeId);
  assert.equal(selection.activeCapabilities.pathAuthoring, true);
});

test('invalid profile/adapter/runtime combinations are rejected', () => {
  const profiles = listProjectProfiles();
  const swimProfile = profiles.find(profile => profile.typeId === 'swim26-babylon');
  const genericAdapter = getAdapterById('adapter.titan.generic.v1');

  assert.ok(swimProfile);
  const result = validateProfileAdapterCompatibility(swimProfile!, genericAdapter);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 1);
});

test('adapter format validation prevents unsupported export format usage', () => {
  validateExportFormatForAdapter('adapter.swim26.babylon.v1', 'glb');

  assert.throws(() => {
    validateExportFormatForAdapter('adapter.swim26.babylon.v1', 'obj');
  }, /not supported/i);
});


test('low-confidence detection returns guided selection options', () => {
  const guidance = getProjectSelectionGuidance({ markerFiles: ['unknown.txt'] });

  assert.equal(guidance.requiresUserSelection, true);
  assert.ok(guidance.options.length >= 2);
});

test('bridge contracts are validated against runtime and scene contract', () => {
  const bridge = getBridgeContract('babylon-swim26-bridge');
  const valid = validateBridgeContract({
    bridgeId: bridge.id,
    runtime: 'babylon',
    sceneContract: 'swim26.scene-manifest.v1',
  });

  assert.equal(valid.valid, true);

  const invalid = validateBridgeContract({
    bridgeId: bridge.id,
    runtime: 'generic-scene',
    sceneContract: 'titan.scene.v1',
  });
  assert.equal(invalid.valid, false);
});

test('SWIM26 manifest builder reports authored content and runtime-owned boundaries', () => {
  const manifest = buildSwim26Manifest({
    models: [{
      id: 'm1',
      name: 'Lane Marker',
      url: '/lane.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      behaviorTags: ['swim', 'lane'],
    }],
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  assert.equal(manifest.runtime, 'babylon');
  assert.equal(manifest.projectType, 'swim26-babylon');
  assert.ok(manifest.authoredContent.objects.length === 1);
  assert.equal(manifest.authoredContent.objects[0].assetRef?.type, 'url');
  assert.ok(manifest.runtimeOwned.length > 0);
  assert.ok(manifest.unsupported.length > 0);
});
