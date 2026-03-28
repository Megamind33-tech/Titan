// ─── Zone Types ───────────────────────────────────────────────────────────────

export type CollisionZoneType =
  | 'ground_surface'
  | 'floor'
  | 'no_placement'
  | 'walkable'
  | 'boundary'
  | 'water'
  | 'ad_placement'
  | 'flag_placement'
  | 'seating_barrier'
  | 'pool_structure_boundary'
  | 'camera_restricted'
  | 'custom';

export type ZoneShape = 'box' | 'cylinder' | 'sphere';

export type PlacementStatus = 'valid' | 'warning' | 'invalid';

export type PlacementViolationReason =
  | 'overlaps_protected_object'
  | 'outside_allowed_zone'
  | 'below_ground'
  | 'floating_above_surface'
  | 'incompatible_surface'
  | 'in_no_placement_zone'
  | 'in_water_zone'
  | 'in_camera_restricted_zone'
  | 'missing_required_zone'
  | 'exceeds_zone_boundary'
  | 'blocked_by_zone_rule';

export interface PlacementViolation {
  reason: PlacementViolationReason;
  message: string;
  severity: 'warning' | 'error';
  zoneId?: string;
  zoneName?: string;
}

export interface PlacementValidationResult {
  status: PlacementStatus;
  violations: PlacementViolation[];
  suggestedPosition?: [number, number, number];
  snapTarget?: { zoneId: string; surfaceY: number };
}

// ─── Zone Definition ──────────────────────────────────────────────────────────

export interface CollisionZone {
  id: string;
  name: string;
  type: CollisionZoneType;
  enabled: boolean;

  // Transform (scale = half-extents for box, radius+height for sphere/cylinder)
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];

  shape: ZoneShape;

  // Tag-based rules
  allowedTags: string[];
  blockedTags: string[];

  // Category-based rules (matches AssetCategory)
  allowedCategories: string[];
  blockedCategories: string[];

  // Editor visuals
  color: string;
  visible: boolean;

  notes?: string;

  // For future runtime/gameplay export
  exportToRuntime?: boolean;
}

// ─── Zone Type Metadata ───────────────────────────────────────────────────────

export interface ZoneTypeDefinition {
  type: CollisionZoneType;
  label: string;
  description: string;
  defaultColor: string;
  defaultAllowedTags: string[];
  defaultBlockedTags: string[];
  defaultAllowedCategories: string[];
  defaultBlockedCategories: string[];
}

export const ZONE_TYPE_DEFINITIONS: ZoneTypeDefinition[] = [
  {
    type: 'ground_surface',
    label: 'Ground Surface',
    description: 'Main ground or terrain surface. Grounded props snap here.',
    defaultColor: '#4ade80',
    defaultAllowedTags: ['Grounded', 'Outdoor', 'Environment', 'Decorative'],
    defaultBlockedTags: ['Water-Related'],
    defaultAllowedCategories: ['Models', 'Props', 'Environment', 'Ground'],
    defaultBlockedCategories: ['Water'],
  },
  {
    type: 'floor',
    label: 'Floor Zone',
    description: 'Indoor floors, arena floors, pool decks.',
    defaultColor: '#60a5fa',
    defaultAllowedTags: ['Grounded', 'Indoor', 'Structural', 'Surface Object'],
    defaultBlockedTags: ['Water-Related'],
    defaultAllowedCategories: ['Models', 'Props'],
    defaultBlockedCategories: ['Water'],
  },
  {
    type: 'no_placement',
    label: 'No Placement Zone',
    description: 'No objects may be placed here. Hard block for all assets.',
    defaultColor: '#f87171',
    defaultAllowedTags: [],
    defaultBlockedTags: [],
    defaultAllowedCategories: [],
    defaultBlockedCategories: [],
  },
  {
    type: 'walkable',
    label: 'Walkable Zone',
    description: 'Walkways, aisles, pool decks where movement should not be blocked.',
    defaultColor: '#a3e635',
    defaultAllowedTags: ['Grounded', 'Decorative'],
    defaultBlockedTags: ['Structural'],
    defaultAllowedCategories: ['Props', 'Models'],
    defaultBlockedCategories: [],
  },
  {
    type: 'boundary',
    label: 'Boundary Zone',
    description: 'Scene or venue outer boundary. Objects must remain inside.',
    defaultColor: '#fb923c',
    defaultAllowedTags: [],
    defaultBlockedTags: [],
    defaultAllowedCategories: [],
    defaultBlockedCategories: [],
  },
  {
    type: 'water',
    label: 'Water Zone',
    description: 'Pool or water body. Only water-related assets allowed unless overridden.',
    defaultColor: '#38bdf8',
    defaultAllowedTags: ['Water-Related'],
    defaultBlockedTags: ['Grounded', 'Indoor', 'Structural'],
    defaultAllowedCategories: ['Water'],
    defaultBlockedCategories: ['Models', 'Props'],
  },
  {
    type: 'ad_placement',
    label: 'Ad Placement Zone',
    description: 'Designated area for advertisement boards.',
    defaultColor: '#fbbf24',
    defaultAllowedTags: ['Ad Placement', 'Signage'],
    defaultBlockedTags: [],
    defaultAllowedCategories: ['Ads and Signage'],
    defaultBlockedCategories: [],
  },
  {
    type: 'flag_placement',
    label: 'Flag Placement Zone',
    description: 'Designated area for national or team flags.',
    defaultColor: '#c084fc',
    defaultAllowedTags: ['Flag Placement'],
    defaultBlockedTags: [],
    defaultAllowedCategories: ['Models', 'Props'],
    defaultBlockedCategories: [],
  },
  {
    type: 'seating_barrier',
    label: 'Seating / Barrier Zone',
    description: 'Area for audience seating or crowd barriers.',
    defaultColor: '#f472b6',
    defaultAllowedTags: ['Structural', 'Decorative', 'Indoor'],
    defaultBlockedTags: ['Water-Related'],
    defaultAllowedCategories: ['Models', 'Props'],
    defaultBlockedCategories: ['Water'],
  },
  {
    type: 'pool_structure_boundary',
    label: 'Pool Structure Boundary',
    description: 'Pool perimeter. Prevents invalid overlaps with pool walls or shell.',
    defaultColor: '#22d3ee',
    defaultAllowedTags: ['Structural', 'Collision-Sensitive'],
    defaultBlockedTags: ['Decorative'],
    defaultAllowedCategories: ['Models'],
    defaultBlockedCategories: ['Props', 'Ads and Signage'],
  },
  {
    type: 'camera_restricted',
    label: 'Camera Restricted Zone',
    description: 'Area where cameras and camera anchors must not enter.',
    defaultColor: '#e879f9',
    defaultAllowedTags: [],
    defaultBlockedTags: ['Camera Anchor'],
    defaultAllowedCategories: [],
    defaultBlockedCategories: [],
  },
  {
    type: 'custom',
    label: 'Custom Zone',
    description: 'User-defined zone with fully custom placement rules.',
    defaultColor: '#94a3b8',
    defaultAllowedTags: [],
    defaultBlockedTags: [],
    defaultAllowedCategories: [],
    defaultBlockedCategories: [],
  },
];

export function getZoneTypeDefinition(type: CollisionZoneType): ZoneTypeDefinition {
  return (
    ZONE_TYPE_DEFINITIONS.find(d => d.type === type) ??
    ZONE_TYPE_DEFINITIONS[ZONE_TYPE_DEFINITIONS.length - 1]
  );
}

export const DEFAULT_ZONE_COLORS: Record<CollisionZoneType, string> = Object.fromEntries(
  ZONE_TYPE_DEFINITIONS.map(d => [d.type, d.defaultColor])
) as Record<CollisionZoneType, string>;

/**
 * Create a new CollisionZone with defaults from its type definition.
 * Position and name must be supplied by the caller.
 */
export function createZoneFromType(
  type: CollisionZoneType,
  name: string,
  position: [number, number, number] = [0, 0, 0]
): CollisionZone {
  const def = getZoneTypeDefinition(type);
  return {
    id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    type,
    enabled: true,
    position,
    rotation: [0, 0, 0],
    scale: [5, 1, 5],
    shape: 'box',
    allowedTags: [...def.defaultAllowedTags],
    blockedTags: [...def.defaultBlockedTags],
    allowedCategories: [...def.defaultAllowedCategories],
    blockedCategories: [...def.defaultBlockedCategories],
    color: def.defaultColor,
    visible: true,
    exportToRuntime: false,
  };
}
