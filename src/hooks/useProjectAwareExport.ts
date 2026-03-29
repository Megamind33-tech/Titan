import { useCallback, useMemo } from 'react';
import { getProjectAwareExportConfig } from '../services/ProjectExportWorkflow';
import { validateExportFormatForAdapter } from '../services/ProjectAdapterRegistry';
import { exportScene } from '../utils/exportUtils';
import { ExportOptions } from '../components/ExportModal';

export const useProjectAwareExport = ({
  activeProject,
  models,
  sceneSettings,
  threeScene,
  cameraSettings,
  layers,
}: any) => {
  const exportConfig = useMemo(() => getProjectAwareExportConfig(activeProject), [activeProject]);

  const handleExport = useCallback((selectedIds: string[], options: ExportOptions) => {
    validateExportFormatForAdapter(activeProject.adapter.id, options.format);
    exportScene(models, sceneSettings, threeScene, {
      selectedIds,
      ...options,
      cameraSettings,
      layers,
    });
  }, [activeProject.adapter.id, cameraSettings, layers, models, sceneSettings, threeScene]);

  return {
    exportConfig,
    handleExport,
  };
};
