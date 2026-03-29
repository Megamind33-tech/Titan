/**
 * GitHub Import Hook
 *
 * React hook for managing GitHub repository import flow.
 * Handles: input validation, repo detection, import progress, result handling
 *
 * Usage in components:
 * const { import, progress, result, error, clear } = useGitHubImport();
 */

import { useState, useCallback } from 'react';
import { ProjectSession } from '../types/projectSession';
import { GitHubRepoImporter, ImportPreparationResult } from '../services/GitHubRepoImporter';
import { LoadedSceneData } from '../services/Swim26ManifestLoader';

/**
 * Import progress state
 */
export type ImportPhase = 'idle' | 'validating' | 'detecting' | 'loading' | 'creating-session' | 'complete' | 'error';

/**
 * Import progress information
 */
export interface ImportProgress {
  phase: ImportPhase;
  message: string;
  percentComplete: number; // 0-100
}

/**
 * Import result
 */
export interface ImportResultData {
  session: ProjectSession;
  sceneData?: LoadedSceneData;
  sourceRepo: string;
  importedFiles: string[];
  warnings: string[];
}

/**
 * Extended result to pass to callbacks
 */
export interface ImportCompleteData extends ImportResultData {
  objectCount: number;
  assetCount: number;
  pathCount: number;
}

/**
 * Hook state
 */
export interface UseGitHubImportState {
  progress: ImportProgress;
  result: ImportResultData | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Hook return value
 */
export interface UseGitHubImportReturn extends UseGitHubImportState {
  importRepository: (repoInput: string, profileIdHint?: string, authToken?: string) => Promise<void>;
  prepareImport: (repoInput: string, authToken?: string) => Promise<ImportPreparationResult | null>;
  clear: () => void;
  retry: (authToken?: string) => Promise<void>;
}

const scrubSecrets = (raw: string): string => raw.replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[redacted-token]');

const toFriendlyImportError = (raw: string): string => {
  const sanitized = scrubSecrets(raw);
  if (sanitized.startsWith('PRIVATE_REPO_AUTH_REQUIRED:')) {
    return 'This repo looks private. Add a read-only GitHub token, then try again.';
  }
  if (sanitized.startsWith('INVALID_TOKEN:')) {
    return 'GitHub rejected that token. Check it and try again.';
  }
  if (sanitized.startsWith('SSO_AUTH_REQUIRED:')) {
    return 'This organization requires SSO for this token. Authorize it in GitHub, then retry.';
  }
  if (sanitized.startsWith('INSUFFICIENT_SCOPE:')) {
    return 'Your token does not have required repository read permission for this repo.';
  }
  if (sanitized.startsWith('RATE_LIMITED:')) {
    return 'GitHub rate limit reached. Wait and retry, or use an authorized token.';
  }
  if (sanitized.startsWith('REPO_NOT_FOUND:')) {
    return 'Repository not found. Check owner/repo and branch, or provide a token if this repository is private.';
  }
  return sanitized;
};

/**
 * useGitHubImport Hook
 */
export const useGitHubImport = (): UseGitHubImportReturn => {
  const [state, setState] = useState<UseGitHubImportState>({
    progress: { phase: 'idle', message: '', percentComplete: 0 },
    result: null,
    error: null,
    isLoading: false,
  });

  const [lastInput, setLastInput] = useState<string>('');
  const [lastProfileIdHint, setLastProfileIdHint] = useState<string | undefined>(undefined);
  const [importer] = useState(() => new GitHubRepoImporter());

  const updateProgress = useCallback((phase: ImportPhase, message: string, percentComplete: number) => {
    setState(prev => ({
      ...prev,
      progress: { phase, message, percentComplete },
      isLoading: phase !== 'complete' && phase !== 'error' && phase !== 'idle',
    }));
  }, []);

  const importRepository = useCallback(
    async (repoInput: string, profileIdHint?: string, authToken?: string) => {
      setLastInput(repoInput);
      setLastProfileIdHint(profileIdHint);

      try {
        // Phase 1: Validate input
        updateProgress('validating', 'Validating repository URL...', 10);
        const validation = importer.validateRepoInput(repoInput);
        if (!validation.valid) {
          setState(prev => ({
            ...prev,
            error: validation.errors[0] || 'Invalid repository input',
            progress: { phase: 'error', message: 'Validation failed', percentComplete: 0 },
            isLoading: false,
          }));
          return;
        }

        // Phase 2: Detect project type
        updateProgress('detecting', 'Detecting project type...', 25);

        // Phase 3: Fetch and ingest repository
        updateProgress('loading', 'Importing repository data from GitHub...', 40);
        const result = await importer.importRepository(repoInput, profileIdHint, authToken);

        if (!result.success) {
          const friendlyError = toFriendlyImportError(result.errors[0] || 'Import failed');
          setState(prev => ({
            ...prev,
            error: friendlyError,
            progress: { phase: 'error', message: friendlyError, percentComplete: 0 },
            isLoading: false,
          }));
          return;
        }

        // Phase 4: Create session
        updateProgress('creating-session', 'Setting up your project...', 80);

        if (!result.session) {
          setState(prev => ({
            ...prev,
            error: 'Failed to create project session',
            progress: { phase: 'error', message: 'Session creation failed', percentComplete: 0 },
            isLoading: false,
          }));
          return;
        }

        // Complete
        updateProgress('complete', 'Import complete.', 100);
        setState(prev => ({
          ...prev,
          result: {
            session: result.session!,
            sceneData: result.sceneData,
            sourceRepo: result.sourceRepo,
            importedFiles: result.importedFiles,
            warnings: result.warnings,
            objectCount: result.sceneData?.objects?.length || 0,
            assetCount: result.sceneData?.assets?.length || 0,
            pathCount: result.sceneData?.paths?.length || 0,
          },
          error: null,
        }));
      } catch (error) {
        const message = toFriendlyImportError(error instanceof Error ? error.message : String(error));
        setState(prev => ({
          ...prev,
          error: message,
          progress: { phase: 'error', message, percentComplete: 0 },
          isLoading: false,
        }));
      }
    },
    [importer, updateProgress]
  );

  const prepareImport = useCallback(
    async (repoInput: string, authToken?: string) => {
      try {
        updateProgress('detecting', 'Detecting project...', 20);
        const preparation = await importer.prepareImport(repoInput, authToken);

        if (!preparation.valid) {
          const friendlyError = toFriendlyImportError(preparation.errors[0] || 'Preparation failed');
          setState(prev => ({
            ...prev,
            error: friendlyError,
            progress: { phase: 'error', message: friendlyError, percentComplete: 0 },
            isLoading: false,
          }));
          return null;
        }

        return preparation;
      } catch (error) {
        const message = toFriendlyImportError(error instanceof Error ? error.message : String(error));
        setState(prev => ({
          ...prev,
          error: message,
          progress: { phase: 'error', message, percentComplete: 0 },
          isLoading: false,
        }));
        return null;
      }
    },
    [importer, updateProgress]
  );

  const clear = useCallback(() => {
    setState({
      progress: { phase: 'idle', message: '', percentComplete: 0 },
      result: null,
      error: null,
      isLoading: false,
    });
    setLastInput('');
    setLastProfileIdHint(undefined);
  }, []);

  const retry = useCallback(async (authToken?: string) => {
    if (lastInput) {
      await importRepository(lastInput, lastProfileIdHint, authToken);
    }
  }, [lastInput, lastProfileIdHint, importRepository]);

  return {
    ...state,
    importRepository,
    prepareImport,
    clear,
    retry,
  };
};

/**
 * Helper: Get user-facing message for phase
 */
export const getPhaseMessage = (phase: ImportPhase, customMessage?: string): string => {
  if (customMessage) return customMessage;

  const messages: Record<ImportPhase, string> = {
    idle: 'Ready to import',
    validating: 'Validating repository...',
    detecting: 'Checking project type...',
    loading: 'Importing from GitHub...',
    'creating-session': 'Setting up project...',
    complete: 'Import complete.',
    error: 'Import failed',
  };

  return messages[phase] || 'Processing...';
};

/**
 * Helper: Get progress percentage for phase
 */
export const getPhaseProgress = (phase: ImportPhase): number => {
  const progress: Record<ImportPhase, number> = {
    idle: 0,
    validating: 10,
    detecting: 30,
    loading: 50,
    'creating-session': 75,
    complete: 100,
    error: 0,
  };

  return progress[phase] || 0;
};
