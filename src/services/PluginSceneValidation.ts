type PluginScenePatch = Partial<{
  models: any[];
  layers: any[];
  paths: any[];
  prefabs: any[];
}>;

// Shared validation helpers
const hasStringId = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';

const isValidId = (id: unknown): boolean => {
  if (typeof id !== 'string') return false;
  // IDs must be non-empty strings, max 256 chars
  return id.length > 0 && id.length <= 256;
};

const isValidString = (value: unknown, fieldName: string, maxLength: number = 512): boolean => {
  if (typeof value !== 'string') return false;
  // Strings must be non-empty and within reasonable size
  return value.length > 0 && value.length <= maxLength;
};

const isVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(n => typeof n === 'number' && Number.isFinite(n));

// Built-in validators (immutable at runtime)
const BUILTIN_SCENE_VALIDATORS = {
  models: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update models must be an array');
    if (value.length > 10000) throw new Error('scene.update models array exceeds maximum size (10000)');

    for (let i = 0; i < value.length; i++) {
      const model = value[i];

      // Validate basic structure
      if (!hasStringId(model)) {
        throw new Error(`scene.update model[${i}]: id must be non-empty string`);
      }
      if (!isValidId(model.id)) {
        // isValidId returns false for both empty strings and strings > 256 chars
        const length = (model.id as string).length;
        if (length === 0) {
          throw new Error(`scene.update model[${i}]: id must be non-empty string`);
        } else {
          throw new Error(`scene.update model[${i}]: id exceeds maximum length (256)`);
        }
      }
      if (!isValidString(model.name, 'name')) {
        throw new Error(`scene.update model[${i}]: name must be non-empty string`);
      }
      if (!isValidString(model.url, 'url')) {
        throw new Error(`scene.update model[${i}]: url must be non-empty string`);
      }

      // Validate vectors
      if (!isVec3(model.position) || !isVec3(model.rotation) || !isVec3(model.scale)) {
        throw new Error(`scene.update model[${i}]: must include valid position/rotation/scale vectors [number, number, number]`);
      }
    }
  },

  layers: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update layers must be an array');
    if (value.length > 10000) throw new Error('scene.update layers array exceeds maximum size (10000)');

    for (let i = 0; i < value.length; i++) {
      const layer = value[i];

      if (!isValidId(layer.id)) {
        throw new Error(`scene.update layer[${i}]: id must be non-empty string (max 256 chars)`);
      }
      if (!isValidString(layer.name, 'name')) {
        throw new Error(`scene.update layer[${i}]: name must be non-empty string`);
      }
      if (typeof layer.visible !== 'boolean') {
        throw new Error(`scene.update layer[${i}]: visible must be boolean`);
      }
      if (typeof layer.locked !== 'boolean') {
        throw new Error(`scene.update layer[${i}]: locked must be boolean`);
      }
      if (typeof layer.order !== 'number' || !Number.isFinite(layer.order)) {
        throw new Error(`scene.update layer[${i}]: order must be finite number`);
      }
    }
  },

  paths: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update paths must be an array');
    if (value.length > 10000) throw new Error('scene.update paths array exceeds maximum size (10000)');

    for (let i = 0; i < value.length; i++) {
      const path = value[i];

      if (!isValidId(path.id)) {
        throw new Error(`scene.update path[${i}]: id must be non-empty string (max 256 chars)`);
      }
      if (!isValidString(path.name, 'name')) {
        throw new Error(`scene.update path[${i}]: name must be non-empty string`);
      }
      if (typeof path.closed !== 'boolean') {
        throw new Error(`scene.update path[${i}]: closed must be boolean`);
      }
      if (typeof path.width !== 'number' || !Number.isFinite(path.width) || path.width <= 0) {
        throw new Error(`scene.update path[${i}]: width must be positive finite number`);
      }
      if (!Array.isArray(path.points)) {
        throw new Error(`scene.update path[${i}]: points must be array`);
      }
      if (path.points.length > 10000) {
        throw new Error(`scene.update path[${i}].points exceeds maximum size (10000)`);
      }

      // Validate each control point
      for (let j = 0; j < path.points.length; j++) {
        const point = path.points[j];
        if (!isValidId(point.id)) {
          throw new Error(`scene.update path[${i}].points[${j}]: id must be non-empty string (max 256 chars)`);
        }
        if (!isVec3(point.position)) {
          throw new Error(`scene.update path[${i}].points[${j}]: position must be [number, number, number]`);
        }
      }
    }
  },

  prefabs: (value: any): void => {
    if (!Array.isArray(value)) throw new Error('scene.update prefabs must be an array');
    if (value.length > 10000) throw new Error('scene.update prefabs array exceeds maximum size (10000)');

    for (let i = 0; i < value.length; i++) {
      const prefab = value[i];

      if (!isValidId(prefab.id)) {
        throw new Error(`scene.update prefab[${i}]: id must be non-empty string (max 256 chars)`);
      }
      if (!isValidString(prefab.name, 'name')) {
        throw new Error(`scene.update prefab[${i}]: name must be non-empty string`);
      }
      if (!Array.isArray(prefab.models)) {
        throw new Error(`scene.update prefab[${i}]: models must be array`);
      }
      if (prefab.models.length > 10000) {
        throw new Error(`scene.update prefab[${i}].models exceeds maximum size (10000)`);
      }

      // Validate each model reference
      for (let j = 0; j < prefab.models.length; j++) {
        const model = prefab.models[j];
        if (!isValidId(model.id)) {
          throw new Error(`scene.update prefab[${i}].models[${j}]: id must be non-empty string (max 256 chars)`);
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

  // CRITICAL: Seal validators on first validation to prevent runtime registration
  // This ensures "startup-only" registration is actually enforced
  if (!validatorsSealed) {
    validatorsSealed = true;
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
