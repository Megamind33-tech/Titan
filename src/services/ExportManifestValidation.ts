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

import { CameraSettings } from '../utils/storageUtils';
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
 * Strictly validated material texture maps.
 * All texture map paths optional but if present must be valid.
 */
export interface StrictMaterialMaps {
  normalMap?: string | null;            // optional, normal map file path
  roughnessMap?: string | null;         // optional, roughness texture
  metalnessMap?: string | null;         // optional, metalness texture
  emissiveMap?: string | null;          // optional, emissive texture
  alphaMap?: string | null;             // optional, alpha/transparency map
  aoMap?: string | null;                // optional, ambient occlusion map
}

/**
 * Strictly validated UV transform for materials.
 */
export interface StrictMaterialUVTransform {
  tiling: [number, number];             // [u, v] tiling, all finite and positive
  offset: [number, number];             // [u, v] offset, all finite
  rotation: number;                     // rotation in radians, finite
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
  materialMaps?: StrictMaterialMaps;    // optional, advanced texture maps
  uvTransform?: StrictMaterialUVTransform; // optional, UV tiling/offset
  behaviorTags?: string[];              // optional, semantic tags (Decorative, Structural, etc.)
  classification?: 'indoor' | 'outdoor' | 'both'; // optional, location classification
  metadata?: Record<string, any>;       // optional, must be JSON-serializable
  parent?: string | null;               // optional, can be null or valid ID
  childrenIds?: string[];               // optional, array of child asset IDs
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
 * Prefab definition in export.
 * Captures template structure for runtime instantiation.
 */
export interface StrictPrefabExport {
  id: string;                           // required, non-empty
  name: string;                         // required, non-empty
  category?: string;                    // optional, prefab category
  modelIds: string[];                   // required, IDs of models in this prefab
  metadata?: Record<string, any>;       // optional, custom prefab data
}

/**
 * Path/spline definition in export.
 * Supports navigation, barriers, decorative splines.
 */
export interface StrictPathExport {
  id: string;                           // required, non-empty
  name: string;                         // required, non-empty
  type: 'walkway' | 'road' | 'river' | 'barrier' | 'fence' | 'guide'; // enum
  closed: boolean;                      // required
  width: number;                        // required, > 0
  points: Array<{
    id: string;                         // control point ID
    position: [number, number, number]; // finite position
  }>;
  materialId?: string;                  // optional, material to apply
}

/**
 * Collision zone definition in export.
 * Enforces placement rules and level design constraints.
 */
export interface StrictCollisionZoneExport {
  id: string;                           // required, non-empty
  name: string;                         // required, non-empty
  type: 'ground_surface' | 'floor' | 'no_placement' | 'walkable' | 'boundary' | 'water' | 'ad_placement' | 'flag_placement' | 'seating_barrier' | 'pool_structure_boundary' | 'camera_restricted' | 'custom';
  enabled: boolean;                     // required
  position: [number, number, number];   // required, finite
  rotation: [number, number, number];   // required, finite
  scale: [number, number, number];      // required, positive
  shape: 'box' | 'cylinder' | 'sphere'; // required, enum
  allowedTags: string[];                // required, can be empty
  blockedTags: string[];                // required, can be empty
  color?: string;                       // optional, hex color for editor
  exportToRuntime?: boolean;            // optional, should runtime consume this
}

/**
 * Terrain data in export.
 * Height and material maps for terrain rendering.
 */
export interface StrictTerrainExport {
  heightMap?: Array<number[]>;          // optional, 2D array of heights
  materialMap?: Array<string[]>;        // optional, 2D array of material IDs
  size?: number;                        // optional, grid size in units
  resolution?: number;                  // optional, number of cells
}

/**
 * Camera preset definition in export.
 * Saved camera configurations for different views.
 */
export interface StrictCameraPresetExport {
  id: string;                           // required, non-empty
  name: string;                         // required, non-empty
  type: 'perspective' | 'orthographic'; // required, enum
  position: [number, number, number];   // required, finite
  rotation: [number, number, number];   // required, finite
  target: [number, number, number];     // required, finite
  fov: number;                          // required, > 0 for perspective
  zoom?: number;                        // optional, for orthographic
  near: number;                         // required, > 0
  far: number;                          // required, > near
}

/**
 * Camera path (animation) definition in export.
 * Keyframe-based camera movement for cinematics.
 */
export interface StrictCameraPathExport {
  id: string;                           // required, non-empty
  name: string;                         // required, non-empty
  points: Array<{
    id: string;                         // keyframe ID
    position: [number, number, number]; // required, finite
    target: [number, number, number];   // required, finite
    duration: number;                   // required, >= 0, time to reach
    pause?: number;                     // optional, pause duration
    fov?: number;                       // optional, field of view
  }>;
  loop?: boolean;                       // optional, should path loop
  interpolation: 'linear' | 'smooth';   // required, interpolation type
}

/**
 * Quality settings configuration in export.
 * Performance optimization hints and constraints.
 */
export interface StrictQualitySettingsExport {
  shadowMapSize?: 512 | 1024 | 2048 | 4096; // optional
  shadowBias?: number;                  // optional, shadow mapping bias
  materialQuality?: 'low' | 'medium' | 'high'; // optional
  textureQuality?: 'low' | 'medium' | 'high'; // optional
  maxLights?: number;                   // optional, maximum light count
}

/**
 * Strictly validated scene export manifest.
 * VERSION 2.0.0 - introduces strict validation and extended content systems.
 *
 * PHASE 3 ADDITIONS (Content Completeness):
 * - Prefab definitions for structure understanding
 * - Path/spline data for navigation
 * - Collision zones for placement validation
 * - Terrain data for level structure
 * - Camera presets and paths for cinematics
 * - Quality settings for optimization hints
 * - Behavior tags and classification on assets
 * - Material texture maps (normal, roughness, metalness, etc.)
 * - Parent-child relationships and hierarchy
 *
 * GUARANTEES:
 * - version is exactly "2.0.0"
 * - exportDate is valid ISO 8601 timestamp
 * - All assets pass complete validation
 * - All asset IDs are unique
 * - All layer IDs referenced by assets exist in layers array
 * - All parent references resolve to existing assets or are null
 * - All child references are valid
 * - All prefab modelIds reference existing assets
 * - All exportSensitiveModels IDs exist in assets
 */
export interface StrictSceneExportManifest {
  version: '2.0.0';                     // fixed version, strict versioning
  exportDate: string;                   // ISO 8601 timestamp
  scene: {
    lighting: StrictLighting;           // required, all validated
    gridReceiveShadow: boolean;         // required
    camera?: CameraSettings | null;     // optional, current camera
    layers?: Layer[];                   // optional, layer definitions
  };
  assets: StrictExportAssetManifest[];  // required, at least 1 asset

  // PHASE 3: Extended content systems
  prefabs?: StrictPrefabExport[];       // optional, prefab definitions
  paths?: StrictPathExport[];           // optional, path/spline data
  collisionZones?: StrictCollisionZoneExport[]; // optional, placement zones
  terrain?: StrictTerrainExport;        // optional, terrain heightmap/materials
  cameraPresets?: StrictCameraPresetExport[]; // optional, camera library
  cameraPaths?: StrictCameraPathExport[]; // optional, camera animations
  qualitySettings?: StrictQualitySettingsExport; // optional, perf hints

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
 * Validate material texture maps (phase 3: extended materials).
 * All maps optional but if present must be valid paths.
 * @throws If any map is invalid
 */
export const validateMaterialMaps = (maps: unknown, context: string): StrictMaterialMaps => {
  if (!maps || typeof maps !== 'object') {
    return {};
  }
  const m = maps as any;
  const validated: StrictMaterialMaps = {};

  if (m.normalMap !== undefined && m.normalMap !== null && typeof m.normalMap !== 'string') {
    throw new Error(`${context}.normalMap: must be string or null`);
  }
  if (m.roughnessMap !== undefined && m.roughnessMap !== null && typeof m.roughnessMap !== 'string') {
    throw new Error(`${context}.roughnessMap: must be string or null`);
  }
  if (m.metalnessMap !== undefined && m.metalnessMap !== null && typeof m.metalnessMap !== 'string') {
    throw new Error(`${context}.metalnessMap: must be string or null`);
  }
  if (m.emissiveMap !== undefined && m.emissiveMap !== null && typeof m.emissiveMap !== 'string') {
    throw new Error(`${context}.emissiveMap: must be string or null`);
  }
  if (m.alphaMap !== undefined && m.alphaMap !== null && typeof m.alphaMap !== 'string') {
    throw new Error(`${context}.alphaMap: must be string or null`);
  }
  if (m.aoMap !== undefined && m.aoMap !== null && typeof m.aoMap !== 'string') {
    throw new Error(`${context}.aoMap: must be string or null`);
  }

  if (m.normalMap) validated.normalMap = m.normalMap;
  if (m.roughnessMap) validated.roughnessMap = m.roughnessMap;
  if (m.metalnessMap) validated.metalnessMap = m.metalnessMap;
  if (m.emissiveMap) validated.emissiveMap = m.emissiveMap;
  if (m.alphaMap) validated.alphaMap = m.alphaMap;
  if (m.aoMap) validated.aoMap = m.aoMap;

  return validated;
};

/**
 * Validate UV transform (tiling, offset, rotation).
 * @throws If any component is invalid
 */
export const validateMaterialUVTransform = (uv: unknown, context: string): StrictMaterialUVTransform => {
  if (!uv || typeof uv !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const u = uv as any;

  if (!Array.isArray(u.tiling) || u.tiling.length !== 2) {
    throw new Error(`${context}.tiling: must be array [u, v]`);
  }
  for (let i = 0; i < 2; i++) {
    if (typeof u.tiling[i] !== 'number' || !Number.isFinite(u.tiling[i]) || u.tiling[i] <= 0) {
      throw new Error(`${context}.tiling[${i}]: must be finite positive number`);
    }
  }

  if (!Array.isArray(u.offset) || u.offset.length !== 2) {
    throw new Error(`${context}.offset: must be array [u, v]`);
  }
  for (let i = 0; i < 2; i++) {
    if (typeof u.offset[i] !== 'number' || !Number.isFinite(u.offset[i])) {
      throw new Error(`${context}.offset[${i}]: must be finite number`);
    }
  }

  if (typeof u.rotation !== 'number' || !Number.isFinite(u.rotation)) {
    throw new Error(`${context}.rotation: must be finite number`);
  }

  return {
    tiling: [u.tiling[0], u.tiling[1]],
    offset: [u.offset[0], u.offset[1]],
    rotation: u.rotation,
  };
};

/**
 * Validate prefab export.
 * @throws If any field is invalid
 */
export const validatePrefabExport = (prefab: unknown, context: string): StrictPrefabExport => {
  if (!prefab || typeof prefab !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const p = prefab as any;

  isValidId(p.id, `${context}.id`);
  isValidString(p.name, `${context}.name`);

  if (!Array.isArray(p.modelIds)) {
    throw new Error(`${context}.modelIds: must be array`);
  }
  for (let i = 0; i < p.modelIds.length; i++) {
    isValidId(p.modelIds[i], `${context}.modelIds[${i}]`);
  }

  return {
    id: p.id,
    name: p.name,
    category: p.category,
    modelIds: p.modelIds,
    metadata: p.metadata,
  };
};

/**
 * Validate path/spline export.
 * @throws If any field is invalid
 */
export const validatePathExport = (path: unknown, context: string): StrictPathExport => {
  if (!path || typeof path !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const p = path as any;

  isValidId(p.id, `${context}.id`);
  isValidString(p.name, `${context}.name`);

  if (!['walkway', 'road', 'river', 'barrier', 'fence', 'guide'].includes(p.type)) {
    throw new Error(`${context}.type: must be valid path type`);
  }

  if (typeof p.closed !== 'boolean') {
    throw new Error(`${context}.closed: must be boolean`);
  }

  if (typeof p.width !== 'number' || !Number.isFinite(p.width) || p.width <= 0) {
    throw new Error(`${context}.width: must be finite positive number`);
  }

  if (!Array.isArray(p.points)) {
    throw new Error(`${context}.points: must be array`);
  }
  for (let i = 0; i < p.points.length; i++) {
    isValidId(p.points[i].id, `${context}.points[${i}].id`);
    isValidVector3(p.points[i].position, `${context}.points[${i}].position`);
  }

  return {
    id: p.id,
    name: p.name,
    type: p.type,
    closed: p.closed,
    width: p.width,
    points: p.points,
    materialId: p.materialId,
  };
};

/**
 * Validate collision zone export.
 * @throws If any field is invalid
 */
export const validateCollisionZoneExport = (zone: unknown, context: string): StrictCollisionZoneExport => {
  if (!zone || typeof zone !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const z = zone as any;

  isValidId(z.id, `${context}.id`);
  isValidString(z.name, `${context}.name`);

  if (typeof z.enabled !== 'boolean') {
    throw new Error(`${context}.enabled: must be boolean`);
  }

  isValidVector3(z.position, `${context}.position`);
  isValidVector3(z.rotation, `${context}.rotation`);
  isValidVector3(z.scale, `${context}.scale`);
  isValidPositiveScale(z.scale as [number, number, number], context);

  if (!['box', 'cylinder', 'sphere'].includes(z.shape)) {
    throw new Error(`${context}.shape: must be box|cylinder|sphere`);
  }

  if (!Array.isArray(z.allowedTags)) {
    throw new Error(`${context}.allowedTags: must be array`);
  }
  if (!Array.isArray(z.blockedTags)) {
    throw new Error(`${context}.blockedTags: must be array`);
  }

  return {
    id: z.id,
    name: z.name,
    type: z.type,
    enabled: z.enabled,
    position: z.position,
    rotation: z.rotation,
    scale: z.scale,
    shape: z.shape,
    allowedTags: z.allowedTags,
    blockedTags: z.blockedTags,
    color: z.color,
    exportToRuntime: z.exportToRuntime,
  };
};

/**
 * Validate terrain export.
 * @throws If any field is invalid
 */
export const validateTerrainExport = (terrain: unknown, context: string): StrictTerrainExport => {
  if (!terrain || typeof terrain !== 'object') {
    return {};
  }
  const t = terrain as any;

  // Terrain is optional, minimal validation
  if (t.heightMap !== undefined && !Array.isArray(t.heightMap)) {
    throw new Error(`${context}.heightMap: must be 2D array or undefined`);
  }
  if (t.materialMap !== undefined && !Array.isArray(t.materialMap)) {
    throw new Error(`${context}.materialMap: must be 2D array or undefined`);
  }
  if (t.size !== undefined) {
    isFiniteNumber(t.size, `${context}.size`, 0.1);
  }
  if (t.resolution !== undefined) {
    isFiniteNumber(t.resolution, `${context}.resolution`, 1);
  }

  return {
    heightMap: t.heightMap,
    materialMap: t.materialMap,
    size: t.size,
    resolution: t.resolution,
  };
};

/**
 * Validate camera preset export.
 * @throws If any field is invalid
 */
export const validateCameraPresetExport = (preset: unknown, context: string): StrictCameraPresetExport => {
  if (!preset || typeof preset !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const p = preset as any;

  isValidId(p.id, `${context}.id`);
  isValidString(p.name, `${context}.name`);

  if (!['perspective', 'orthographic'].includes(p.type)) {
    throw new Error(`${context}.type: must be perspective|orthographic`);
  }

  isValidVector3(p.position, `${context}.position`);
  isValidVector3(p.rotation, `${context}.rotation`);
  isValidVector3(p.target, `${context}.target`);

  if (p.type === 'perspective') {
    isFiniteNumber(p.fov, `${context}.fov`, 0.1, 179);
  }
  if (p.zoom !== undefined) {
    isFiniteNumber(p.zoom, `${context}.zoom`, 0.1);
  }

  isFiniteNumber(p.near, `${context}.near`, 0.01);
  isFiniteNumber(p.far, `${context}.far`, p.near);

  return {
    id: p.id,
    name: p.name,
    type: p.type,
    position: p.position,
    rotation: p.rotation,
    target: p.target,
    fov: p.fov,
    zoom: p.zoom,
    near: p.near,
    far: p.far,
  };
};

/**
 * Validate camera path export.
 * @throws If any field is invalid
 */
export const validateCameraPathExport = (path: unknown, context: string): StrictCameraPathExport => {
  if (!path || typeof path !== 'object') {
    throw new Error(`${context}: must be object`);
  }
  const p = path as any;

  isValidId(p.id, `${context}.id`);
  isValidString(p.name, `${context}.name`);

  if (!Array.isArray(p.points)) {
    throw new Error(`${context}.points: must be array`);
  }
  for (let i = 0; i < p.points.length; i++) {
    const pt = p.points[i];
    isValidId(pt.id, `${context}.points[${i}].id`);
    isValidVector3(pt.position, `${context}.points[${i}].position`);
    isValidVector3(pt.target, `${context}.points[${i}].target`);
    isFiniteNumber(pt.duration, `${context}.points[${i}].duration`, 0);
    if (pt.pause !== undefined) {
      isFiniteNumber(pt.pause, `${context}.points[${i}].pause`, 0);
    }
    if (pt.fov !== undefined) {
      isFiniteNumber(pt.fov, `${context}.points[${i}].fov`, 0.1);
    }
  }

  if (!['linear', 'smooth'].includes(p.interpolation)) {
    throw new Error(`${context}.interpolation: must be linear|smooth`);
  }

  return {
    id: p.id,
    name: p.name,
    points: p.points,
    loop: p.loop,
    interpolation: p.interpolation,
  };
};

/**
 * Validate quality settings export.
 * @throws If any field is invalid
 */
export const validateQualitySettingsExport = (quality: unknown, context: string): StrictQualitySettingsExport => {
  if (!quality || typeof quality !== 'object') {
    return {};
  }
  const q = quality as any;

  if (q.shadowMapSize !== undefined && ![512, 1024, 2048, 4096].includes(q.shadowMapSize)) {
    throw new Error(`${context}.shadowMapSize: must be 512|1024|2048|4096`);
  }

  if (q.shadowBias !== undefined) {
    isFiniteNumber(q.shadowBias, `${context}.shadowBias`);
  }

  if (q.materialQuality !== undefined && !['low', 'medium', 'high'].includes(q.materialQuality)) {
    throw new Error(`${context}.materialQuality: must be low|medium|high`);
  }

  if (q.textureQuality !== undefined && !['low', 'medium', 'high'].includes(q.textureQuality)) {
    throw new Error(`${context}.textureQuality: must be low|medium|high`);
  }

  if (q.maxLights !== undefined) {
    isFiniteNumber(q.maxLights, `${context}.maxLights`, 1);
  }

  return {
    shadowMapSize: q.shadowMapSize,
    shadowBias: q.shadowBias,
    materialQuality: q.materialQuality,
    textureQuality: q.textureQuality,
    maxLights: q.maxLights,
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

  // Phase 3: Material maps and UV transforms
  const materialMaps = a.materialMaps ? validateMaterialMaps(a.materialMaps, `${context}.materialMaps`) : undefined;
  const uvTransform = a.uvTransform ? validateMaterialUVTransform(a.uvTransform, `${context}.uvTransform`) : undefined;

  // Phase 3: Behavior tags (optional semantic tags)
  if (a.behaviorTags !== undefined && !Array.isArray(a.behaviorTags)) {
    throw new Error(`${context}.behaviorTags: must be array of strings`);
  }

  // Phase 3: Classification (indoor/outdoor/both)
  if (a.classification !== undefined && !['indoor', 'outdoor', 'both'].includes(a.classification)) {
    throw new Error(`${context}.classification: must be indoor|outdoor|both`);
  }

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

  // Phase 3: Children IDs (for hierarchy support)
  if (a.childrenIds !== undefined && !Array.isArray(a.childrenIds)) {
    throw new Error(`${context}.childrenIds: must be array of IDs`);
  }
  if (a.childrenIds) {
    for (let i = 0; i < a.childrenIds.length; i++) {
      isValidId(a.childrenIds[i], `${context}.childrenIds[${i}]`);
    }
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
    materialMaps,
    uvTransform,
    behaviorTags: a.behaviorTags,
    classification: a.classification,
    metadata: a.metadata,
    parent: a.parent,
    childrenIds: a.childrenIds,
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

  // Phase 3: Children reference consistency check
  for (const asset of validatedAssets) {
    if (asset.childrenIds) {
      for (const childId of asset.childrenIds) {
        if (!assetIds.has(childId)) {
          throw new Error(`Asset "${asset.id}": references non-existent child "${childId}"`);
        }
      }
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

  // Phase 3: Prefabs validation
  let validatedPrefabs: StrictPrefabExport[] | undefined;
  if (m.prefabs !== undefined) {
    if (!Array.isArray(m.prefabs)) {
      throw new Error('manifest.prefabs: must be array');
    }
    validatedPrefabs = [];
    const prefabIds = new Set<string>();

    for (let i = 0; i < m.prefabs.length; i++) {
      const prefab = validatePrefabExport(m.prefabs[i], `manifest.prefabs[${i}]`);

      if (prefabIds.has(prefab.id)) {
        throw new Error(`manifest.prefabs[${i}]: duplicate ID "${prefab.id}"`);
      }
      prefabIds.add(prefab.id);

      // Validate all model IDs exist in assets
      for (const modelId of prefab.modelIds) {
        if (!assetIds.has(modelId)) {
          throw new Error(`Prefab "${prefab.id}": references non-existent model "${modelId}"`);
        }
      }

      validatedPrefabs.push(prefab);
    }
  }

  // Phase 3: Paths validation
  let validatedPaths: StrictPathExport[] | undefined;
  if (m.paths !== undefined) {
    if (!Array.isArray(m.paths)) {
      throw new Error('manifest.paths: must be array');
    }
    validatedPaths = [];
    const pathIds = new Set<string>();

    for (let i = 0; i < m.paths.length; i++) {
      const path = validatePathExport(m.paths[i], `manifest.paths[${i}]`);

      if (pathIds.has(path.id)) {
        throw new Error(`manifest.paths[${i}]: duplicate ID "${path.id}"`);
      }
      pathIds.add(path.id);

      validatedPaths.push(path);
    }
  }

  // Phase 3: Collision zones validation
  let validatedZones: StrictCollisionZoneExport[] | undefined;
  if (m.collisionZones !== undefined) {
    if (!Array.isArray(m.collisionZones)) {
      throw new Error('manifest.collisionZones: must be array');
    }
    validatedZones = [];
    const zoneIds = new Set<string>();

    for (let i = 0; i < m.collisionZones.length; i++) {
      const zone = validateCollisionZoneExport(m.collisionZones[i], `manifest.collisionZones[${i}]`);

      if (zoneIds.has(zone.id)) {
        throw new Error(`manifest.collisionZones[${i}]: duplicate ID "${zone.id}"`);
      }
      zoneIds.add(zone.id);

      validatedZones.push(zone);
    }
  }

  // Phase 3: Terrain validation
  const validatedTerrain = m.terrain ? validateTerrainExport(m.terrain, 'manifest.terrain') : undefined;

  // Phase 3: Camera presets validation
  let validatedCameraPresets: StrictCameraPresetExport[] | undefined;
  if (m.cameraPresets !== undefined) {
    if (!Array.isArray(m.cameraPresets)) {
      throw new Error('manifest.cameraPresets: must be array');
    }
    validatedCameraPresets = [];
    const presetIds = new Set<string>();

    for (let i = 0; i < m.cameraPresets.length; i++) {
      const preset = validateCameraPresetExport(m.cameraPresets[i], `manifest.cameraPresets[${i}]`);

      if (presetIds.has(preset.id)) {
        throw new Error(`manifest.cameraPresets[${i}]: duplicate ID "${preset.id}"`);
      }
      presetIds.add(preset.id);

      validatedCameraPresets.push(preset);
    }
  }

  // Phase 3: Camera paths validation
  let validatedCameraPaths: StrictCameraPathExport[] | undefined;
  if (m.cameraPaths !== undefined) {
    if (!Array.isArray(m.cameraPaths)) {
      throw new Error('manifest.cameraPaths: must be array');
    }
    validatedCameraPaths = [];
    const pathIds = new Set<string>();

    for (let i = 0; i < m.cameraPaths.length; i++) {
      const path = validateCameraPathExport(m.cameraPaths[i], `manifest.cameraPaths[${i}]`);

      if (pathIds.has(path.id)) {
        throw new Error(`manifest.cameraPaths[${i}]: duplicate ID "${path.id}"`);
      }
      pathIds.add(path.id);

      validatedCameraPaths.push(path);
    }
  }

  // Phase 3: Quality settings validation
  const validatedQuality = m.qualitySettings ? validateQualitySettingsExport(m.qualitySettings, 'manifest.qualitySettings') : undefined;

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
    prefabs: validatedPrefabs,
    paths: validatedPaths,
    collisionZones: validatedZones,
    terrain: validatedTerrain,
    cameraPresets: validatedCameraPresets,
    cameraPaths: validatedCameraPaths,
    qualitySettings: validatedQuality,
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
