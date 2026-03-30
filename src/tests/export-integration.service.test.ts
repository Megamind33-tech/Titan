/**
 * export-integration.service.test.ts
 *
 * Service-level integration tests for the export validation pipeline.
 * Tests the integration of preflight validation and manifest validation
 * without file I/O dependencies.
 *
 * NOTE: Full export file I/O testing is handled in e2e tests.
 * These tests validate the validation layer integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runPreflightValidation,
  PreflightReport,
} from '../services/ExportPreflightValidation';
import {
  validateExportManifest,
  StrictExportAssetManifest,
  StrictSceneExportManifest,
} from '../services/ExportManifestValidation';

// Helper: Create a minimal valid model for preflight validation
const createValidModel = (id: string, overrides: Partial<any> = {}): any => ({
  id,
  name: `Model ${id}`,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  type: 'model',
  ...overrides,
});

// Helper: Create a valid export asset for manifest validation
const createValidAsset = (id: string, overrides: Partial<StrictExportAssetManifest> = {}): StrictExportAssetManifest => ({
  id,
  name: `Asset ${id}`,
  type: 'model',
  layerId: undefined,
  visible: true,
  locked: false,
  file: undefined,
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  material: {
    wireframe: false,
    lightIntensity: 1,
    castShadow: true,
    receiveShadow: true,
    color: '#ffffff',
    opacity: 1.0,
    roughness: 0.5,
    metalness: 0,
    emissiveColor: '#000000',
    texture: null,
    presetId: undefined,
    presetName: undefined,
  },
  version: 2,
  parent: null,
  metadata: {},
  ...overrides,
});

// Helper: Create valid scene manifest
const createValidManifest = (assets: StrictExportAssetManifest[]): StrictSceneExportManifest => ({
  version: '2.0.0',
  exportDate: new Date().toISOString(),
  scene: {
    lighting: {
      ambient: 0.5,
      hemisphere: {
        intensity: 0.7,
        color: '#ffffff',
        groundColor: '#000000',
      },
      directional: {
        intensity: 1,
        position: [5, 10, 7],
      },
      shadowSoftness: 0.5,
      presetId: 'env-1',
      presetName: 'Default',
      environmentPreset: 'studio',
      exposure: 1,
      toneMapping: 'Linear',
    },
    gridReceiveShadow: true,
    camera: undefined,
    layers: undefined,
  },
  assets,
});

// ─── Preflight Validation Integration Tests ────────────────────────────────

test('preflight validation rejects export with no models selected', () => {
  const models = [createValidModel('model-1')];

  const report = runPreflightValidation(models, [], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'NO_MODELS_SELECTED'));
});

test('preflight validation rejects export with invalid model ID', () => {
  const models = [createValidModel('')];

  const report = runPreflightValidation(models, [''], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'INVALID_MODEL_ID'));
});

test('preflight validation rejects export with NaN in position', () => {
  const models = [createValidModel('model-1', { position: [NaN, 0, 0] })];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'INVALID_POSITION_VALUE'));
});

test('preflight validation rejects export with non-positive scale', () => {
  const models = [createValidModel('model-1', { scale: [0, 1, 1] })];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, false);
  assert.ok(report.blockingErrors.some((e: any) => e.code === 'INVALID_SCALE_VALUE'));
});

test('preflight validation accepts valid single model', () => {
  const models = [createValidModel('model-1')];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.equal(report.blockingErrors.length, 0);
  assert.equal(report.summary.exportable, true);
});

test('preflight validation accepts valid models with hierarchy', () => {
  const models = [
    createValidModel('parent-1'),
    createValidModel('child-1', { parentId: 'parent-1' }),
    createValidModel('child-2', { parentId: 'parent-1' }),
  ];

  const report = runPreflightValidation(models, ['parent-1', 'child-1', 'child-2'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.equal(report.blockingErrors.length, 0);
});

test('preflight validation warns on missing parent reference', () => {
  const models = [
    createValidModel('model-1'),
    createValidModel('model-2', { parentId: 'missing-parent' }),
  ];

  const report = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_PARENT_REFERENCE'));
  assert.equal(report.summary.exportable, true);
});

test('preflight validation validates layer references', () => {
  const models = [createValidModel('model-1', { layerId: 'missing-layer' })];
  const layers = [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, order: 0 }];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
    layers,
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_LAYER_REFERENCE'));
});

test('preflight validation validates prefab model references', () => {
  const models = [createValidModel('model-1')];
  const prefabs = [
    {
      id: 'prefab-1',
      models: [
        { id: 'model-1' },
        { id: 'model-missing' },
      ],
    },
  ];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
    prefabs,
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_PREFAB_MODEL_REFERENCE'));
});

test('preflight validation detects missing files for original format', () => {
  const models = [createValidModel('model-1')];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'original',
  });

  assert.ok(report.warnings.some((w: any) => w.code === 'MISSING_MODEL_FILE'));
});

test('preflight validation skips file check for GLB format', () => {
  const models = [createValidModel('model-1')];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.ok(!report.warnings.some((w: any) => w.code === 'MISSING_MODEL_FILE'));
});

test('preflight validation distinguishes exportable with warnings', () => {
  const models = [createValidModel('model-1', { colorTint: 'invalid' })];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(report.isValid, true);
  assert.equal(report.summary.exportable, true);
  assert.ok(report.warnings.length > 0);
});

// ─── Manifest Validation Integration Tests ────────────────────────────────

test('manifest validation accepts valid single asset manifest', () => {
  const assets = [createValidAsset('asset-1')];
  const manifest = createValidManifest(assets);

  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 1);
  assert.equal(validatedManifest.assets[0].id, 'asset-1');
});

test('manifest validation accepts valid multi-asset manifest', () => {
  const assets = [
    createValidAsset('asset-1'),
    createValidAsset('asset-2'),
    createValidAsset('asset-3'),
  ];
  const manifest = createValidManifest(assets);

  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 3);
});

test('manifest validation rejects duplicate asset IDs', () => {
  const assets = [
    createValidAsset('asset-1'),
    createValidAsset('asset-1'),  // Duplicate ID
  ];
  const manifest = createValidManifest(assets);

  assert.throws(() => validateExportManifest(manifest), /duplicate|id/i);
});

test('manifest validation validates asset layer references', () => {
  const assets = [
    createValidAsset('asset-1', { layerId: 'layer-1' }),
  ];
  const manifest = createValidManifest(assets);
  manifest.scene.layers = [{ id: 'layer-2', name: 'Layer 2', visible: true, locked: false, order: 0 }];

  assert.throws(() => validateExportManifest(manifest), /layer|reference/i);
});

test('manifest validation accepts valid asset layer references', () => {
  const assets = [
    createValidAsset('asset-1', { layerId: 'layer-1' }),
  ];
  const manifest = createValidManifest(assets);
  manifest.scene.layers = [{ id: 'layer-1', name: 'Layer 1', visible: true, locked: false, order: 0 }];

  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 1);
});

test('manifest validation validates parent-child relationships', () => {
  const assets = [
    createValidAsset('asset-1'),
    createValidAsset('asset-2', { parent: 'missing-parent' }),
  ];
  const manifest = createValidManifest(assets);

  assert.throws(() => validateExportManifest(manifest), /parent|reference/i);
});

test('manifest validation accepts valid parent-child relationships', () => {
  const assets = [
    createValidAsset('asset-1'),
    createValidAsset('asset-2', { parent: 'asset-1' }),
  ];
  const manifest = createValidManifest(assets);

  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 2);
});

// ─── Pipeline Integration Tests ───────────────────────────────────────────

test('pipeline validates preflight then manifest for valid export', () => {
  // Phase 1: Preflight validation
  const models = [
    createValidModel('model-1'),
    createValidModel('model-2', { parentId: 'model-1' }),
  ];
  const preflightReport = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
  });

  assert.equal(preflightReport.isValid, true);

  // Phase 2: Build assets and manifest
  const assets = [
    createValidAsset('model-1'),
    createValidAsset('model-2', { parent: 'model-1' }),
  ];
  const manifest = createValidManifest(assets);

  // Phase 3: Manifest validation
  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 2);
});

test('pipeline aborts if preflight validation fails', () => {
  // Phase 1: Preflight validation
  const models = [createValidModel('model-1', { position: [NaN, 0, 0] })];
  const preflightReport = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(preflightReport.isValid, false);
  // Pipeline should abort here - no manifest building/validation

  // Verify blocking errors present
  assert.ok(preflightReport.blockingErrors.length > 0);
});

test('pipeline handles warnings as exportable if no blocking errors', () => {
  // Phase 1: Preflight validation with warnings
  const models = [
    createValidModel('model-1', { colorTint: 'invalid' }),
    createValidModel('model-2', { parentId: 'missing-parent' }),
  ];
  const preflightReport = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
  });

  // Should be exportable despite warnings
  assert.equal(preflightReport.isValid, true);
  assert.equal(preflightReport.summary.exportable, true);
  assert.ok(preflightReport.warnings.length > 0);

  // Phase 2: Continue to manifest building
  const assets = [
    createValidAsset('model-1'),
    createValidAsset('model-2'),
  ];
  const manifest = createValidManifest(assets);

  // Phase 3: Manifest validation succeeds
  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 2);
});

test('pipeline validates complex scene with all systems', () => {
  // Phase 1: Preflight validation with multiple systems
  const models = [
    createValidModel('model-1', { layerId: 'layer-1' }),
    createValidModel('model-2', { layerId: 'layer-1', parentId: 'model-1' }),
    createValidModel('model-3', { layerId: 'layer-2' }),
  ];

  const layers = [
    { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, order: 0 },
    { id: 'layer-2', name: 'Layer 2', visible: true, locked: false, order: 1 },
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

  const preflightReport = runPreflightValidation(models, ['model-1', 'model-2', 'model-3'], {
    format: 'glb',
    layers,
    prefabs,
  });

  assert.equal(preflightReport.isValid, true);

  // Phase 2: Build and validate manifest
  const assets = [
    createValidAsset('model-1', { layerId: 'layer-1' }),
    createValidAsset('model-2', { layerId: 'layer-1', parent: 'model-1' }),
    createValidAsset('model-3', { layerId: 'layer-2' }),
  ];

  const manifest = createValidManifest(assets);
  manifest.scene.layers = layers;
  manifest.prefabs = [
    {
      id: 'prefab-1',
      name: 'Prefab 1',
      category: undefined,
      modelIds: ['model-1', 'model-2'],
      metadata: undefined,
    },
  ];

  const validatedManifest = validateExportManifest(manifest);

  assert.equal(validatedManifest.assets.length, 3);
  assert.equal(validatedManifest.prefabs?.length, 1);
});

// ─── Error Reporting Integration Tests ────────────────────────────────────

test('preflight report includes actionable recommendations', () => {
  const models = [
    createValidModel('model-1', { position: [NaN, 0, 0] }),
    createValidModel('model-2', { scale: [0, 1, 1] }),
  ];

  const report = runPreflightValidation(models, ['model-1', 'model-2'], {
    format: 'glb',
  });

  assert.ok(report.recommendations.length > 0);
  assert.ok(report.recommendations.some((r: string) => r.match(/blocking/i)));
});

test('preflight report includes context for each issue', () => {
  const models = [createValidModel('model-1', { position: [NaN, 0, 0] })];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  const issue = report.blockingErrors[0];
  assert.ok(issue.context);
  assert.equal(issue.context?.modelId, 'model-1');
  assert.ok(issue.context?.field);
});

test('preflight report includes recovery suggestions', () => {
  const models = [createValidModel('model-1', { position: [Infinity, 0, 0] })];

  const report = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  const issue = report.blockingErrors[0];
  assert.ok(issue.recovery);
  assert.ok(issue.recovery?.action);
  assert.ok(issue.recovery?.description);
});

test('preflight report summarizes blocked and degraded items', () => {
  const models = [
    createValidModel('model-1', { position: [NaN, 0, 0] }),  // Blocking
    createValidModel('model-2', { colorTint: 'invalid' }),    // Warning
    createValidModel('model-3'),                              // Valid
  ];

  const report = runPreflightValidation(models, ['model-1', 'model-2', 'model-3'], {
    format: 'glb',
  });

  assert.ok(report.summary.blockedItems.includes('model-1'));
  assert.ok(report.summary.degradedItems.includes('model-2'));
  assert.ok(!report.summary.blockedItems.includes('model-3'));
  assert.ok(!report.summary.degradedItems.includes('model-3'));
});

// ─── Atomic Export Behavior Tests ─────────────────────────────────────────

test('pipeline ensures all-or-nothing export semantics with preflight validation', () => {
  // Valid preflight
  const models = [createValidModel('model-1')];
  const preflightReport = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });
  assert.equal(preflightReport.isValid, true);

  // Valid manifest
  const assets = [createValidAsset('model-1')];
  const manifest = createValidManifest(assets);
  const validatedManifest = validateExportManifest(manifest);

  // Both should succeed atomically
  assert.equal(validatedManifest.assets.length, 1);
});

test('pipeline prevents partial exports with preflight validation failure', () => {
  // Invalid preflight - should block manifest building
  const models = [createValidModel('model-1', { position: [NaN, 0, 0] })];
  const preflightReport = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });

  assert.equal(preflightReport.isValid, false);
  // At this point, manifest building should not proceed
  // No asset would be created, no ZIP written
});

test('pipeline prevents partial exports with manifest validation failure', () => {
  // Valid preflight
  const models = [createValidModel('model-1')];
  const preflightReport = runPreflightValidation(models, ['model-1'], {
    format: 'glb',
  });
  assert.equal(preflightReport.isValid, true);

  // Invalid manifest
  const assets = [createValidAsset('model-1', { parent: 'missing-parent' })];
  const manifest = createValidManifest(assets);

  // Manifest validation should fail
  assert.throws(() => validateExportManifest(manifest), /parent|reference/i);
  // No ZIP should be written after this error
});
