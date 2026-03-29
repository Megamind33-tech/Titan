import { useEffect } from 'react';
import { loadAutoSave } from '../utils/storageUtils';
import { loadProjectSession } from '../services/ProjectSessionService';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import { ProjectSession } from '../types/projectSession';
import { activateProjectForEditor } from '../services/ProjectLoadService';

interface UseProjectSessionBootstrapArgs<TAppState> {
  defaultMetadata?: ProjectMetadataProbe;
  applyRecoveredSceneState: (savedState: any) => void;
  setProjectMetadata: (metadata: ProjectMetadataProbe) => void;
  setActiveProject: (activation: ReturnType<typeof activateProjectForEditor>) => void;
  setProjectSession: (session: ProjectSession | null) => void;
  setShowOnboarding: (show: boolean) => void;
  setSessionRecoveryMessage: (message: string | null) => void;
  setIsInitialLoad: (value: boolean) => void;
}

export const useProjectSessionBootstrap = <TAppState = unknown>({
  applyRecoveredSceneState,
  setProjectMetadata,
  setActiveProject,
  setProjectSession,
  setShowOnboarding,
  setSessionRecoveryMessage,
  setIsInitialLoad,
}: UseProjectSessionBootstrapArgs<TAppState>) => {
  useEffect(() => {
    const init = async () => {
      try {
        const [savedState, persistedSession] = await Promise.all([
          loadAutoSave(),
          loadProjectSession(),
        ]);

        const urlParams = new URLSearchParams(window.location.search);
        const guidedProbe: ProjectMetadataProbe = {
          profileHint: urlParams.get('projectProfile') ?? undefined,
          runtimeHint: (urlParams.get('runtime') as ProjectMetadataProbe['runtimeHint']) ?? undefined,
          adapterHint: urlParams.get('adapterId') ?? undefined,
        };

        const baseMetadata = persistedSession.session?.metadata ?? savedState?.projectMetadata ?? {};
        const metadataProbe = { ...baseMetadata, ...guidedProbe };
        const activatedProject = activateProjectForEditor(metadataProbe);

        setProjectMetadata(metadataProbe);
        setActiveProject(activatedProject);

        if (persistedSession.session) {
          setProjectSession({
            ...persistedSession.session,
            metadata: metadataProbe,
            profileId: activatedProject.profile.id,
            adapterId: activatedProject.adapter.id,
            bridgeId: activatedProject.bridgeId,
            runtimeTarget: activatedProject.adapter.runtime,
            capabilities: activatedProject.activeCapabilities,
          });
        } else {
          setShowOnboarding(true);
        }

        if (persistedSession.requiresRecovery && persistedSession.recoveryReason) {
          setSessionRecoveryMessage(`Recovered using safe defaults: ${persistedSession.recoveryReason}`);
          setShowOnboarding(true);
        }

        if (savedState) {
          applyRecoveredSceneState(savedState);
        }
      } catch (error) {
        console.error('Failed to bootstrap project session', error);
      } finally {
        setIsInitialLoad(false);
      }
    };

    init();
  }, [
    applyRecoveredSceneState,
    setActiveProject,
    setIsInitialLoad,
    setProjectMetadata,
    setProjectSession,
    setSessionRecoveryMessage,
    setShowOnboarding,
  ]);
};
