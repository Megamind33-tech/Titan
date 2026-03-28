import React from 'react';

export type PluginPermission = 
  | 'read:scene' 
  | 'write:scene' 
  | 'read:assets' 
  | 'write:assets' 
  | 'export' 
  | 'network' 
  | 'ui:panels' 
  | 'ui:toolbar' 
  | 'ui:inspector' 
  | 'ui:menu';

export type ExtensionType = 
  | 'asset-import'
  | 'material'
  | 'lighting'
  | 'camera'
  | 'terrain'
  | 'path'
  | 'diagnostics'
  | 'export'
  | 'ui'
  | 'workflow'
  | 'ai-assistant'
  | 'gameplay';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  type: ExtensionType[];
  permissions: PluginPermission[];
  dependencies?: string[];
}

export type PluginState = 'registered' | 'loaded' | 'initialized' | 'active' | 'error' | 'unloaded';

export interface PluginContext {
  api: PluginAPI;
  state: any; // Plugin's internal state
}

export interface Plugin {
  metadata: PluginMetadata;
  // Lifecycle hooks
  load?: () => Promise<void>;
  initialize?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  unload?: () => Promise<void>;
}

export interface UIExtensionPoint {
  id: string;
  type: 'panel' | 'toolbar' | 'inspector' | 'menu' | 'context' | 'diagnostic';
  render: () => React.ReactNode;
  position?: string;
  icon?: string;
  label?: string;
}

export interface PluginAPI {
  // Data Access (controlled by permissions)
  scene: {
    get: () => any; // Returns readonly scene state
    update: (updater: (state: any) => any) => void;
    subscribe: (listener: (state: any) => void) => () => void;
  };
  assets: {
    getLibrary: () => any;
    addAsset: (asset: any) => void;
  };
  ui: {
    registerExtension: (extension: UIExtensionPoint) => void;
    unregisterExtension: (id: string) => void;
  };
  data: {
    // For saving plugin-specific data in the scene
    getPluginData: (key: string) => any;
    setPluginData: (key: string, data: any) => void;
  };
}
