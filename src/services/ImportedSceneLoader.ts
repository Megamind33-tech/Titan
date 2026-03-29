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
import { EnvironmentPreset } from '../types/environment';
import { CameraPath } from '../types/camera';
import { CollisionZone } from '../types/collision';
import { Path } from '../types/paths';
import { generateAuthoredId } from '../utils/idUtils';

/**
 * Convert imported scene objects into ModelData format for editor
 */
export const loadImportedObjects = (sceneData: LoadedSceneData): ModelData[] => {
  const models: ModelData[] = [];

  if (!sceneData.objects || sceneData.objects.length === 0) {
    return models;
  }

  for (const obj of sceneData.objects) {
    const model: ModelData = {
      id: generateAuthoredId(),
      authoredId: obj.id || generateAuthoredId(),
      name: obj.name || 'Imported Object',
      url: obj.assetRef?.value || '',
      assetId: undefined,
      position: obj.transform?.position || [0, 0, 0],
      rotation: obj.transform?.rotation || [0, 0, 0],
      scale: obj.transform?.scale || [1, 1, 1],
      visible: true,
      locked: false,
      layerId: 'scene',
      type: inferModelType(obj.assetRef?.value),
      behaviorTags: obj.tags || [],
    };

    models.push(model);
  }

  return models;
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
export const loadImportedEnvironment = (
  sceneData: LoadedSceneData,
  defaultEnvironment: EnvironmentPreset
): EnvironmentPreset => {
  if (!sceneData.environment) {
    return defaultEnvironment;
  }

  // If the imported scene has an environment skybox reference,
  // try to match it against available presets
  // For now, return the default and log the imported environment data
  if (sceneData.environment.skybox) {
    console.log('[ImportedScene] Environment skybox:', sceneData.environment.skybox);
  }

  return defaultEnvironment;
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
        points: importedPath.points.map((p: any, idx: number) => ({
          id: generateAuthoredId(),
          position: p.position || [0, 0, 0],
          rotation: p.rotation || [0, 0, 0],
          timestamp: idx * 1000, // Default: 1 second per point
        })),
        duration: importedPath.points.length * 1000,
        easing: 'linear',
        autoLoop: false,
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

  return {
    projectName: sceneData.name,
    objectCount: sceneData.objects?.length || 0,
    assetCount: sceneData.assets?.length || 0,
    pathCount: sceneData.paths?.length || 0,
    environmentPresent: !!sceneData.environment?.skybox,
    sourceRepo,
    importedAt: new Date().toISOString(),
    warnings: validation.warnings,
  };
};
