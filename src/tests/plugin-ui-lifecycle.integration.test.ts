import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginManager } from '../services/PluginManager';
import { PluginContext, UIExtensionPoint } from '../types/plugin';

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

  // Verify render function is callable
  const rendered = extensions[0].render();
  assert.equal(rendered, expectedOutput);
});
