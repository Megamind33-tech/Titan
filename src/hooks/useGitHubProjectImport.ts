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
import { EnvironmentPreset } from '../types/environment';

interface UseGitHubProjectImportArgs {
  environment: EnvironmentPreset;
  onActivateSession: (session: ProjectSession) => void;
  setShowOnboarding: (show: boolean) => void;
  setModels: (updater: any) => void;
  setEnvironment: (updater: any) => void;
  setCameraPaths: (updater: any) => void;
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
  environment,
  onActivateSession,
  setShowOnboarding,
  setModels,
  setEnvironment,
  setCameraPaths,
  closeModal,
}: UseGitHubProjectImportArgs) => {
  return useCallback(async (importedSession: ProjectSession, sceneData?: LoadedSceneData) => {
    try {
      const rootPath = importedSession.metadata.rootPath || 'unknown';
      const importHistoryEntry = extractGitHubImportHistoryEntry(rootPath);
      if (importHistoryEntry) {
        addToImportHistory(importHistoryEntry.owner, importHistoryEntry.repo, importedSession.projectName);
      }

      onActivateSession(importedSession);
      setShowOnboarding(false);

      if (sceneData) {
        try {
          const importedObjects = loadImportedObjects(sceneData);
          const importedEnvironment = loadImportedEnvironment(sceneData, environment);
          const importedPaths = loadImportedPaths(sceneData);

          setModels(importedObjects);
          setEnvironment(importedEnvironment);
          setCameraPaths(importedPaths);

          const summary = createImportSummary(sceneData, importedSession.metadata.rootPath || 'unknown');
          console.log('[GitHub Import] Scene data loaded:', {
            projectName: summary.projectName,
            objects: summary.objectCount,
            assets: summary.assetCount,
            paths: summary.pathCount,
            warnings: summary.warnings,
          });

          if (summary.warnings.length > 0) {
            console.warn('[GitHub Import] Warnings:', summary.warnings);
          }
        } catch (sceneError) {
          console.warn('[GitHub Import] Could not load scene data:', sceneError);
        }
      }

      closeModal();
      console.log(`[GitHub Import] Successfully imported project: ${importedSession.projectName} from ${importedSession.metadata.rootPath}`);
    } catch (error) {
      console.error('[GitHub Import] Error handling import completion:', error);
    }
  }, [closeModal, environment, onActivateSession, setCameraPaths, setEnvironment, setModels, setShowOnboarding]);
};
