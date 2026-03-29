import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginManager } from '../services/PluginManager';
import { PluginContext } from '../types/plugin';

function installMockLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
  return store;
}

test.beforeEach(() => {
  pluginManager.resetForTests();
});

test('plugin bridge exposes real asset library and addAsset integration', async () => {
  installMockLocalStorage();
  const added: any[] = [];
  const assets = [{ id: 'a1' }];

  pluginManager.initCoreApi({
    getSceneState: () => ({}),
    updateSceneState: () => {},
    subscribeToScene: () => () => {},
    getAssetLibrary: () => assets,
    addAsset: (payload: any) => added.push(payload),
    triggerUIUpdate: () => {},
  });

  let ctx!: PluginContext;
  const pluginId = `test-assets-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Asset Test',
      version: '1.0.0',
      author: 'test',
      description: 'test plugin',
      type: ['ui'],
      permissions: ['read:assets', 'write:assets'],
    },
    activate: (context) => {
      ctx = context;
    }
  });

  await pluginManager.activate(pluginId);
  assert.ok(ctx);
  assert.equal(ctx!.api.assets.getLibrary(), assets);
  ctx!.api.assets.addAsset({ file: 'demo', category: 'Props' });
  assert.equal(added.length, 1);
});

test('plugin bridge enforces permissions and persists plugin data', async () => {
  const storage = installMockLocalStorage();
  pluginManager.initCoreApi({
    getSceneState: () => ({}),
    updateSceneState: () => {},
    subscribeToScene: () => () => {},
    triggerUIUpdate: () => {},
  });

  let ctx!: PluginContext;
  const pluginId = `test-data-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Data Test',
      version: '1.0.0',
      author: 'test',
      description: 'test plugin',
      type: ['ui'],
      permissions: ['read:scene'],
    },
    activate: (context) => {
      ctx = context;
      context.api.data.setPluginData('answer', 42);
    }
  });

  await pluginManager.activate(pluginId);
  assert.ok(ctx);
  assert.equal(ctx!.api.data.getPluginData('answer'), 42);

  const persisted = storage.get('plugin_bridge_data');
  assert.ok(persisted);
  assert.match(persisted!, /"answer":42/);

  assert.throws(() => ctx!.api.assets.getLibrary(), /Permission denied/);
});

test('plugin UI bridge enforces extension permissions', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({
    triggerUIUpdate: () => {},
  });

  let ctx!: PluginContext;
  const pluginId = `test-ui-perms-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'UI Permission Test',
      version: '1.0.0',
      author: 'test',
      description: 'test plugin',
      type: ['ui'],
      permissions: [],
    },
    activate: (context) => {
      ctx = context;
    }
  });

  await pluginManager.activate(pluginId);
  assert.ok(ctx);
  assert.throws(
    () => ctx!.api.ui.registerExtension({ id: 'panel-1', type: 'panel', render: () => null }),
    /Permission denied: ui:panels/
  );
});

test('plugin scene bridge returns state, routes updates, and supports subscribe/unsubscribe', async () => {
  installMockLocalStorage();
  const updates: any[] = [];
  const listeners = new Set<(state: any) => void>();
  let sceneState = {
    models: [{ id: 'm1' }],
    layers: [{ id: 'l1' }],
    paths: [],
    prefabs: [],
  };

  pluginManager.initCoreApi({
    getSceneState: () => sceneState,
    updateSceneState: (updater: (state: any) => any) => {
      sceneState = updater(sceneState);
      updates.push(sceneState);
      listeners.forEach(listener => listener(sceneState));
    },
    subscribeToScene: (listener: (state: any) => void) => {
      listener(sceneState);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    triggerUIUpdate: () => {},
  });

  let ctx!: PluginContext;
  const received: any[] = [];
  const pluginId = `test-scene-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Scene Test',
      version: '1.0.0',
      author: 'test',
      description: 'test plugin',
      type: ['workflow'],
      permissions: ['read:scene', 'write:scene'],
    },
    activate: (context) => {
      ctx = context;
    }
  });

  await pluginManager.activate(pluginId);
  assert.ok(ctx);
  assert.equal(ctx!.api.scene.get().models[0].id, 'm1');

  const unsubscribe = ctx!.api.scene.subscribe((state) => received.push(state));
  assert.equal(received.length, 1);
  assert.equal(received[0].layers[0].id, 'l1');

  ctx!.api.scene.update((state) => ({
    ...state,
    models: [...state.models, { id: 'm2' }],
  }));

  assert.equal(updates.length, 1);
  assert.equal(received.length, 2);
  assert.equal(received[1].models.length, 2);

  unsubscribe();
  ctx!.api.scene.update((state) => ({
    ...state,
    models: [...state.models, { id: 'm3' }],
  }));
  assert.equal(received.length, 2);
});

test('plugin bridge gates unavailable core capabilities with explicit errors', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({
    triggerUIUpdate: () => {},
  });

  let ctx!: PluginContext;
  const pluginId = `test-capability-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Capability Test',
      version: '1.0.0',
      author: 'test',
      description: 'test plugin',
      type: ['workflow'],
      permissions: ['read:scene', 'write:scene', 'read:assets', 'write:assets'],
    },
    activate: (context) => {
      ctx = context;
    }
  });

  await pluginManager.activate(pluginId);
  assert.ok(ctx);
  assert.throws(() => ctx!.api.scene.get(), /not available/);
  assert.throws(() => ctx!.api.scene.update((state) => state), /not available/);
  assert.throws(() => ctx!.api.scene.subscribe(() => {}), /not available/);
  assert.throws(() => ctx!.api.assets.getLibrary(), /not available/);
  assert.throws(() => ctx!.api.assets.addAsset({ file: 'f', category: 'Props' }), /not available/);
});

test('duplicate registration is deterministic and does not override initial plugin', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `dup-${Date.now()}`;
  const firstRegistered = pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'First',
      version: '1.0.0',
      author: 'test',
      description: 'first',
      type: ['workflow'],
      permissions: [],
    },
  });
  const secondRegistered = pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Second',
      version: '1.0.0',
      author: 'test',
      description: 'second',
      type: ['workflow'],
      permissions: [],
    },
  });

  assert.equal(firstRegistered, true);
  assert.equal(secondRegistered, false);
  const plugin = pluginManager.getPlugins().find(p => p.metadata.id === pluginId);
  assert.equal(plugin?.metadata.name, 'First');
});

test('plugin UI extension lifecycle remains clean across repeated activate/deactivate cycles', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `ui-lifecycle-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'UI Lifecycle',
      version: '1.0.0',
      author: 'test',
      description: 'ui lifecycle',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'lifecycle-panel',
        type: 'panel',
        render: () => null,
      });
    },
    deactivate: (context) => {
      context.api.ui.unregisterExtension('lifecycle-panel');
    },
  });

  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getPluginState(pluginId), 'active');
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  await pluginManager.activate(pluginId);
  await pluginManager.activate(pluginId); // no duplicate while already active
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
});

test('reset clears singleton runtime state and enables isolated reruns', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `reset-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Reset',
      version: '1.0.0',
      author: 'test',
      description: 'reset',
      type: ['workflow'],
      permissions: [],
    },
  });
  assert.equal(pluginManager.getPlugins().length, 1);

  pluginManager.reset();
  assert.equal(pluginManager.getPlugins().length, 0);
  assert.equal(pluginManager.getPluginState(pluginId), undefined);
});
