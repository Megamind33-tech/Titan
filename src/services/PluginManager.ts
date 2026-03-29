import { Plugin, PluginMetadata, PluginState, PluginAPI, UIExtensionPoint } from '../types/plugin';
import { resetSceneValidators } from './PluginSceneValidation';

interface PluginCoreApi {
  getSceneState?: () => any;
  updateSceneState?: (updater: (state: any) => any) => void;
  subscribeToScene?: (listener: (state: any) => void) => () => void;
  getAssetLibrary?: () => any;
  addAsset?: (asset: any) => void;
  triggerUIUpdate?: () => void;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginStates: Map<string, PluginState> = new Map();
  private pluginErrors: Map<string, Error> = new Map();
  private uiExtensions: Map<string, UIExtensionPoint[]> = new Map(); // pluginId -> extensions
  private pluginData: Map<string, any> = new Map(); // pluginId -> data
  private readonly storageKey = 'plugin_bridge_data';
  private hasHydratedPluginData = false;

  // Provide a way to inject the core editor API
  private coreApi: PluginCoreApi | null = null;

  initCoreApi(api: PluginCoreApi) {
    this.coreApi = api;
    if (!this.hasHydratedPluginData) {
      this.hydratePluginData();
      this.hasHydratedPluginData = true;
    }
  }

  private hydratePluginData() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.storageKey) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, any>;
      Object.entries(parsed).forEach(([pluginId, data]) => {
        this.pluginData.set(pluginId, data);
      });
    } catch (error) {
      console.warn('Failed to hydrate plugin bridge data', error);
    }
  }

  private persistPluginData() {
    try {
      if (typeof localStorage === 'undefined') return;
      const data = Object.fromEntries(this.pluginData.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to persist plugin bridge data', error);
    }
  }

  register(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.metadata.id)) {
      return false;
    }
    this.plugins.set(plugin.metadata.id, plugin);
    this.pluginStates.set(plugin.metadata.id, 'registered');
    this.pluginErrors.delete(plugin.metadata.id);
    return true;
  }

  async load(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin ${id} not found`);
    
    try {
      if (plugin.load) await plugin.load();
      this.pluginStates.set(id, 'loaded');
    } catch (e) {
      this.handleError(id, e as Error);
    }
  }

  private createPluginAPI(pluginId: string, permissions: string[]): PluginAPI {
    const getUIPermissionForExtensionType = (type: UIExtensionPoint['type']) => {
      if (type === 'panel') return 'ui:panels';
      if (type === 'toolbar') return 'ui:toolbar';
      if (type === 'inspector') return 'ui:inspector';
      if (type === 'menu') return 'ui:menu';
      return null;
    };

    const assertUiPermission = (required: string | null) => {
      if (!required) return;
      if (!permissions.includes(required)) {
        throw new Error(`Permission denied: ${required}`);
      }
    };

    // Create a restricted API based on permissions
    return {
      scene: {
        get: () => {
          if (!permissions.includes('read:scene')) throw new Error('Permission denied: read:scene');
          if (!this.coreApi?.getSceneState) throw new Error('Scene read is not available');
          return this.coreApi.getSceneState();
        },
        update: (updater) => {
          if (!permissions.includes('write:scene')) throw new Error('Permission denied: write:scene');
          if (!this.coreApi?.updateSceneState) throw new Error('Scene update is not available');
          this.coreApi.updateSceneState(updater);
        },
        subscribe: (listener) => {
          if (!permissions.includes('read:scene')) throw new Error('Permission denied: read:scene');
          if (!this.coreApi?.subscribeToScene) throw new Error('Scene subscription is not available');
          return this.coreApi.subscribeToScene(listener);
        }
      },
      assets: {
        getLibrary: () => {
          if (!permissions.includes('read:assets')) throw new Error('Permission denied: read:assets');
          if (!this.coreApi?.getAssetLibrary) throw new Error('Asset library is not available');
          return this.coreApi.getAssetLibrary();
        },
        addAsset: (asset) => {
          if (!permissions.includes('write:assets')) throw new Error('Permission denied: write:assets');
          if (!this.coreApi?.addAsset) throw new Error('Asset creation is not available');
          this.coreApi.addAsset(asset);
        }
      },
      ui: {
        registerExtension: (ext) => {
          assertUiPermission(getUIPermissionForExtensionType(ext.type));
          if (!this.uiExtensions.has(pluginId)) {
            this.uiExtensions.set(pluginId, []);
          }
          this.uiExtensions.get(pluginId)!.push(ext);
          // Trigger UI update
          this.coreApi?.triggerUIUpdate();
        },
        unregisterExtension: (extId) => {
          const exts = this.uiExtensions.get(pluginId) || [];
          const target = exts.find(e => e.id === extId);
          if (target) {
            assertUiPermission(getUIPermissionForExtensionType(target.type));
          }
          this.uiExtensions.set(pluginId, exts.filter(e => e.id !== extId));
          this.coreApi?.triggerUIUpdate();
        }
      },
      data: {
        getPluginData: (key) => {
          const data = this.pluginData.get(pluginId) || {};
          return data[key];
        },
        setPluginData: (key, value) => {
          const data = this.pluginData.get(pluginId) || {};
          data[key] = value;
          this.pluginData.set(pluginId, data);
          this.persistPluginData();
        }
      }
    };
  }

  async activate(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    if (this.pluginStates.get(id) === 'active') return;

    // Check dependencies
    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (this.pluginStates.get(dep) !== 'active') {
          this.handleError(id, new Error(`Missing or inactive dependency: ${dep}`));
          return;
        }
      }
    }

    try {
      if (this.pluginStates.get(id) === 'registered') {
        await this.load(id);
      }

      const api = this.createPluginAPI(id, plugin.metadata.permissions);
      const context = { api, state: {} };
      this.uiExtensions.set(id, []);

      if (plugin.initialize && this.pluginStates.get(id) === 'loaded') {
        await plugin.initialize(context);
        this.pluginStates.set(id, 'initialized');
      }

      if (plugin.activate) {
        await plugin.activate(context);
      }
      
      this.pluginStates.set(id, 'active');
      this.pluginErrors.delete(id);
    } catch (error) {
      this.handleError(id, error as Error);
    }
  }

  async deactivate(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    try {
      const api = this.createPluginAPI(id, plugin.metadata.permissions);
      if (plugin.deactivate) {
        await plugin.deactivate({ api, state: {} }); // State might be lost here, need better state management if needed
      }
      // Clean up UI extensions
      this.uiExtensions.delete(id);
      this.coreApi?.triggerUIUpdate();

      this.pluginStates.set(id, 'initialized');
    } catch (error) {
      this.handleError(id, error as Error);
    }
  }

  async unload(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

    if (this.pluginStates.get(id) === 'active') {
      await this.deactivate(id);
    }

    try {
      if (plugin.unload) {
        await plugin.unload();
      }
      this.plugins.delete(id);
      this.pluginStates.delete(id);
      this.pluginErrors.delete(id);
      this.uiExtensions.delete(id);
    } catch (error) {
      this.handleError(id, error as Error);
    }
  }

  private handleError(id: string, error: Error) {
    console.error(`Plugin error [${id}]:`, error);
    this.pluginStates.set(id, 'error');
    this.pluginErrors.set(id, error);
  }

  getPlugins() {
    return Array.from(this.plugins.values());
  }

  getPluginState(id: string) {
    return this.pluginStates.get(id);
  }

  getPluginError(id: string) {
    return this.pluginErrors.get(id);
  }

  getUIExtensions(type: string) {
    const allExts: UIExtensionPoint[] = [];
    for (const [pluginId, exts] of this.uiExtensions.entries()) {
      if (this.pluginStates.get(pluginId) === 'active') {
        allExts.push(...exts.filter(e => e.type === type));
      }
    }
    return allExts;
  }

  reset(options?: { preservePluginData?: boolean }) {
    this.plugins.clear();
    this.pluginStates.clear();
    this.pluginErrors.clear();
    this.uiExtensions.clear();
    if (!options?.preservePluginData) {
      this.pluginData.clear();
    }
    this.coreApi = null;
    this.hasHydratedPluginData = false;

    // CRITICAL: Reset scene validators when plugin manager resets
    // Ensures scene validator singleton state doesn't leak between test runs
    resetSceneValidators();
  }

  // Test helper alias.
  resetForTests() {
    this.reset();
  }
}

export const pluginManager = new PluginManager();
