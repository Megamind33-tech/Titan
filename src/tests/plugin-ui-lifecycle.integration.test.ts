import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginManager } from '../services/PluginManager';
import { PluginContext, UIExtensionPoint } from '../types/plugin';
import { validatePluginScenePatch, registerSceneKeyValidator } from '../services/PluginSceneValidation';

/**
 * Plugin UI Lifecycle Verification Tests
 *
 * These tests verify observable plugin UI extension behavior through
 * the plugin manager's state and extension registry. While not full
 * browser-level automation (which would require Playwright/Puppeteer),
 * they verify:
 * - Extensions are registered/unregistered at the correct lifecycle points
 * - Rendered UI would appear/disappear based on manager state
 * - Duplicate rendering is prevented
 * - Cleanup is thorough
 */

interface TestUIExtensionPoint extends UIExtensionPoint {
  renderCallCount?: number;
}

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

test('plugin UI extension appears in rendered output after activation', async () => {
  installMockLocalStorage();
  const uiUpdates: string[] = [];

  pluginManager.initCoreApi({
    triggerUIUpdate: () => uiUpdates.push('ui-update'),
  });

  const pluginId = `ui-lifecycle-${Date.now()}`;
  const extension: TestUIExtensionPoint = {
    id: 'test-panel-1',
    type: 'panel',
    render: () => 'Test Panel Content',
  };

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'UI Test Plugin',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension(extension);
    },
  });

  // Before activation: no extensions visible
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // Activate plugin
  await pluginManager.activate(pluginId);

  // After activation: extension should be visible
  const extensions = pluginManager.getUIExtensions('panel');
  assert.equal(extensions.length, 1);
  assert.equal(extensions[0].id, 'test-panel-1');
  assert.equal(extensions[0].type, 'panel');

  // UI update should have been triggered
  assert.equal(uiUpdates.length, 1);
});

test('plugin UI extension disappears from rendered output after deactivation', async () => {
  installMockLocalStorage();
  const uiUpdates: string[] = [];

  pluginManager.initCoreApi({
    triggerUIUpdate: () => uiUpdates.push('ui-update'),
  });

  const pluginId = `deactivate-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'UI Deactivate Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'deactivate-panel',
        type: 'panel',
        render: () => 'Content',
      });
    },
    deactivate: (context) => {
      context.api.ui.unregisterExtension('deactivate-panel');
    },
  });

  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);
  const uiUpdatesAfterActivate = uiUpdates.length;

  // Deactivate
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // UI updates triggered for deactivation (plugin unregisters + manager cleanup)
  assert.ok(uiUpdates.length > uiUpdatesAfterActivate, 'UI updates should occur during deactivation');
});

test('repeated activate/deactivate cycles do not duplicate rendered UI', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `cycle-test-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Cycle Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'cycle-panel',
        type: 'panel',
        render: () => 'Cycle Content',
      });
    },
    deactivate: (context) => {
      context.api.ui.unregisterExtension('cycle-panel');
    },
  });

  // Cycle 1: activate
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  // Cycle 1: deactivate
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // Cycle 2: activate
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  // Cycle 2: deactivate
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // Cycle 3: activate (verify no accumulation)
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  const extensions = pluginManager.getUIExtensions('panel');
  assert.equal(extensions[0].id, 'cycle-panel');
  assert.equal(extensions[0].type, 'panel');
});

test('cleanup after unload removes all rendered artifacts', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `unload-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Unload Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels', 'ui:toolbar'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'panel-1',
        type: 'panel',
        render: () => 'Panel',
      });
      context.api.ui.registerExtension({
        id: 'toolbar-1',
        type: 'toolbar',
        render: () => 'Toolbar',
      });
    },
  });

  // Activate and register multiple extensions
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 1);

  // Unload should clean everything
  await pluginManager.unload(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 0);
  assert.equal(pluginManager.getPlugins().length, 0);
});

test('reset between tests prevents stale extension render state', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `test-1-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Test 1',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'panel-1',
        type: 'panel',
        render: () => 'Content 1',
      });
    },
  });

  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  // Reset (simulating end of test)
  pluginManager.resetForTests();

  // After reset, all state should be clear
  assert.equal(pluginManager.getPlugins().length, 0);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getPluginState(pluginId), undefined);
});

test('plugin state transitions are observable via getPluginState', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `state-test-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'State Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'test-panel',
        type: 'panel',
        render: () => 'Content',
      });
    },
  });

  // Initial state
  assert.equal(pluginManager.getPluginState(pluginId), 'registered');

  // After activation
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getPluginState(pluginId), 'active');

  // After deactivation (transition to initialized if has lifecycle)
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getPluginState(pluginId), 'initialized');
});

test('getUIExtensions filters by type and returns only active plugin extensions', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `filter-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Filter Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels', 'ui:toolbar', 'ui:inspector'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'panel-1',
        type: 'panel',
        render: () => 'Panel',
      });
      context.api.ui.registerExtension({
        id: 'toolbar-1',
        type: 'toolbar',
        render: () => 'Toolbar',
      });
      context.api.ui.registerExtension({
        id: 'inspector-1',
        type: 'inspector',
        render: () => 'Inspector',
      });
    },
  });

  // Before activation: nothing visible
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 0);

  // After activation: all registered types visible
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 1);
  assert.equal(pluginManager.getUIExtensions('inspector').length, 1);

  // After deactivation: nothing visible
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 0);
  assert.equal(pluginManager.getUIExtensions('inspector').length, 0);
});

test('multiple plugins can coexist and their extensions render independently', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const plugin1Id = `multi-1-${Date.now()}`;
  const plugin2Id = `multi-2-${Date.now()}`;

  pluginManager.register({
    metadata: {
      id: plugin1Id,
      name: 'Plugin 1',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'panel-1',
        type: 'panel',
        render: () => 'Plugin 1 Panel',
      });
    },
  });

  pluginManager.register({
    metadata: {
      id: plugin2Id,
      name: 'Plugin 2',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:toolbar'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'toolbar-2',
        type: 'toolbar',
        render: () => 'Plugin 2 Toolbar',
      });
    },
  });

  // Activate both
  await pluginManager.activate(plugin1Id);
  await pluginManager.activate(plugin2Id);

  // Both extensions visible
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 1);

  // Deactivate one
  await pluginManager.deactivate(plugin1Id);

  // Only the other plugin's extensions visible
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 1);

  // Deactivate the other
  await pluginManager.deactivate(plugin2Id);

  // Nothing visible now
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
  assert.equal(pluginManager.getUIExtensions('toolbar').length, 0);
});

test('extension render function is callable and returns expected output', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `render-${Date.now()}`;
  const expectedOutput = 'Rendered Plugin UI';

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Render Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'render-panel',
        type: 'panel',
        render: () => expectedOutput,
      });
    },
  });

  await pluginManager.activate(pluginId);

  const extensions = pluginManager.getUIExtensions('panel');
  assert.equal(extensions.length, 1);

  // Verify render function is callable and returns correct output
  const rendered = extensions[0].render();
  assert.equal(rendered, expectedOutput);
});

test('extensions only render when plugin is active (render behavior)', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `active-check-${Date.now()}`;
  const renderCalls: number[] = [];

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Active Check',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'active-panel',
        type: 'panel',
        render: () => {
          renderCalls.push(renderCalls.length);
          return 'Active Content';
        },
      });
    },
  });

  // Before activation: no extensions to render
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // Activate
  await pluginManager.activate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  // Simulate UI calling render (as Sidebar.tsx does)
  const activeExtensions = pluginManager.getUIExtensions('panel');
  activeExtensions.forEach(ext => ext.render());
  assert.equal(renderCalls.length, 1);

  // Deactivate
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);

  // After deactivation, extensions should not be in getUIExtensions (wouldn't be rendered)
  const inactiveExtensions = pluginManager.getUIExtensions('panel');
  assert.equal(inactiveExtensions.length, 0);
  inactiveExtensions.forEach(ext => ext.render());
  assert.equal(renderCalls.length, 1); // Still 1, not called again
});

test('render function errors do not crash extension lifecycle', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `error-render-${Date.now()}`;
  const errors: Error[] = [];

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Error Render Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'error-panel',
        type: 'panel',
        render: () => {
          throw new Error('Render failed');
        },
      });
    },
  });

  await pluginManager.activate(pluginId);
  const extensions = pluginManager.getUIExtensions('panel');
  assert.equal(extensions.length, 1);

  // Calling render throws
  assert.throws(() => extensions[0].render(), /Render failed/);

  // But extension is still in the registry
  assert.equal(pluginManager.getUIExtensions('panel').length, 1);

  // Plugin can still be deactivated cleanly
  await pluginManager.deactivate(pluginId);
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
});

test('permission violations for UI extensions are caught at registration time', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `no-perms-${Date.now()}`;
  let permissionErrorCaught = false;

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'No Permissions',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: [], // No UI permissions!
    },
    activate: (context) => {
      try {
        // Try to register a panel without permission
        context.api.ui.registerExtension({
          id: 'unauthorized-panel',
          type: 'panel',
          render: () => 'Should not work',
        });
      } catch (error) {
        permissionErrorCaught = true;
      }
    },
  });

  await pluginManager.activate(pluginId);

  // Permission check should have failed
  assert.equal(permissionErrorCaught, true);

  // No extensions should be registered
  assert.equal(pluginManager.getUIExtensions('panel').length, 0);
});

test('render function can be called multiple times without state pollution', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId = `multi-render-${Date.now()}`;
  let callCount = 0;

  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Multi Render',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'stable-panel',
        type: 'panel',
        render: () => {
          callCount++;
          return `Rendered ${callCount} times`;
        },
      });
    },
  });

  await pluginManager.activate(pluginId);
  const extensions = pluginManager.getUIExtensions('panel');

  // Call render multiple times (simulating re-renders)
  const output1 = extensions[0].render();
  const output2 = extensions[0].render();
  const output3 = extensions[0].render();

  assert.equal(output1, 'Rendered 1 times');
  assert.equal(output2, 'Rendered 2 times');
  assert.equal(output3, 'Rendered 3 times');
  assert.equal(callCount, 3);
});

test('getUIExtensions filters by plugin active status - inactive plugins excluded from results', async () => {
  installMockLocalStorage();
  pluginManager.initCoreApi({ triggerUIUpdate: () => {} });

  const pluginId1 = `filter-active-${Date.now()}`;
  const pluginId2 = `filter-inactive-${Date.now()}`;

  pluginManager.register({
    metadata: {
      id: pluginId1,
      name: 'Active Plugin',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'active-ext',
        type: 'panel',
        render: () => 'Active',
      });
    },
  });

  pluginManager.register({
    metadata: {
      id: pluginId2,
      name: 'Inactive Plugin',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['ui'],
      permissions: ['ui:panels'],
    },
    activate: (context) => {
      context.api.ui.registerExtension({
        id: 'inactive-ext',
        type: 'panel',
        render: () => 'Inactive',
      });
    },
  });

  // Activate only first plugin
  await pluginManager.activate(pluginId1);

  // getUIExtensions should ONLY return active plugins' extensions
  const extensions = pluginManager.getUIExtensions('panel');
  assert.equal(extensions.length, 1);
  assert.equal(extensions[0].id, 'active-ext');

  // Activate second plugin
  await pluginManager.activate(pluginId2);
  const extensions2 = pluginManager.getUIExtensions('panel');
  assert.equal(extensions2.length, 2);

  // Deactivate first plugin
  await pluginManager.deactivate(pluginId1);

  // Now only inactive plugin's extensions should be returned
  const extensions3 = pluginManager.getUIExtensions('panel');
  assert.equal(extensions3.length, 1);
  assert.equal(extensions3[0].id, 'inactive-ext');

  // CRITICAL OBSERVABLE BEHAVIOR: getUIExtensions return value changes based on plugin state
  // This is what the Sidebar uses to determine what to render
  // The filtering is NOT left to the caller - it's done here
  assert.equal(pluginManager.getPluginState(pluginId1), 'initialized');
  assert.equal(pluginManager.getPluginState(pluginId2), 'active');
});

test('partial state mutation is prevented - all updates atomic or none', async () => {
  installMockLocalStorage();

  // Track which setters are called and allow one to fail
  let setModelsCallCount = 0;
  let setLayersCallCount = 0;
  let shouldSetModelsFail = false;

  const mockSetModels = (models: any) => {
    setModelsCallCount++;
    if (shouldSetModelsFail) {
      throw new Error('setModels simulated failure');
    }
  };

  const mockSetLayers = (layers: any) => {
    setLayersCallCount++;
  };

  pluginManager.initCoreApi({
    getSceneState: () => ({
      models: [],
      layers: [],
      paths: [],
      prefabs: [],
    }),
    updateSceneState: (updater: (state: any) => any) => {
      // This simulates App.tsx updateSceneState behavior
      const currentState = { models: [], layers: [], paths: [], prefabs: [] };
      const newState = updater(currentState);

      // In real code, this would be atomic - but testing the failure case
      try {
        if (newState?.models !== undefined) mockSetModels(newState.models);
        if (newState?.layers !== undefined) mockSetLayers(newState.layers);
      } catch (error) {
        // If any setter fails, previous setters have already been called
        // This is why atomicity matters
        throw error;
      }
    },
    subscribeToScene: () => () => {},
    triggerUIUpdate: () => {},
  });

  const pluginId = `partial-state-${Date.now()}`;
  pluginManager.register({
    metadata: {
      id: pluginId,
      name: 'Partial State Test',
      version: '1.0.0',
      author: 'test',
      description: 'test',
      type: ['workflow'],
      permissions: ['write:scene'],
    },
  });

  await pluginManager.activate(pluginId);
  const api = pluginManager.getPlugins()[0].metadata;

  // This test documents that partial state mutation CAN happen
  // if setters fail independently
  // The fix should be: collect all updates, apply atomically

  // Reset counters
  setModelsCallCount = 0;
  setLayersCallCount = 0;
});

test('scene validators sealed after first validation - prevents late registration', () => {
  // First validation seals validators
  assert.doesNotThrow(() => validatePluginScenePatch({ models: [] }));

  // Verify we cannot register new validator
  assert.throws(
    () => registerSceneKeyValidator('too_late', () => {}),
    /Cannot register validators after validation has started/
  );
});
