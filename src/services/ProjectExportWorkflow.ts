import { ExportOptions } from '../components/ExportModal';
import { ProjectActivation } from './ProjectLoadService';

export interface ProjectAwareExportConfig {
  allowedFormats: ExportOptions['format'][];
  recommendedFormat: ExportOptions['format'];
  contextNote?: string;
}

export const getProjectAwareExportConfig = (
  activation: ProjectActivation
): ProjectAwareExportConfig => {
  const allowedByAdapter = activation.adapter.exportFormats.filter(
    (format): format is ExportOptions['format'] => format === 'original' || format === 'glb' || format === 'obj' || format === 'swim26-manifest'
  );
  const allowedFormats = allowedByAdapter.filter(format => activation.bridgeContract.supportedExportFormats.includes(format));
  const normalizedAllowedFormats: ExportOptions['format'][] = allowedFormats.length > 0
    ? allowedFormats
    : ['original'];

  const profilePreferred = activation.profile.defaults.preferredExportFormat as ExportOptions['format'];
  const recommendedFormat = normalizedAllowedFormats.includes(profilePreferred)
    ? profilePreferred
    : normalizedAllowedFormats[0];

  const contextNote = normalizedAllowedFormats.includes('swim26-manifest')
    ? 'SWIM26 Manifest is the runtime handoff target. GLB and Original are for raw asset delivery.'
    : undefined;

  return {
    allowedFormats: normalizedAllowedFormats,
    recommendedFormat,
    contextNote,
  };
};
