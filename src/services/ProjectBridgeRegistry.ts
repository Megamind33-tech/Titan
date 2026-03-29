import { BridgeContract } from '../types/projectAdapter';

const BRIDGES: BridgeContract[] = [
  {
    id: 'generic-export-bridge',
    runtime: 'generic-scene',
    sceneContract: 'titan.scene.v1',
    supportedExportFormats: ['original', 'glb', 'obj'],
    supportsPaths: true,
    supportsMaterials: true,
  },
  {
    id: 'babylon-swim26-bridge',
    runtime: 'babylon',
    sceneContract: 'swim26.scene-manifest.v1',
    supportedExportFormats: ['original', 'glb', 'swim26-manifest'],
    supportsPaths: true,
    supportsMaterials: true,
  },
];

export const getBridgeContract = (bridgeId: string): BridgeContract => {
  const bridge = BRIDGES.find(item => item.id === bridgeId);
  if (!bridge) {
    throw new Error(`Unknown bridge "${bridgeId}"`);
  }
  return bridge;
};

export const validateBridgeContract = (input: {
  bridgeId: string;
  runtime: string;
  sceneContract: string;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const bridge = getBridgeContract(input.bridgeId);

  if (bridge.runtime !== input.runtime) {
    errors.push(`Bridge runtime "${bridge.runtime}" does not match runtime "${input.runtime}".`);
  }
  if (bridge.sceneContract !== input.sceneContract) {
    errors.push(
      `Bridge scene contract "${bridge.sceneContract}" does not match scene contract "${input.sceneContract}".`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
