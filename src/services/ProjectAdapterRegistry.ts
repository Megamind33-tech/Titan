import {
  ProjectAdapter,
  ProjectTypeId,
  RuntimeType,
  ProjectProfile,
  ProjectMetadataProbe,
  ProjectSelectionResult,
  ProjectSelectionGuidance,
} from '../types/projectAdapter';

const GENERIC_TITAN_ADAPTER: ProjectAdapter = {
  id: 'adapter.titan.generic.v1',
  typeId: 'titan-scene',
  displayName: 'Titan Generic Scene Adapter',
  runtime: 'generic-scene',
  importFormats: ['glb', 'gltf', 'obj', 'fbx'],
  exportFormats: ['original', 'glb', 'obj'],
  sceneContract: 'titan.scene.v1',
  bridge: 'generic-export-bridge',
  assetResolution: {
    acceptedExtensions: ['.glb', '.gltf', '.obj', '.fbx'],
    preferAssetLibrary: true,
    allowRelativePaths: true,
  },
  materialEnvironment: {
    supportsPBR: true,
    allowEnvironmentOverride: true,
  },
  cameraPath: {
    supportsCameraPresets: true,
    supportsCameraPaths: true,
    supportsAuthoringPaths: true,
  },
  capabilities: {
    terrain: true,
    collisionZones: true,
    prefabs: true,
    materialAuthoring: true,
    environmentControls: true,
    pathAuthoring: true,
    pluginExtensions: true,
  },
  authoringScope: {
    authoredByTitan: [
      'scene objects',
      'transforms',
      'materials/textures',
      'environment settings',
      'camera presets and paths',
      'collision zones and metadata tags',
    ],
    runtimeOwned: [
      'runtime bootstrap',
      'runtime-specific script execution',
    ],
    unsupported: [],
  },
};

const SWIM26_BABYLON_ADAPTER: ProjectAdapter = {
  id: 'adapter.swim26.babylon.v1',
  typeId: 'swim26-babylon',
  displayName: 'SWIM26 Babylon Adapter',
  runtime: 'babylon',
  importFormats: ['glb', 'gltf', 'obj'],
  exportFormats: ['original', 'glb', 'swim26-manifest'],
  sceneContract: 'swim26.scene-manifest.v1',
  bridge: 'babylon-swim26-bridge',
  assetResolution: {
    acceptedExtensions: ['.glb', '.gltf', '.obj'],
    preferAssetLibrary: true,
    allowRelativePaths: false,
  },
  materialEnvironment: {
    supportsPBR: true,
    allowEnvironmentOverride: true,
    preferredEnvironmentPresetId: 'pool-competition',
  },
  cameraPath: {
    supportsCameraPresets: true,
    supportsCameraPaths: true,
    supportsAuthoringPaths: true,
  },
  capabilities: {
    terrain: false,
    collisionZones: true,
    prefabs: true,
    materialAuthoring: true,
    environmentControls: true,
    pathAuthoring: true,
    pluginExtensions: false,
  },
  authoringScope: {
    authoredByTitan: [
      'scene objects',
      'transforms',
      'materials and textures',
      'environment settings',
      'camera paths',
      'tags and metadata',
      'runtime-consumable scene manifest',
    ],
    runtimeOwned: [
      'SWIM26 gameplay code',
      'Babylon runtime bootstrap and execution pipeline',
      'runtime networking and game-state orchestration',
    ],
    unsupported: [
      'live runtime script debugging',
      'runtime-owned procedural gameplay systems',
    ],
  },
  unsupportedNotes: [
    'SWIM26 runtime owns gameplay systems and scripting bindings.',
    'Titan does not author Babylon runtime boot code.',
  ],
};

const GENERIC_TITAN_PROFILE: ProjectProfile = {
  id: 'profile.titan.generic.v1',
  displayName: 'Generic Titan Scene',
  typeId: 'titan-scene',
  preferredAdapterId: GENERIC_TITAN_ADAPTER.id,
  runtimeTarget: 'generic-scene',
  expectedSceneContract: 'titan.scene.v1',
  capabilities: GENERIC_TITAN_ADAPTER.capabilities,
  defaults: {
    preferredExportFormat: 'original',
    enableCameraPathsByDefault: true,
    enablePathAuthoringByDefault: true,
  },
};

const SWIM26_PROFILE: ProjectProfile = {
  id: 'profile.swim26.babylon.v1',
  displayName: 'SWIM26 Babylon Project',
  typeId: 'swim26-babylon',
  preferredAdapterId: SWIM26_BABYLON_ADAPTER.id,
  runtimeTarget: 'babylon',
  expectedSceneContract: 'swim26.scene-manifest.v1',
  capabilities: SWIM26_BABYLON_ADAPTER.capabilities,
  defaults: {
    preferredExportFormat: 'swim26-manifest',
    preferredEnvironmentPresetId: 'pool-competition',
    enableCameraPathsByDefault: true,
    enablePathAuthoringByDefault: true,
  },
};

const ADAPTERS: ProjectAdapter[] = [GENERIC_TITAN_ADAPTER, SWIM26_BABYLON_ADAPTER];
const PROFILES: ProjectProfile[] = [GENERIC_TITAN_PROFILE, SWIM26_PROFILE];

const SWIM26_MARKERS = ['swim26.config.json', 'babylon.config.json', 'swim26.manifest.json'];

const includesAny = (stack: string[] | undefined, needles: string[]): boolean => {
  if (!stack) return false;
  const normalized = stack.map(item => item.toLowerCase());
  return needles.some(marker => normalized.includes(marker.toLowerCase()));
};

const looksLikeSwim26 = (probe: ProjectMetadataProbe): boolean => {
  const packageName = probe.packageName?.toLowerCase() ?? '';
  const deps = probe.dependencies?.map(d => d.toLowerCase()) ?? [];

  return (
    includesAny(probe.markerFiles, SWIM26_MARKERS) ||
    packageName.includes('swim26') ||
    deps.includes('babylonjs') ||
    deps.includes('@babylonjs/core') ||
    probe.profileHint === 'swim26-babylon' ||
    probe.adapterHint === SWIM26_BABYLON_ADAPTER.id ||
    probe.runtimeHint === 'babylon'
  );
};

const resolveProfile = (profileId: string): ProjectProfile => {
  const profile = PROFILES.find(p => p.id === profileId);
  if (!profile) {
    throw new Error(`Unknown profile "${profileId}"`);
  }
  return profile;
};

export const listProjectAdapters = (): ProjectAdapter[] => ADAPTERS;
export const listProjectProfiles = (): ProjectProfile[] => PROFILES;

export const getAdapterById = (adapterId: string): ProjectAdapter => {
  const adapter = ADAPTERS.find(item => item.id === adapterId);
  if (!adapter) {
    throw new Error(`Unknown adapter "${adapterId}"`);
  }
  return adapter;
};

export const getAdapterForProjectType = (typeId: ProjectTypeId): ProjectAdapter => {
  const adapter = ADAPTERS.find(item => item.typeId === typeId);
  if (!adapter) {
    throw new Error(`No adapter registered for project type "${typeId}"`);
  }
  return adapter;
};

export const getBridgeForAdapter = (adapterId: string): string => getAdapterById(adapterId).bridge;

export const validateProfileAdapterCompatibility = (
  profile: ProjectProfile,
  adapter: ProjectAdapter
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (profile.typeId !== adapter.typeId) {
    errors.push(`Profile type "${profile.typeId}" does not match adapter type "${adapter.typeId}".`);
  }
  if (profile.runtimeTarget !== adapter.runtime) {
    errors.push(`Profile runtime "${profile.runtimeTarget}" does not match adapter runtime "${adapter.runtime}".`);
  }
  if (profile.expectedSceneContract !== adapter.sceneContract) {
    errors.push(
      `Profile scene contract "${profile.expectedSceneContract}" does not match adapter contract "${adapter.sceneContract}".`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const detectProjectProfile = (probe: ProjectMetadataProbe): ProjectSelectionResult => {
  if (probe.profileHint) {
    const hinted = PROFILES.find(profile => profile.id === probe.profileHint || profile.typeId === probe.profileHint);
    if (hinted) {
      const adapter = getAdapterById(hinted.preferredAdapterId);
      return {
        profile: hinted,
        adapter,
        detection: {
          mode: 'guided',
          reason: `Profile hint "${probe.profileHint}" was provided.`,
          confidence: 'high',
        },
      };
    }
  }

  if (looksLikeSwim26(probe)) {
    const profile = resolveProfile(SWIM26_PROFILE.id);
    const adapter = getAdapterById(profile.preferredAdapterId);
    return {
      profile,
      adapter,
      detection: {
        mode: 'automatic',
        reason: 'Detected SWIM26/Babylon project markers or dependencies.',
        confidence: 'high',
      },
    };
  }

  const profile = resolveProfile(GENERIC_TITAN_PROFILE.id);
  const adapter = getAdapterById(profile.preferredAdapterId);
  return {
    profile,
    adapter,
    detection: {
      mode: 'fallback',
      reason: 'No explicit runtime markers found. Falling back to generic Titan profile.',
      confidence: 'low',
    },
  };
};


export const getProjectSelectionGuidance = (probe: ProjectMetadataProbe): ProjectSelectionGuidance => {
  const selection = detectProjectProfile(probe);

  if (selection.detection.confidence === 'low') {
    return {
      requiresUserSelection: true,
      options: [...PROFILES].sort((a, b) => (a.typeId === 'swim26-babylon' ? -1 : 1) - (b.typeId === 'swim26-babylon' ? -1 : 1)).map(profile => ({
        label: profile.typeId === 'swim26-babylon' ? 'SWIM26 Game Builder (Babylon Runtime)' : 'Generic Titan Scene',
        profileId: profile.id,
        adapterId: profile.preferredAdapterId,
        reason: profile.typeId === 'swim26-babylon'
          ? 'Best for SWIM26 production work with Babylon runtime handoff.'
          : 'Use this for non-SWIM26 scene authoring.',
      })),
    };
  }

  return {
    requiresUserSelection: false,
    options: [
      {
        label: selection.profile.displayName,
        profileId: selection.profile.id,
        adapterId: selection.adapter.id,
        reason: selection.detection.reason,
      },
    ],
  };
};

export const selectProjectAdapter = (probe: ProjectMetadataProbe): ProjectSelectionResult => {
  const selection = detectProjectProfile(probe);
  const compatibility = validateProfileAdapterCompatibility(selection.profile, selection.adapter);

  if (!compatibility.valid) {
    throw new Error(`Invalid profile/adapter combination: ${compatibility.errors.join(' ')}`);
  }

  return selection;
};

export const validateExportFormatForAdapter = (adapterId: string, format: string): void => {
  const adapter = getAdapterById(adapterId);
  if (!adapter.exportFormats.includes(format as any)) {
    throw new Error(
      `Format "${format}" is not supported by adapter "${adapter.displayName}". Supported: ${adapter.exportFormats.join(', ')}`
    );
  }
};

export const getRuntimeByAdapter = (adapterId: string): RuntimeType => getAdapterById(adapterId).runtime;
