import { useMemo } from 'react';

export const useActiveProjectSummary = (activeProject: any) => {
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
    bridgeId: activeProject.bridgeId,
    activationMode: toTitleCase(activeProject.detection.mode),
    canAuthorMaterials: activeProject.activeCapabilities.materialAuthoring ?? true,
  }), [activeProject]);
};
