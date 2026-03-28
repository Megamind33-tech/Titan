import localforage from 'localforage';
import { ModelData } from '../App';
import { Prefab } from '../types/prefabs';
import { Layer } from '../types/layers';
import { CameraPreset, CameraPath } from '../types/camera';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from '../types/environment';
import { TerrainData } from '../types/terrain';
import { Path } from '../types/paths';
import { CollisionZone } from '../types/collision';

localforage.config({
  name: '3DGameEditor',
  storeName: 'scenes'
});

export interface SceneSettings {
  gridReceiveShadow: boolean;
  shadowSoftness: number;
  environment: EnvironmentPreset;
}

export interface CameraSettings {
  presets: CameraPreset[];
  activePresetId: string | null;
  paths: CameraPath[];
  activePathId: string | null;
}

/**
 * Persisted scene state. NOTE: File/Blob URLs cannot be preserved across sessions.
 * When loading a saved version, models will have undefined URLs unless explicitly
 * restored by the user (requires re-uploading files).
 */
export interface SceneState {
  versionId: string;
  timestamp: string;
  note: string;
  models: Omit<ModelData, 'url' | 'textureUrl' | 'normalMapUrl' | 'file' | 'textureFile' | 'normalMapFile'>[];
  prefabs: Prefab[];
  sceneSettings: SceneSettings;
  layers: Layer[];
  cameraSettings: CameraSettings;
  changesSummary?: {
    added: number;
    removed: number;
    edited: number;
  };
  terrain?: TerrainData;
  paths: Path[];
  collisionZones: CollisionZone[];
}

/**
 * Save a version of the scene to history.
 * NOTE: File/Blob URLs are discarded and cannot be restored.
 * Users will need to re-upload files after loading a saved version.
 */
export const saveSceneVersion = async (
  models: ModelData[],
  prefabs: Prefab[],
  sceneSettings: SceneSettings,
  note: string = 'Manual Save',
  cameraSettings?: CameraSettings,
  layers?: Layer[],
  terrain?: TerrainData,
  paths?: Path[],
  collisionZones?: CollisionZone[]
): Promise<SceneState> => {
  const versionId = Date.now().toString();

  // Discard transient fields (URLs, File objects) before persisting
  const persistedModels = models.map(m => {
    const { url, file, textureUrl, textureFile, normalMapUrl, normalMapFile, ...rest } = m;
    return rest;
  });

  const state: SceneState = {
    versionId,
    timestamp: new Date().toISOString(),
    note,
    models: persistedModels,
    prefabs,
    sceneSettings,
    layers: layers ?? [],
    cameraSettings: cameraSettings ?? { presets: [], activePresetId: null, paths: [], activePathId: null },
    terrain,
    paths: paths ?? [],
    collisionZones: collisionZones ?? [],
  };

  const history: SceneState[] = await localforage.getItem('scene_history') || [];

  // Calculate change summary
  let added = 0, removed = 0, edited = 0;
  if (history.length > 0) {
    const lastState = history[history.length - 1];
    const lastIds    = new Set(lastState.models.map(m => m.id));
    const currentIds = new Set(state.models.map(m => m.id));

    added   = [...currentIds].filter(id => !lastIds.has(id)).length;
    removed = [...lastIds].filter(id => !currentIds.has(id)).length;
    edited  = [...currentIds].filter(id => lastIds.has(id)).length;
  } else {
    added = state.models.length;
  }

  state.changesSummary = { added, removed, edited };

  history.push(state);
  await localforage.setItem('scene_history', history);
  return state;
};

/**
 * Load a version of the scene from history.
 * WARNING: File/Blob URLs are NOT restored because they cannot be persisted.
 * Loaded models will have undefined URLs and will need explicit re-upload or
 * fallback to placeholder/stub geometries.
 */
export const loadSceneVersion = async (versionId: string): Promise<SceneState | null> => {
  const history: SceneState[] = await localforage.getItem('scene_history') || [];
  const state = history.find(s => s.versionId === versionId);
  if (!state) return null;

  // Ensure all optional fields have safe defaults
  // Note: URLs remain undefined (cannot be restored)
  return {
    ...state,
    prefabs: state.prefabs ?? [],
    layers: state.layers ?? [],
    cameraSettings: state.cameraSettings ?? {
      presets: [],
      activePresetId: null,
      paths: [],
      activePathId: null
    },
    terrain: state.terrain,
    paths: state.paths ?? [],
    collisionZones: state.collisionZones ?? [],
  };
};

export const getVersionHistory = async (): Promise<SceneState[]> => {
  const history = await localforage.getItem('scene_history');
  if (!history || !Array.isArray(history)) {
    return [];
  }
  return history as SceneState[];
};

/**
 * Auto-save the current scene state.
 * NOTE: File/Blob URLs are discarded and cannot be restored.
 */
export const autoSaveScene = async (
  models: ModelData[],
  prefabs: Prefab[],
  sceneSettings: SceneSettings,
  cameraSettings?: CameraSettings,
  layers?: Layer[],
  terrain?: TerrainData,
  paths?: Path[],
  collisionZones?: CollisionZone[]
): Promise<void> => {
  // Discard transient fields
  const persistedModels = models.map(m => {
    const { url, file, textureUrl, textureFile, normalMapUrl, normalMapFile, ...rest } = m;
    return rest;
  });

  const state = {
    timestamp: new Date().toISOString(),
    models: persistedModels,
    prefabs,
    sceneSettings,
    cameraSettings: cameraSettings ?? { presets: [], activePresetId: null, paths: [], activePathId: null },
    layers: layers ?? [],
    terrain,
    paths: paths ?? [],
    collisionZones: collisionZones ?? [],
  };

  await localforage.setItem('autosave', state);
};

export interface AutoSaveState {
  timestamp: string;
  models: Omit<ModelData, 'url' | 'textureUrl' | 'normalMapUrl' | 'file' | 'textureFile' | 'normalMapFile'>[];
  prefabs: Prefab[];
  sceneSettings: SceneSettings;
  cameraSettings: CameraSettings;
  layers: Layer[];
  terrain?: TerrainData;
  paths: Path[];
  collisionZones: CollisionZone[];
}

/**
 * Load auto-saved scene state.
 * WARNING: URLs are not restored (cannot be persisted).
 */
export const loadAutoSave = async (): Promise<AutoSaveState | null> => {
  const raw = await localforage.getItem('autosave');
  if (!raw) return null;

  // Type-cast from unknown to partial state object
  const state = raw as Partial<AutoSaveState>;

  // Type-safe defaults
  return {
    timestamp: state.timestamp ?? new Date().toISOString(),
    models: state.models ?? [],
    prefabs: state.prefabs ?? [],
    sceneSettings: state.sceneSettings ?? {
      gridReceiveShadow: true,
      shadowSoftness: 0.5,
      environment: DEFAULT_ENVIRONMENT
    },
    cameraSettings: state.cameraSettings ?? {
      presets: [],
      activePresetId: null,
      paths: [],
      activePathId: null
    },
    layers: state.layers ?? [],
    terrain: state.terrain,
    paths: state.paths ?? [],
    collisionZones: state.collisionZones ?? [],
  };
};
