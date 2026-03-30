/**
 * Imported Scene Data Loader
 *
 * Converts imported SWIM26 scene data (from GitHub) into Titan editor format.
 * Handles object hierarchy, asset references, environment, and paths.
 *
 * Scope: Transform imported LoadedSceneData into usable editor state
 */

import { LoadedSceneData } from './Swim26ManifestLoader';
import { ModelData } from '../App';
import { DEFAULT_ENVIRONMENT, EnvironmentPreset, OUTDOOR_SUNSET, POOL_COMPETITION, POOL_INDOOR_BRIGHT } from '../types/environment';
import { CameraPath } from '../types/camera';
import { CollisionZone } from '../types/collision';
import { Path } from '../types/paths';
import { generateAuthoredId } from '../utils/idUtils';

type ObjectPreviewResolution =
  | { ok: true; url: string; normalizedFrom: string }
  | { ok: false; reason: string; normalizedFrom?: string };

export interface ImportedObjectDiagnostics {
  previewReadyCount: number;
  unresolvedCount: number;
  warnings: string[];
}

const PREVIEWABLE_ASSET_EXTENSIONS = ['.glb', '.gltf', '.obj', '.fbx'];

const toTuple3 = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  const [x, y, z] = value;
  if (![x, y, z].every(v => typeof v === 'number' && Number.isFinite(v))) return fallback;
  return [x, y, z];
};

const isPreviewableAssetPath = (value: string): boolean => {
  const clean = value.split('?')[0].split('#')[0].toLowerCase();
  return PREVIEWABLE_ASSET_EXTENSIONS.some(ext => clean.endsWith(ext));
};

const parseGitHubRootPath = (rootPath?: string): { owner: string; repo: string; branch: string } | null => {
  if (!rootPath || !rootPath.startsWith('github:')) return null;
  const withoutPrefix = rootPath.replace('github:', '');
  const [repoPath, branch = 'main'] = withoutPrefix.split('#');
  const [owner, repo] = repoPath.split('/');
  if (!owner || !repo) return null;
  return { owner, repo, branch };
};

const resolvePreviewUrl = (rawAssetRef: unknown, rootPath?: string): ObjectPreviewResolution => {
  if (typeof rawAssetRef !== 'string') {
    return { ok: false, reason: 'Asset reference is missing or not a string.' };
  }

  const trimmed = rawAssetRef.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Asset reference is empty.' };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    if (!isPreviewableAssetPath(trimmed)) {
      return { ok: false, reason: `Asset URL is not a previewable 3D format: "${trimmed}".`, normalizedFrom: trimmed };
    }
    return { ok: true, url: trimmed, normalizedFrom: trimmed };
  }

  if (trimmed.startsWith('/')) {
    if (!isPreviewableAssetPath(trimmed)) {
      return { ok: false, reason: `Absolute asset path is not a previewable 3D format: "${trimmed}".`, normalizedFrom: trimmed };
    }
    return { ok: true, url: trimmed, normalizedFrom: trimmed };
  }

  const normalizedRelative = trimmed.replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (!isPreviewableAssetPath(normalizedRelative)) {
    return {
      ok: false,
      reason: `Relative asset path is not a previewable 3D format: "${trimmed}".`,
      normalizedFrom: normalizedRelative,
    };
  }

  if (normalizedRelative.startsWith('assets/')) {
    return { ok: true, url: `/${normalizedRelative}`, normalizedFrom: normalizedRelative };
  }

  const githubRoot = parseGitHubRootPath(rootPath);
  if (!githubRoot) {
    return {
      ok: false,
      reason: `Relative asset path "${trimmed}" cannot be resolved without GitHub repo metadata.`,
      normalizedFrom: normalizedRelative,
    };
  }

  const rawUrl = `https://raw.githubusercontent.com/${githubRoot.owner}/${githubRoot.repo}/${githubRoot.branch}/${normalizedRelative}`;
  return { ok: true, url: rawUrl, normalizedFrom: normalizedRelative };
};

const resolveImportedObjectModels = (sceneData: LoadedSceneData): { models: ModelData[]; diagnostics: ImportedObjectDiagnostics } => {
  const models: ModelData[] = [];
  const warnings: string[] = [];
  let previewReadyCount = 0;
  let unresolvedCount = 0;

  for (const obj of sceneData.objects || []) {
    const resolution = resolvePreviewUrl(obj.assetRef?.value, sceneData.metadata.rootPath);
    if (resolution.ok === false) {
      unresolvedCount += 1;
      warnings.push(`${obj.name || obj.id || 'Imported Object'}: ${resolution.reason}`);
      continue;
    }

    previewReadyCount += 1;
    const model: ModelData = {
      id: generateAuthoredId(),
      authoredId: obj.id || generateAuthoredId(),
      name: obj.name || 'Imported Object',
      url: resolution.url,
      assetId: undefined,
      position: toTuple3(obj.transform?.position, [0, 0, 0]),
      rotation: toTuple3(obj.transform?.rotation, [0, 0, 0]),
      scale: toTuple3(obj.transform?.scale, [1, 1, 1]),
      visible: true,
      locked: false,
      layerId: 'scene',
      type: inferModelType(resolution.url),
      behaviorTags: obj.tags || [],
    };

    models.push(model);
  }

  return {
    models,
    diagnostics: {
      previewReadyCount,
      unresolvedCount,
      warnings,
    },
  };
};

/**
 * Convert imported scene objects into ModelData format for editor
 */
export const loadImportedObjects = (sceneData: LoadedSceneData): ModelData[] => {
  const resolved = resolveImportedObjectModels(sceneData);
  if (resolved.diagnostics.warnings.length > 0) {
    console.warn('[ImportedScene] Asset preview resolution warnings:', resolved.diagnostics.warnings);
  }
  return resolved.models;
};

/**
 * Infer model type from asset reference
 */
const inferModelType = (assetUrl?: string): 'model' | 'environment' | 'light' | 'camera' => {
  if (!assetUrl) return 'model';

  const lower = assetUrl.toLowerCase();
  if (lower.includes('skybox') || lower.includes('environment')) return 'environment';
  if (lower.includes('light')) return 'light';
  if (lower.includes('camera')) return 'camera';

  return 'model';
};

/**
 * Load imported environment preset
 */
type ImportEnvironmentDiagnostics = {
  applied: string[];
  approximated: string[];
  unsupported: string[];
  warnings: string[];
};

const SUPPORTED_ENVIRONMENT_PRESETS: EnvironmentPreset['environmentPreset'][] = [
  'apartment', 'city', 'forest', 'dawn', 'night', 'warehouse', 'sunset', 'park', 'studio', 'lobby',
];

const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#[\da-fA-F]{3}$/.test(normalized) || /^#[\da-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return null;
};

const resolveImportedEnvironment = (
  importedEnvironment: unknown,
  defaultEnvironment: EnvironmentPreset
): { environment: EnvironmentPreset; diagnostics: ImportEnvironmentDiagnostics } => {
  const diagnostics: ImportEnvironmentDiagnostics = {
    applied: [],
    approximated: [],
    unsupported: [],
    warnings: [],
  };

  if (!importedEnvironment || typeof importedEnvironment !== 'object') {
    diagnostics.warnings.push('No importable environment payload was found. Using the current editor environment.');
    return { environment: defaultEnvironment, diagnostics };
  }

  const env = importedEnvironment as Record<string, unknown>;
  const nextEnvironment: EnvironmentPreset = { ...defaultEnvironment };

  const importedPresetId = typeof env.presetId === 'string' ? env.presetId : undefined;
  if (importedPresetId) {
    const presetMatch = [POOL_COMPETITION, POOL_INDOOR_BRIGHT, OUTDOOR_SUNSET].find(p => p.id === importedPresetId);
    if (presetMatch) {
      Object.assign(nextEnvironment, presetMatch);
      diagnostics.applied.push(`presetId "${importedPresetId}"`);
    } else {
      diagnostics.approximated.push(`presetId "${importedPresetId}"`);
      diagnostics.warnings.push(`Environment preset "${importedPresetId}" is not built in. Keeping current lighting defaults.`);
    }
  }

  const colorCandidate = normalizeHexColor(env.clearColor) || normalizeHexColor(env.skyColor) || normalizeHexColor(env.backgroundColor);
  if (colorCandidate) {
    nextEnvironment.backgroundType = 'color';
    nextEnvironment.backgroundColor = colorCandidate;
    diagnostics.applied.push('background color');
  } else if (env.clearColor || env.skyColor || env.backgroundColor) {
    diagnostics.approximated.push('background color');
    diagnostics.warnings.push('Imported environment color is not a supported hex value. Kept current background color.');
  }

  const intensityCandidate = typeof env.intensity === 'number'
    ? env.intensity
    : (typeof env.environmentIntensity === 'number' ? env.environmentIntensity : null);
  if (typeof intensityCandidate === 'number' && Number.isFinite(intensityCandidate)) {
    nextEnvironment.environmentIntensity = Math.max(0, intensityCandidate);
    diagnostics.applied.push('environment intensity');
  }

  const skybox = typeof env.skybox === 'string' ? env.skybox.trim() : '';
  if (skybox) {
    const presetFromSkybox = SUPPORTED_ENVIRONMENT_PRESETS.find(preset =>
      skybox.toLowerCase().includes(preset.toLowerCase())
    );
    if (presetFromSkybox) {
      nextEnvironment.backgroundType = 'preset';
      nextEnvironment.environmentPreset = presetFromSkybox;
      diagnostics.applied.push(`skybox preset "${presetFromSkybox}"`);
      diagnostics.approximated.push(`skybox reference "${skybox}"`);
      diagnostics.warnings.push(`Skybox "${skybox}" mapped to preset "${presetFromSkybox}" (approximation).`);
    } else {
      diagnostics.unsupported.push(`skybox reference "${skybox}"`);
      diagnostics.warnings.push(`Skybox "${skybox}" cannot be loaded directly in Titan editor. Preserving imported colors/intensity only.`);
    }
  }

  const fog = env.fog;
  if (fog && typeof fog === 'object') {
    const fogRecord = fog as Record<string, unknown>;
    if (typeof fogRecord.enabled === 'boolean') {
      nextEnvironment.fogEnabled = fogRecord.enabled;
      diagnostics.applied.push('fog enabled');
    }
    if (typeof fogRecord.density === 'number' && Number.isFinite(fogRecord.density)) {
      nextEnvironment.fogDensity = Math.max(0, fogRecord.density);
      nextEnvironment.fogType = 'exp2';
      diagnostics.applied.push('fog density');
    }
  }

  if (diagnostics.applied.length === 0 && diagnostics.approximated.length === 0 && diagnostics.unsupported.length === 0) {
    diagnostics.warnings.push('Environment payload was present but had no supported fields. Using current editor environment.');
  }

  return { environment: nextEnvironment, diagnostics };
};

export const loadImportedEnvironment = (
  sceneData: LoadedSceneData,
  defaultEnvironment: EnvironmentPreset
): EnvironmentPreset => {
  if (!sceneData.environment) {
    return defaultEnvironment;
  }

  const { environment, diagnostics } = resolveImportedEnvironment(sceneData.environment, defaultEnvironment);
  if (diagnostics.warnings.length > 0 || diagnostics.applied.length > 0) {
    console.log('[ImportedScene] Environment mapping result:', diagnostics);
  }
  return environment;
};

/**
 * Load imported camera paths
 */
export const loadImportedPaths = (sceneData: LoadedSceneData): CameraPath[] => {
  const paths: CameraPath[] = [];

  if (!sceneData.paths || sceneData.paths.length === 0) {
    return paths;
  }

  for (const importedPath of sceneData.paths) {
    if (importedPath.type === 'camera' && importedPath.points) {
      const cameraPath: CameraPath = {
        id: generateAuthoredId(),
        name: importedPath.name || 'Imported Camera Path',
        category: 'Cinematic Showcase',
        points: (importedPath.points as any[]).map((point: any, idx: number) => {
          return ({
            id: generateAuthoredId(),
            position: toTuple3(point.position, [0, 0, 0]),
            target: toTuple3(point.target, [0, 0, 0]),
            duration: idx === 0 ? 0 : 1000,
          });
        }),
        loop: false,
        interpolation: 'smooth',
      };

      paths.push(cameraPath);
    }
  }

  return paths;
};

/**
 * Load imported collision zones
 */
export const loadImportedCollisionZones = (sceneData: LoadedSceneData): CollisionZone[] => {
  // Note: LoadedSceneData doesn't currently export collision zones,
  // but this is prepared for future manifest versions that do
  return [];
};

/**
 * Validate imported scene data for completeness
 */
export const validateImportedSceneData = (
  sceneData: LoadedSceneData
): { valid: boolean; issues: string[]; warnings: string[] } => {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!sceneData.name) {
    issues.push('Scene has no name');
  }

  if (!sceneData.objects || sceneData.objects.length === 0) {
    warnings.push('Scene has no objects');
  }

  // Check for objects with missing asset references
  const objectsWithoutAssets = sceneData.objects?.filter(o => !o.assetRef?.value) || [];
  if (objectsWithoutAssets.length > 0) {
    warnings.push(`${objectsWithoutAssets.length} object(s) have no asset reference`);
  }

  // Check for broken asset URLs
  const brokenAssets = sceneData.assets?.filter(a =>
    a.url && !a.url.match(/^https?:\/\//) && !a.url.match(/^assets\//)
  ) || [];
  if (brokenAssets.length > 0) {
    warnings.push(`${brokenAssets.length} asset reference(s) may be broken or inaccessible`);
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
};

/**
 * Summary of what was imported from a GitHub repo
 */
export interface ImportedSceneSummary {
  projectName: string;
  objectCount: number;
  previewReadyObjectCount: number;
  unresolvedObjectCount: number;
  assetCount: number;
  pathCount: number;
  environmentPresent: boolean;
  sourceRepo: string;
  importedAt: string;
  warnings: string[];
}

/**
 * Create a summary of what was imported
 */
export const createImportSummary = (
  sceneData: LoadedSceneData,
  sourceRepo: string
): ImportedSceneSummary => {
  const validation = validateImportedSceneData(sceneData);
  const objectResolution = resolveImportedObjectModels(sceneData);

  return {
    projectName: sceneData.name,
    objectCount: sceneData.objects?.length || 0,
    previewReadyObjectCount: objectResolution.diagnostics.previewReadyCount,
    unresolvedObjectCount: objectResolution.diagnostics.unresolvedCount,
    assetCount: sceneData.assets?.length || 0,
    pathCount: sceneData.paths?.length || 0,
    environmentPresent: !!(sceneData.environment && Object.keys(sceneData.environment).length > 0),
    sourceRepo,
    importedAt: new Date().toISOString(),
    warnings: [
      ...validation.warnings,
      ...objectResolution.diagnostics.warnings,
      ...(sceneData.environment
        ? resolveImportedEnvironment(sceneData.environment, DEFAULT_ENVIRONMENT).diagnostics.warnings
        : []),
    ],
  };
};
