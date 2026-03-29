import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePluginScenePatch } from '../services/PluginSceneValidation';

test('validatePluginScenePatch accepts valid partial updates', () => {
  const valid = validatePluginScenePatch({
    models: [{
      id: 'm1',
      name: 'Model',
      url: '/model.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }],
    layers: [{ id: 'l1', name: 'Layer', visible: true, locked: false, order: 0 }],
    paths: [{
      id: 'p1',
      name: 'Path',
      closed: false,
      width: 1,
      points: [{ id: 'pt1', position: [0, 0, 0] }],
    }],
    prefabs: [{ id: 'pf1', name: 'Prefab', models: [{ id: 'm1' }] }],
  });

  assert.equal(valid.models?.length, 1);
  assert.equal(valid.layers?.length, 1);
  assert.equal(valid.paths?.length, 1);
  assert.equal(valid.prefabs?.length, 1);
});

test('validatePluginScenePatch rejects malformed payloads and unsupported keys', () => {
  assert.throws(() => validatePluginScenePatch(null), /must return an object/);
  assert.throws(() => validatePluginScenePatch({ environment: {} }), /Unsupported scene.update key/);
  assert.throws(() => validatePluginScenePatch({ models: {} }), /models must be an array/);
  assert.throws(
    () => validatePluginScenePatch({ models: [{ id: 'm1', name: 'x', url: '/x', position: [0, 0, 0], rotation: [0], scale: [1, 1, 1] }] }),
    /valid position\/rotation\/scale vectors/
  );
  assert.throws(
    () => validatePluginScenePatch({ layers: [{ id: 'l1', name: 'L', visible: true, locked: false }] }),
    /layer entries are malformed/
  );
  assert.throws(
    () => validatePluginScenePatch({ paths: [{ id: 'p1', name: 'P', closed: false, width: 1, points: [{ id: 'pt1', position: [0, 0] }] }] }),
    /control points are malformed/
  );
  assert.throws(
    () => validatePluginScenePatch({ prefabs: [{ id: 'pf1', name: 'P', models: [{ notId: true }] }] }),
    /prefab model entries must include id/
  );
});
