/**
 * SWIM26 Manifest Loader
 *
 * Loads and parses SWIM26 manifest files from GitHub imports.
 * Extracts scene structure, assets, environment, paths, and metadata.
 * Does NOT import code, runtime systems, or gameplay logic.
 *
 * Scope: Safe parsing of JSON manifest data only.
 */

import { ProjectMetadataProbe } from '../types/projectAdapter';
import { GitHubFileContent } from '../types/gitHubConnector';

/**
 * Parsed SWIM26 manifest structure
 */
export interface Swim26ManifestData {
  version: string;
  type: string;
  projectType?: string;
  authoredBy?: string;
  sceneInfo?: {
    name: string;
    description?: string;
    version?: string;
  };
  objects?: Array<{
    id: string;
    authoredId?: string;
    name: string;
    assetRef?: {
      type: 'url' | 'library' | 'embedded';
      value: string;
    };
    transform?: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    };
    tags?: string[];
    metadata?: Record<string, any>;
  }>;
  environment?: {
    skybox?: string;
    fog?: { enabled: boolean; density?: number };
    lighting?: { intensity?: number };
  };
  paths?: Array<{
    id: string;
    name: string;
    type: 'camera' | 'walkway' | 'other';
    points: Array<{ position: [number, number, number] }>;
  }>;
  collisionZones?: Array<{
    id: string;
    name: string;
    bounds: { min: [number, number, number]; max: [number, number, number] };
  }>;
  authoredContent?: {
    sceneInfo?: any;
    objects?: any[];
    environment?: any;
    paths?: any[];
  };
}

/**
 * Asset reference extracted from manifest
 */
export interface AssetReference {
  url: string;
  name: string;
  type?: 'model' | 'texture' | 'environment';
  metadata?: Record<string, any>;
}

/**
 * Loaded scene data
 */
export interface LoadedSceneData {
  name: string;
  description?: string;
  version?: string;
  objects: Array<{
    id: string;
    name: string;
    assetRef?: { type: string; value: string };
    transform?: any;
    tags?: string[];
  }>;
  assets: AssetReference[];
  environment?: any;
  paths?: any[];
  metadata: ProjectMetadataProbe;
}

/**
 * Loader error type
 */
export interface ManifestLoaderError {
  type: 'INVALID_JSON' | 'INVALID_STRUCTURE' | 'MISSING_DATA' | 'UNSUPPORTED_VERSION';
  message: string;
  path?: string;
}

export const SUPPORTED_SWIM26_MANIFEST_VERSIONS = ['1.0.0', '1.1.0'] as const;

/**
 * Load and parse SWIM26 manifest file
 */
export const loadSwim26Manifest = (
  fileContent: GitHubFileContent
): { data: Swim26ManifestData | null; errors: ManifestLoaderError[] } => {
  const errors: ManifestLoaderError[] = [];

  try {
    const data = JSON.parse(fileContent.content) as any;

    // Basic validation
    if (!data.type || !data.type.includes('swim26')) {
      errors.push({
        type: 'INVALID_STRUCTURE',
        message: `Invalid manifest type: "${data.type}". Expected "swim26.scene-manifest" or similar.`,
        path: fileContent.path,
      });
    }

    if (!data.version || typeof data.version !== 'string') {
      errors.push({
        type: 'MISSING_DATA',
        message: 'Manifest is missing a valid string version field.',
        path: fileContent.path,
      });
    } else if (!SUPPORTED_SWIM26_MANIFEST_VERSIONS.includes(data.version as typeof SUPPORTED_SWIM26_MANIFEST_VERSIONS[number])) {
      errors.push({
        type: 'UNSUPPORTED_VERSION',
        message: `Unsupported manifest version "${data.version}". Supported versions: ${SUPPORTED_SWIM26_MANIFEST_VERSIONS.join(', ')}`,
        path: fileContent.path,
      });
    }

    return { data: data as Swim26ManifestData, errors };
  } catch (error) {
    errors.push({
      type: 'INVALID_JSON',
      message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      path: fileContent.path,
    });
    return { data: null, errors };
  }
};

/**
 * Load babylon.config.json
 */
export const loadBabylonConfig = (
  fileContent: GitHubFileContent
): { data: any; errors: ManifestLoaderError[] } => {
  const errors: ManifestLoaderError[] = [];

  try {
    const data = JSON.parse(fileContent.content) as any;
    return { data, errors };
  } catch (error) {
    errors.push({
      type: 'INVALID_JSON',
      message: `Failed to parse babylon.config.json: ${error instanceof Error ? error.message : String(error)}`,
      path: fileContent.path,
    });
    return { data: null, errors };
  }
};

/**
 * Load swim26.config.json
 */
export const loadSwim26Config = (
  fileContent: GitHubFileContent
): { data: any; errors: ManifestLoaderError[] } => {
  const errors: ManifestLoaderError[] = [];

  try {
    const data = JSON.parse(fileContent.content) as any;
    return { data, errors };
  } catch (error) {
    errors.push({
      type: 'INVALID_JSON',
      message: `Failed to parse swim26.config.json: ${error instanceof Error ? error.message : String(error)}`,
      path: fileContent.path,
    });
    return { data: null, errors };
  }
};

/**
 * Extract asset references from manifest
 */
export const extractAssetReferences = (manifest: Swim26ManifestData): AssetReference[] => {
  const assets: AssetReference[] = [];
  const seen = new Set<string>();

  // Extract from objects
  const objects = manifest.authoredContent?.objects || manifest.objects || [];
  for (const obj of objects) {
    if (obj.assetRef && obj.assetRef.value && !seen.has(obj.assetRef.value)) {
      seen.add(obj.assetRef.value);
      assets.push({
        url: obj.assetRef.value,
        name: obj.name || 'Unknown',
        type: inferAssetType(obj.assetRef.value),
        metadata: obj.metadata,
      });
    }
  }

  // Extract from environment
  const env = manifest.authoredContent?.environment || manifest.environment;
  if (env?.skybox) {
    assets.push({
      url: env.skybox,
      name: 'Environment Skybox',
      type: 'environment',
    });
  }

  return assets;
};

/**
 * Infer asset type from URL
 */
const inferAssetType = (url: string): 'model' | 'texture' | 'environment' => {
  const lower = url.toLowerCase();
  if (lower.includes('skybox') || lower.includes('environment')) return 'environment';
  if (lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg')) return 'texture';
  return 'model';
};

/**
 * Extract scene name and metadata
 */
export const extractSceneInfo = (
  manifest: Swim26ManifestData
): { name: string; description?: string; version?: string } => {
  const sceneInfo = manifest.authoredContent?.sceneInfo || manifest.sceneInfo;

  return {
    name: sceneInfo?.name || manifest.version || 'Imported Scene',
    description: sceneInfo?.description,
    version: sceneInfo?.version || manifest.version,
  };
};

/**
 * Extract objects from manifest
 */
export const extractObjects = (manifest: Swim26ManifestData): any[] => {
  return manifest.authoredContent?.objects || manifest.objects || [];
};

/**
 * Extract environment settings
 */
export const extractEnvironment = (manifest: Swim26ManifestData): any => {
  return manifest.authoredContent?.environment || manifest.environment;
};

/**
 * Extract paths from manifest
 */
export const extractPaths = (manifest: Swim26ManifestData): any[] => {
  return manifest.authoredContent?.paths || manifest.paths || [];
};

/**
 * Extract collision zones
 */
export const extractCollisionZones = (manifest: Swim26ManifestData): any[] => {
  return manifest.collisionZones || [];
};

/**
 * Build LoadedSceneData from manifest
 */
export const buildSceneDataFromManifest = (
  manifest: Swim26ManifestData,
  sourceMetadata: ProjectMetadataProbe
): LoadedSceneData => {
  const sceneInfo = extractSceneInfo(manifest);
  const objects = extractObjects(manifest);
  const assets = extractAssetReferences(manifest);
  const environment = extractEnvironment(manifest);
  const paths = extractPaths(manifest);

  return {
    name: sceneInfo.name,
    description: sceneInfo.description,
    version: sceneInfo.version,
    objects: objects.map(obj => ({
      id: obj.id || obj.authoredId,
      name: obj.name,
      assetRef: obj.assetRef,
      transform: obj.transform,
      tags: obj.tags,
    })),
    assets,
    environment,
    paths,
    metadata: {
      ...sourceMetadata,
      packageName: sourceMetadata.packageName || sceneInfo.name,
    },
  };
};

/**
 * Validate manifest for completeness
 */
export const validateManifest = (manifest: Swim26ManifestData): {
  valid: boolean;
  issues: string[];
  warnings: string[];
} => {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!manifest.type) {
    issues.push('Missing required field: type');
  }

  if (!manifest.version) {
    issues.push('Missing required field: version');
  } else if (!SUPPORTED_SWIM26_MANIFEST_VERSIONS.includes(manifest.version as typeof SUPPORTED_SWIM26_MANIFEST_VERSIONS[number])) {
    issues.push(`Unsupported manifest version: ${manifest.version}`);
  }

  // Check scene data
  const objects = extractObjects(manifest);
  if (objects.length === 0) {
    warnings.push('No scene objects found in manifest');
  } else {
    objects.forEach((object, index) => {
      if (!object?.id && !object?.authoredId) {
        issues.push(`Object at index ${index} is missing id/authoredId`);
      }
      if (!object?.name || typeof object.name !== 'string') {
        issues.push(`Object at index ${index} is missing name`);
      }
      if (object?.transform) {
        const vectors: Array<{ key: string; value: unknown }> = [
          { key: 'position', value: object.transform.position },
          { key: 'rotation', value: object.transform.rotation },
          { key: 'scale', value: object.transform.scale },
        ];

        vectors.forEach(({ key, value }) => {
          const isTuple = Array.isArray(value) && value.length === 3 && value.every((n: unknown) => Number.isFinite(n as number));
          if (!isTuple) {
            issues.push(`Object ${object.name || object.id || index} has invalid transform.${key}`);
          }
        });
      }
    });
  }

  // Check for missing assets
  const assets = extractAssetReferences(manifest);
  if (assets.length === 0) {
    warnings.push('No asset references found');
  }

  // Check scene info
  const sceneInfo = extractSceneInfo(manifest);
  const explicitSceneName = safeGet(manifest, ['authoredContent', 'sceneInfo', 'name']) || safeGet(manifest, ['sceneInfo', 'name']);
  if (!explicitSceneName || sceneInfo.name === 'Imported Scene') {
    warnings.push('Scene name not set or using default');
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings,
  };
};

/**
 * Safely extract a value from potentially missing nested structures
 */
const safeGet = (obj: any, path: string[]): any => {
  return path.reduce((current, key) => current?.[key], obj);
};
