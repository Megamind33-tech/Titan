import { useEffect } from 'react';
import { persistProjectSession } from '../services/ProjectSessionService';
import { ProjectSession } from '../types/projectSession';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import { activateProjectForEditor } from '../services/ProjectLoadService';

interface UseProjectSessionPersistenceArgs {
  projectSession: ProjectSession | null;
  projectMetadata: ProjectMetadataProbe;
  activeProject: ReturnType<typeof activateProjectForEditor>;
}

export const buildPersistedSessionSnapshot = (
  projectSession: ProjectSession,
  projectMetadata: ProjectMetadataProbe,
  activeProject: ReturnType<typeof activateProjectForEditor>,
): ProjectSession => ({
  ...projectSession,
  metadata: projectMetadata,
  profileId: activeProject.profile.id,
  adapterId: activeProject.adapter.id,
  bridgeId: activeProject.bridgeId,
  runtimeTarget: activeProject.adapter.runtime,
  capabilities: activeProject.activeCapabilities,
  lastOpenedAt: new Date().toISOString(),
});

export const useProjectSessionPersistence = ({
  projectSession,
  projectMetadata,
  activeProject,
}: UseProjectSessionPersistenceArgs) => {
  useEffect(() => {
    if (!projectSession) return;

    persistProjectSession(buildPersistedSessionSnapshot(projectSession, projectMetadata, activeProject));
  }, [activeProject, projectMetadata, projectSession]);
};
