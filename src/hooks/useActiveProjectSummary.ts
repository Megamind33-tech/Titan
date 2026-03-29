import { useMemo } from 'react';
import { activateProjectForEditor } from '../services/ProjectLoadService';

type ActiveProject = ReturnType<typeof activateProjectForEditor>;

export const useActiveProjectSummary = (activeProject: ActiveProject) => {
  const formatActivationMode = (mode: ActiveProject['detection']['mode']): string => {
    if (mode === 'automatic') return 'Automatic';
    if (mode === 'guided') return 'Guided';
    if (mode === 'fallback') return 'Fallback profile';
    return toTitleCase(mode);
  };

  const toTitleCase = (value: string): string =>
    value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  return useMemo(() => ({
    profileName: activeProject.profile.displayName,
    runtimeTargetLabel: toTitleCase(activeProject.profile.runtimeTarget),
    adapterName: activeProject.adapter.displayName,
    bridgeId: activeProject.bridgeId.replace(/-/g, ' '),
    activationMode: formatActivationMode(activeProject.detection.mode),
    canAuthorMaterials: activeProject.activeCapabilities.materialAuthoring ?? true,
  }), [activeProject]);
};
