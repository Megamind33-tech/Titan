import { Dispatch, SetStateAction, useCallback } from 'react';
import { activateProjectForEditor } from '../services/ProjectLoadService';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import { ProjectSession } from '../types/projectSession';

interface UseProjectActivationCoordinatorArgs {
  setProjectMetadata: (metadata: ProjectMetadataProbe) => void;
  setActiveProject: (activation: ReturnType<typeof activateProjectForEditor>) => void;
  setProjectSession: Dispatch<SetStateAction<ProjectSession | null>>;
}

export const useProjectActivationCoordinator = ({
  setProjectMetadata,
  setActiveProject,
  setProjectSession,
}: UseProjectActivationCoordinatorArgs) => {
  const activateFromMetadata = useCallback((metadata: ProjectMetadataProbe) => {
    const activation = activateProjectForEditor(metadata);
    setProjectMetadata(metadata);
    setActiveProject(activation);
    return activation;
  }, [setActiveProject, setProjectMetadata]);

  const activateWithSession = useCallback((session: ProjectSession, metadataOverride?: ProjectMetadataProbe) => {
    const metadata = metadataOverride ?? session.metadata;
    const activation = activateProjectForEditor(metadata);

    setProjectMetadata(metadata);
    setActiveProject(activation);
    setProjectSession({
      ...session,
      metadata,
      profileId: activation.profile.id,
      adapterId: activation.adapter.id,
      bridgeId: activation.bridgeId,
      runtimeTarget: activation.adapter.runtime,
      capabilities: activation.activeCapabilities,
    });

    return activation;
  }, [setActiveProject, setProjectMetadata, setProjectSession]);

  const updateSessionVersion = useCallback((sceneVersionId: string) => {
    setProjectSession(prev => (prev ? { ...prev, sceneVersionId } : prev));
  }, [setProjectSession]);

  return {
    activateFromMetadata,
    activateWithSession,
    updateSessionVersion,
  };
};
