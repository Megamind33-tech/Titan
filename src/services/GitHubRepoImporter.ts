/**
 * GitHub Repository Importer
 *
 * Main service for importing SWIM26/Babylon projects from GitHub.
 * Orchestrates: connector → detector → session creation
 *
 * Scope: Import supported project data only.
 * Reuses existing profile/adapter/session architecture.
 */

import { ProjectSession } from '../types/projectSession';
import { generateAuthoredId } from '../utils/idUtils';
import { ProjectMetadataProbe, ProjectSelectionResult } from '../types/projectAdapter';
import {
  GitHubRepoReference,
  GitHubRepoIngestResult,
  DEFAULT_SUPPORTED_IMPORT_FILES,
} from '../types/gitHubConnector';
import {
  GitHubConnector,
  parseGitHubReference,
} from './GitHubConnector';
import { extractMetadataFromRepo, assessRepoType, RepoDetectionResult } from './Swim26RepoDetector';
import {
  loadSwim26Manifest,
  LoadedSceneData,
  buildSceneDataFromManifest,
  validateManifest,
} from './Swim26ManifestLoader';
import {
  selectProjectAdapter,
  getProjectSelectionGuidance,
} from './ProjectAdapterRegistry';

/**
 * Validation result for import
 */
export interface ImportValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Import preparation result - used before actual import
 */
export interface ImportPreparationResult {
  valid: boolean;
  repoRef: GitHubRepoReference | null;
  metadata: ProjectMetadataProbe | null;
  detection: RepoDetectionResult | null;
  guidance: any; // ProjectSelectionGuidance
  errors: string[];
  warnings: string[];
}

/**
 * Final import result with created session
 */
export interface ImportResult {
  success: boolean;
  session?: ProjectSession;
  sceneData?: LoadedSceneData;
  sourceRepo: string;
  sourceRef: GitHubRepoReference | null;
  importedFiles: string[];
  errors: string[];
  warnings: string[];
}

/**
 * GitHub Repository Importer Service
 */
export class GitHubRepoImporter {
  private connector: GitHubConnector;
  private readonly supportedImportFiles: string[] = [...DEFAULT_SUPPORTED_IMPORT_FILES];

  constructor(connector?: GitHubConnector) {
    this.connector = connector || new GitHubConnector({ accessMode: 'public-only' });
  }

  /**
   * Parse and validate repository input
   */
  validateRepoInput(input: string): {
    valid: boolean;
    reference: GitHubRepoReference | null;
    errors: string[];
  } {
    const trimmed = input.trim();

    if (!trimmed) {
      return {
        valid: false,
        reference: null,
        errors: ['Repository URL or owner/repo cannot be empty'],
      };
    }

    const reference = parseGitHubReference(trimmed);
    if (!reference) {
      return {
        valid: false,
        reference: null,
        errors: [
          'Invalid repository reference. Use: https://github.com/owner/repo or owner/repo',
        ],
      };
    }

    if (reference.subpath && (reference.subpath.includes('..') || reference.subpath.startsWith('/'))) {
      return {
        valid: false,
        reference: null,
        errors: ['Folder path is invalid. Use a relative path inside the repository.'],
      };
    }

    return {
      valid: true,
      reference,
      errors: [],
    };
  }

  /**
   * Prepare for import without creating session
   * This is useful for showing preview/confirmation before actual import
   */
  async prepareImport(repoInput: string, authToken?: string): Promise<ImportPreparationResult> {
    const result: ImportPreparationResult = {
      valid: false,
      repoRef: null,
      metadata: null,
      detection: null,
      guidance: null,
      errors: [],
      warnings: [],
    };

    // Validate input
    const validation = this.validateRepoInput(repoInput);
    if (!validation.valid) {
      result.errors = validation.errors;
      return result;
    }

    result.repoRef = validation.reference;

    try {
      // Ingest repository
      const activeConnector = authToken
        ? new GitHubConnector({ accessMode: 'authenticated', authToken })
        : this.connector;
      const ingestResult = await activeConnector.ingestRepository(validation.reference!, this.supportedImportFiles);

      if (!ingestResult.success) {
        result.errors.push(
          ...ingestResult.errors.map(e => `${e.type}: ${e.message}`)
        );
        result.warnings.push(...ingestResult.warnings);
        return result;
      }

      // Assess repo type
      const detection = assessRepoType(ingestResult);
      result.detection = detection;

      // Extract metadata via shared detector pathway to avoid duplicate heuristics
      result.metadata = extractMetadataFromRepo(ingestResult);

      // Get guidance (for user selection or auto-selection)
      result.guidance = getProjectSelectionGuidance(result.metadata!);

      result.warnings.push(...ingestResult.warnings);
      result.valid = true;

      return result;
    } catch (error) {
      result.errors.push(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
      return result;
    }
  }

  /**
   * Perform the actual import and create a project session
   */
  async importRepository(
    repoInput: string,
    profileIdHint?: string,
    authToken?: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      sourceRepo: repoInput,
      sourceRef: null,
      importedFiles: [],
      errors: [],
      warnings: [],
    };

    // Validate input
    const validation = this.validateRepoInput(repoInput);
    if (!validation.valid) {
      result.errors = validation.errors;
      return result;
    }

    result.sourceRef = validation.reference;

    try {
      // Ingest repository
      const activeConnector = authToken
        ? new GitHubConnector({ accessMode: 'authenticated', authToken })
        : this.connector;
      const ingestResult = await activeConnector.ingestRepository(validation.reference!, this.supportedImportFiles);

      if (!ingestResult.success) {
        result.errors.push(
          ...ingestResult.errors.map(e => `${e.type}: ${e.message}`)
        );
        result.warnings.push(...ingestResult.warnings);
        return result;
      }

      result.importedFiles = Array.from(ingestResult.files.keys());
      result.warnings.push(...ingestResult.warnings);

      // Extract metadata and detect project type
      const metadata = extractMetadataFromRepo(ingestResult);

      // Apply profile hint if provided
      if (profileIdHint) {
        metadata.profileHint = profileIdHint;
      }

      // Detect and select adapter
      let selection: ProjectSelectionResult;
      try {
        selection = selectProjectAdapter(metadata);
      } catch (error) {
        result.errors.push(
          `Failed to select project adapter: ${error instanceof Error ? error.message : String(error)}`
        );
        return result;
      }

      // Try to load scene data from manifest
      let sceneData: LoadedSceneData | undefined;
      const manifestFile = ingestResult.files.get('swim26.manifest.json');
      if (manifestFile) {
        try {
          const manifestResult = loadSwim26Manifest(manifestFile);
          if (manifestResult.errors.length === 0 && manifestResult.data) {
            const schemaValidation = validateManifest(manifestResult.data);
            if (!schemaValidation.valid) {
              result.errors.push(...schemaValidation.issues.map(issue => `Manifest validation: ${issue}`));
              result.warnings.push(...schemaValidation.warnings);
              return result;
            }
            result.warnings.push(...schemaValidation.warnings);
            sceneData = buildSceneDataFromManifest(manifestResult.data, metadata);
          } else {
            result.warnings.push(
              ...manifestResult.errors.map(e => `Manifest error: ${e.message}`)
            );
          }
        } catch (error) {
          result.warnings.push(
            `Could not parse manifest: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Create project session
      const session: ProjectSession = {
        sessionId: generateAuthoredId(),
        projectId: generateAuthoredId(),
        projectName: this.extractProjectName(ingestResult, metadata),
        profileId: selection.profile.id,
        adapterId: selection.adapter.id,
        runtimeTarget: selection.adapter.runtime,
        bridgeId: selection.adapter.bridge,
        metadata: {
          ...metadata,
          rootPath: `github:${validation.reference!.owner}/${validation.reference!.repo}#${ingestResult.branch}`,
        },
        capabilities: selection.profile.capabilities,
        lastOpenedAt: new Date().toISOString(),
      };

      result.session = session;
      if (sceneData) {
        result.sceneData = sceneData;
      }
      result.success = true;

      return result;
    } catch (error) {
      result.errors.push(
        `Unexpected error during import: ${error instanceof Error ? error.message : String(error)}`
      );
      return result;
    }
  }

  /**
   * Helper: Extract project name from various sources
   */
  private extractProjectName(
    ingestResult: GitHubRepoIngestResult,
    metadata: ProjectMetadataProbe
  ): string {
    // Try package.json name first
    if (metadata.packageName) {
      return metadata.packageName;
    }

    // Fall back to repo name
    if (ingestResult.metadata?.repo) {
      return ingestResult.metadata.repo;
    }

    return 'Imported Project';
  }
}

/**
 * Create a default importer instance
 */
export const createDefaultImporter = (): GitHubRepoImporter => {
  return new GitHubRepoImporter();
};
