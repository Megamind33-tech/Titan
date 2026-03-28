import { DeviceProfile } from '../types/quality';

export const DEFAULT_PROFILES: DeviceProfile[] = [
  {
    id: 'low',
    name: 'Low-end Android 12+',
    settings: {
      textureQuality: 'low',
      shadowQuality: 'none',
      maxLightCount: 2,
      reflectionQuality: 'none',
      postProcessingLevel: 'none',
      drawDistance: 50,
      fogEnabled: false,
      antiAliasing: false
    }
  },
  {
    id: 'mid',
    name: 'Mid-range Android 12+',
    settings: {
      textureQuality: 'medium',
      shadowQuality: 'low',
      maxLightCount: 4,
      reflectionQuality: 'low',
      postProcessingLevel: 'low',
      drawDistance: 100,
      fogEnabled: true,
      antiAliasing: true
    }
  },
  {
    id: 'high',
    name: 'High-end Android 12+',
    settings: {
      textureQuality: 'high',
      shadowQuality: 'high',
      maxLightCount: 8,
      reflectionQuality: 'high',
      postProcessingLevel: 'high',
      drawDistance: 200,
      fogEnabled: true,
      antiAliasing: true
    }
  }
];
