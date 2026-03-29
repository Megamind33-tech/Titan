import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandExecutor, CommandExecutorCallbacks, CommandExecutorContext } from '../services/CommandExecutor';
import { ModelData } from '../App';
import { MaterialPreset } from '../types/materials';
import { DEFAULT_ENVIRONMENT, POOL_COMPETITION } from '../types/environment';
import { Path } from '../types/paths';
import { Asset } from '../types/assets';

const material: MaterialPreset = {
  id: 'mat-1',
  name: 'Concrete',
  category: 'Concrete',
  color: '#999999',
  opacity: 1,
  transparent: false,
  roughness: 0.7,
  metalness: 0,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  tiling: [1, 1],
  offset: [0, 0],
  rotation: 0,
  wireframe: false,
  side: 'front',
};

const model: ModelData = {
  id: 'model-1',
  name: 'Bench',
  url: '/bench.glb',
  assetId: 'asset-1',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

const validPath: Path = {
  id: 'path-1',
  name: 'Main Path',
  points: [
    { id: 'p1', position: [0, 0, 0] },
    { id: 'p2', position: [10, 0, 0] },
  ],
  closed: false,
  type: 'walkway',
  width: 1,
};

const invalidPath: Path = {
  ...validPath,
  id: 'path-invalid',
  points: [{ id: 'only', position: [0, 0, 0] }],
};

const asset: Asset = {
  id: 'asset-2',
  url: '/library.glb',
  metadata: {
    assetId: 'asset-2',
    name: 'Library Bench',
    type: 'model',
    category: 'Props',
    fileSize: 100,
    optimizedStatus: 'optimized',
    version: 1,
    editStatus: 'original',
    classification: 'outdoor',
    exportCompatibility: 'ready',
    tags: [],
    importDate: Date.now(),
  },
};

function buildHarness(overrides?: Partial<CommandExecutorContext>) {
  let modelsChanged: ModelData[] | null = null;
  let environmentChanged: string | null = null;
  let cloneCalls = 0;
  let createCalls = 0;

  const context: CommandExecutorContext = {
    models: [model],
    selectedModelId: model.id,
    layers: [],
    environment: DEFAULT_ENVIRONMENT,
    cameraPresets: [],
    activeCameraPresetId: null,
    cameraPaths: [],
    activeCameraPathId: null,
    prefabs: [],
    collisionZones: [],
    materialLibrary: [material],
    environmentLibrary: [DEFAULT_ENVIRONMENT, POOL_COMPETITION],
    paths: [validPath],
    assets: [asset],
    ...overrides,
  };

  const callbacks: CommandExecutorCallbacks = {
    onModelsChange: next => { modelsChanged = next; },
    onLayersChange: () => {},
    onEnvironmentChange: env => { environmentChanged = env.id; },
    onCameraPresetsChange: () => {},
    onActiveCameraPresetChange: () => {},
    onCameraPathsChange: () => {},
    onActiveCameraPathChange: () => {},
    onCollisionZonesChange: () => {},
    onOpenAssetBrowser: () => {},
    onOpenExportModal: () => {},
    onSelectModel: () => {},
    onTagFilterChange: () => {},
    onCloneModels: (_m, placements) => {
      cloneCalls += 1;
      return placements.map((_, i) => `clone-${i}`);
    },
    onCreateModelsFromAsset: (_a, placements) => {
      createCalls += 1;
      return placements.map((_, i) => `asset-${i}`);
    },
  };

  return {
    executor: new CommandExecutor(context, callbacks),
    get: () => ({ modelsChanged, environmentChanged, cloneCalls, createCalls }),
  };
}

test('apply_material succeeds and updates models callback payload', async () => {
  const { executor, get } = buildHarness();
  const result = await executor.execute({
    type: 'apply_material',
    description: 'apply',
    requiresConfirmation: false,
    payload: { targetId: model.id, materialId: material.id },
  });

  assert.equal(result.success, true);
  assert.equal(get().modelsChanged?.[0].material?.id, material.id);
});

test('apply_material fails for missing target or missing material', async () => {
  const { executor } = buildHarness();
  const missingTarget = await executor.execute({
    type: 'apply_material',
    description: 'apply',
    requiresConfirmation: false,
    payload: { targetId: 'missing', materialId: material.id },
  });
  assert.equal(missingTarget.success, false);

  const missingMaterial = await executor.execute({
    type: 'apply_material',
    description: 'apply',
    requiresConfirmation: false,
    payload: { targetId: model.id, materialId: 'missing' },
  });
  assert.equal(missingMaterial.success, false);
});

test('apply_material rejects invalid library presets and does not invoke model updates', async () => {
  const invalidMaterial: MaterialPreset = { ...material, id: 'invalid', roughness: 2 };
  const { executor, get } = buildHarness({ materialLibrary: [invalidMaterial] });
  const result = await executor.execute({
    type: 'apply_material',
    description: 'apply',
    requiresConfirmation: false,
    payload: { targetId: model.id, materialId: invalidMaterial.id },
  });

  assert.equal(result.success, false);
  assert.match(result.message, /invalid material/i);
  assert.equal(get().modelsChanged, null);
});

test('update_lighting succeeds/fails and only triggers environment callback', async () => {
  const { executor, get } = buildHarness();

  const success = await executor.execute({
    type: 'update_lighting',
    description: 'light',
    requiresConfirmation: false,
    payload: { presetId: POOL_COMPETITION.id },
  });
  assert.equal(success.success, true);
  assert.equal(get().environmentChanged, POOL_COMPETITION.id);
  assert.equal(get().modelsChanged, null);

  const failure = await executor.execute({
    type: 'update_lighting',
    description: 'light',
    requiresConfirmation: false,
    payload: { presetName: 'does-not-exist' },
  });
  assert.equal(failure.success, false);
  assert.match(failure.message, /not found/i);
  assert.equal(get().environmentChanged, POOL_COMPETITION.id);
});

test('place_along_path validates payload and path validity', async () => {
  const { executor } = buildHarness();
  const missingPayload = await executor.execute({
    type: 'place_along_path',
    description: 'place',
    requiresConfirmation: false,
    payload: { count: 3 },
  });
  assert.equal(missingPayload.success, false);

  const { executor: invalidPathExecutor } = buildHarness({ paths: [invalidPath] });
  const invalidPathResult = await invalidPathExecutor.execute({
    type: 'place_along_path',
    description: 'place',
    requiresConfirmation: false,
    payload: { sourceModelId: model.id, pathId: invalidPath.id, count: 2 },
  });
  assert.equal(invalidPathResult.success, false);
  assert.match(invalidPathResult.message, /invalid/i);
});

test('place_along_path succeeds for source model and asset library paths with callback routing', async () => {
  const sourceHarness = buildHarness();
  const sourceResult = await sourceHarness.executor.execute({
    type: 'place_along_path',
    description: 'place',
    requiresConfirmation: false,
    payload: { sourceModelId: model.id, pathId: validPath.id, count: 3 },
  });
  assert.equal(sourceResult.success, true);
  assert.equal(sourceResult.affectedModelIds?.length, 3);
  assert.equal(sourceHarness.get().cloneCalls, 1);
  assert.equal(sourceHarness.get().createCalls, 0);

  const assetHarness = buildHarness({ models: [] });
  const assetResult = await assetHarness.executor.execute({
    type: 'place_along_path',
    description: 'place',
    requiresConfirmation: false,
    payload: { assetId: asset.id, pathId: validPath.id, count: 2 },
  });
  assert.equal(assetResult.success, true);
  assert.equal(assetResult.affectedModelIds?.length, 2);
  assert.equal(assetHarness.get().cloneCalls, 0);
  assert.equal(assetHarness.get().createCalls, 1);
});

test('place_along_path fails for metadata-only asset library entries', async () => {
  const metadataOnlyAsset = { ...asset, id: 'asset-empty', url: '' };
  const harness = buildHarness({ models: [], assets: [metadataOnlyAsset] });
  const result = await harness.executor.execute({
    type: 'place_along_path',
    description: 'place',
    requiresConfirmation: false,
    payload: { assetId: metadataOnlyAsset.id, pathId: validPath.id, count: 2 },
  });

  assert.equal(result.success, false);
  assert.match(result.message, /metadata-only/i);
  assert.equal(harness.get().cloneCalls, 0);
  assert.equal(harness.get().createCalls, 0);
});
