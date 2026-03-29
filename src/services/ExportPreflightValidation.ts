/**
 * ExportPreflightValidation.ts
 *
 * Comprehensive preflight validation for export operations.
 * Distinguishes between blocking errors (export impossible) and warnings (degraded quality).
 * Provides diagnostic reports and recovery suggestions.
 *
 * VALIDATION SCOPE:
 * - Model data completeness and validity
 * - Material references and preset validity
 * - Layer reference consistency
 * - Parent-child relationship validity
 * - Prefab model references
 * - Path and zone validity
 * - Camera and quality settings
 * - Three.js scene synchronization
 * - File availability for exports
 */

export type IssueSeverity = 'blocking-error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string; // machine-readable error code
  message: string; // human-readable message
  context?: {
    modelId?: string;
    itemId?: string;
    field?: string;
  };
  recovery?: {
    action: 'use-default' | 'skip-item' | 'use-fallback' | 'inform-user';
    description: string;
  };
}

export interface PreflightReport {
  isValid: boolean; // true if no blocking errors
  blockingErrors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: {
    totalIssues: number;
    blockedItems: string[]; // IDs of items that cannot be exported
    degradedItems: string[]; // IDs of items with reduced quality
    exportable: boolean; // can proceed with warnings
  };
  recommendations: string[]; // actionable suggestions
}

/**
 * Validate model data completeness and validity.
 */
export const validateModelData = (model: any, context: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // Check ID validity
  if (!model.id || typeof model.id !== 'string' || model.id.length === 0) {
    issues.push({
      severity: 'blocking-error',
      code: 'INVALID_MODEL_ID',
      message: `${context}: Model ID must be non-empty string`,
      context: { modelId: model.id },
    });
  }

  if (model.id && model.id.length > 256) {
    issues.push({
      severity: 'blocking-error',
      code: 'MODEL_ID_TOO_LONG',
      message: `${context}: Model ID exceeds maximum length (256)`,
      context: { modelId: model.id },
    });
  }

  // Check name validity
  if (!model.name || typeof model.name !== 'string' || model.name.length === 0) {
    issues.push({
      severity: 'blocking-error',
      code: 'INVALID_MODEL_NAME',
      message: `${context}: Model name must be non-empty string`,
      context: { modelId: model.id },
    });
  }

  // Check transform validity
  if (!model.position || !Array.isArray(model.position) || model.position.length !== 3) {
    issues.push({
      severity: 'blocking-error',
      code: 'INVALID_POSITION',
      message: `${context}: Model position must be [x, y, z]`,
      context: { modelId: model.id, field: 'position' },
    });
  } else {
    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(model.position[i])) {
        issues.push({
          severity: 'blocking-error',
          code: 'INVALID_POSITION_VALUE',
          message: `${context}: Position[${i}] is not a finite number (${model.position[i]})`,
          context: { modelId: model.id, field: `position[${i}]` },
          recovery: {
            action: 'use-default',
            description: 'Reset position to [0, 0, 0]',
          },
        });
      }
    }
  }

  if (!model.rotation || !Array.isArray(model.rotation) || model.rotation.length !== 3) {
    issues.push({
      severity: 'blocking-error',
      code: 'INVALID_ROTATION',
      message: `${context}: Model rotation must be [x, y, z]`,
      context: { modelId: model.id, field: 'rotation' },
    });
  } else {
    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(model.rotation[i])) {
        issues.push({
          severity: 'blocking-error',
          code: 'INVALID_ROTATION_VALUE',
          message: `${context}: Rotation[${i}] is not a finite number`,
          context: { modelId: model.id, field: `rotation[${i}]` },
          recovery: {
            action: 'use-default',
            description: 'Reset rotation to [0, 0, 0]',
          },
        });
      }
    }
  }

  if (!model.scale || !Array.isArray(model.scale) || model.scale.length !== 3) {
    issues.push({
      severity: 'blocking-error',
      code: 'INVALID_SCALE',
      message: `${context}: Model scale must be [x, y, z]`,
      context: { modelId: model.id, field: 'scale' },
    });
  } else {
    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(model.scale[i]) || model.scale[i] <= 0) {
        issues.push({
          severity: 'blocking-error',
          code: 'INVALID_SCALE_VALUE',
          message: `${context}: Scale[${i}] must be positive finite number (${model.scale[i]})`,
          context: { modelId: model.id, field: `scale[${i}]` },
          recovery: {
            action: 'use-default',
            description: 'Reset scale to [1, 1, 1]',
          },
        });
      }
    }
  }

  // Check type validity
  const validTypes = ['model', 'environment', 'light', 'camera'];
  if (model.type && !validTypes.includes(model.type)) {
    issues.push({
      severity: 'warning',
      code: 'UNKNOWN_MODEL_TYPE',
      message: `${context}: Unknown model type "${model.type}", will default to "model"`,
      context: { modelId: model.id, field: 'type' },
    });
  }

  return issues;
};

/**
 * Validate material references and values.
 */
export const validateMaterialData = (model: any, context: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // Check material color if present
  if (model.colorTint) {
    if (typeof model.colorTint !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(model.colorTint)) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_COLOR_FORMAT',
        message: `${context}: Color tint "${model.colorTint}" is not valid hex, will use default`,
        context: { modelId: model.id, field: 'colorTint' },
        recovery: {
          action: 'use-default',
          description: 'Use default color #ffffff',
        },
      });
    }
  }

  // Check opacity range
  if (model.opacity !== undefined && (typeof model.opacity !== 'number' || model.opacity < 0 || model.opacity > 1)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_OPACITY',
      message: `${context}: Opacity ${model.opacity} out of range [0, 1], will clamp`,
      context: { modelId: model.id, field: 'opacity' },
      recovery: {
        action: 'use-fallback',
        description: 'Clamp opacity to [0, 1]',
      },
    });
  }

  // Check roughness/metalness range
  if (model.roughness !== undefined && (typeof model.roughness !== 'number' || model.roughness < 0 || model.roughness > 1)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_ROUGHNESS',
      message: `${context}: Roughness ${model.roughness} out of range [0, 1], will clamp`,
      context: { modelId: model.id, field: 'roughness' },
      recovery: {
        action: 'use-fallback',
        description: 'Clamp roughness to [0, 1]',
      },
    });
  }

  if (model.metalness !== undefined && (typeof model.metalness !== 'number' || model.metalness < 0 || model.metalness > 1)) {
    issues.push({
      severity: 'warning',
      code: 'INVALID_METALNESS',
      message: `${context}: Metalness ${model.metalness} out of range [0, 1], will clamp`,
      context: { modelId: model.id, field: 'metalness' },
      recovery: {
        action: 'use-fallback',
        description: 'Clamp metalness to [0, 1]',
      },
    });
  }

  return issues;
};

/**
 * Validate layer references exist.
 */
export const validateLayerReferences = (
  models: any[],
  layers: any[] | undefined,
  context: string
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!layers || layers.length === 0) {
    return issues; // Layers optional
  }

  const layerIds = new Set(layers.map((l: any) => l.id));

  for (const model of models) {
    if (model.layerId && !layerIds.has(model.layerId)) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_LAYER_REFERENCE',
        message: `${context}: Model "${model.id}" references non-existent layer "${model.layerId}"`,
        context: { modelId: model.id, field: 'layerId' },
        recovery: {
          action: 'use-fallback',
          description: 'Clear layer assignment',
        },
      });
    }
  }

  return issues;
};

/**
 * Validate parent-child relationships.
 */
export const validateHierarchy = (models: any[], context: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const modelIds = new Set(models.map((m: any) => m.id));

  for (const model of models) {
    if (model.parentId && !modelIds.has(model.parentId)) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_PARENT_REFERENCE',
        message: `${context}: Model "${model.id}" references non-existent parent "${model.parentId}"`,
        context: { modelId: model.id, field: 'parentId' },
        recovery: {
          action: 'use-fallback',
          description: 'Clear parent relationship',
        },
      });
    }
  }

  return issues;
};

/**
 * Validate prefab model references.
 */
export const validatePrefabReferences = (
  prefabs: any[] | undefined,
  modelIds: Set<string>,
  context: string
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!prefabs) return issues;

  for (const prefab of prefabs) {
    if (!prefab.models || !Array.isArray(prefab.models)) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_PREFAB_MODELS',
        message: `${context}: Prefab "${prefab.id}" has invalid models array`,
        context: { itemId: prefab.id, field: 'models' },
      });
      continue;
    }

    for (const model of prefab.models) {
      if (!modelIds.has(model.id)) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_PREFAB_MODEL_REFERENCE',
          message: `${context}: Prefab "${prefab.id}" references non-existent model "${model.id}"`,
          context: { itemId: prefab.id },
          recovery: {
            action: 'inform-user',
            description: 'Prefab contains model not in export selection',
          },
        });
      }
    }
  }

  return issues;
};

/**
 * Validate export file availability (for original format exports).
 */
export const validateFileAvailability = (models: any[], format: string, context: string): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (format !== 'original') return issues;

  for (const model of models) {
    if (!model.file) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_MODEL_FILE',
        message: `${context}: Model "${model.id}" has no file for original format export`,
        context: { modelId: model.id, field: 'file' },
        recovery: {
          action: 'skip-item',
          description: 'Skip this model in original format (use GLB or OBJ)',
        },
      });
    }
  }

  return issues;
};

/**
 * Comprehensive preflight validation.
 */
export const runPreflightValidation = (
  models: any[],
  selectedIds: string[],
  options: {
    format: string;
    layers?: any[];
    prefabs?: any[];
    paths?: any[];
    collisionZones?: any[];
    terrain?: any;
    cameraPresets?: any[];
    cameraPaths?: any[];
    qualitySettings?: any;
    threeScene?: any;
  }
): PreflightReport => {
  const issues: ValidationIssue[] = [];
  const modelsToExport = models.filter(m => selectedIds.includes(m.id));
  const modelIds = new Set(modelsToExport.map(m => m.id));
  const blockedItems = new Set<string>();
  const degradedItems = new Set<string>();

  // Validate model selection
  if (selectedIds.length === 0) {
    issues.push({
      severity: 'blocking-error',
      code: 'NO_MODELS_SELECTED',
      message: 'No models selected for export',
    });
    return {
      isValid: false,
      blockingErrors: issues,
      warnings: [],
      summary: {
        totalIssues: 1,
        blockedItems: [],
        degradedItems: [],
        exportable: false,
      },
      recommendations: ['Select at least one model to export'],
    };
  }

  // Validate each model
  for (const model of modelsToExport) {
    const modelIssues = [
      ...validateModelData(model, `Model "${model.id}"`),
      ...validateMaterialData(model, `Model "${model.id}"`),
    ];

    for (const issue of modelIssues) {
      issues.push(issue);
      if (issue.severity === 'blocking-error') {
        blockedItems.add(model.id);
      } else {
        degradedItems.add(model.id);
      }
    }
  }

  // Validate layer references
  issues.push(...validateLayerReferences(modelsToExport, options.layers, 'Layer validation'));

  // Validate hierarchy
  issues.push(...validateHierarchy(modelsToExport, 'Hierarchy validation'));

  // Validate prefab references
  issues.push(...validatePrefabReferences(options.prefabs, modelIds, 'Prefab validation'));

  // Validate file availability
  issues.push(...validateFileAvailability(modelsToExport, options.format, 'File validation'));

  // Validate Three.js scene sync (optional check)
  if (options.threeScene) {
    for (const model of modelsToExport) {
      let found = false;
      options.threeScene.traverse((child: any) => {
        if (child.userData?.id === model.id) {
          found = true;
        }
      });
      if (!found) {
        degradedItems.add(model.id);
        issues.push({
          severity: 'warning',
          code: 'SCENE_SYNC_MISMATCH',
          message: `Model "${model.id}" not found in Three.js scene (geometry will not be exported)`,
          context: { modelId: model.id },
          recovery: {
            action: 'inform-user',
            description: 'Ensure model is added to scene before export',
          },
        });
      }
    }
  }

  // Separate issues by severity
  const blockingErrors = issues.filter(i => i.severity === 'blocking-error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // Build recommendations
  const recommendations: string[] = [];
  if (blockingErrors.length > 0) {
    recommendations.push(`Fix ${blockingErrors.length} blocking error(s) before export`);
  }
  if (warnings.length > 0) {
    recommendations.push(`Address ${warnings.length} warning(s) for optimal export quality`);
  }
  if (blockedItems.size > 0) {
    recommendations.push(`${blockedItems.size} model(s) cannot be exported - review blocking errors`);
  }
  if (degradedItems.size > 0) {
    recommendations.push(`${degradedItems.size} model(s) will have reduced quality - review warnings`);
  }

  return {
    isValid: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    summary: {
      totalIssues: issues.length,
      blockedItems: Array.from(blockedItems),
      degradedItems: Array.from(degradedItems),
      exportable: blockingErrors.length === 0,
    },
    recommendations,
  };
};
