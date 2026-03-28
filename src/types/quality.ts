export type ShadowQuality = 'none' | 'low' | 'medium' | 'high';
export type TextureQuality = 'low' | 'medium' | 'high';
export type PostProcessingLevel = 'none' | 'low' | 'medium' | 'high';

export interface QualitySettings {
  textureQuality: TextureQuality;
  shadowQuality: ShadowQuality;
  maxLightCount: number;
  reflectionQuality: 'none' | 'low' | 'high';
  postProcessingLevel: PostProcessingLevel;
  drawDistance: number;
  fogEnabled: boolean;
  antiAliasing: boolean;
}

export interface DeviceProfile {
  id: string;
  name: string;
  settings: QualitySettings;
}
