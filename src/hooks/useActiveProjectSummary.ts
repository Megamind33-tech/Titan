import { useMemo } from 'react';

export const useActiveProjectSummary = (activeProject: any) => {
  return useMemo(() => ({
    profileName: activeProject.profile.displayName,
    runtimeTargetLabel: activeProject.profile.runtimeTarget.toUpperCase(),
    adapterName: activeProject.adapter.displayName,
    bridgeId: activeProject.bridgeId,
    activationMode: activeProject.detection.mode.toUpperCase(),
    canAuthorMaterials: activeProject.activeCapabilities.materialAuthoring ?? true,
  }), [activeProject]);
};
