/**
 * SWIM26 Repository Detector
 *
 * Detects SWIM26/Babylon projects from GitHub repo data.
 * Reuses existing ProjectAdapterRegistry profile detection logic
 * to determine project type and select appropriate profile/adapter/bridge.
 *
 * Scope: Detection using repo markers, manifest content, dependencies.
 * No code execution or arbitrary file inspection.
 */

import { ProjectMetadataProbe, ProjectSelectionResult } from '../types/projectAdapter';
import { GitHubRepoIngestResult } from '../types/gitHubConnector';
import {
  detectProjectProfile,
  getProjectSelectionGuidance,
} from './ProjectAdapterRegistry';

/**
 * Extract project metadata from ingested repo files
 */
export const extractMetadataFromRepo = (
  ingestResult: GitHubRepoIngestResult
): ProjectMetadataProbe => {
  const probe: ProjectMetadataProbe = {
    rootPath: `${ingestResult.metadata?.owner}/${ingestResult.metadata?.repo}#${ingestResult.branch}`,
    markerFiles: [],
    dependencies: [],
  };

  // Check for marker files
  for (const fileName of ingestResult.files.keys()) {
    if (['swim26.config.json', 'babylon.config.json', 'swim26.manifest.json'].includes(fileName)) {
      probe.markerFiles!.push(fileName);
    }
  }

  // Try to extract package name and dependencies from package.json
  const packageJsonFile = ingestResult.files.get('package.json');
  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(packageJsonFile.content) as any;
      probe.packageName = packageJson.name;

      // Extract dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      probe.dependencies = Object.keys(allDeps);
    } catch (error) {
      // Silently fail - package.json may not be valid JSON
    }
  }

  // Try to extract SWIM26 version hint from manifest
  const manifestFile = ingestResult.files.get('swim26.manifest.json');
  if (manifestFile) {
    try {
      const manifest = JSON.parse(manifestFile.content) as any;
      if (manifest.type === 'swim26.scene-manifest' || manifest.type === 'swim26-scene-manifest') {
        probe.profileHint = 'swim26-babylon';
      }
    } catch (error) {
      // Silently fail - may not be valid manifest
    }
  }

  // Check for babylon.config.json
  const babylonConfigFile = ingestResult.files.get('babylon.config.json');
  if (babylonConfigFile) {
    try {
      JSON.parse(babylonConfigFile.content);
      probe.runtimeHint = 'babylon';
    } catch (error) {
      // Silently fail
    }
  }

  return probe;
};

/**
 * Validate the extracted metadata
 */
export const validateMetadataProbe = (probe: ProjectMetadataProbe): {
  valid: boolean;
  issues: string[];
} => {
  const issues: string[] = [];

  if (!probe.markerFiles || probe.markerFiles.length === 0) {
    issues.push('No SWIM26 marker files found (swim26.config.json, babylon.config.json, or swim26.manifest.json)');
  }

  if (!probe.dependencies || probe.dependencies.length === 0) {
    issues.push('No package dependencies detected (check package.json)');
  }

  // Not necessarily invalid - just low confidence
  return {
    valid: issues.length === 0,
    issues,
  };
};

/**
 * Detect project profile from ingested repository
 */
export const detectProjectFromRepo = (
  ingestResult: GitHubRepoIngestResult
): ProjectSelectionResult => {
  const probe = extractMetadataFromRepo(ingestResult);
  return detectProjectProfile(probe);
};

/**
 * Get guidance on project selection from ingested repository
 */
export const getRepoSelectionGuidance = (
  ingestResult: GitHubRepoIngestResult
) => {
  const probe = extractMetadataFromRepo(ingestResult);
  return getProjectSelectionGuidance(probe);
};

/**
 * Check if repo looks like SWIM26 with confidence level
 */
export interface RepoDetectionResult {
  isSWIM26: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  detectedMarkers: string[];
  detectedDependencies: string[];
  suggestedProfile?: string;
}

export const assessRepoType = (
  ingestResult: GitHubRepoIngestResult
): RepoDetectionResult => {
  const probe = extractMetadataFromRepo(ingestResult);
  const validation = validateMetadataProbe(probe);
  const selection = detectProjectFromRepo(ingestResult);

  const detectedMarkers = probe.markerFiles || [];
  const swimDeps = (probe.dependencies || []).filter(d =>
    d.toLowerCase().includes('babylon') ||
    d.toLowerCase().includes('swim26') ||
    d.toLowerCase() === '@babylonjs/core'
  );

  // Confidence levels
  const hasMarkerFiles = detectedMarkers.length > 0;
  const hasBabylonDeps = swimDeps.length > 0;
  const isSwim26 = selection.profile.typeId === 'swim26-babylon';

  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (hasMarkerFiles && hasBabylonDeps) {
    confidence = 'high';
  } else if (hasMarkerFiles || hasBabylonDeps) {
    confidence = 'medium';
  }

  return {
    isSWIM26: isSwim26,
    confidence,
    reason: selection.detection.reason,
    detectedMarkers,
    detectedDependencies: swimDeps,
    suggestedProfile: selection.profile.displayName,
  };
};
