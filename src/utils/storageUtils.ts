import localforage from 'localforage';

localforage.config({
  name: '3DGameEditor',
  storeName: 'scenes'
});

export interface SceneState {
  versionId: string;
  timestamp: string;
  note: string;
  models: any[];
  prefabs?: any[];
  sceneSettings: any;
  layers?: any[];
  cameraSettings?: {
    presets: any[];
    activePresetId: string | null;
    paths: any[];
    activePathId: string | null;
  };
  changesSummary?: {
    added: number;
    removed: number;
    edited: number;
  };
  terrain?: any;
  paths?: any[];
  /** Collision zones and placement constraint data */
  collisionZones?: any[];
}

export const saveSceneVersion = async (
  models: any[],
  prefabs: any[],
  sceneSettings: any,
  note: string = 'Manual Save',
  cameraSettings?: any,
  layers?: any[],
  terrain?: any,
  paths?: any[],
  collisionZones?: any[]
) => {
  const versionId = Date.now().toString();
  const state: SceneState = {
    versionId,
    timestamp: new Date().toISOString(),
    note,
    models: models.map(m => ({
      ...m,
      url: undefined,        // Don't save blob URLs, they expire
      textureUrl: undefined
    })),
    prefabs,
    sceneSettings,
    cameraSettings,
    layers,
    terrain,
    paths,
    collisionZones: collisionZones ?? [],
  };

  const history: SceneState[] = await localforage.getItem('scene_history') || [];

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

export const loadSceneVersion = async (versionId: string): Promise<SceneState | null> => {
  const history: SceneState[] = await localforage.getItem('scene_history') || [];
  const state = history.find(s => s.versionId === versionId);
  if (!state) return null;

  const restoredModels = state.models.map(m => {
    const restored = { ...m };
    if (restored.file) {
      try { restored.url = URL.createObjectURL(restored.file); }
      catch (e) { console.error('Failed to restore model file URL', e); }
    }
    if (restored.textureFile) {
      try { restored.textureUrl = URL.createObjectURL(restored.textureFile); }
      catch (e) { console.error('Failed to restore texture file URL', e); }
    }
    return restored;
  });

  return {
    ...state,
    models:         restoredModels,
    prefabs:        state.prefabs        ?? [],
    terrain:        state.terrain,
    paths:          state.paths          ?? [],
    collisionZones: state.collisionZones ?? [],
  };
};

export const getVersionHistory = async (): Promise<SceneState[]> => {
  return await localforage.getItem('scene_history') || [];
};

export const autoSaveScene = async (
  models: any[],
  prefabs: any[],
  sceneSettings: any,
  cameraSettings?: any,
  layers?: any[],
  terrain?: any,
  paths?: any[],
  collisionZones?: any[]
) => {
  const state = {
    timestamp: new Date().toISOString(),
    models: models.map(m => ({
      ...m,
      url: undefined,
      textureUrl: undefined
    })),
    prefabs,
    sceneSettings,
    cameraSettings,
    layers,
    terrain,
    paths,
    collisionZones: collisionZones ?? [],
  };
  await localforage.setItem('autosave', state);
};

export const loadAutoSave = async (): Promise<any | null> => {
  const state: any = await localforage.getItem('autosave');
  if (!state) return null;

  const restoredModels = state.models.map((m: any) => {
    const restored = { ...m };
    if (restored.file) {
      try { restored.url = URL.createObjectURL(restored.file); }
      catch (e) { console.error('Failed to restore model file URL', e); }
    }
    if (restored.textureFile) {
      try { restored.textureUrl = URL.createObjectURL(restored.textureFile); }
      catch (e) { console.error('Failed to restore texture file URL', e); }
    }
    return restored;
  });

  return {
    ...state,
    models:         restoredModels,
    prefabs:        state.prefabs        ?? [],
    terrain:        state.terrain,
    paths:          state.paths          ?? [],
    collisionZones: state.collisionZones ?? [],
  };
};
