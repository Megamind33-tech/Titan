import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectSession,
  persistProjectSession,
  loadProjectSession,
  clearProjectSession,
} from '../services/ProjectSessionService';
import localforage from 'localforage';
import { getProjectSelectionGuidance } from '../services/ProjectAdapterRegistry';
import { activateProjectForEditor } from '../services/ProjectLoadService';

const memoryStore = new Map<string, any>();
(localforage as any).setItem = async (key: string, value: any) => { memoryStore.set(key, value); return value; };
(localforage as any).getItem = async (key: string) => memoryStore.get(key) ?? null;
(localforage as any).removeItem = async (key: string) => { memoryStore.delete(key); };

test('first-run guidance returns simple project choices when detection is uncertain', () => {
  const guidance = getProjectSelectionGuidance({ markerFiles: ['unknown.marker'] });
  assert.equal(guidance.requiresUserSelection, true);
  assert.ok(guidance.options.some(opt => opt.profileId.includes('swim26')));
  assert.ok(guidance.options.some(opt => opt.profileId.includes('titan')));
});

test('project session creation captures adapter/profile/bridge and capabilities', () => {
  const session = createProjectSession({
    projectName: 'SWIM Session',
    metadata: { profileHint: 'swim26-babylon' },
  });

  assert.equal(session.projectName, 'SWIM Session');
  assert.equal(session.runtimeTarget, 'babylon');
  assert.match(session.profileId, /swim26/);
  assert.match(session.adapterId, /swim26/);
  assert.equal(session.bridgeId, 'babylon-swim26-bridge');
  assert.equal(session.capabilities.pathAuthoring, true);
});

test('project session persists and restores cleanly', async () => {
  await clearProjectSession();

  const created = createProjectSession({
    projectName: 'Generic Session',
    metadata: { profileHint: 'titan-scene' },
  });
  await persistProjectSession(created);

  const recovered = await loadProjectSession();
  assert.equal(recovered.requiresRecovery, false);
  assert.ok(recovered.session);
  assert.equal(recovered.session?.projectName, 'Generic Session');
  assert.match(recovered.session?.profileId ?? '', /titan/);
});

test('invalid stored project session enters recovery mode', async () => {
  await persistProjectSession({
    sessionId: 'session-bad',
    projectId: 'project-bad',
    projectName: 'Broken Session',
    profileId: 'profile.invalid',
    adapterId: 'adapter.invalid',
    runtimeTarget: 'generic-scene',
    bridgeId: 'generic-export-bridge',
    metadata: { profileHint: 'profile.invalid' },
    capabilities: {
      terrain: true,
      collisionZones: true,
      prefabs: true,
      materialAuthoring: true,
      environmentControls: true,
      pathAuthoring: true,
      pluginExtensions: true,
    },
    lastOpenedAt: new Date().toISOString(),
  });

  const recovered = await loadProjectSession();
  assert.equal(recovered.requiresRecovery, true);
  assert.ok(recovered.recoveryReason);
  await clearProjectSession();
});

test('activation from project session metadata selects consistent adapter/profile/bridge', () => {
  const activation = activateProjectForEditor({ profileHint: 'swim26-babylon' });
  assert.equal(activation.profile.typeId, 'swim26-babylon');
  assert.equal(activation.adapter.runtime, 'babylon');
  assert.equal(activation.bridgeId, 'babylon-swim26-bridge');
  assert.equal(activation.bridgeContract.sceneContract, 'swim26.scene-manifest.v1');
});
