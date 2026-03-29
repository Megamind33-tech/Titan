import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGitHubImportHistoryEntry } from '../hooks/useGitHubProjectImport';
import { mapStoredSceneStateToAppState } from '../hooks/useScenePersistenceCoordinator';
import { buildPersistedSessionSnapshot } from '../hooks/useProjectSessionPersistence';

test('extractGitHubImportHistoryEntry parses github root path', () => {
  const entry = extractGitHubImportHistoryEntry('github:octo/example-repo#main');
  assert.deepEqual(entry, { owner: 'octo', repo: 'example-repo' });
});

test('extractGitHubImportHistoryEntry returns null for non-github root path', () => {
  const entry = extractGitHubImportHistoryEntry('file:/tmp/project');
  assert.equal(entry, null);
});

test('extractGitHubImportHistoryEntry returns null for malformed github root path', () => {
  const entry = extractGitHubImportHistoryEntry('github:owner-only');
  assert.equal(entry, null);
});

test('mapStoredSceneStateToAppState applies fallback defaults', () => {
  const mapped = mapStoredSceneStateToAppState({
    versionId: 'v1',
    timestamp: new Date().toISOString(),
    models: [],
  } as any, []);

  assert.equal(mapped.gridReceiveShadow, true);
  assert.equal(mapped.shadowSoftness, 0.5);
  assert.equal(mapped.activeCameraPresetId, 'default-orbit');
  assert.deepEqual(mapped.models, []);
  assert.deepEqual(mapped.prefabs, []);
});

test('mapStoredSceneStateToAppState preserves stored scene values when present', () => {
  const mapped = mapStoredSceneStateToAppState({
    versionId: 'v2',
    timestamp: new Date().toISOString(),
    models: [{ id: 'm1' }],
    prefabs: [{ id: 'p1' }],
    sceneSettings: { gridReceiveShadow: false, shadowSoftness: 0.9, environment: { name: 'custom' } },
    cameraSettings: { presets: [{ id: 'c1' }], activePresetId: 'c1', paths: [{ id: 'path1' }], activePathId: 'path1' },
    layers: [{ id: 'layer1' }],
    terrain: { size: 10 },
    paths: [{ id: 'pathA' }],
    collisionZones: [{ id: 'zone1' }],
  } as any, []);

  assert.equal(mapped.gridReceiveShadow, false);
  assert.equal(mapped.shadowSoftness, 0.9);
  assert.equal(mapped.activeCameraPresetId, 'c1');
  assert.equal(mapped.activeCameraPathId, 'path1');
  assert.deepEqual(mapped.prefabs, [{ id: 'p1' }]);
});

test('buildPersistedSessionSnapshot aligns session with active project identity', () => {
  const session = {
    sessionId: 's1',
    projectId: 'p1',
    projectName: 'Demo',
    profileId: 'old',
    adapterId: 'old',
    runtimeTarget: 'babylon',
    bridgeId: 'old-bridge',
    metadata: {},
    capabilities: {},
    lastOpenedAt: '2020-01-01T00:00:00.000Z',
  } as any;

  const activeProject = {
    profile: { id: 'swim26' },
    adapter: { id: 'swim26-adapter', runtime: 'babylon' },
    bridgeId: 'swim26-bridge',
    activeCapabilities: { supportsPluginDiagnostics: true },
  } as any;

  const snapshot = buildPersistedSessionSnapshot(session, { profileHint: 'swim26' }, activeProject);

  assert.equal(snapshot.profileId, 'swim26');
  assert.equal(snapshot.adapterId, 'swim26-adapter');
  assert.equal(snapshot.bridgeId, 'swim26-bridge');
  assert.deepEqual(snapshot.metadata, { profileHint: 'swim26' });
  assert.ok(Date.parse(snapshot.lastOpenedAt));
});
