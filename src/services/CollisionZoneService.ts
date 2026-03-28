import {
  CollisionZone,
  PlacementValidationResult,
  PlacementViolation,
  PlacementStatus,
} from '../types/collision';
import { ModelData } from '../App';

// ─── Point-in-Zone Tests ──────────────────────────────────────────────────────

function isPointInBox(
  point: [number, number, number],
  zone: CollisionZone
): boolean {
  const [px, py, pz] = point;
  const [zx, zy, zz] = zone.position;
  const [sx, sy, sz] = zone.scale;
  return (
    px >= zx - sx && px <= zx + sx &&
    py >= zy - sy && py <= zy + sy &&
    pz >= zz - sz && pz <= zz + sz
  );
}

function isPointInSphere(
  point: [number, number, number],
  zone: CollisionZone
): boolean {
  const [px, py, pz] = point;
  const [zx, zy, zz] = zone.position;
  const radius = Math.max(...zone.scale);
  const dx = px - zx, dy = py - zy, dz = pz - zz;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

function isPointInCylinder(
  point: [number, number, number],
  zone: CollisionZone
): boolean {
  const [px, py, pz] = point;
  const [zx, zy, zz] = zone.position;
  const [sx, sy, sz] = zone.scale;
  const radius = Math.max(sx, sz);
  const dx = px - zx, dz = pz - zz;
  return (
    dx * dx + dz * dz <= radius * radius &&
    py >= zy - sy && py <= zy + sy
  );
}

export function isPointInZone(
  point: [number, number, number],
  zone: CollisionZone
): boolean {
  if (!zone.enabled) return false;
  switch (zone.shape) {
    case 'sphere':   return isPointInSphere(point, zone);
    case 'cylinder': return isPointInCylinder(point, zone);
    case 'box':
    default:         return isPointInBox(point, zone);
  }
}

export function getZonesContainingPoint(
  point: [number, number, number],
  zones: CollisionZone[]
): CollisionZone[] {
  return zones.filter(z => isPointInZone(point, z));
}

// ─── Object AABB Helpers ──────────────────────────────────────────────────────

export function getObjectBounds(model: ModelData): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const [x, y, z] = model.position;
  const dims = model.dimensions ?? { width: 1, height: 1, depth: 1 };
  const [sx, sy, sz] = model.scale;
  const hw = (dims.width  * sx) / 2;
  const hh = (dims.height * sy) / 2;
  const hd = (dims.depth  * sz) / 2;
  return {
    min: [x - hw, y - hh, z - hd],
    max: [x + hw, y + hh, z + hd],
  };
}

function getObjectCorners(model: ModelData): [number, number, number][] {
  const b = getObjectBounds(model);
  const corners: [number, number, number][] = [];
  for (const cx of [b.min[0], b.max[0]])
    for (const cy of [b.min[1], b.max[1]])
      for (const cz of [b.min[2], b.max[2]])
        corners.push([cx, cy, cz]);
  return corners;
}

/**
 * Returns true if any corner of the model's AABB, or its centre, is inside the zone.
 */
export function doesObjectOverlapZone(
  model: ModelData,
  zone: CollisionZone
): boolean {
  if (!zone.enabled) return false;
  const corners = getObjectCorners(model);
  if (corners.some(c => isPointInZone(c, zone))) return true;
  return isPointInZone(model.position as [number, number, number], zone);
}

// ─── Core Placement Validation ────────────────────────────────────────────────

/**
 * Validate whether a model can be placed at its current position
 * given the provided collision zones.
 *
 * Rules checked (in order):
 *  1. No-placement zone hard block
 *  2. Water zone – non-water-related objects warned/blocked
 *  3. Camera-restricted zone – cameras/anchors blocked
 *  4. Pool-structure boundary – blocked tags check
 *  5. Generic blocked-tag check across all zones
 *  6. Boundary zone – object must be inside at least one boundary zone
 *  7. Tag-specific preferred-zone requirements (ad boards → ad zones, flags → flag zones)
 *  8. Below-ground detection
 */
export function validatePlacement(
  model: ModelData,
  zones: CollisionZone[],
  _allModels: ModelData[]
): PlacementValidationResult {
  if (!zones.length) return { status: 'valid', violations: [] };

  const violations: PlacementViolation[] = [];
  const pos = model.position as [number, number, number];
  const tags = model.behaviorTags ?? [];

  const containingZones = zones.filter(z => doesObjectOverlapZone(model, z));

  // 1. No-placement zones – hard error
  for (const z of containingZones.filter(z => z.type === 'no_placement')) {
    violations.push({
      reason: 'in_no_placement_zone',
      message: `Blocked by no-placement zone "${z.name}"`,
      severity: 'error',
      zoneId: z.id,
      zoneName: z.name,
    });
  }

  // 2. Water zones – warn if non-water object
  for (const z of containingZones.filter(z => z.type === 'water')) {
    if (z.allowedTags.length > 0 && !tags.some(t => z.allowedTags.includes(t))) {
      violations.push({
        reason: 'in_water_zone',
        message: `Object enters water zone "${z.name}" but lacks a Water-Related tag`,
        severity: 'warning',
        zoneId: z.id,
        zoneName: z.name,
      });
    }
  }

  // 3. Camera-restricted zones
  for (const z of containingZones.filter(z => z.type === 'camera_restricted')) {
    if (model.type === 'camera' || tags.includes('Camera Anchor')) {
      violations.push({
        reason: 'in_camera_restricted_zone',
        message: `Camera/anchor enters restricted zone "${z.name}"`,
        severity: 'error',
        zoneId: z.id,
        zoneName: z.name,
      });
    }
  }

  // 4. Pool structure boundary
  for (const z of containingZones.filter(z => z.type === 'pool_structure_boundary')) {
    if (z.blockedTags.length > 0 && z.blockedTags.some(bt => tags.includes(bt))) {
      violations.push({
        reason: 'overlaps_protected_object',
        message: `Object overlaps pool structure boundary "${z.name}"`,
        severity: 'error',
        zoneId: z.id,
        zoneName: z.name,
      });
    }
  }

  // 5. Generic blocked-tag check (skipping already handled types)
  const handledTypes = new Set(['no_placement', 'water', 'camera_restricted', 'pool_structure_boundary']);
  for (const z of containingZones) {
    if (handledTypes.has(z.type)) continue;
    if (z.blockedTags.length > 0 && z.blockedTags.some(bt => tags.includes(bt))) {
      violations.push({
        reason: 'blocked_by_zone_rule',
        message: `Object tag is blocked by zone "${z.name}"`,
        severity: 'error',
        zoneId: z.id,
        zoneName: z.name,
      });
    }
  }

  // 6. Boundary zone: if any boundary zones exist, object must be inside one
  const boundaryZones = zones.filter(z => z.enabled && z.type === 'boundary');
  if (boundaryZones.length > 0 && !boundaryZones.some(z => doesObjectOverlapZone(model, z))) {
    violations.push({
      reason: 'exceeds_zone_boundary',
      message: 'Object is outside the scene boundary',
      severity: 'error',
    });
  }

  // 7. Tag-specific preferred-zone requirements
  if (tags.includes('Ad Placement') && zones.some(z => z.type === 'ad_placement')) {
    if (!containingZones.some(z => z.type === 'ad_placement')) {
      violations.push({
        reason: 'missing_required_zone',
        message: 'Ad board should be placed inside an Ad Placement zone',
        severity: 'warning',
      });
    }
  }

  if (tags.includes('Flag Placement') && zones.some(z => z.type === 'flag_placement')) {
    if (!containingZones.some(z => z.type === 'flag_placement')) {
      violations.push({
        reason: 'missing_required_zone',
        message: 'Flag should be placed inside a Flag Placement zone',
        severity: 'warning',
      });
    }
  }

  // 8. Below-ground check (Y < −0.05 is considered sunk)
  if (pos[1] < -0.05) {
    violations.push({
      reason: 'below_ground',
      message: 'Object is below ground level',
      severity: 'error',
    });
  }

  // Determine overall status
  let status: PlacementStatus = 'valid';
  if (violations.some(v => v.severity === 'error')) status = 'invalid';
  else if (violations.some(v => v.severity === 'warning')) status = 'warning';

  // Suggest snap surface from nearest ground/floor zone
  const groundZone = containingZones.find(
    z => z.type === 'ground_surface' || z.type === 'floor'
  );
  const snapTarget = groundZone
    ? { zoneId: groundZone.id, surfaceY: groundZone.position[1] + groundZone.scale[1] }
    : undefined;

  return { status, violations, snapTarget };
}

// ─── Surface Snapping ─────────────────────────────────────────────────────────

/**
 * Given an XZ position, return the top-surface Y of the highest
 * ground_surface or floor zone covering that XZ position.
 * Returns null if no such zone covers the position.
 */
export function getSnapSurfaceY(
  pos: [number, number, number],
  zones: CollisionZone[]
): number | null {
  const groundZones = zones.filter(z => {
    if (!z.enabled) return false;
    if (z.type !== 'ground_surface' && z.type !== 'floor') return false;
    // Check XZ footprint only – temporarily flatten the Y
    const testPoint: [number, number, number] = [pos[0], z.position[1], pos[2]];
    return isPointInZone(testPoint, z);
  });
  if (!groundZones.length) return null;
  return Math.max(...groundZones.map(z => z.position[1] + z.scale[1]));
}

// ─── Scene-wide Helpers ───────────────────────────────────────────────────────

/**
 * Find every model in the scene that has a non-valid placement result.
 */
export function findAllInvalidPlacements(
  models: ModelData[],
  zones: CollisionZone[]
): { modelId: string; result: PlacementValidationResult }[] {
  return models
    .map(m => ({ modelId: m.id, result: validatePlacement(m, zones, models) }))
    .filter(r => r.result.status !== 'valid');
}

export function getZoneById(
  zones: CollisionZone[],
  id: string
): CollisionZone | undefined {
  return zones.find(z => z.id === id);
}

/**
 * Return all zones that a model overlaps with.
 */
export function getZonesForModel(
  model: ModelData,
  zones: CollisionZone[]
): CollisionZone[] {
  return zones.filter(z => doesObjectOverlapZone(model, z));
}
