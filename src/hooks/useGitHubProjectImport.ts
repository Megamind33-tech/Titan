import { useCallback } from 'react';
import { addToImportHistory } from '../services/ImportHistoryService';
import { ProjectSession } from '../types/projectSession';
import {
  createImportSummary,
  loadImportedEnvironment,
  loadImportedObjects,
  loadImportedPaths,
} from '../services/ImportedSceneLoader';
import { LoadedSceneData } from '../services/Swim26ManifestLoader';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from '../types/environment';
import { CameraPath } from '../types/camera';
import { ModelData } from '../App';

interface ImportedSceneStatePayload {
  models: ModelData[];
  environment: EnvironmentPreset;
  cameraPaths: CameraPath[];
}

interface UseGitHubProjectImportArgs {
  onActivateSession: (session: ProjectSession) => void;
  setShowOnboarding: (show: boolean) => void;
  applyImportedSceneState: (payload: ImportedSceneStatePayload) => void;
  clearSelection: () => void;
  closeModal: () => void;
}

export const extractGitHubImportHistoryEntry = (rootPath: string): { owner: string; repo: string } | null => {
  if (!rootPath.startsWith('github:')) return null;
  const repoPath = rootPath.replace('github:', '').split('#')[0];
  const [owner, repo] = repoPath.split('/');
  if (!owner || !repo) return null;
  return { owner, repo };
};

export const useGitHubProjectImport = ({
  onActivateSession,
  setShowOnboarding,
  applyImportedSceneState,
  clearSelection,
  closeModal,
}: UseGitHubProjectImportArgs) => {
  return useCallback(async (importedSession: ProjectSession, sceneData?: LoadedSceneData) => {
    try {
      const rootPath = importedSession.metadata.rootPath || 'unknown';
      const importHistoryEntry = extractGitHubImportHistoryEntry(rootPath);
      if (importHistoryEntry) {
        addToImportHistory(importHistoryEntry.owner, importHistoryEntry.repo, importedSession.projectName);
      }

      let importedModels: ModelData[] = [];
      let importedEnvironment: EnvironmentPreset = DEFAULT_ENVIRONMENT;
      let importedPaths: CameraPath[] = [];
      let summary: ReturnType<typeof createImportSummary> | null = null;
      if (sceneData) {
        try {
          importedModels = loadImportedObjects(sceneData);
          importedEnvironment = loadImportedEnvironment(sceneData, DEFAULT_ENVIRONMENT);
          importedPaths = loadImportedPaths(sceneData);
          summary = createImportSummary(sceneData, importedSession.metadata.rootPath || 'unknown');
        } catch (sceneError) {
          console.warn('[GitHub Import] Could not load scene data:', sceneError);
        }
      }

      onActivateSession(importedSession);

      if (sceneData) {
        applyImportedSceneState({
          models: importedModels,
          environment: importedEnvironment,
          cameraPaths: importedPaths,
        });
        clearSelection();
      }
      setShowOnboarding(false);

      if (summary) {
          console.log('[GitHub Import] Scene data loaded:', {
            projectName: summary.projectName,
            objects: summary.objectCount,
            previewReadyObjects: summary.previewReadyObjectCount,
            unresolvedObjects: summary.unresolvedObjectCount,
            assets: summary.assetCount,
            paths: summary.pathCount,
            warnings: summary.warnings,
          });

          if (summary.warnings.length > 0) {
            console.warn('[GitHub Import] Warnings:', summary.warnings);
          }
      }

      closeModal();
      console.log(`[GitHub Import] Successfully imported project: ${importedSession.projectName} from ${importedSession.metadata.rootPath}`);
    } catch (error) {
      console.error('[GitHub Import] Error handling import completion:', error);
    }
  }, [applyImportedSceneState, clearSelection, closeModal, onActivateSession, setShowOnboarding]);
};
