type PluginScenePatch = Partial<{
  models: any[];
  layers: any[];
  paths: any[];
  prefabs: any[];
}>;

// Shared validation helpers
const hasStringId = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';

const isVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(n => typeof n === 'number' && Number.isFinite(n));

// Individual scene-key validators
const sceneKeyValidators = {
  models: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update models must be an array');
    for (const model of value) {
      if (!hasStringId(model) || typeof model.name !== 'string' || typeof model.url !== 'string') {
        throw new Error('scene.update model entries must include { id, name, url }');
      }
      if (!isVec3(model.position) || !isVec3(model.rotation) || !isVec3(model.scale)) {
        throw new Error('scene.update model entries must include valid position/rotation/scale vectors');
      }
    }
  },

  layers: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update layers must be an array');
    for (const layer of value) {
      if (
        !hasStringId(layer) ||
        typeof layer.name !== 'string' ||
        typeof layer.visible !== 'boolean' ||
        typeof layer.locked !== 'boolean' ||
        typeof layer.order !== 'number'
      ) {
        throw new Error('scene.update layer entries are malformed');
      }
    }
  },

  paths: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update paths must be an array');
    for (const path of value) {
      if (
        !hasStringId(path) ||
        typeof path.name !== 'string' ||
        typeof path.closed !== 'boolean' ||
        typeof path.width !== 'number' ||
        !Array.isArray(path.points)
      ) {
        throw new Error('scene.update path entries are malformed');
      }
      for (const point of path.points) {
        if (!hasStringId(point) || !isVec3(point.position)) {
          throw new Error('scene.update path control points are malformed');
        }
      }
    }
  },

  prefabs: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update prefabs must be an array');
    for (const prefab of value) {
      if (!hasStringId(prefab) || typeof prefab.name !== 'string' || !Array.isArray(prefab.models)) {
        throw new Error('scene.update prefab entries are malformed');
      }
      for (const model of prefab.models) {
        if (!hasStringId(model)) {
          throw new Error('scene.update prefab model entries must include id');
        }
      }
    }
  },
} as const;

type SupportedSceneKey = keyof typeof sceneKeyValidators;

const getSupportedSceneKeys = (): SupportedSceneKey[] =>
  Object.keys(sceneKeyValidators) as SupportedSceneKey[];

export const validatePluginScenePatch = (patch: unknown): PluginScenePatch => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('updateSceneState updater must return an object');
  }

  const supportedKeys = getSupportedSceneKeys();
  const supportedKeySet = new Set(supportedKeys);

  for (const key of Object.keys(patch as Record<string, unknown>)) {
    if (!supportedKeySet.has(key as SupportedSceneKey)) {
      throw new Error(`Unsupported scene.update key: ${key}`);
    }
  }

  const next = patch as PluginScenePatch;

  // Apply validators for each provided key
  for (const key of supportedKeys) {
    if ((next as any)[key] !== undefined) {
      const validator = sceneKeyValidators[key];
      validator((next as any)[key]);
    }
  }

  return next;
};

/**
 * Register a new scene-key validator for future schema expansion.
 * This enables safe extensibility while maintaining strict validation.
 *
 * @param key - The scene key to validate (e.g., 'meshes', 'animations')
 * @param validator - A function that throws if validation fails
 */
export const registerSceneKeyValidator = (
  key: string,
  validator: (value: any) => void
): void => {
  if ((sceneKeyValidators as any)[key]) {
    throw new Error(`Scene key validator already registered: ${key}`);
  }
  (sceneKeyValidators as any)[key] = validator;
};
