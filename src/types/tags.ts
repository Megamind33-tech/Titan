export type BehaviorTag = 
  | 'Decorative'
  | 'Structural'
  | 'Environment'
  | 'Grounded'
  | 'Surface Object'
  | 'Indoor'
  | 'Outdoor'
  | 'Clickable'
  | 'Selectable'
  | 'Movable'
  | 'Replaceable'
  | 'Prefab Source'
  | 'Prefab Instance'
  | 'Gameplay-Critical'
  | 'Camera Anchor'
  | 'Light Anchor'
  | 'Ad Placement'
  | 'Flag Placement'
  | 'Signage'
  | 'Water-Related'
  | 'Collision-Sensitive'
  | 'Export-Sensitive'
  | 'Locked Layout Asset'
  | 'Helper Object'
  | 'Hidden Support Object'
  | string;

export interface TagDefinition {
  tag: BehaviorTag;
  description: string;
  category: string;
}

export const PREDEFINED_TAGS: TagDefinition[] = [
  { tag: 'Decorative', description: 'Visual only, no gameplay impact.', category: 'General' },
  { tag: 'Structural', description: 'Forms the physical bounds of the level.', category: 'General' },
  { tag: 'Environment', description: 'Part of the background or setting.', category: 'General' },
  { tag: 'Grounded', description: 'Should snap to the floor/terrain.', category: 'Placement' },
  { tag: 'Surface Object', description: 'Placed on walls or other surfaces.', category: 'Placement' },
  { tag: 'Indoor', description: 'Belongs inside a building.', category: 'Location' },
  { tag: 'Outdoor', description: 'Belongs outside.', category: 'Location' },
  { tag: 'Clickable', description: 'Can be clicked by the player.', category: 'Interaction' },
  { tag: 'Selectable', description: 'Can be selected in-game.', category: 'Interaction' },
  { tag: 'Movable', description: 'Can move during gameplay.', category: 'Interaction' },
  { tag: 'Replaceable', description: 'Intended to be swapped out.', category: 'Editor' },
  { tag: 'Prefab Source', description: 'Original source of a prefab.', category: 'Editor' },
  { tag: 'Prefab Instance', description: 'Instance of a prefab.', category: 'Editor' },
  { tag: 'Gameplay-Critical', description: 'Required for the game to function.', category: 'Logic' },
  { tag: 'Camera Anchor', description: 'A point of interest for cameras.', category: 'Logic' },
  { tag: 'Light Anchor', description: 'A point of interest for lighting.', category: 'Logic' },
  { tag: 'Ad Placement', description: 'Location for dynamic advertisements.', category: 'Swimming Game' },
  { tag: 'Flag Placement', description: 'Location for national/team flags.', category: 'Swimming Game' },
  { tag: 'Signage', description: 'Signs and text displays.', category: 'Swimming Game' },
  { tag: 'Water-Related', description: 'Interacts with or is near water.', category: 'Swimming Game' },
  { tag: 'Collision-Sensitive', description: 'Requires precise collision meshes.', category: 'Logic' },
  { tag: 'Export-Sensitive', description: 'Requires special handling during export.', category: 'Editor' },
  { tag: 'Locked Layout Asset', description: 'Should not be moved accidentally.', category: 'Editor' },
  { tag: 'Helper Object', description: 'Editor-only helper, not exported.', category: 'Editor' },
  { tag: 'Hidden Support Object', description: 'Invisible collision or trigger.', category: 'Logic' },
];
