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
  GitHubConnectorError,
  GitHubConnectorErrorType,
} from '../types/gitHubConnector';
import {
  GitHubConnector,
  parseGitHubReference,
} from './GitHubConnector';
import {
  detectProjectFromRepo,
  assessRepoType,
  RepoDetectionResult,
} from './Swim26RepoDetector';
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
  async prepareImport(repoInput: string): Promise<ImportPreparationResult> {
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
      const ingestResult = await this.connector.ingestRepository(validation.reference!);

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

      // Get project metadata probe (for adapter selection)
      // We create this manually since we need to pass through the ingestion result
      const probe: ProjectMetadataProbe = {};
      if (ingestResult.metadata) {
        probe.rootPath = `${ingestResult.metadata.owner}/${ingestResult.metadata.repo}#${ingestResult.branch}`;
      }

      // Extract markers, dependencies
      result.metadata = this.extractMetadataFromIngest(ingestResult);
      result.metadata!.profileHint = detection.isSWIM26 ? 'swim26-babylon' : undefined;

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
    profileIdHint?: string
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
      const ingestResult = await this.connector.ingestRepository(validation.reference!);

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
      const metadata = this.extractMetadataFromIngest(ingestResult);

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
   * Helper: Extract metadata from ingestion result
   */
  private extractMetadataFromIngest(ingestResult: GitHubRepoIngestResult): ProjectMetadataProbe {
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

    // Extract package info and dependencies
    const packageJsonFile = ingestResult.files.get('package.json');
    if (packageJsonFile) {
      try {
        const packageJson = JSON.parse(packageJsonFile.content) as any;
        probe.packageName = packageJson.name;
        probe.dependencies = Object.keys({
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        });
      } catch {
        // Silently fail
      }
    }

    return probe;
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
