export type ProjectTypeId = 'titan-scene' | 'swim26-babylon';
export type RuntimeType = 'generic-scene' | 'babylon' | 'three';

export type SceneContractId =
  | 'titan.scene.v1'
  | 'swim26.scene-manifest.v1';

export type BridgeId =
  | 'generic-export-bridge'
  | 'babylon-swim26-bridge';

export type ImportFormat = 'glb' | 'gltf' | 'obj' | 'fbx';
export type ExportFormat = 'original' | 'glb' | 'obj' | 'swim26-manifest';

export interface AssetResolutionRules {
  acceptedExtensions: string[];
  preferAssetLibrary: boolean;
  allowRelativePaths: boolean;
}

export interface MaterialEnvironmentRules {
  supportsPBR: boolean;
  allowEnvironmentOverride: boolean;
  preferredEnvironmentPresetId?: string;
}

export interface CameraPathRules {
  supportsCameraPresets: boolean;
  supportsCameraPaths: boolean;
  supportsAuthoringPaths: boolean;
}

export interface EditorCapabilityFlags {
  terrain: boolean;
  collisionZones: boolean;
  prefabs: boolean;
  materialAuthoring: boolean;
  environmentControls: boolean;
  pathAuthoring: boolean;
  pluginExtensions: boolean;
}


export interface ProjectAuthoringScope {
  authoredByTitan: string[];
  runtimeOwned: string[];
  unsupported: string[];
}

export interface ProjectAdapter {
  id: string;
  typeId: ProjectTypeId;
  displayName: string;
  runtime: RuntimeType;
  importFormats: ImportFormat[];
  exportFormats: ExportFormat[];
  sceneContract: SceneContractId;
  bridge: BridgeId;
  assetResolution: AssetResolutionRules;
  materialEnvironment: MaterialEnvironmentRules;
  cameraPath: CameraPathRules;
  capabilities: EditorCapabilityFlags;
  authoringScope: ProjectAuthoringScope;
  unsupportedNotes?: string[];
}

export interface ProjectProfile {
  id: string;
  displayName: string;
  typeId: ProjectTypeId;
  preferredAdapterId: string;
  runtimeTarget: RuntimeType;
  expectedSceneContract: SceneContractId;
  capabilities: EditorCapabilityFlags;
  defaults: {
    preferredExportFormat: ExportFormat;
    preferredEnvironmentPresetId?: string;
    enableCameraPathsByDefault: boolean;
    enablePathAuthoringByDefault: boolean;
  };
}

export interface ProjectMetadataProbe {
  rootPath?: string;
  profileHint?: string;
  adapterHint?: string;
  runtimeHint?: RuntimeType;
  markerFiles?: string[];
  packageName?: string;
  dependencies?: string[];
}

export interface ProjectSelectionResult {
  profile: ProjectProfile;
  adapter: ProjectAdapter;
  detection: {
    mode: 'automatic' | 'guided' | 'fallback';
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface ProjectSelectionGuidance {
  requiresUserSelection: boolean;
  options: Array<{
    label: string;
    profileId: string;
    adapterId: string;
    reason: string;
  }>;
}

export interface BridgeContract {
  id: BridgeId;
  runtime: RuntimeType;
  sceneContract: SceneContractId;
  supportedExportFormats: ExportFormat[];
  supportsPaths: boolean;
  supportsMaterials: boolean;
}
