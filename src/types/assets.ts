
export type AssetCategory = 
  | 'Models'
  | 'Environment'
  | 'Ground'
  | 'Water'
  | 'Props'
  | 'Ads and Signage'
  | 'Textures'
  | 'Materials'
  | 'Lights'
  | 'Saved Presets';

export type AssetType = 'model' | 'texture' | 'material' | 'light' | 'preset' | 'environment';

export interface AssetMetadata {
  assetId: string;
  name: string;
  type: AssetType;
  category: AssetCategory;
  sourcePath?: string;
  fileSize: number;
  textureLinks?: string[];
  materialLinks?: string[];
  optimizedStatus: 'optimized' | 'unoptimized' | 'heavy';
  version: number;
  editStatus: 'original' | 'edited';
  classification: 'indoor' | 'outdoor' | 'both';
  exportCompatibility: 'ready' | 'issues' | 'unsupported';
  tags: string[];
  importDate: number;
}

export interface Asset {
  id: string;
  metadata: AssetMetadata;
  url: string; // Blob URL or external URL
  thumbnailUrl?: string;
  file?: File;
}
