
export type MaterialCategory = 
  | 'Concrete'
  | 'Tile'
  | 'Water'
  | 'Metal'
  | 'Plastic'
  | 'Wood'
  | 'Fabric'
  | 'Glass'
  | 'Sports Surface'
  | 'UI/Ad Surface'
  | 'Custom';

export interface MaterialPreset {
  id: string;
  name: string;
  category: MaterialCategory;
  
  // Basic properties
  color: string;
  opacity: number;
  transparent: boolean;
  
  // PBR properties
  roughness: number;
  metalness: number;
  emissiveColor: string;
  emissiveIntensity: number;
  
  // Texture maps (URLs or Asset IDs)
  mapUrl?: string;
  normalMapUrl?: string;
  roughnessMapUrl?: string;
  metalnessMapUrl?: string;
  emissiveMapUrl?: string;
  alphaMapUrl?: string;
  
  // UV Transform
  tiling: [number, number];
  offset: [number, number];
  rotation: number;
  
  // Advanced
  wireframe: boolean;
  side: 'front' | 'back' | 'double';
}

export const DEFAULT_MATERIAL: MaterialPreset = {
  id: 'default',
  name: 'Default Material',
  category: 'Custom',
  color: '#ffffff',
  opacity: 1,
  transparent: false,
  roughness: 0.5,
  metalness: 0,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  tiling: [1, 1],
  offset: [0, 0],
  rotation: 0,
  wireframe: false,
  side: 'front'
};
