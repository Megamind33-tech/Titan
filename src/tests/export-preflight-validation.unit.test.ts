/**
 * export-preflight-validation.unit.test.ts
 *
 * Comprehensive test suite for ExportPreflightValidation service.
 * Tests preflight validation functions that categorize errors (blocking vs warnings),
 * provide recovery suggestions, and generate diagnostic reports.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateModelData,
  validateMaterialData,
  validateLayerReferences,
  validateHierarchy,
  validatePrefabReferences,
  validateFileAvailability,
  runPreflightValidation,
} from '../services/ExportPreflightValidation';

// ─── validateModelData Tests ────────────────────────────────────────────────

test('validateModelData accepts valid model with all required fields', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    type: 'model',
  };

  const issues = validateModelData(model, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateModelData rejects model with missing ID', () => {
  const model = {
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.length > 0);
  assert.equal(issues[0].severity, 'blocking-error');
  assert.equal(issues[0].code, 'INVALID_MODEL_ID');
});

test('validateModelData rejects model with empty string ID', () => {
  const model = {
    id: '',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.length > 0);
  assert.equal(issues[0].code, 'INVALID_MODEL_ID');
});

test('validateModelData rejects model with ID exceeding 256 characters', () => {
  const model = {
    id: 'a'.repeat(257),
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.length > 0);
  assert.ok(issues.some((i: any) => i.code === 'MODEL_ID_TOO_LONG'));
});

test('validateModelData rejects model with missing name', () => {
  const model = {
    id: 'model-1',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_MODEL_NAME'));
});

test('validateModelData rejects model with invalid position (not array)', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: { x: 0, y: 0, z: 0 },
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_POSITION'));
});

test('validateModelData rejects model with NaN in position', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [NaN, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_POSITION_VALUE'));
  assert.ok(issues.some((i: any) => i.severity === 'blocking-error'));
  const recoveryIssue = issues.find((i: any) => i.code === 'INVALID_POSITION_VALUE');
  assert.ok(recoveryIssue?.recovery);
  assert.equal(recoveryIssue?.recovery?.action, 'use-default');
});

test('validateModelData rejects model with Infinity in position', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [Infinity, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_POSITION_VALUE'));
});

test('validateModelData rejects model with invalid rotation', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0],
    scale: [1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_ROTATION'));
});

test('validateModelData rejects model with zero scale', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [0, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_SCALE_VALUE'));
  assert.ok(issues.some((i: any) => i.severity === 'blocking-error'));
});

test('validateModelData rejects model with negative scale', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [-1, 1, 1],
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_SCALE_VALUE'));
});

test('validateModelData warns on unknown model type', () => {
  const model = {
    id: 'model-1',
    name: 'Test Model',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    type: 'unknown-type',
  };

  const issues = validateModelData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'UNKNOWN_MODEL_TYPE'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
});

test('validateModelData accepts valid model types', () => {
  const validTypes = ['model', 'environment', 'light', 'camera'];
  for (const type of validTypes) {
    const model = {
      id: 'model-1',
      name: 'Test Model',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      type,
    };

    const issues = validateModelData(model, 'Test context');
    assert.equal(issues.filter((i: any) => i.code === 'UNKNOWN_MODEL_TYPE').length, 0);
  }
});

// ─── validateMaterialData Tests ─────────────────────────────────────────────

test('validateMaterialData accepts valid material colors', () => {
  const model = {
    id: 'model-1',
    colorTint: '#ffffff',
    opacity: 0.5,
    roughness: 0.3,
    metalness: 0.2,
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateMaterialData warns on invalid hex color format', () => {
  const model = {
    id: 'model-1',
    colorTint: 'not-a-hex',
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_COLOR_FORMAT'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
});

test('validateMaterialData warns on opacity out of range (too low)', () => {
  const model = {
    id: 'model-1',
    opacity: -0.1,
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_OPACITY'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
  const issue = issues.find((i: any) => i.code === 'INVALID_OPACITY');
  assert.equal(issue?.recovery?.action, 'use-fallback');
});

test('validateMaterialData warns on opacity out of range (too high)', () => {
  const model = {
    id: 'model-1',
    opacity: 1.5,
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_OPACITY'));
});

test('validateMaterialData warns on roughness out of range', () => {
  const model = {
    id: 'model-1',
    roughness: 1.5,
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_ROUGHNESS'));
});

test('validateMaterialData warns on metalness out of range', () => {
  const model = {
    id: 'model-1',
    metalness: -0.2,
  };

  const issues = validateMaterialData(model, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_METALNESS'));
});

// ─── validateLayerReferences Tests ──────────────────────────────────────────

test('validateLayerReferences accepts models with valid layer references', () => {
  const models = [
    { id: 'model-1', layerId: 'layer-1' },
    { id: 'model-2', layerId: 'layer-2' },
  ];
  const layers = [
    { id: 'layer-1', name: 'Layer 1' },
    { id: 'layer-2', name: 'Layer 2' },
  ];

  const issues = validateLayerReferences(models, layers, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateLayerReferences warns on model with missing layer reference', () => {
  const models = [
    { id: 'model-1', layerId: 'layer-1' },
    { id: 'model-2', layerId: 'layer-missing' },
  ];
  const layers = [
    { id: 'layer-1', name: 'Layer 1' },
  ];

  const issues = validateLayerReferences(models, layers, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'MISSING_LAYER_REFERENCE'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
});

test('validateLayerReferences accepts models without layer assignment', () => {
  const models = [
    { id: 'model-1' },
    { id: 'model-2' },
  ];
  const layers = [
    { id: 'layer-1', name: 'Layer 1' },
  ];

  const issues = validateLayerReferences(models, layers, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateLayerReferences accepts models when no layers defined', () => {
  const models = [
    { id: 'model-1', layerId: 'layer-1' },
  ];

  const issues = validateLayerReferences(models, undefined, 'Test context');
  assert.equal(issues.length, 0);
});

// ─── validateHierarchy Tests ────────────────────────────────────────────────

test('validateHierarchy accepts models with valid parent references', () => {
  const models = [
    { id: 'parent-1', name: 'Parent' },
    { id: 'child-1', parentId: 'parent-1', name: 'Child' },
  ];

  const issues = validateHierarchy(models, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateHierarchy warns on model with missing parent reference', () => {
  const models = [
    { id: 'model-1', name: 'Model 1' },
    { id: 'model-2', parentId: 'missing-parent', name: 'Model 2' },
  ];

  const issues = validateHierarchy(models, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'MISSING_PARENT_REFERENCE'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
});

test('validateHierarchy accepts models without parent assignment', () => {
  const models = [
    { id: 'model-1', name: 'Model 1' },
    { id: 'model-2', name: 'Model 2' },
  ];

  const issues = validateHierarchy(models, 'Test context');
  assert.equal(issues.length, 0);
});

test('validateHierarchy detects multiple missing parent references', () => {
  const models = [
    { id: 'model-1', name: 'Model 1' },
    { id: 'model-2', parentId: 'missing-1', name: 'Model 2' },
    { id: 'model-3', parentId: 'missing-2', name: 'Model 3' },
  ];

  const issues = validateHierarchy(models, 'Test context');
  assert.equal(issues.filter((i: any) => i.code === 'MISSING_PARENT_REFERENCE').length, 2);
});

// ─── validatePrefabReferences Tests ─────────────────────────────────────────

test('validatePrefabReferences accepts prefabs with valid model references', () => {
  const prefabs = [
    {
      id: 'prefab-1',
      models: [
        { id: 'model-1' },
        { id: 'model-2' },
      ],
    },
  ];
  const modelIds = new Set(['model-1', 'model-2', 'model-3']);

  const issues = validatePrefabReferences(prefabs, modelIds, 'Test context');
  assert.equal(issues.length, 0);
});

test('validatePrefabReferences warns on prefab with missing model reference', () => {
  const prefabs = [
    {
      id: 'prefab-1',
      models: [
        { id: 'model-1' },
        { id: 'model-missing' },
      ],
    },
  ];
  const modelIds = new Set(['model-1']);

  const issues = validatePrefabReferences(prefabs, modelIds, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'MISSING_PREFAB_MODEL_REFERENCE'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
});

test('validatePrefabReferences warns on prefab with invalid models array', () => {
  const prefabs = [
    {
      id: 'prefab-1',
      models: 'not-an-array',
    },
  ];
  const modelIds = new Set(['model-1']);

  const issues = validatePrefabReferences(prefabs, modelIds, 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'INVALID_PREFAB_MODELS'));
});

test('validatePrefabReferences accepts when no prefabs provided', () => {
  const modelIds = new Set(['model-1']);

  const issues = validatePrefabReferences(undefined, modelIds, 'Test context');
  assert.equal(issues.length, 0);
});

// ─── validateFileAvailability Tests ─────────────────────────────────────────

test('validateFileAvailability accepts models with files for original format', () => {
  const models = [
    { id: 'model-1', file: { name: 'model.obj' } },
    { id: 'model-2', file: { name: 'model.glb' } },
  ];

  const issues = validateFileAvailability(models, 'original', 'Test context');
  assert.equal(issues.length, 0);
});

test('validateFileAvailability warns on model without file for original format', () => {
  const models = [
    { id: 'model-1' },
    { id: 'model-2', file: { name: 'model.obj' } },
  ];

  const issues = validateFileAvailability(models, 'original', 'Test context');
  assert.ok(issues.some((i: any) => i.code === 'MISSING_MODEL_FILE'));
  assert.ok(issues.some((i: any) => i.severity === 'warning'));
  const issue = issues.find((i: any) => i.code === 'MISSING_MODEL_FILE');
  assert.equal(issue?.recovery?.action, 'skip-item');
});

test('validateFileAvailability skips file check for non-original formats', () => {
  const models = [
    { id: 'model-1' },
  ];

  const issuesGlb = validateFileAvailability(models, 'glb', 'Test context');
  const issuesObj = validateFileAvailability(models, 'obj', 'Test context');

  assert.equal(issuesGlb.length, 0);
  assert.equal(issuesObj.length, 0);
});

// ─── runPreflightValidation Tests ────────────────────────────────────────────

test('runPreflightValidation returns valid report for clean export selection', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.equal(report.blockingErrors.length, 0);
  assert.equal(report.summary.exportable, true);
});

test('runPreflightValidation returns invalid report when no models selected', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, [], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.length > 0);
  assert.equal(report.blockingErrors[0].code, 'NO_MODELS_SELECTED');
  assert.equal(report.summary.exportable, false);
});

test('runPreflightValidation reports blocking errors from invalid model data', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'INVALID_POSITION_VALUE'));
  assert.ok(report.summary.blockedItems.includes('model-1'));
});

test('runPreflightValidation reports warnings separately from blocking errors', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorTint: 'invalid-color',
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.ok(report.warnings.some((w: any) => w.code === 'INVALID_COLOR_FORMAT'));
  assert.equal(report.summary.exportable, true);
  assert.ok(report.summary.degradedItems.includes('model-1'));
});

test('runPreflightValidation includes recovery suggestions in report', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [Infinity, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  const issue = report.blockingErrors.find((e: any) => e.code === 'INVALID_POSITION_VALUE');
  assert.ok(issue?.recovery);
  assert.equal(issue?.recovery?.action, 'use-default');
});

test('runPreflightValidation validates layer references in report', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      layerId: 'missing-layer',
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
    layers: [{ id: 'layer-1', name: 'Layer 1' }],
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_LAYER_REFERENCE'));
});

test('runPreflightValidation validates parent-child hierarchy in report', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: 'model-2',
      name: 'Model 2',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'missing-parent',
    },
  ];

  const report = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_PARENT_REFERENCE'));
});

test('runPreflightValidation validates prefab model references in report', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const prefabs = [
    {
      id: 'prefab-1',
      models: [
        { id: 'model-1' },
        { id: 'missing-model' },
      ],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
    prefabs,
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_PREFAB_MODEL_REFERENCE'));
});

test('runPreflightValidation validates file availability in report for original format', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'original',
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_MODEL_FILE'));
});

test('runPreflightValidation includes summary with issue counts', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorTint: 'invalid',
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.ok(report.summary.totalIssues > 0);
  assert.ok(report.summary.blockedItems.length > 0);
});

test('runPreflightValidation generates actionable recommendations', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.ok(report.recommendations.length > 0);
  assert.match(report.recommendations[0], /blocking error/i);
});

test('runPreflightValidation validates Three.js scene sync when threeScene provided', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const threeScene = {
    traverse: (callback: (child: any) => void) => {
      // Model not found in scene
    },
  };

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
    threeScene,
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'SCENE_SYNC_MISMATCH'));
  assert.ok(report.summary.degradedItems.includes('model-1'));
});

test('runPreflightValidation handles multiple issues for single model', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, Infinity, -0],
      rotation: [0, 0, 0],
      scale: [0, -1, 1],
      colorTint: 'bad',
      opacity: 2,
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'original',
  });

  assert.ok(report.blockingErrors.length > 1);
  assert.ok(report.warnings.length > 0);
  assert.ok(report.summary.blockedItems.includes('model-1'));
});

test('runPreflightValidation correctly distinguishes exportable with warnings', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colorTint: 'invalid-color',
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.equal(report.summary.exportable, true);
  assert.ok(report.warnings.length > 0);
});

test('runPreflightValidation provides context in validation issues', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  const issue = report.blockingErrors.find((e: any) => e.code === 'INVALID_POSITION_VALUE');
  assert.ok(issue?.context);
  assert.equal(issue?.context?.modelId, 'model-1');
  assert.equal(issue?.context?.field, 'position[0]');
});

// ─── Integration: Complex multi-system scenario ─────────────────────────────

test('runPreflightValidation validates complete scene with all systems present', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Parent Model',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      layerId: 'layer-1',
    },
    {
      id: 'model-2',
      name: 'Child Model',
      position: [1, 0, 0],
      rotation: [0, 0, 0],
      scale: [0.5, 0.5, 0.5],
      parentId: 'model-1',
      layerId: 'layer-1',
    },
  ];

  const layers = [
    { id: 'layer-1', name: 'Main Layer' },
  ];

  const prefabs = [
    {
      id: 'prefab-1',
      models: [
        { id: 'model-1' },
        { id: 'model-2' },
      ],
    },
  ];

  const report = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
    layers,
    prefabs,
  });

  assert.equal(report.isValid, true);
  assert.equal(report.blockingErrors.length, 0);
  assert.equal(report.summary.blockedItems.length, 0);
});

test('runPreflightValidation identifies all issues in degraded scenario', () => {
  const models = [
    {
      id: 'model-1',
      name: 'Model 1',
      position: [NaN, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parentId: 'missing-parent',
      layerId: 'missing-layer',
      colorTint: 'bad',
      opacity: 2,
    },
  ];

  const layers = [
    { id: 'layer-1', name: 'Layer 1' },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'original',
    layers,
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'INVALID_POSITION_VALUE'));
  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_PARENT_REFERENCE'));
  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_LAYER_REFERENCE'));
  assert.ok(report.warnings.some((w: any) => w.code === 'INVALID_COLOR_FORMAT'));
  assert.ok(report.warnings.some((w: any) => w.code === 'INVALID_OPACITY'));
  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_MODEL_FILE'));
});
