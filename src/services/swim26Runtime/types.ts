export interface BabylonLikeVector3 {
  x: number;
  y: number;
  z: number;
}

export interface BabylonLikeColor3 {
  r: number;
  g: number;
  b: number;
}

export interface BabylonLikePBRMaterial {
  name: string;
  albedoColor?: BabylonLikeColor3;
  alpha?: number;
  metallic?: number;
  roughness?: number;
  emissiveColor?: BabylonLikeColor3;
  albedoTextureUrl?: string;
}

export interface BabylonLikeMesh {
  id: string;
  name: string;
  position: BabylonLikeVector3;
  rotation: BabylonLikeVector3;
  scaling: BabylonLikeVector3;
  material?: BabylonLikePBRMaterial;
  metadata?: Record<string, any>;
  isEnabled?: boolean;
  visibility?: number;
}

export interface BabylonLikeScene {
  meshes: BabylonLikeMesh[];
  clearColor?: string;
  environmentPresetId?: string;
  environmentIntensity?: number;
}

export type RuntimeSeverity = 'info' | 'warning' | 'error';

export interface RuntimeDiagnostic {
  severity: RuntimeSeverity;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}
