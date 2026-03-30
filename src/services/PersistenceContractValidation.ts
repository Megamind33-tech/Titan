/**
 * PersistenceContractValidation.ts
 *
 * Defines and enforces the persistence contract for save/load operations.
 *
 * PHASE 2: Persistence Contract Hardening
 *
 * This module:
 * 1. Defines REQUIRED vs OPTIONAL fields explicitly
 * 2. Implements blocking validation for critical fields
 * 3. Provides sensible defaults for all optional fields
 * 4. Validates nested structures deeply
 * 5. Implements recovery for recoverable issues
 */

import { ModelData } from '../App';
import { SceneSettings, CameraSettings } from '../utils/storageUtils';
import { Path } from '../types/paths';
import { CollisionZone } from '../types/collision';
import { CameraPreset, CameraPath } from '../types/camera';
import { Prefab } from '../types/prefabs';
import { TerrainData } from '../types/terrain';
import { Layer } from '../types/layers';
import { DEFAULT_ENVIRONMENT } from '../types/environment';
import { generateAuthoredId } from '../utils/idUtils';

/**
 * Validation result with clear severity distinction
 */
export interface ValidationResult {
  isValid: boolean;
  blockingErrors: string[];  // Must fix before using data
  warnings: string[];         // Issues but data is usable
  recovered: boolean;          // True if data was auto-repaired
  repairs: string[];           // What was fixed
}

/**
 * Defaults for required model fields that might be missing
 */
const MODEL_FIELD_DEFAULTS = {
  type: 'model' as const,
  visible: true,
  locked: false,
  wireframe: false,
  lightIntensity: 1.0,
  castShadow: true,
  receiveShadow: true,
  opacity: 1.0,
  colorTint: '#ffffff',
  emissiveColor: '#000000',
  roughness: 0.5,
  metalness: 0,
  parentId: null,
  childrenIds: [] as string[],
  behaviorTags: [] as string[],
  classification: 'both' as const,
  metadata: {} as Record<string, any>,
  authoredId: '',  // Will be generated if missing; cannot use generateAuthoredId() here
};

const SCENE_SETTINGS_DEFAULTS = {
  gridReceiveShadow: true,
  shadowSoftness: 0.5,
};

/**
 * REQUIRED FIELDS (blocking if missing or invalid)
 * These must exist and be valid for the scene to load
 */
const REQUIRED_MODEL_FIELDS = ['id', 'name', 'position', 'rotation', 'scale'] as const;
const REQUIRED_SCENE_FIELDS = ['gridReceiveShadow', 'shadowSoftness', 'environment'] as const;

/**
 * Validate that a value is a valid 3D transform component
 */
function isValidTransform(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(v => typeof v === 'number' && isFinite(v))
  );
}

/**
 * Validate hex color format
 */
function isValidHexColor(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Validate opacity range
 */
function isValidOpacity(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value) && value >= 0 && value <= 1;
}

/**
 * Validate non-empty string
 */
function isValidString(value: unknown, minLength = 1): boolean {
  return typeof value === 'string' && value.length >= minLength;
}

/**
 * Repair a persisted model by fixing recoverable issues and filling in defaults
 */
export function repairPersistedModel(model: any): { repaired: ModelData; repairs: string[] } {
  const repairs: string[] = [];
  const repaired: any = { ...model };

  // Fix blocking issues (cannot load without these)
  if (!isValidString(repaired.id)) {
    // Generate ID if missing (fallback recovery)
    if (!repaired.id) {
      repaired.id = `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      repairs.push('Generated missing model ID');
    } else {
      // If not a valid string, use fallback
      repaired.id = String(repaired.id || `unnamed-${Date.now()}`);
      repairs.push('Coerced model ID to string');
    }
  }

  if (!isValidString(repaired.name)) {
    repaired.name = repaired.id || 'Unnamed Model';
    repairs.push('Applied default name from ID');
  }

  // Fix transforms (essential for Three.js)
  if (!isValidTransform(repaired.position)) {
    repaired.position = [0, 0, 0];
    repairs.push('Reset position to origin (invalid transform)');
  }
  if (!isValidTransform(repaired.rotation)) {
    repaired.rotation = [0, 0, 0];
    repairs.push('Reset rotation to identity (invalid transform)');
  }
  if (!isValidTransform(repaired.scale)) {
    repaired.scale = [1, 1, 1];
    repairs.push('Reset scale to identity (invalid transform)');
  }

  // Apply defaults for optional fields
  for (const [key, defaultValue] of Object.entries(MODEL_FIELD_DEFAULTS)) {
    if (repaired[key] === undefined) {
      repaired[key] = defaultValue;
      repairs.push(`Applied default for ${key}`);
    }
  }

  // Fix optional numeric fields (within valid ranges)
  if (repaired.opacity !== undefined && !isValidOpacity(repaired.opacity)) {
    const original = repaired.opacity;
    repaired.opacity = Math.max(0, Math.min(1, Number(repaired.opacity) || 1));
    repairs.push(`Clamped opacity from ${original} to [0, 1]`);
  } else if (repaired.opacity === undefined) {
    repaired.opacity = 1.0;
  }

  if (repaired.lightIntensity !== undefined && (!isFinite(repaired.lightIntensity) || repaired.lightIntensity < 0)) {
    const original = repaired.lightIntensity;
    repaired.lightIntensity = Math.max(0, isFinite(repaired.lightIntensity) ? repaired.lightIntensity : 1);
    repairs.push(`Clamped lightIntensity from ${original} to >= 0`);
  } else if (repaired.lightIntensity === undefined) {
    repaired.lightIntensity = 1.0;
  }

  // Fix optional color fields
  if (repaired.colorTint !== undefined && !isValidHexColor(repaired.colorTint)) {
    repairs.push(`Invalid colorTint format: ${repaired.colorTint}, reset to default`);
    repaired.colorTint = '#ffffff';
  } else if (repaired.colorTint === undefined) {
    repaired.colorTint = '#ffffff';
  }

  if (repaired.emissiveColor !== undefined && !isValidHexColor(repaired.emissiveColor)) {
    repairs.push(`Invalid emissiveColor format: ${repaired.emissiveColor}, reset to default`);
    repaired.emissiveColor = '#000000';
  } else if (repaired.emissiveColor === undefined) {
    repaired.emissiveColor = '#000000';
  }

  // Ensure arrays are arrays
  if (!Array.isArray(repaired.childrenIds)) {
    repaired.childrenIds = [];
    repairs.push('Coerced childrenIds to array');
  }

  if (!Array.isArray(repaired.behaviorTags)) {
    repaired.behaviorTags = [];
    repairs.push('Coerced behaviorTags to array');
  }

  // Ensure authoredId exists for round-trip support (migration for older scenes)
  if (!isValidString(repaired.authoredId)) {
    repaired.authoredId = generateAuthoredId();
    repairs.push('Generated missing authoredId for round-trip support');
  }

  return { repaired, repairs };
}

/**
 * Validate persisted model with repair capability
 */
export function validatePersistedModelWithRepair(model: any): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    blockingErrors: [],
    warnings: [],
    recovered: false,
    repairs: []
  };

  // Type check
  if (!model || typeof model !== 'object') {
    result.blockingErrors.push('Model must be an object');
    return result;
  }

  // Check required fields
  if (!isValidString((model as any).id)) {
    result.blockingErrors.push(`Model ID must be non-empty string, got: ${typeof (model as any).id}`);
  }

  if (!isValidString((model as any).name)) {
    result.blockingErrors.push(`Model name must be non-empty string, got: ${typeof (model as any).name}`);
  }

  if (!isValidTransform((model as any).position)) {
    result.blockingErrors.push(`Model position must be [number, number, number], got: ${JSON.stringify((model as any).position)}`);
  }

  if (!isValidTransform((model as any).rotation)) {
    result.blockingErrors.push(`Model rotation must be [number, number, number], got: ${JSON.stringify((model as any).rotation)}`);
  }

  if (!isValidTransform((model as any).scale)) {
    result.blockingErrors.push(`Model scale must be [number, number, number], got: ${JSON.stringify((model as any).scale)}`);
  }

  // If blocking errors, cannot proceed
  if (result.blockingErrors.length > 0) {
    result.isValid = false;
    return result;
  }

  // Validate optional fields (non-blocking)
  if ((model as any).opacity !== undefined && !isValidOpacity((model as any).opacity)) {
    result.warnings.push(`Opacity out of range [0, 1]: ${(model as any).opacity}`);
  }

  if ((model as any).colorTint !== undefined && !isValidHexColor((model as any).colorTint)) {
    result.warnings.push(`Invalid color format for colorTint: ${(model as any).colorTint}`);
  }

  if ((model as any).emissiveColor !== undefined && !isValidHexColor((model as any).emissiveColor)) {
    result.warnings.push(`Invalid color format for emissiveColor: ${(model as any).emissiveColor}`);
  }

  if ((model as any).lightIntensity !== undefined && !isFinite((model as any).lightIntensity)) {
    result.warnings.push(`lightIntensity is not finite: ${(model as any).lightIntensity}`);
  }

  // Now attempt repair
  try {
    const { repairs } = repairPersistedModel(model);
    result.repairs = repairs;
    result.recovered = repairs.length > 0;
    result.isValid = true;
  } catch (e) {
    result.blockingErrors.push(`Repair failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}

/**
 * Repair persisted scene settings
 */
export function repairSceneSettings(settings: any): { repaired: SceneSettings; repairs: string[] } {
  const repairs: string[] = [];
  const repaired: any = { ...settings };

  // Ensure gridReceiveShadow is boolean
  if (typeof repaired.gridReceiveShadow !== 'boolean') {
    repaired.gridReceiveShadow = SCENE_SETTINGS_DEFAULTS.gridReceiveShadow;
    repairs.push('Applied default for gridReceiveShadow');
  }

  // Ensure shadowSoftness is finite number
  if (!isFinite(repaired.shadowSoftness)) {
    repaired.shadowSoftness = SCENE_SETTINGS_DEFAULTS.shadowSoftness;
    repairs.push('Applied default for shadowSoftness');
  }

  // Ensure environment exists and is an object
  if (!repaired.environment || typeof repaired.environment !== 'object') {
    repaired.environment = DEFAULT_ENVIRONMENT;
    repairs.push('Applied default environment');
  }

  return { repaired, repairs };
}

/**
 * Validate scene settings with repair
 */
export function validateSceneSettingsWithRepair(settings: any): ValidationResult {
  const result: ValidationResult = {
    isValid: false,
    blockingErrors: [],
    warnings: [],
    recovered: false,
    repairs: []
  };

  if (!settings || typeof settings !== 'object') {
    result.blockingErrors.push('Scene settings must be an object');
    return result;
  }

  // Check required fields
  if (typeof settings.gridReceiveShadow !== 'boolean') {
    result.blockingErrors.push(`gridReceiveShadow must be boolean, got: ${typeof settings.gridReceiveShadow}`);
  }

  if (!isFinite(settings.shadowSoftness)) {
    result.blockingErrors.push(`shadowSoftness must be finite number, got: ${settings.shadowSoftness}`);
  }

  if (!settings.environment || typeof settings.environment !== 'object') {
    result.blockingErrors.push('environment must be an object');
  }

  if (result.blockingErrors.length > 0) {
    // Attempt repair
    try {
      const { repaired, repairs } = repairSceneSettings(settings);
      result.repairs = repairs;
      result.recovered = repairs.length > 0;
      result.isValid = true;
    } catch (e) {
      result.blockingErrors.push(`Repair failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    result.isValid = true;
  }

  return result;
}

/**
 * Validate array of paths
 */
export function validatePaths(paths: any[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    blockingErrors: [],
    warnings: [],
    recovered: false,
    repairs: []
  };

  if (!Array.isArray(paths)) {
    result.blockingErrors.push('Paths must be an array');
    return result;
  }

  paths.forEach((path, idx) => {
    if (!path.id || typeof path.id !== 'string') {
      result.warnings.push(`Path ${idx} has invalid ID`);
    }
    if (!path.width || path.width <= 0) {
      result.warnings.push(`Path ${idx} has invalid width`);
    }
    if (!Array.isArray(path.points) || path.points.length === 0) {
      result.warnings.push(`Path ${idx} has no control points`);
    }
  });

  return result;
}

/**
 * Validate array of collision zones
 */
export function validateCollisionZones(zones: any[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    blockingErrors: [],
    warnings: [],
    recovered: false,
    repairs: []
  };

  if (!Array.isArray(zones)) {
    result.blockingErrors.push('Collision zones must be an array');
    return result;
  }

  zones.forEach((zone, idx) => {
    if (!['box', 'cylinder', 'sphere'].includes(zone.shape)) {
      result.warnings.push(`Zone ${idx} has invalid shape: ${zone.shape}`);
    }
    if (!Array.isArray(zone.scale) || zone.scale.some((s: number) => s <= 0)) {
      result.warnings.push(`Zone ${idx} has invalid scale`);
    }
  });

  return result;
}

/**
 * Validate array of camera presets
 */
export function validateCameraPresets(presets: any[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    blockingErrors: [],
    warnings: [],
    recovered: false,
    repairs: []
  };

  if (!Array.isArray(presets)) {
    result.blockingErrors.push('Camera presets must be an array');
    return result;
  }

  presets.forEach((preset, idx) => {
    if (!['perspective', 'orthographic'].includes(preset.type)) {
      result.warnings.push(`Camera preset ${idx} has invalid type: ${preset.type}`);
    }
    if (preset.type === 'perspective' && preset.fov) {
      if (preset.fov < 0 || preset.fov > 180) {
        result.warnings.push(`Camera preset ${idx} has invalid FOV: ${preset.fov}`);
      }
    }
  });

  return result;
}

/**
 * Comprehensive scene state validation with repair capability
 */
export function validateAndRepairPersistedScene(sceneData: any): {
  isValid: boolean;
  issues: ValidationResult[];
  allBlockingErrors: string[];
  canLoad: boolean;
} {
  const issues: ValidationResult[] = [];
  const allBlockingErrors: string[] = [];

  // Validate models
  if (Array.isArray(sceneData.models)) {
    sceneData.models.forEach((model: any, idx: number) => {
      const modelValidation = validatePersistedModelWithRepair(model);
      if (!modelValidation.isValid) {
        modelValidation.blockingErrors.forEach(err => {
          allBlockingErrors.push(`Model ${idx}: ${err}`);
        });
      }
      issues.push(modelValidation);
    });
  }

  // Validate scene settings
  if (sceneData.sceneSettings) {
    const settingsValidation = validateSceneSettingsWithRepair(sceneData.sceneSettings);
    issues.push(settingsValidation);
    if (!settingsValidation.isValid) {
      settingsValidation.blockingErrors.forEach(err => {
        allBlockingErrors.push(`Scene Settings: ${err}`);
      });
    }
  }

  // Validate paths
  if (Array.isArray(sceneData.paths)) {
    const pathsValidation = validatePaths(sceneData.paths);
    issues.push(pathsValidation);
  }

  // Validate collision zones
  if (Array.isArray(sceneData.collisionZones)) {
    const zonesValidation = validateCollisionZones(sceneData.collisionZones);
    issues.push(zonesValidation);
  }

  // Validate camera presets
  if (Array.isArray(sceneData.cameraSettings?.presets)) {
    const camerasValidation = validateCameraPresets(sceneData.cameraSettings.presets);
    issues.push(camerasValidation);
  }

  return {
    isValid: allBlockingErrors.length === 0,
    issues,
    allBlockingErrors,
    canLoad: allBlockingErrors.length === 0
  };
}
