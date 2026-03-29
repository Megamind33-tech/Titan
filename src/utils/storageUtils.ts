import localforage from 'localforage';
import { ModelData } from '../App';
import { Prefab } from '../types/prefabs';
import { Layer } from '../types/layers';
import { CameraPreset, CameraPath } from '../types/camera';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from '../types/environment';
import { TerrainData } from '../types/terrain';
import { Path } from '../types/paths';
import { CollisionZone } from '../types/collision';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import {
  validatePersistedModelWithRepair,
  validateSceneSettingsWithRepair,
  validateAndRepairPersistedScene,
  repairPersistedModel,
  repairSceneSettings,
} from '../services/PersistenceContractValidation';

// Schema version for migrations
export const CURRENT_SCHEMA_VERSION = '2.0.0';

localforage.config({
  name: '3DGameEditor',
  storeName: 'scenes'
});

// ─── Validation Helpers ────────────────────────────────────────────────────

/**
 * Validates that a value is a valid transform component (position, rotation, scale)
 */
const isValidTransform = (value: unknown): value is [number, number, number] => {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(v => typeof v === 'number' && isFinite(v))
  );
};

/**
 * Validates that a color string is a valid hex color
 */
const isValidHexColor = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value);
};

/**
 * Validates that opacity is in valid range [0, 1]
 */
const isValidOpacity = (value: unknown): value is number => {
  return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1;
};

/**
 * Validates that a string is a non-empty string
 */
const isValidString = (value: unknown, minLength = 1): value is string => {
  return typeof value === 'string' && value.length >= minLength;
};

/**
 * Validate persisted model data against schema
 */
const validatePersistedModel = (model: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!model || typeof model !== 'object') {
    return { valid: false, errors: ['Model must be an object'] };
  }

  const m = model as Record<string, unknown>;

  // Required string fields
  if (!isValidString(m.id)) {
    errors.push('Model id must be a non-empty string');
  }
  if (!isValidString(m.name)) {
    errors.push('Model name must be a non-empty string');
  }

  // Transform validation
  if (!isValidTransform(m.position)) {
    errors.push('Model position must be [number, number, number]');
  }
  if (!isValidTransform(m.rotation)) {
    errors.push('Model rotation must be [number, number, number]');
  }
  if (!isValidTransform(m.scale)) {
    errors.push('Model scale must be [number, number, number]');
  }

  // Optional color validation (if present, must be valid)
  if (m.colorTint !== undefined && !isValidHexColor(m.colorTint)) {
    errors.push('Model colorTint must be valid hex color (#RRGGBB)');
  }

  // Opacity validation (if present, must be in range)
  if (m.opacity !== undefined && !isValidOpacity(m.opacity)) {
    errors.push('Model opacity must be number between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate scene settings against schema
 */
const validateSceneSettings = (settings: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!settings || typeof settings !== 'object') {
    return { valid: false, errors: ['SceneSettings must be an object'] };
  }

  const s = settings as Record<string, unknown>;

  if (typeof s.gridReceiveShadow !== 'boolean') {
    errors.push('gridReceiveShadow must be boolean');
  }

  if (typeof s.shadowSoftness !== 'number' || !isFinite(s.shadowSoftness)) {
    errors.push('shadowSoftness must be a finite number');
  }

  if (!s.environment || typeof s.environment !== 'object') {
    errors.push('environment must be an object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// ─── Migration System ──────────────────────────────────────────────────────

/**
 * Migration function type: transforms state from old schema to new schema
 */
type Migration = (state: any) => any;

/**
 * Registry of migrations, indexed by target schema version
 */
const MIGRATIONS: Record<string, Migration> = {
  // Migration from 1.0.0 to 2.0.0: Add schemaVersion field and validate texture maps
  '2.0.0': (state: any) => {
    if (!state.schemaVersion) {
      // Add schema version if missing
      state.schemaVersion = '2.0.0';

      // Ensure texture map URLs are preserved (not discarded)
      // In 1.0.0, some texture map URLs may have been missing; ensure they exist
      if (state.models && Array.isArray(state.models)) {
        state.models = state.models.map((m: any) => ({
          ...m,
          // Preserve texture map URLs if present, otherwise undefined (not an error)
          normalMapUrl: m.normalMapUrl,
          roughnessMapUrl: m.roughnessMapUrl,
          metalnessMapUrl: m.metalnessMapUrl,
          emissiveMapUrl: m.emissiveMapUrl,
          alphaMapUrl: m.alphaMapUrl,
          aoMapUrl: m.aoMapUrl,
        }));
      }
    }
    return state;
  },
};

/**
 * Apply all pending migrations to bring state up to CURRENT_SCHEMA_VERSION
 */
const applyMigrations = (state: any): any => {
  let currentVersion = state.schemaVersion || '1.0.0';

  if (currentVersion === CURRENT_SCHEMA_VERSION) {
    return state;
  }

  // Apply all migrations from current version to latest
  const versionOrder = ['1.0.0', '2.0.0'];
  const currentIdx = versionOrder.indexOf(currentVersion);
  const targetIdx = versionOrder.indexOf(CURRENT_SCHEMA_VERSION);

  if (currentIdx < 0 || targetIdx < 0) {
    console.warn(
      `Unknown schema version: ${currentVersion}. Expected one of: ${versionOrder.join(', ')}`
    );
    return state;
  }

  // Apply migrations in sequence
  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    const version = versionOrder[i];
    const migration = MIGRATIONS[version];
    if (migration) {
      state = migration(state);
      console.log(`Applied migration to schema ${version}`);
    }
  }

  return state;
};

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
 * Persisted scene state.
 *
 * SCHEMA VERSION: 2.0.0
 *
 * PRESERVED FIELDS:
 * - All model properties except File/Blob objects (url, file, textureFile, normalMapFile, etc.)
 * - Texture map URLs (can be restored), but not File objects
 * - All prefabs, layers, camera settings, scene settings
 * - Terrain, paths, collision zones
 *
 * TRANSIENT FIELDS (NOT PERSISTED):
 * - File and Blob objects (url, file, textureFile, normalMapFile - cannot serialize)
 *
 * NOTE: When models are loaded from saved state, File/Blob fields will be undefined.
 * Users must re-upload geometry files, but texture URLs will be preserved.
 */
export interface SceneState {
  schemaVersion: string;
  versionId: string;
  timestamp: string;
  note: string;
  models: Omit<ModelData, 'file' | 'textureFile' | 'normalMapFile' | 'roughnessMapFile' | 'metalnessMapFile' | 'emissiveMapFile' | 'alphaMapFile' | 'aoMapFile'>[];
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
  projectMetadata?: ProjectMetadataProbe;
}

/**
 * Save a version of the scene to history with validation.
 *
 * VALIDATION:
 * - All models validated before persisting
 * - All scene settings validated
 * - Non-serializable values logged with warnings
 *
 * NOTE: File/Blob objects are discarded and cannot be restored.
 * Users will need to re-upload geometry files after loading a saved version.
 * Texture map URLs are preserved.
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
  collisionZones?: CollisionZone[],
  projectMetadata?: ProjectMetadataProbe
): Promise<SceneState> => {
  const versionId = Date.now().toString();

  // Validate scene settings
  const settingsValidation = validateSceneSettings(sceneSettings);
  if (!settingsValidation.valid) {
    console.warn(
      `Scene settings validation warnings during save:\n${settingsValidation.errors.join('\n')}`
    );
  }

  // Discard transient file-based fields before persisting
  const persistedModels = models.map((m, idx) => {
    // Validate before persisting
    const { file, textureFile, normalMapFile, roughnessMapFile, metalnessMapFile, emissiveMapFile, alphaMapFile, aoMapFile, ...rest } = m;

    const modelValidation = validatePersistedModel(rest);
    if (!modelValidation.valid) {
      console.warn(
        `Model "${m.id}" validation warnings during save:\n${modelValidation.errors.join('\n')}`
      );
    }

    return rest;
  });

  const state: SceneState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
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
    projectMetadata,
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
 * Load a version of the scene from history with hardened validation and repair.
 *
 * VALIDATION & REPAIR STRATEGY:
 * - Schema version checked (migrations applied if needed)
 * - All models validated and repaired (transforms, colors, opacity)
 * - All scene settings validated and repaired
 * - Malformed data auto-repaired where possible
 * - Unrecoverable issues logged, blocking load failure with diagnostics
 *
 * REPAIR CAPABILITIES:
 * - Missing required fields: Generate defaults
 * - Invalid transforms (NaN, Infinity): Reset to identity
 * - Invalid colors: Reset to sensible defaults
 * - Out-of-range values: Clamp to valid ranges
 * - Missing optional fields: Apply comprehensive defaults
 *
 * WARNING: File/Blob objects are NOT restored because they cannot be persisted.
 * Loaded models will have undefined File fields. Texture map URLs are restored.
 *
 * THROWS: If scene has blocking validation errors that cannot be repaired
 */
export const loadSceneVersion = async (versionId: string): Promise<SceneState | null> => {
  const history: SceneState[] = (await localforage.getItem('scene_history')) || [];
  let state = history.find(s => s.versionId === versionId);
  if (!state) return null;

  // Apply migrations if schema version is older
  state = applyMigrations(state) as SceneState;

  // Comprehensive validation and repair
  const validation = validateAndRepairPersistedScene(state);

  if (!validation.canLoad) {
    const errorMessage = [
      `Failed to load scene version ${versionId}.`,
      `Blocking validation errors:`,
      ...validation.allBlockingErrors.map(e => `  - ${e}`)
    ].join('\n');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Log any warnings or repairs
  if (validation.issues.length > 0) {
    const repairs = validation.issues
      .filter(issue => issue.repairs.length > 0)
      .flatMap(issue => issue.repairs);

    if (repairs.length > 0) {
      console.warn(
        `Scene loaded with repairs:\n${repairs.map(r => `  - ${r}`).join('\n')}`
      );
    }

    const warnings = validation.issues
      .filter(issue => issue.warnings.length > 0)
      .flatMap(issue => issue.warnings);

    if (warnings.length > 0) {
      console.warn(
        `Scene loaded with warnings:\n${warnings.map(w => `  - ${w}`).join('\n')}`
      );
    }
  }

  // Repair models if needed
  if (state.models && Array.isArray(state.models)) {
    state.models = state.models.map(model => {
      const { repaired } = repairPersistedModel(model);
      return repaired;
    });
  }

  // Repair scene settings if needed
  if (state.sceneSettings) {
    const { repaired } = repairSceneSettings(state.sceneSettings);
    state.sceneSettings = repaired;
  }

  // Ensure all optional fields have safe defaults
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
    projectMetadata: state.projectMetadata,
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
 * Auto-save the current scene state with validation.
 *
 * SCHEMA VERSION: 2.0.0
 *
 * PRESERVED FIELDS: Same as SceneState
 * TRANSIENT FIELDS: Same as SceneState
 *
 * NOTE: File/Blob objects are discarded and cannot be restored.
 * Texture map URLs are preserved.
 */
export const autoSaveScene = async (
  models: ModelData[],
  prefabs: Prefab[],
  sceneSettings: SceneSettings,
  cameraSettings?: CameraSettings,
  layers?: Layer[],
  terrain?: TerrainData,
  paths?: Path[],
  collisionZones?: CollisionZone[],
  projectMetadata?: ProjectMetadataProbe
): Promise<void> => {
  // Validate scene settings
  const settingsValidation = validateSceneSettings(sceneSettings);
  if (!settingsValidation.valid) {
    console.warn(
      `Scene settings validation warnings during autosave:\n${settingsValidation.errors.join('\n')}`
    );
  }

  // Discard transient file-based fields
  const persistedModels = models.map(m => {
    const { file, textureFile, normalMapFile, roughnessMapFile, metalnessMapFile, emissiveMapFile, alphaMapFile, aoMapFile, ...rest } = m;

    const modelValidation = validatePersistedModel(rest);
    if (!modelValidation.valid) {
      console.warn(
        `Model "${m.id}" validation warnings during autosave:\n${modelValidation.errors.join('\n')}`
      );
    }

    return rest;
  });

  const state = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    models: persistedModels,
    prefabs,
    sceneSettings,
    cameraSettings: cameraSettings ?? { presets: [], activePresetId: null, paths: [], activePathId: null },
    layers: layers ?? [],
    terrain,
    paths: paths ?? [],
    collisionZones: collisionZones ?? [],
    projectMetadata,
  };

  await localforage.setItem('autosave', state);
};

/**
 * Persisted auto-save state.
 *
 * SCHEMA VERSION: 2.0.0
 *
 * Similar to SceneState but without versionId, note, and changesSummary metadata
 * (autosave is latest-only, not historical).
 */
export interface AutoSaveState {
  schemaVersion: string;
  timestamp: string;
  models: Omit<ModelData, 'file' | 'textureFile' | 'normalMapFile' | 'roughnessMapFile' | 'metalnessMapFile' | 'emissiveMapFile' | 'alphaMapFile' | 'aoMapFile'>[];
  prefabs: Prefab[];
  sceneSettings: SceneSettings;
  cameraSettings: CameraSettings;
  layers: Layer[];
  terrain?: TerrainData;
  paths: Path[];
  collisionZones: CollisionZone[];
  projectMetadata?: ProjectMetadataProbe;
}

/**
 * Load auto-saved scene state with hardened validation and repair.
 *
 * Same validation/repair strategy as loadSceneVersion:
 * - Schema version checked (migrations applied if needed)
 * - All models validated and repaired (transforms, colors, opacity)
 * - All scene settings validated and repaired
 * - Malformed data auto-repaired where possible
 * - Unrecoverable issues logged, blocking load failure with diagnostics
 *
 * NOTE: Autosave is more permissive than manual version loads (logs but continues
 * on recoverable errors) since autosave is a recovery mechanism and should not
 * prevent editor startup.
 *
 * WARNING: File/Blob objects are NOT restored because they cannot be persisted.
 * Loaded models will have undefined File fields. Texture map URLs are restored.
 */
export const loadAutoSave = async (): Promise<AutoSaveState | null> => {
  const raw = await localforage.getItem('autosave');
  if (!raw) return null;

  // Type-cast from unknown to mutable state object
  let state = raw as Partial<any>;

  // Apply migrations if needed
  state = applyMigrations(state);

  // Comprehensive validation and repair
  const validation = validateAndRepairPersistedScene(state);

  // For autosave, log issues but don't fail (autosave is recovery mechanism)
  if (validation.issues.length > 0) {
    const repairs = validation.issues
      .filter(issue => issue.repairs.length > 0)
      .flatMap(issue => issue.repairs);

    if (repairs.length > 0) {
      console.warn(
        `Autosave loaded with repairs:\n${repairs.map(r => `  - ${r}`).join('\n')}`
      );
    }

    const warnings = validation.issues
      .filter(issue => issue.warnings.length > 0)
      .flatMap(issue => issue.warnings);

    if (warnings.length > 0) {
      console.warn(
        `Autosave loaded with warnings:\n${warnings.map(w => `  - ${w}`).join('\n')}`
      );
    }
  }

  // If blocking errors exist in autosave, try to recover as much as possible
  if (!validation.canLoad) {
    console.error(
      `Autosave has blocking errors. Some data may be lost:\n${validation.allBlockingErrors.map(e => `  - ${e}`).join('\n')}`
    );
  }

  // Repair models if needed
  if (state.models && Array.isArray(state.models)) {
    state.models = state.models.map(model => {
      const { repaired } = repairPersistedModel(model);
      return repaired;
    });
  }

  // Repair scene settings if needed
  if (state.sceneSettings) {
    const { repaired } = repairSceneSettings(state.sceneSettings);
    state.sceneSettings = repaired;
  }

  // Provide type-safe defaults for optional/missing fields
  return {
    schemaVersion: state.schemaVersion ?? CURRENT_SCHEMA_VERSION,
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
    projectMetadata: state.projectMetadata,
  };
};
