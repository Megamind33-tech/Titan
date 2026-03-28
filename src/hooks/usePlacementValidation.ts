import { useMemo } from 'react';
import { CollisionZone, PlacementValidationResult } from '../types/collision';
import { ModelData } from '../App';
import { validatePlacement } from '../services/CollisionZoneService';

/**
 * Returns a live PlacementValidationResult for the given model against
 * the current set of collision zones and sibling models.
 *
 * Returns null when:
 *  - No model is provided (nothing is selected)
 *  - No collision zones exist in the scene
 */
export function usePlacementValidation(
  model: ModelData | null | undefined,
  zones: CollisionZone[],
  allModels: ModelData[]
): PlacementValidationResult | null {
  return useMemo(() => {
    if (!model || zones.length === 0) return null;
    return validatePlacement(model, zones, allModels);
  }, [
    // Re-run whenever the model's position/scale/tags change, or zones change
    model?.id,
    model?.position[0], model?.position[1], model?.position[2],
    model?.scale[0],    model?.scale[1],    model?.scale[2],
    model?.behaviorTags?.join(','),
    model?.type,
    zones,
    // allModels is intentionally omitted to avoid excessive re-runs;
    // other objects don't affect single-object zone validation
  ]);
}
