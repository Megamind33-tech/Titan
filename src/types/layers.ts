export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
  isCustom?: boolean;
  order: number;
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'env', name: 'Main Environment', visible: true, locked: false, order: 0 },
  { id: 'ground', name: 'Ground', visible: true, locked: false, order: 1 },
  { id: 'water', name: 'Water', visible: true, locked: false, order: 2 },
  { id: 'buildings', name: 'Buildings', visible: true, locked: false, order: 3 },
  { id: 'pool', name: 'Pool Structure', visible: true, locked: false, order: 4 },
  { id: 'props', name: 'Props', visible: true, locked: false, order: 5 },
  { id: 'ads', name: 'Ads and Signage', visible: true, locked: false, order: 6 },
  { id: 'decals', name: 'Flags and Decals', visible: true, locked: false, order: 7 },
  { id: 'lights', name: 'Lights', visible: true, locked: false, order: 8 },
  { id: 'cameras', name: 'Cameras', visible: true, locked: false, order: 9 },
  { id: 'helpers', name: 'Helper Objects', visible: true, locked: false, order: 10 },
  { id: 'gameplay', name: 'Gameplay Objects', visible: true, locked: false, order: 11 },
];
