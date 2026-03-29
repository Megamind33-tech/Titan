/**
 * ExportManifestValidation.ts
 *
 * Strict manifest schema definitions and preflight validators.
 *
 * CONTRACT:
 * - All fields marked "required" MUST be present and valid
 * - All fields marked "optional" MAY be absent, but if present MUST be valid
 * - Downstream consumers can trust that required fields exist and pass validation
 * - Validation failures throw with descriptive errors, never silently pass
 */

import { CameraSettings } from './storageUtils';
import { Layer } from '../types/layers';

// ─── Validation Helpers ───────────────────────────────────────────────────

const isValidHexColor = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return /^#[0-9a-fA-F]{6}$/.test(value);
};

const isValidId = (value: unknown, context: string): boolean => {
  if (typeof value !== 'string') {
    throw new Error(`${context}: ID must be string, got ${typeof value}`);
  }
  if (value.length === 0) {
    throw new Error(`${context}: ID must be non-empty`);
  }
  if (value.length > 256) {
    throw new Error(`${context}: ID exceeds maximum length (256)`);
  }
  return true;
};

const isValidString = (value: unknown, context: string, maxLength: number = 512): boolean => {
  if (typeof value !== 'string') {
    throw new Error(`${context}: must be string, got ${typeof value}`);
  }
  if (value.length === 0) {
    throw new Error(`${context}: must be non-empty`);
  }
  if (value.length > maxLength) {
    throw new Error(`${context}: exceeds maximum length (${maxLength})`);
  }
  return true;
};

const isFiniteNumber = (value: unknown, context: string, minInclusive?: number, maxInclusive?: number): boolean => {
  if (typeof value !== 'number') {
    throw new Error(`${context}: must be number, got ${typeof value}`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`${context}: must be finite, got ${value}`);
  }
  if (minInclusive !== undefined && value < minInclusive) {
    throw new Error(`${context}: must be >= ${minInclusive}, got ${value}`);
  }
  if (maxInclusive !== undefined && value > maxInclusive) {
    throw new Error(`${context}: must be <= ${maxInclusive}, got ${value}`);
  }
  return true;
};

const isValidVector3 = (value: unknown, context: string): value is [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`${context}: must be array of 3 numbers, got ${typeof value}`);
  }
  for (let i = 0; i < 3; i++) {
    if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) {
      throw new Error(`${context}[${i}]: must be finite number, got ${value[i]}`);
    }
  }
  return true;
};

const isValidPositiveScale = (scale: [number, number, number], context: string): boolean => {
  for (let i = 0; i < 3; i++) {
    if (scale[i] <= 0) {
      throw new Error(`${context}.scale[${i}]: must be positive, got ${scale[i]}`);
    }
  }
  return true;
};

// ─── Strict Schema Definitions ─────────────────────────────────────────────

/**
 * Strictly validated transform for an exported asset.
 * REQUIRED: all fields present and valid
 */
export interface StrictTransform {
  position: [number, number, number]; // finite values, any bounds
  rotation: [number, number, number]; // finite values, in radians
  scale: [number, number, number];     // all values > 0 (positive)
}

/**
 * Strictly validated material properties.
 * REQUIRED: all fields present
 * All numeric values are constrained to valid ranges.
 */
export interface StrictMaterialProperties {
  wireframe: boolean;
  lightIntensity: number;              // >= 0
  castShadow: boolean;
  receiveShadow: boolean;
  color: string;                        // valid hex #RRGGBB
  opacity: number;                      // 0.0 to 1.0
  roughness: number;                    // 0.0 to 1.0
  metalness: number;                    // 0.0 to 1.0
  emissiveColor: string;                // valid hex #RRGGBB
  texture?: string | null;              // optional file path
  presetId?: string;                    // optional, non-empty if present
  presetName?: string;                  // optional, non-empty if present
}

/**
 * Strictly validated export asset manifest.
 * Each asset in the export must pass complete validation.
 */
export interface StrictExportAssetManifest {
  id: string;                           // required, non-empty, max 256 chars
  name: string;                         // required, non-empty, max 512 chars
  type: 'model' | 'environment' | 'light' | 'camera'; // required, enum
  layerId?: string;                     // optional, non-empty if present
  visible: boolean;                     // required
  locked: boolean;                      // required
  file?: string;                        // optional file path
  transform: StrictTransform;           // required, all validated
  material: StrictMaterialProperties;   // required, all validated
  metadata?: Record<string, any>;       // optional, must be JSON-serializable
  parent?: string | null;               // optional, can be null or valid ID
  version: number;                      // required, >= 1
}

/**
 * Strictly validated lighting configuration.
 * All values constrained to valid ranges.
 */
export interface StrictLighting {
  ambient: number;                      // >= 0
  hemisphere: {
    intensity: number;                  // >= 0
    color: string;                      // valid hex
    groundColor: string;                // valid hex
  };
  directional: {
    intensity: number;                  // >= 0
    position: [number, number, number]; // finite values
  };
  shadowSoftness: number;               // >= 0
  presetId?: string;                    // optional
  presetName?: string;                  // optional
  environmentPreset?: string;           // optional
  exposure: number;                     // > 0
  toneMapping: 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic'; // enum
}

/**
 * Strictly validated scene export manifest.
 * VERSION 2.0.0 - introduces strict validation.
 *
 * GUARANTEES:
 * - version is exactly "2.0.0"
 * - exportDate is valid ISO 8601 timestamp
 * - All assets pass complete validation
 * - All asset IDs are unique
 * - All layer IDs referenced by assets exist in layers array
 * - All parent references resolve to existing assets or are null
 * - All exportSensitiveModels IDs exist in assets
 */
export interface StrictSceneExportManifest {
  version: '2.0.0';                     // fixed version, strict versioning
  exportDate: string;                   // ISO 8601 timestamp
  scene: {
    lighting: StrictLighting;           // required, all validated
    gridReceiveShadow: boolean;         // required
    camera?: CameraSettings | null;     // optional
    layers?: Layer[];                   // optional, but if present all IDs unique
  };
  assets: StrictExportAssetManifest[];  // required, at least 1 asset
  exportSensitiveModels?: string[];     // optional, all IDs exist in assets
}

// ─── Validators ────────────────────────────────────────────────────────────

/**
 * Validate a transform object.
 * @throws If any component is invalid
 */
export const validateTransform = (transform: unknown, context: string): StrictTransform => {
  if (!transform || typeof transform !== 'object') {
    throw new Error(`${context}: must be object`);
  }

  const t = transform as any;
  isValidVector3(t.position, `${context}.position`);
  isValidVector3(t.rotation, `${context}.rotation`);
  isValidVector3(t.scale, `${context}.scale`);
  isValidPositiveScale(t.scale, context);

  return {
    position: t.position as [number, number, number],
    rotation: t.rotation as [number, number, number],
    scale: t.scale as [number, number, number],
  };
};

/**
 * Validate material properties.
 * @throws If any property is invalid
 */
export const validateMaterialProperties = (
  material: unknown,
  context: string
): StrictMaterialProperties => {
  if (!material || typeof material !== 'object') {
    throw new Error(`${context}: must be object`);
  }

  const m = material as any;

  if (typeof m.wireframe !== 'boolean') {
    throw new Error(`${context}.wireframe: must be boolean`);
  }
  if (typeof m.castShadow !== 'boolean') {
    throw new Error(`${context}.castShadow: must be boolean`);
  }
  if (typeof m.receiveShadow !== 'boolean') {
    throw new Error(`${context}.receiveShadow: must be boolean`);
  }

  isFiniteNumber(m.lightIntensity, `${context}.lightIntensity`, 0);
  isFiniteNumber(m.opacity, `${context}.opacity`, 0, 1);
  isFiniteNumber(m.roughness, `${context}.roughness`, 0, 1);
  isFiniteNumber(m.metalness, `${context}.metalness`, 0, 1);

  if (!isValidHexColor(m.color)) {
    throw new Error(`${context}.color: must be valid hex color, got ${m.color}`);
  }
  if (!isValidHexColor(m.emissiveColor)) {
    throw new Error(`${context}.emissiveColor: must be valid hex color, got ${m.emissiveColor}`);
  }

  // Optional fields
  if (m.texture !== undefined && m.texture !== null && typeof m.texture !== 'string') {
    throw new Error(`${context}.texture: must be string or null`);
  }
  if (m.presetId !== undefined && m.presetId !== null) {
    isValidString(m.presetId, `${context}.presetId`);
  }
  if (m.presetName !== undefined && m.presetName !== null) {
    isValidString(m.presetName, `${context}.presetName`);
  }

  return {
    wireframe: m.wireframe,
    lightIntensity: m.lightIntensity,
    castShadow: m.castShadow,
    receiveShadow: m.receiveShadow,
    color: m.color,
    opacity: m.opacity,
    roughness: m.roughness,
    metalness: m.metalness,
    emissiveColor: m.emissiveColor,
    texture: m.texture || null,
    presetId: m.presetId,
    presetName: m.presetName,
  };
};

/**
 * Validate an asset in the export manifest.
 * @throws If any field is invalid
 */
export const validateExportAsset = (asset: unknown, context: string): StrictExportAssetManifest => {
  if (!asset || typeof asset !== 'object') {
    throw new Error(`${context}: must be object`);
  }

  const a = asset as any;

  isValidId(a.id, `${context}.id`);
  isValidString(a.name, `${context}.name`, 512);

  if (!['model', 'environment', 'light', 'camera'].includes(a.type)) {
    throw new Error(`${context}.type: must be one of model|environment|light|camera, got ${a.type}`);
  }

  if (typeof a.visible !== 'boolean') {
    throw new Error(`${context}.visible: must be boolean`);
  }
  if (typeof a.locked !== 'boolean') {
    throw new Error(`${context}.locked: must be boolean`);
  }

  if (a.layerId !== undefined && a.layerId !== null) {
    isValidString(a.layerId, `${context}.layerId`);
  }

  if (a.file !== undefined && a.file !== null && typeof a.file !== 'string') {
    throw new Error(`${context}.file: must be string or null`);
  }

  const transform = validateTransform(a.transform, `${context}.transform`);
  const material = validateMaterialProperties(a.material, `${context}.material`);

  if (a.metadata !== undefined && a.metadata !== null) {
    if (typeof a.metadata !== 'object' || Array.isArray(a.metadata)) {
      throw new Error(`${context}.metadata: must be object`);
    }
    // Verify it's JSON-serializable by attempting stringify
    try {
      JSON.stringify(a.metadata);
    } catch {
      throw new Error(`${context}.metadata: must be JSON-serializable`);
    }
  }

  if (a.parent !== undefined && a.parent !== null && typeof a.parent !== 'string') {
    throw new Error(`${context}.parent: must be string or null`);
  }

  if (typeof a.version !== 'number' || a.version < 1) {
    throw new Error(`${context}.version: must be number >= 1, got ${a.version}`);
  }

  return {
    id: a.id,
    name: a.name,
    type: a.type as 'model' | 'environment' | 'light' | 'camera',
    visible: a.visible,
    locked: a.locked,
    layerId: a.layerId,
    file: a.file,
    transform,
    material,
    metadata: a.metadata,
    parent: a.parent,
    version: a.version,
  };
};

/**
 * Validate lighting configuration.
 * @throws If any field is invalid
 */
export const validateLighting = (lighting: unknown, context: string): StrictLighting => {
  if (!lighting || typeof lighting !== 'object') {
    throw new Error(`${context}: must be object`);
  }

  const l = lighting as any;

  isFiniteNumber(l.ambient, `${context}.ambient`, 0);
  isFiniteNumber(l.shadowSoftness, `${context}.shadowSoftness`, 0);
  isFiniteNumber(l.exposure, `${context}.exposure`, 0.0001);

  // Tone mapping enum
  const validToneMappings = ['None', 'Linear', 'Reinhard', 'Cineon', 'ACESFilmic'];
  if (!validToneMappings.includes(l.toneMapping)) {
    throw new Error(
      `${context}.toneMapping: must be one of ${validToneMappings.join('|')}, got ${l.toneMapping}`
    );
  }

  // Hemisphere
  if (!l.hemisphere || typeof l.hemisphere !== 'object') {
    throw new Error(`${context}.hemisphere: must be object`);
  }
  isFiniteNumber(l.hemisphere.intensity, `${context}.hemisphere.intensity`, 0);
  if (!isValidHexColor(l.hemisphere.color)) {
    throw new Error(`${context}.hemisphere.color: must be valid hex color`);
  }
  if (!isValidHexColor(l.hemisphere.groundColor)) {
    throw new Error(`${context}.hemisphere.groundColor: must be valid hex color`);
  }

  // Directional
  if (!l.directional || typeof l.directional !== 'object') {
    throw new Error(`${context}.directional: must be object`);
  }
  isFiniteNumber(l.directional.intensity, `${context}.directional.intensity`, 0);
  isValidVector3(l.directional.position, `${context}.directional.position`);

  return {
    ambient: l.ambient,
    hemisphere: {
      intensity: l.hemisphere.intensity,
      color: l.hemisphere.color,
      groundColor: l.hemisphere.groundColor,
    },
    directional: {
      intensity: l.directional.intensity,
      position: l.directional.position,
    },
    shadowSoftness: l.shadowSoftness,
    presetId: l.presetId,
    presetName: l.presetName,
    environmentPreset: l.environmentPreset,
    exposure: l.exposure,
    toneMapping: l.toneMapping,
  };
};

/**
 * Validate the complete export manifest.
 * Performs all validation including cross-field consistency checks.
 *
 * @throws If manifest is invalid
 * @returns Validated manifest
 */
export const validateExportManifest = (manifest: unknown): StrictSceneExportManifest => {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Manifest must be object');
  }

  const m = manifest as any;

  // Version check
  if (m.version !== '2.0.0') {
    throw new Error(`manifest.version: must be exactly "2.0.0", got ${m.version}`);
  }

  // Export date validation
  if (typeof m.exportDate !== 'string') {
    throw new Error('manifest.exportDate: must be string (ISO 8601 timestamp)');
  }
  if (isNaN(Date.parse(m.exportDate))) {
    throw new Error(`manifest.exportDate: must be valid ISO 8601, got ${m.exportDate}`);
  }

  // Scene object
  if (!m.scene || typeof m.scene !== 'object') {
    throw new Error('manifest.scene: must be object');
  }

  if (typeof m.scene.gridReceiveShadow !== 'boolean') {
    throw new Error('manifest.scene.gridReceiveShadow: must be boolean');
  }

  const lighting = validateLighting(m.scene.lighting, 'manifest.scene.lighting');

  // Assets array
  if (!Array.isArray(m.assets)) {
    throw new Error('manifest.assets: must be array');
  }
  if (m.assets.length === 0) {
    throw new Error('manifest.assets: must contain at least 1 asset');
  }

  const validatedAssets: StrictExportAssetManifest[] = [];
  const assetIds = new Set<string>();

  for (let i = 0; i < m.assets.length; i++) {
    const asset = validateExportAsset(m.assets[i], `manifest.assets[${i}]`);

    // Check for duplicate IDs
    if (assetIds.has(asset.id)) {
      throw new Error(`manifest.assets[${i}]: duplicate ID "${asset.id}"`);
    }
    assetIds.add(asset.id);

    validatedAssets.push(asset);
  }

  // Layer consistency check
  if (m.scene.layers !== undefined) {
    if (!Array.isArray(m.scene.layers)) {
      throw new Error('manifest.scene.layers: must be array');
    }

    const layerIds = new Set<string>();
    for (let i = 0; i < m.scene.layers.length; i++) {
      const layerId = m.scene.layers[i].id;
      if (layerIds.has(layerId)) {
        throw new Error(`manifest.scene.layers[${i}]: duplicate layer ID "${layerId}"`);
      }
      layerIds.add(layerId);
    }

    // Check that all assets with layerId reference existing layers
    for (const asset of validatedAssets) {
      if (asset.layerId && !layerIds.has(asset.layerId)) {
        throw new Error(
          `Asset "${asset.id}": references non-existent layer "${asset.layerId}"`
        );
      }
    }
  }

  // Parent reference consistency check
  for (const asset of validatedAssets) {
    if (asset.parent && !assetIds.has(asset.parent)) {
      throw new Error(`Asset "${asset.id}": references non-existent parent "${asset.parent}"`);
    }
  }

  // Export-sensitive models consistency check
  if (m.exportSensitiveModels !== undefined) {
    if (!Array.isArray(m.exportSensitiveModels)) {
      throw new Error('manifest.exportSensitiveModels: must be array');
    }
    for (const modelId of m.exportSensitiveModels) {
      if (!assetIds.has(modelId)) {
        throw new Error(`manifest.exportSensitiveModels: references non-existent asset "${modelId}"`);
      }
    }
  }

  return {
    version: '2.0.0',
    exportDate: m.exportDate,
    scene: {
      lighting,
      gridReceiveShadow: m.scene.gridReceiveShadow,
      camera: m.scene.camera,
      layers: m.scene.layers,
    },
    assets: validatedAssets,
    exportSensitiveModels: m.exportSensitiveModels,
  };
};

/**
 * Check if data is valid for export before manifest is created.
 * Preflight validation to catch issues early.
 *
 * @param models - Models to export
 * @throws If preflight check fails with descriptive error
 * @returns true if data is exportable
 */
export const preflightValidation = (models: any[]): boolean => {
  if (!Array.isArray(models)) {
    throw new Error('Models must be array');
  }
  if (models.length === 0) {
    throw new Error('Must select at least one model to export');
  }

  // Check each model has required export fields
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const ctx = `model[${i}]`;

    // ID validation
    try {
      isValidId(model.id, `${ctx}.id`);
    } catch (e) {
      throw new Error(`${ctx}: ${(e as Error).message}`);
    }

    // Name validation
    try {
      isValidString(model.name, `${ctx}.name`);
    } catch (e) {
      throw new Error(`${ctx}: ${(e as Error).message}`);
    }

    // Transform validation
    if (!model.position || !model.rotation || !model.scale) {
      throw new Error(`${ctx}: missing transform components (position/rotation/scale)`);
    }

    try {
      isValidVector3(model.position, `${ctx}.position`);
      isValidVector3(model.rotation, `${ctx}.rotation`);
      isValidVector3(model.scale, `${ctx}.scale`);
      isValidPositiveScale(model.scale as [number, number, number], ctx);
    } catch (e) {
      throw new Error(`${ctx}: ${(e as Error).message}`);
    }

    // Type validation
    if (model.type && !['model', 'environment', 'light', 'camera'].includes(model.type)) {
      throw new Error(`${ctx}.type: invalid type "${model.type}"`);
    }

    // Layer reference (if present, just check it's a string)
    if (model.layerId && typeof model.layerId !== 'string') {
      throw new Error(`${ctx}.layerId: must be string`);
    }
  }

  return true;
};
