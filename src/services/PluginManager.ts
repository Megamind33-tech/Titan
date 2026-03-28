import { Plugin, PluginMetadata, PluginState, PluginAPI, UIExtensionPoint } from '../types/plugin';

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginStates: Map<string, PluginState> = new Map();
  private pluginErrors: Map<string, Error> = new Map();
  private uiExtensions: Map<string, UIExtensionPoint[]> = new Map(); // pluginId -> extensions
  private pluginData: Map<string, any> = new Map(); // pluginId -> data

  // Provide a way to inject the core editor API
  private coreApi: any;

  initCoreApi(api: any) {
    this.coreApi = api;
  }

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.metadata.id)) {
      console.warn(`Plugin ${plugin.metadata.id} is already registered.`);
      return;
    }
    this.plugins.set(plugin.metadata.id, plugin);
    this.pluginStates.set(plugin.metadata.id, 'registered');
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
    // Create a restricted API based on permissions
    return {
      scene: {
        get: () => {
          if (!permissions.includes('read:scene')) throw new Error('Permission denied: read:scene');
          return this.coreApi?.getSceneState();
        },
        update: (updater) => {
          if (!permissions.includes('write:scene')) throw new Error('Permission denied: write:scene');
          this.coreApi?.updateSceneState(updater);
        },
        subscribe: (listener) => {
          if (!permissions.includes('read:scene')) throw new Error('Permission denied: read:scene');
          return this.coreApi?.subscribeToScene(listener) || (() => {});
        }
      },
      assets: {
        getLibrary: () => {
          if (!permissions.includes('read:assets')) throw new Error('Permission denied: read:assets');
          return this.coreApi?.getAssetLibrary();
        },
        addAsset: (asset) => {
          if (!permissions.includes('write:assets')) throw new Error('Permission denied: write:assets');
          this.coreApi?.addAsset(asset);
        }
      },
      ui: {
        registerExtension: (ext) => {
          if (!this.uiExtensions.has(pluginId)) {
            this.uiExtensions.set(pluginId, []);
          }
          this.uiExtensions.get(pluginId)!.push(ext);
          // Trigger UI update
          this.coreApi?.triggerUIUpdate();
        },
        unregisterExtension: (extId) => {
          const exts = this.uiExtensions.get(pluginId) || [];
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
          // Notify core to save plugin data
          this.coreApi?.savePluginData(pluginId, data);
        }
      }
    };
  }

  async activate(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;

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
}

export const pluginManager = new PluginManager();
