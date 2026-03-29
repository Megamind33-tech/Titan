import { Swim26SceneManifest } from './Swim26ManifestService';

export type ImportIssueSeverity = 'warning' | 'error';

export interface Swim26ImportIssue {
  path: string;
  message: string;
  severity: ImportIssueSeverity;
}

export interface Swim26ManifestValidationResult {
  valid: boolean;
  errors: Swim26ImportIssue[];
  warnings: Swim26ImportIssue[];
}

const isFiniteVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(n => typeof n === 'number' && Number.isFinite(n));

const asIssue = (path: string, message: string, severity: ImportIssueSeverity): Swim26ImportIssue => ({
  path,
  message,
  severity,
});

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(entry => typeof entry === 'string');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const validateSwim26Manifest = (manifest: unknown): Swim26ManifestValidationResult => {
  const errors: Swim26ImportIssue[] = [];
  const warnings: Swim26ImportIssue[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: [asIssue('manifest', 'Manifest must be an object.', 'error')],
      warnings,
    };
  }

  const typed = manifest as Partial<Swim26SceneManifest>;
  const manifestTopLevelKeys = Object.keys(typed as Record<string, unknown>);
  const supportedTopLevelKeys = ['version', 'runtime', 'projectType', 'authoredBy', 'authoredContent', 'runtimeOwned', 'unsupported'];
  manifestTopLevelKeys
    .filter(key => !supportedTopLevelKeys.includes(key))
    .forEach(key => warnings.push(asIssue(key, `Unknown top-level field "${key}" will be ignored by runtime importer.`, 'warning')));

  if (typed.version !== '1.0.0') {
    errors.push(asIssue('version', 'Only SWIM26 manifest version 1.0.0 is currently supported.', 'error'));
  }
  if (typed.runtime !== 'babylon') {
    errors.push(asIssue('runtime', 'Manifest runtime must be "babylon".', 'error'));
  }
  if (typed.projectType !== 'swim26-babylon') {
    errors.push(asIssue('projectType', 'Manifest projectType must be "swim26-babylon".', 'error'));
  }
  if (typed.authoredBy !== 'titan') {
    warnings.push(asIssue('authoredBy', 'Manifest authoredBy is not "titan"; continuing with caution.', 'warning'));
  }
  if (!typed.authoredContent) {
    errors.push(asIssue('authoredContent', 'authoredContent is required.', 'error'));
  }

  const objects = typed.authoredContent?.objects;
  if (!Array.isArray(objects)) {
    errors.push(asIssue('authoredContent.objects', 'Objects array is required.', 'error'));
  } else {
    objects.forEach((obj, idx) => {
      if (!obj?.id) errors.push(asIssue(`authoredContent.objects[${idx}].id`, 'Object id is required.', 'error'));
      if (!obj?.name) warnings.push(asIssue(`authoredContent.objects[${idx}].name`, 'Object name missing; id will be used.', 'warning'));
      if (!obj?.transform) {
        errors.push(asIssue(`authoredContent.objects[${idx}].transform`, 'Object transform is required.', 'error'));
        return;
      }
      if (!isFiniteVec3(obj.transform.position)) {
        errors.push(asIssue(`authoredContent.objects[${idx}].transform.position`, 'Position must be a finite vec3.', 'error'));
      }
      if (!isFiniteVec3(obj.transform.rotation)) {
        errors.push(asIssue(`authoredContent.objects[${idx}].transform.rotation`, 'Rotation must be a finite vec3.', 'error'));
      }
      if (!isFiniteVec3(obj.transform.scale)) {
        errors.push(asIssue(`authoredContent.objects[${idx}].transform.scale`, 'Scale must be a finite vec3.', 'error'));
      }
      if (obj.assetRef && (!obj.assetRef.type || !obj.assetRef.value)) {
        warnings.push(asIssue(`authoredContent.objects[${idx}].assetRef`, 'assetRef is malformed and will be ignored.', 'warning'));
      } else if (obj.assetRef && !['url', 'asset-id'].includes(obj.assetRef.type)) {
        warnings.push(asIssue(`authoredContent.objects[${idx}].assetRef.type`, 'assetRef.type must be "url" or "asset-id"; this assetRef will be ignored.', 'warning'));
      }
      if (!obj.assetRef) {
        warnings.push(asIssue(`authoredContent.objects[${idx}].assetRef`, 'No assetRef provided; object must resolve from runtime defaults.', 'warning'));
      }
      if (obj.tags && !isStringArray(obj.tags)) {
        warnings.push(asIssue(`authoredContent.objects[${idx}].tags`, 'Tags must be string[]; invalid tags will be dropped.', 'warning'));
      }
      if (obj.metadata && !isPlainObject(obj.metadata)) {
        warnings.push(asIssue(`authoredContent.objects[${idx}].metadata`, 'Metadata must be an object; invalid metadata will be replaced with {}.', 'warning'));
      }
      if (obj.material) {
        if (obj.material.color && typeof obj.material.color !== 'string') {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.color`, 'material.color must be a string; field will be ignored.', 'warning'));
        }
        if (obj.material.texture && typeof obj.material.texture !== 'string') {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.texture`, 'material.texture must be a string; field will be ignored.', 'warning'));
        }
        if (obj.material.opacity !== undefined && (typeof obj.material.opacity !== 'number' || obj.material.opacity < 0 || obj.material.opacity > 1)) {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.opacity`, 'material.opacity must be a number between 0 and 1; field will be ignored.', 'warning'));
        }
        if (obj.material.roughness !== undefined && (typeof obj.material.roughness !== 'number' || obj.material.roughness < 0 || obj.material.roughness > 1)) {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.roughness`, 'material.roughness must be a number between 0 and 1; field will be ignored.', 'warning'));
        }
        if (obj.material.metalness !== undefined && (typeof obj.material.metalness !== 'number' || obj.material.metalness < 0 || obj.material.metalness > 1)) {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.metalness`, 'material.metalness must be a number between 0 and 1; field will be ignored.', 'warning'));
        }
        if (obj.material.emissiveColor !== undefined && typeof obj.material.emissiveColor !== 'string') {
          warnings.push(asIssue(`authoredContent.objects[${idx}].material.emissiveColor`, 'material.emissiveColor must be a string; field will be ignored.', 'warning'));
        }
      }
      ['layerId', 'prefabId', 'prefabInstanceId', 'editorSelectionState'].forEach(editorOnlyField => {
        if ((obj as any)[editorOnlyField] !== undefined) {
          warnings.push(asIssue(`authoredContent.objects[${idx}].${editorOnlyField}`, `${editorOnlyField} is editor-only and ignored by SWIM26 runtime importer.`, 'warning'));
        }
      });
    });
  }

  const environment = typed.authoredContent?.environment;
  if (!environment || !environment.presetId) {
    warnings.push(asIssue('authoredContent.environment', 'Environment preset is missing; runtime default environment will be used.', 'warning'));
  }

  const paths = typed.authoredContent?.paths;
  if (paths && !Array.isArray(paths)) {
    warnings.push(asIssue('authoredContent.paths', 'Paths must be an array; path data will be ignored.', 'warning'));
  } else if (Array.isArray(paths)) {
    paths.forEach((path, idx) => {
      if (!path?.id || typeof path.id !== 'string') {
        warnings.push(asIssue(`authoredContent.paths[${idx}].id`, 'Path id must be a string; path will be ignored.', 'warning'));
      }
      if (!Array.isArray(path?.points) || path.points.some(point => !isFiniteVec3(point))) {
        warnings.push(asIssue(`authoredContent.paths[${idx}].points`, 'Path points must be vec3[]; invalid path will be ignored.', 'warning'));
      }
    });
  }

  if (typed.runtimeOwned && !isStringArray(typed.runtimeOwned)) {
    warnings.push(asIssue('runtimeOwned', 'runtimeOwned must be string[]; invalid entries will be dropped.', 'warning'));
  }
  if (typed.unsupported && !isStringArray(typed.unsupported)) {
    warnings.push(asIssue('unsupported', 'unsupported must be string[]; invalid entries will be dropped.', 'warning'));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
