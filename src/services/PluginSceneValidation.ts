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

// Built-in validators (immutable at runtime)
const BUILTIN_SCENE_VALIDATORS = {
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

type BuiltinSceneKey = keyof typeof BUILTIN_SCENE_VALIDATORS;

// Custom validators registered at startup (immutable during validation)
let customSceneValidators: Map<string, (value: any) => void> = new Map();
let validatorsSealed = false;

/**
 * Get all supported scene keys (built-in + registered custom).
 * WARNING: This function determines which keys are valid.
 * Never call this during validation - use getSupportedSceneKeysAtValidationTime instead.
 */
const getAllSupportedKeys = (): (BuiltinSceneKey | string)[] => [
  ...Object.keys(BUILTIN_SCENE_VALIDATORS) as BuiltinSceneKey[],
  ...Array.from(customSceneValidators.keys()),
];

/**
 * Get supported keys frozen at the moment validation starts.
 * This prevents race conditions where new validators are registered during validation.
 */
const getSupportedSceneKeysAtValidationTime = (): Set<string> => {
  const keys = [
    ...Object.keys(BUILTIN_SCENE_VALIDATORS),
    ...Array.from(customSceneValidators.keys()),
  ];
  return new Set(keys);
};

export const validatePluginScenePatch = (patch: unknown): PluginScenePatch => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('updateSceneState updater must return an object');
  }

  // Snapshot supported keys at validation time (prevents race conditions)
  const supportedKeysAtValidationTime = getSupportedSceneKeysAtValidationTime();

  // Strict: Reject any unsupported key
  for (const key of Object.keys(patch as Record<string, unknown>)) {
    if (!supportedKeysAtValidationTime.has(key)) {
      throw new Error(`Unsupported scene.update key: ${key}`);
    }
  }

  const next = patch as PluginScenePatch;

  // Apply built-in validators for provided keys
  for (const builtinKey of Object.keys(BUILTIN_SCENE_VALIDATORS) as BuiltinSceneKey[]) {
    if ((next as any)[builtinKey] !== undefined) {
      BUILTIN_SCENE_VALIDATORS[builtinKey]((next as any)[builtinKey]);
    }
  }

  // Apply custom validators for provided keys
  for (const [customKey, validator] of customSceneValidators.entries()) {
    if ((next as any)[customKey] !== undefined) {
      try {
        validator((next as any)[customKey]);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Custom validator for '${customKey}' failed: ${error.message}`);
        }
        throw error;
      }
    }
  }

  return next;
};

/**
 * Register a custom scene-key validator for startup schema expansion.
 * This must be called BEFORE any validation occurs.
 * Validators are immutable once validation starts.
 *
 * @param key - The scene key to validate (e.g., 'animations', 'meshes')
 * @param validator - A function that throws if validation fails
 * @throws If key is already registered or contains invalid characters
 * @throws If validators have already been sealed (validation started)
 */
export const registerSceneKeyValidator = (
  key: string,
  validator: (value: any) => void
): void => {
  if (validatorsSealed) {
    throw new Error('Cannot register validators after validation has started');
  }

  // Validate key format (no empty strings, no reserved names, valid identifier)
  if (!key || typeof key !== 'string') {
    throw new Error('Validator key must be a non-empty string');
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid validator key '${key}'. Must match /^[a-z_][a-z0-9_]*$/`);
  }

  // Prevent overwriting built-in validators
  if (key in BUILTIN_SCENE_VALIDATORS) {
    throw new Error(`Cannot override built-in scene key: ${key}`);
  }

  // Validate validator function
  if (typeof validator !== 'function') {
    throw new Error(`Validator must be a function, got ${typeof validator}`);
  }

  // Prevent duplicate registration
  if (customSceneValidators.has(key)) {
    throw new Error(`Scene key validator already registered: ${key}`);
  }

  // Register the validator
  customSceneValidators.set(key, validator);
};

/**
 * Seal validators to prevent registration after validation begins.
 * Used internally by the validation system.
 * @internal
 */
export const sealSceneValidators = (): void => {
  validatorsSealed = true;
};

/**
 * Reset validator registry (for testing).
 * @internal
 */
export const resetSceneValidators = (): void => {
  customSceneValidators.clear();
  validatorsSealed = false;
};
