import { ModelData } from '../App';

export type PrefabCategory = 
  | 'Pool Elements'
  | 'Props'
  | 'Ads and Signage'
  | 'Environment'
  | 'Structural Sets'
  | 'Lights'
  | 'Decorations'
  | 'Gameplay Objects'
  | 'Custom';

export interface Prefab {
  id: string;
  name: string;
  category: PrefabCategory;
  thumbnail?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  /**
   * The models that make up this prefab.
   * The first model is considered the root if it's a grouped prefab.
   * All positions/rotations/scales in these models are relative to the root.
   */
  models: ModelData[];
}

export const PREFAB_CATEGORIES: PrefabCategory[] = [
  'Pool Elements',
  'Props',
  'Ads and Signage',
  'Environment',
  'Structural Sets',
  'Lights',
  'Decorations',
  'Gameplay Objects',
  'Custom'
];
