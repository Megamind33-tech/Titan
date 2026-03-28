import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandExecutor, CommandExecutorCallbacks, CommandExecutorContext } from '../services/CommandExecutor';
import { ModelData } from '../App';
import { DEFAULT_ENVIRONMENT, POOL_COMPETITION } from '../types/environment';
import { MaterialPreset } from '../types/materials';
import { Path } from '../types/paths';
import { getPathLength, samplePathAtDistance } from '../utils/pathPlacement';
import { Asset } from '../types/assets';

const material: MaterialPreset = {
  id: 'mat-stone',
  name: 'Stone',
  category: 'Concrete',
  color: '#808080',
  opacity: 1,
  transparent: false,
  roughness: 0.7,
  metalness: 0.1,
  emissiveColor: '#000000',
  emissiveIntensity: 0,
  tiling: [1, 1],
  offset: [0, 0],
  rotation: 0,
  wireframe: false,
  side: 'front'
};

const sourceModel: ModelData = {
  id: 'model-1',
  name: 'Bench',
  url: '/bench.glb',
  assetId: 'bench-asset',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  locked: false,
};

const path: Path = {
  id: 'path-1',
  name: 'Main Walkway',
  points: [
    { id: 'p1', position: [0, 0, 0] },
    { id: 'p2', position: [10, 0, 0] },
    { id: 'p3', position: [10, 0, 10] },
  ],
  closed: false,
  type: 'walkway',
  width: 2,
};

const libraryAsset: Asset = {
  id: 'asset-bench-library',
  url: '/library-bench.glb',
  metadata: {
    assetId: 'asset-bench-library',
    name: 'Library Bench',
    type: 'model',
    category: 'Props',
    fileSize: 1024,
    optimizedStatus: 'optimized',
    version: 1,
    editStatus: 'original',
    classification: 'outdoor',
    exportCompatibility: 'ready',
    tags: ['bench'],
    importDate: Date.now(),
  }
};

function buildExecutor(overrides?: Partial<CommandExecutorContext>) {
  let updatedModels: ModelData[] = [];
  let updatedEnvironment = DEFAULT_ENVIRONMENT;

  const context: CommandExecutorContext = {
    models: [sourceModel],
    selectedModelId: sourceModel.id,
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
    paths: [path],
    assets: [libraryAsset],
    ...overrides,
  };

  const callbacks: CommandExecutorCallbacks = {
    onModelsChange: models => { updatedModels = models; },
    onLayersChange: () => {},
    onEnvironmentChange: env => { updatedEnvironment = env; },
    onCameraPresetsChange: () => {},
    onActiveCameraPresetChange: () => {},
    onCameraPathsChange: () => {},
    onActiveCameraPathChange: () => {},
    onCollisionZonesChange: () => {},
    onOpenAssetBrowser: () => {},
    onOpenExportModal: () => {},
    onSelectModel: () => {},
    onTagFilterChange: () => {},
    onCloneModels: (template, placements) => {
      const clones = placements.map((placement, index) => ({
        ...template,
        id: `clone-${index}`,
        position: placement.position,
        rotation: placement.rotation,
      }));
      updatedModels = [...context.models, ...clones];
      return clones.map(c => c.id);
    },
    onCreateModelsFromAsset: (_asset, placements) => {
      const created = placements.map((placement, index) => ({
        ...sourceModel,
        id: `asset-clone-${index}`,
        position: placement.position,
        rotation: placement.rotation,
      }));
      updatedModels = [...context.models, ...created];
      return created.map(m => m.id);
    },
  };

  return { executor: new CommandExecutor(context, callbacks), getUpdatedModels: () => updatedModels, getUpdatedEnvironment: () => updatedEnvironment };
}

test('applies material by name through library source of truth', async () => {
  const { executor, getUpdatedModels } = buildExecutor();

  const result = await executor.execute({
    type: 'apply_material',
    description: 'apply material',
    requiresConfirmation: false,
    payload: { targetId: sourceModel.id, materialName: 'stone' },
  });

  assert.equal(result.success, true);
  const model = getUpdatedModels()[0];
  assert.equal(model.material?.id, material.id);
});

test('applies material by safe partial name matching', async () => {
  const { executor, getUpdatedModels } = buildExecutor();
  const result = await executor.execute({
    type: 'apply_material',
    description: 'apply material',
    requiresConfirmation: false,
    payload: { targetId: sourceModel.id, materialName: 'sto' },
  });

  assert.equal(result.success, true);
  assert.equal(getUpdatedModels()[0].material?.id, material.id);
});

test('updates lighting by preset id', async () => {
  const { executor, getUpdatedEnvironment } = buildExecutor();

  const result = await executor.execute({
    type: 'update_lighting',
    description: 'update lighting',
    requiresConfirmation: false,
    payload: { presetId: 'pool-competition' },
  });

  assert.equal(result.success, true);
  assert.equal(getUpdatedEnvironment().id, 'pool-competition');
});

test('fails lighting update with useful message when preset does not exist', async () => {
  const { executor } = buildExecutor();
  const result = await executor.execute({
    type: 'update_lighting',
    description: 'update lighting',
    requiresConfirmation: false,
    payload: { presetName: 'unknown preset' },
  });

  assert.equal(result.success, false);
  assert.match(result.message, /not found/i);
});

test('places models along path with orientation', async () => {
  const { executor, getUpdatedModels } = buildExecutor();

  const result = await executor.execute({
    type: 'place_along_path',
    description: 'place along path',
    requiresConfirmation: false,
    payload: {
      sourceModelId: sourceModel.id,
      pathId: path.id,
      count: 3,
      orientToPath: true,
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.affectedModelIds?.length, 3);
  assert.equal(getUpdatedModels().length, 4);
  assert.equal(getUpdatedModels()[1].rotation[1], Math.PI / 2);
});

test('path utility computes deterministic length and sampling', () => {
  const length = getPathLength(path);
  assert.equal(length, 20);

  const sample = samplePathAtDistance(path, 15);
  assert.ok(sample);
  assert.deepEqual(sample?.position, [10, 0, 5]);
});

test('place_along_path fails on invalid count and missing path', async () => {
  const { executor } = buildExecutor();
  const invalidCount = await executor.execute({
    type: 'place_along_path',
    description: 'invalid count',
    requiresConfirmation: false,
    payload: { sourceModelId: sourceModel.id, pathId: path.id, count: 0 },
  });
  assert.equal(invalidCount.success, false);
  assert.match(invalidCount.message, /count/i);

  const missingPath = await executor.execute({
    type: 'place_along_path',
    description: 'missing path',
    requiresConfirmation: false,
    payload: { sourceModelId: sourceModel.id, pathId: 'missing', count: 2 },
  });
  assert.equal(missingPath.success, false);
  assert.match(missingPath.message, /not found/i);
});

test('place_along_path can resolve from asset library when model is not in scene', async () => {
  const { executor, getUpdatedModels } = buildExecutor({ models: [] });
  const result = await executor.execute({
    type: 'place_along_path',
    description: 'asset library placement',
    requiresConfirmation: false,
    payload: { assetId: libraryAsset.id, pathId: path.id, count: 2 },
  });

  assert.equal(result.success, true);
  assert.equal(result.affectedModelIds?.length, 2);
  assert.equal(getUpdatedModels().length, 2);
});
