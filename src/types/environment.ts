
export type EnvironmentCategory = 
  | 'Indoor'
  | 'Outdoor'
  | 'Studio'
  | 'Cinematic'
  | 'Performance'
  | 'Custom';

export interface EnvironmentPreset {
  id: string;
  name: string;
  category: EnvironmentCategory;
  
  // Ambient Light
  ambientColor: string;
  ambientIntensity: number;
  
  // Hemisphere Light
  hemisphereColor: string;
  hemisphereGroundColor: string;
  hemisphereIntensity: number;
  
  // Directional Light
  directionalColor: string;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
  castShadows: boolean;
  shadowBias: number;
  shadowNormalBias: number;
  
  // Environment / Sky
  backgroundType: 'color' | 'skybox' | 'preset';
  backgroundColor: string;
  environmentPreset: 'apartment' | 'city' | 'forest' | 'dawn' | 'night' | 'warehouse' | 'sunset' | 'park' | 'studio' | 'lobby';
  environmentIntensity: number;
  
  // Fog
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  fogDensity: number;
  fogType: 'linear' | 'exp2';
  
  // Post-processing (Tone mapping)
  exposure: number;
  toneMapping: 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic';
  
  // Realism
  ssaoEnabled: boolean;
  softShadowsEnabled: boolean;
  
  // Performance
  shadowMapSize: 512 | 1024 | 2048 | 4096;
}

export const DEFAULT_ENVIRONMENT: EnvironmentPreset = {
  id: 'default-studio',
  name: 'Default Studio',
  category: 'Studio',
  ambientColor: '#ffffff',
  ambientIntensity: 0.3,
  hemisphereColor: '#ffffff',
  hemisphereGroundColor: '#2a2b2e',
  hemisphereIntensity: 0.6,
  directionalColor: '#ffffff',
  directionalIntensity: 1.5,
  directionalPosition: [50, 50, 25],
  castShadows: true,
  shadowBias: -0.0005,
  shadowNormalBias: 0,
  backgroundType: 'color',
  backgroundColor: '#2a2b2e',
  environmentPreset: 'studio',
  environmentIntensity: 1,
  fogEnabled: false,
  fogColor: '#2a2b2e',
  fogNear: 1,
  fogFar: 1000,
  fogDensity: 0.002,
  fogType: 'linear',
  exposure: 1,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 2048
};

export const POOL_INDOOR_BRIGHT: EnvironmentPreset = {
  id: 'pool-indoor-bright',
  name: 'Pool Indoor Bright',
  category: 'Indoor',
  ambientColor: '#ffffff',
  ambientIntensity: 0.5,
  hemisphereColor: '#e0f2fe',
  hemisphereGroundColor: '#0c4a6e',
  hemisphereIntensity: 0.8,
  directionalColor: '#ffffff',
  directionalIntensity: 2.0,
  directionalPosition: [20, 40, 20],
  castShadows: true,
  shadowBias: -0.0001,
  shadowNormalBias: 0.02,
  backgroundType: 'color',
  backgroundColor: '#1e293b',
  environmentPreset: 'lobby',
  environmentIntensity: 1.2,
  fogEnabled: true,
  fogColor: '#1e293b',
  fogNear: 50,
  fogFar: 300,
  fogDensity: 0.001,
  fogType: 'linear',
  exposure: 1.1,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 2048
};

export const POOL_COMPETITION: EnvironmentPreset = {
  id: 'pool-competition',
  name: 'Competition Arena',
  category: 'Indoor',
  ambientColor: '#ffffff',
  ambientIntensity: 0.2,
  hemisphereColor: '#ffffff',
  hemisphereGroundColor: '#000000',
  hemisphereIntensity: 0.4,
  directionalColor: '#ffffff',
  directionalIntensity: 4.0,
  directionalPosition: [0, 100, 0],
  castShadows: true,
  shadowBias: -0.0005,
  shadowNormalBias: 0.05,
  backgroundType: 'color',
  backgroundColor: '#000000',
  environmentPreset: 'studio',
  environmentIntensity: 0.5,
  fogEnabled: true,
  fogColor: '#000000',
  fogNear: 100,
  fogFar: 500,
  fogDensity: 0.001,
  fogType: 'linear',
  exposure: 1.0,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 4096
};

export const OUTDOOR_SUNSET: EnvironmentPreset = {
  id: 'outdoor-sunset',
  name: 'Golden Hour',
  category: 'Outdoor',
  ambientColor: '#ffedd5',
  ambientIntensity: 0.4,
  hemisphereColor: '#fdba74',
  hemisphereGroundColor: '#431407',
  hemisphereIntensity: 0.6,
  directionalColor: '#fb923c',
  directionalIntensity: 3.0,
  directionalPosition: [50, 10, -50],
  castShadows: true,
  shadowBias: -0.0005,
  shadowNormalBias: 0.05,
  backgroundType: 'preset',
  backgroundColor: '#431407',
  environmentPreset: 'sunset',
  environmentIntensity: 1.5,
  fogEnabled: true,
  fogColor: '#7c2d12',
  fogNear: 10,
  fogFar: 1000,
  fogDensity: 0.005,
  fogType: 'exp2',
  exposure: 1.2,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 2048
};

export const CINEMATIC_NIGHT: EnvironmentPreset = {
  id: 'cinematic-night',
  name: 'Cinematic Night',
  category: 'Cinematic',
  ambientColor: '#1e1b4b',
  ambientIntensity: 0.1,
  hemisphereColor: '#1e1b4b',
  hemisphereGroundColor: '#000000',
  hemisphereIntensity: 0.2,
  directionalColor: '#6366f1',
  directionalIntensity: 2.0,
  directionalPosition: [-20, 30, -20],
  castShadows: true,
  shadowBias: -0.0001,
  shadowNormalBias: 0.05,
  backgroundType: 'preset',
  backgroundColor: '#000000',
  environmentPreset: 'night',
  environmentIntensity: 0.3,
  fogEnabled: true,
  fogColor: '#000000',
  fogNear: 5,
  fogFar: 100,
  fogDensity: 0.02,
  fogType: 'exp2',
  exposure: 0.8,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 2048
};

export const REALISTIC_STUDIO: EnvironmentPreset = {
  id: 'realistic-studio',
  name: 'Realistic Studio',
  category: 'Studio',
  ambientColor: '#ffffff',
  ambientIntensity: 0.1,
  hemisphereColor: '#ffffff',
  hemisphereGroundColor: '#2a2b2e',
  hemisphereIntensity: 0.3,
  directionalColor: '#ffffff',
  directionalIntensity: 2.5,
  directionalPosition: [10, 20, 10],
  castShadows: true,
  shadowBias: -0.0005,
  shadowNormalBias: 0.02,
  backgroundType: 'color',
  backgroundColor: '#1a1a1a',
  environmentPreset: 'studio',
  environmentIntensity: 1.5,
  fogEnabled: false,
  fogColor: '#1a1a1a',
  fogNear: 1,
  fogFar: 1000,
  fogDensity: 0.002,
  fogType: 'linear',
  exposure: 1.2,
  toneMapping: 'ACESFilmic',
  ssaoEnabled: true,
  softShadowsEnabled: true,
  shadowMapSize: 4096
};
