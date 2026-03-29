import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePluginScenePatch, registerSceneKeyValidator, resetSceneValidators } from '../services/PluginSceneValidation';

test.beforeEach(() => {
  resetSceneValidators();
});

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

test('validator enforces strict validation for each supported key', () => {
  // Valid models pass
  const modelsPatch = validatePluginScenePatch({
    models: [{
      id: 'm1',
      name: 'Model',
      url: '/model.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }],
  });
  assert.ok(modelsPatch.models);

  // Invalid model missing required field
  assert.throws(
    () => validatePluginScenePatch({
      models: [{
        id: 'm1',
        name: 'Model',
        // missing url
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }],
    }),
    /model entries must include.*url/
  );

  // Invalid layer missing required field
  assert.throws(
    () => validatePluginScenePatch({
      layers: [{
        id: 'l1',
        name: 'Layer',
        visible: true,
        // missing locked
        order: 0,
      }],
    }),
    /layer entries are malformed/
  );

  // Invalid path with wrong point structure
  assert.throws(
    () => validatePluginScenePatch({
      paths: [{
        id: 'p1',
        name: 'Path',
        closed: false,
        width: 1,
        points: [{
          // missing id
          position: [0, 0, 0],
        }],
      }],
    }),
    /control points are malformed/
  );

  // Invalid prefab missing models array
  assert.throws(
    () => validatePluginScenePatch({
      prefabs: [{
        id: 'pf1',
        name: 'Prefab',
        // missing models
      }],
    }),
    /prefab entries are malformed/
  );
});

test('validator rejects unsupported keys explicitly to prevent silent failures', () => {
  const unsupportedKeys = ['environment', 'materials', 'lights', 'custom_data'];
  for (const key of unsupportedKeys) {
    assert.throws(
      () => validatePluginScenePatch({ [key]: {} }),
      /Unsupported scene.update key/
    );
  }
});

test('validator remains safe when multiple keys are present', () => {
  // Valid: multiple valid keys
  const valid = validatePluginScenePatch({
    models: [{ id: 'm1', name: 'M', url: '/m', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    layers: [{ id: 'l1', name: 'L', visible: true, locked: false, order: 0 }],
  });
  assert.ok(valid.models && valid.layers);

  // Invalid: one key valid, one invalid
  assert.throws(
    () => validatePluginScenePatch({
      models: [{ id: 'm1', name: 'M', url: '/m', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
      layers: [{ id: 'l1', name: 'L', visible: true, locked: false }], // missing order
    }),
    /layer entries are malformed/
  );

  // Invalid: one key valid, one unsupported
  assert.throws(
    () => validatePluginScenePatch({
      models: [{ id: 'm1', name: 'M', url: '/m', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
      environment: { brightness: 1 }, // unsupported
    }),
    /Unsupported scene.update key/
  );
});

test('registerSceneKeyValidator enables safe schema expansion for future keys', () => {
  const customValidatorCalls: any[] = [];
  const customValidator = (value: any) => {
    customValidatorCalls.push(value);
    if (!Array.isArray(value)) throw new Error('custom_items must be an array');
  };

  // Register at startup before validation
  registerSceneKeyValidator('custom_items', customValidator);

  // Custom key now accepted
  const result = validatePluginScenePatch({
    custom_items: [1, 2, 3],
  });
  assert.ok((result as any).custom_items);
  assert.equal(customValidatorCalls.length, 1);

  // Custom key validates strictly (failure path)
  assert.throws(
    () => validatePluginScenePatch({
      custom_items: 'not an array',
    }),
    /custom_items must be an array/
  );
});

test('registerSceneKeyValidator validates validator function input', () => {
  // Non-function validators rejected
  assert.throws(
    () => registerSceneKeyValidator('invalid_1', null as any),
    /must be a function/
  );

  assert.throws(
    () => registerSceneKeyValidator('invalid_2', 'not a function' as any),
    /must be a function/
  );

  // Empty or invalid key names rejected
  assert.throws(
    () => registerSceneKeyValidator('', () => {}),
    /non-empty string/
  );

  assert.throws(
    () => registerSceneKeyValidator('123invalid', () => {}),
    /Must match.*a-z_/
  );

  assert.throws(
    () => registerSceneKeyValidator('invalid-key', () => {}),
    /Must match.*a-z_/
  );
});

test('registerSceneKeyValidator prevents duplicate key registration', () => {
  // Register once
  registerSceneKeyValidator('test_unique_key', () => {});

  // Attempt to register again
  assert.throws(
    () => registerSceneKeyValidator('test_unique_key', () => {}),
    /already registered/
  );
});

test('registerSceneKeyValidator prevents overriding built-in scene keys', () => {
  // Cannot override built-in keys like 'models', 'layers', 'paths', 'prefabs'
  assert.throws(
    () => registerSceneKeyValidator('models', () => {}),
    /Cannot override built-in/
  );

  assert.throws(
    () => registerSceneKeyValidator('layers', () => {}),
    /Cannot override built-in/
  );

  assert.throws(
    () => registerSceneKeyValidator('paths', () => {}),
    /Cannot override built-in/
  );

  assert.throws(
    () => registerSceneKeyValidator('prefabs', () => {}),
    /Cannot override built-in/
  );
});

test('custom validator errors are wrapped with context', () => {
  registerSceneKeyValidator('error_test', (value: any) => {
    throw new Error('Custom validation failed for this value');
  });

  assert.throws(
    () => validatePluginScenePatch({ error_test: {} }),
    /Custom validator for 'error_test' failed.*Custom validation failed/
  );
});

test('unsupported keys remain explicitly rejected even with custom validators registered', () => {
  // Register a custom validator
  registerSceneKeyValidator('custom_key', () => {});

  // Custom key is now supported
  assert.doesNotThrow(() => validatePluginScenePatch({ custom_key: [] }));

  // But other unsupported keys still fail (strict!)
  assert.throws(
    () => validatePluginScenePatch({ unknown_key: {} }),
    /Unsupported scene.update key: unknown_key/
  );

  assert.throws(
    () => validatePluginScenePatch({ environment: {} }),
    /Unsupported scene.update key: environment/
  );

  // Multiple keys: all must be supported
  assert.throws(
    () => validatePluginScenePatch({
      custom_key: [],
      unknown_key: {}, // This one fails, whole patch rejected
    }),
    /Unsupported scene.update key: unknown_key/
  );
});
