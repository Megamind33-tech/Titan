type PluginScenePatch = Partial<{
  models: any[];
  layers: any[];
  paths: any[];
  prefabs: any[];
}>;

const hasStringId = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';

const isVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(n => typeof n === 'number' && Number.isFinite(n));

export const validatePluginScenePatch = (patch: unknown): PluginScenePatch => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('updateSceneState updater must return an object');
  }

  const allowedKeys = new Set(['models', 'layers', 'paths', 'prefabs']);
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unsupported scene.update key: ${key}`);
    }
  }

  const next = patch as PluginScenePatch;

  if (next.models !== undefined) {
    if (!Array.isArray(next.models)) throw new Error('scene.update models must be an array');
    for (const model of next.models) {
      const entry = model as any;
      if (!hasStringId(entry) || typeof entry.name !== 'string' || typeof entry.url !== 'string') {
        throw new Error('scene.update model entries must include { id, name, url }');
      }
      if (!isVec3(entry.position) || !isVec3(entry.rotation) || !isVec3(entry.scale)) {
        throw new Error('scene.update model entries must include valid position/rotation/scale vectors');
      }
    }
  }

  if (next.layers !== undefined) {
    if (!Array.isArray(next.layers)) throw new Error('scene.update layers must be an array');
    for (const layer of next.layers) {
      const entry = layer as any;
      if (
        !hasStringId(entry) ||
        typeof entry.name !== 'string' ||
        typeof entry.visible !== 'boolean' ||
        typeof entry.locked !== 'boolean' ||
        typeof entry.order !== 'number'
      ) {
        throw new Error('scene.update layer entries are malformed');
      }
    }
  }

  if (next.paths !== undefined) {
    if (!Array.isArray(next.paths)) throw new Error('scene.update paths must be an array');
    for (const path of next.paths) {
      const entry = path as any;
      if (
        !hasStringId(entry) ||
        typeof entry.name !== 'string' ||
        typeof entry.closed !== 'boolean' ||
        typeof entry.width !== 'number' ||
        !Array.isArray(entry.points)
      ) {
        throw new Error('scene.update path entries are malformed');
      }
      for (const point of entry.points) {
        const pathPoint = point as any;
        if (!hasStringId(pathPoint) || !isVec3(pathPoint.position)) {
          throw new Error('scene.update path control points are malformed');
        }
      }
    }
  }

  if (next.prefabs !== undefined) {
    if (!Array.isArray(next.prefabs)) throw new Error('scene.update prefabs must be an array');
    for (const prefab of next.prefabs) {
      const entry = prefab as any;
      if (!hasStringId(entry) || typeof entry.name !== 'string' || !Array.isArray(entry.models)) {
        throw new Error('scene.update prefab entries are malformed');
      }
      for (const model of entry.models) {
        const prefabModel = model as any;
        if (!hasStringId(prefabModel)) {
          throw new Error('scene.update prefab model entries must include id');
        }
      }
    }
  }

  return next;
};
