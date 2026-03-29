import {
  ProjectMetadataProbe,
  ProjectSelectionResult,
  ProjectAdapter,
  ProjectProfile,
} from '../types/projectAdapter';
import {
  selectProjectAdapter,
  validateProfileAdapterCompatibility,
  getBridgeForAdapter,
  getProjectSelectionGuidance,
} from './ProjectAdapterRegistry';
import { getBridgeContract, validateBridgeContract } from './ProjectBridgeRegistry';

export interface ProjectActivation {
  profile: ProjectProfile;
  adapter: ProjectAdapter;
  bridgeId: string;
  bridgeContract: ReturnType<typeof getBridgeContract>;
  detection: ProjectSelectionResult['detection'];
  activeCapabilities: ProjectAdapter['capabilities'];
}

export const activateProjectForEditor = (probe: ProjectMetadataProbe): ProjectActivation => {
  const guidance = getProjectSelectionGuidance(probe);
  const guidedProbe = guidance.requiresUserSelection ? { ...probe, profileHint: 'titan-scene' } : probe;

  const selection = selectProjectAdapter(guidedProbe);
  const compatibility = validateProfileAdapterCompatibility(selection.profile, selection.adapter);

  if (!compatibility.valid) {
    throw new Error(`Cannot activate project: ${compatibility.errors.join(' ')}`);
  }

  const bridgeId = getBridgeForAdapter(selection.adapter.id);
  const bridgeContract = getBridgeContract(bridgeId);
  const bridgeValidation = validateBridgeContract({
    bridgeId,
    runtime: selection.adapter.runtime,
    sceneContract: selection.adapter.sceneContract,
  });

  if (!bridgeValidation.valid) {
    throw new Error(`Cannot activate project bridge: ${bridgeValidation.errors.join(' ')}`);
  }

  return {
    profile: selection.profile,
    adapter: selection.adapter,
    bridgeId,
    bridgeContract,
    detection: selection.detection,
    activeCapabilities: selection.adapter.capabilities,
  };
};
