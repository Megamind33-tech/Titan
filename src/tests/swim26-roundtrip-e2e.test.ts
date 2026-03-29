/**
 * End-to-End Round-Trip Tests
 *
 * Validates the complete pipeline:
 * Export → Import → Assemble → Re-export → Re-import → Verify
 *
 * Ensures no duplication or identity drift across real-world cycles.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelData } from '../App';
import { buildSwim26Manifest } from '../services/Swim26ManifestService';
import { importSwim26Manifest } from '../services/Swim26ManifestImporter';
import { assembleSwim26RuntimeScene } from '../services/swim26Runtime/Swim26RuntimeSceneAssembler';
import { DEFAULT_ENVIRONMENT } from '../types/environment';

/**
 * Helper: Create a minimal ModelData for testing
 */
const createTestModel = (authoredId: string, name: string, position: [number, number, number] = [0, 0, 0]): ModelData => ({
  id: `runtime-${Date.now()}`,  // Runtime ID changes, authoredId stays same
  authoredId,                     // This is what matters for round-trip
  name,
  url: 'test.glb',
  position,
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  locked: false,
  wireframe: false,
  lightIntensity: 0,
  castShadow: true,
  receiveShadow: true,
  type: 'model',
  classification: 'outdoor',
  behavior: 'movable',
  childrenIds: [],
});

// ─── END-TO-END PIPELINE TESTS ──────────────────────────────────────

test('first import creates meshes with correct authoredId', async () => {
  const models = [
    createTestModel('uuid-podium', 'Podium', [0, 0, 0]),
    createTestModel('uuid-flag', 'Flag', [5, 0, 0]),
  ];

  // Export manifest
  const manifest = buildSwim26Manifest({
    models,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  // Import manifest
  const importResult = importSwim26Manifest(manifest);
  assert.equal(importResult.ok, true);
  assert.equal(importResult.scene?.nodes.length, 2);

  // Verify authoredIds are preserved
  const podiumNode = importResult.scene?.nodes.find(n => n.name === 'Podium');
  assert.equal(podiumNode?.id, 'uuid-podium');

  const flagNode = importResult.scene?.nodes.find(n => n.name === 'Flag');
  assert.equal(flagNode?.id, 'uuid-flag');
});

test('re-import of same manifest does not duplicate nodes', async () => {
  const models = [
    createTestModel('uuid-podium', 'Podium', [0, 0, 0]),
    createTestModel('uuid-flag', 'Flag', [5, 0, 0]),
  ];

  // First export/import
  const manifest1 = buildSwim26Manifest({
    models,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const importResult1 = importSwim26Manifest(manifest1);
  assert.equal(importResult1.scene?.nodes.length, 2);

  // Create initial scene
  const scene1 = await assembleSwim26RuntimeScene({
    manifest: manifest1,
    resolver: undefined,
  });
  assert.equal(scene1.scene.meshes?.length, 2);

  // Re-import same manifest to EXISTING scene (round-trip update)
  const importResult2 = importSwim26Manifest(manifest1);
  const scene2 = await assembleSwim26RuntimeScene({
    manifest: manifest1,
    existingScene: scene1.scene,  // ← Round-trip key: provide existing scene
  });

  // CRITICAL: Should still be 2 meshes, not 4
  assert.equal(scene2.scene.meshes?.length, 2, 'Re-import should not duplicate meshes');
});

test('updated node properties are applied on re-import', async () => {
  const models1 = [
    createTestModel('uuid-podium', 'Podium', [0, 0, 0]),
  ];

  // First import
  const manifest1 = buildSwim26Manifest({
    models: models1,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const scene1 = await assembleSwim26RuntimeScene({ manifest: manifest1 });
  assert.equal(scene1.scene.meshes?.length, 1);

  const mesh1 = scene1.scene.meshes?.[0];
  assert.deepEqual(mesh1?.position, { x: 0, y: 0, z: 0 });
  assert.equal(mesh1?.metadata?.authoredId, 'uuid-podium');

  // User edits: move podium
  const models2 = [
    createTestModel('uuid-podium', 'Podium', [10, 20, 30]),
  ];

  // Re-export with new position
  const manifest2 = buildSwim26Manifest({
    models: models2,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  // Re-import to existing scene
  const scene2 = await assembleSwim26RuntimeScene({
    manifest: manifest2,
    existingScene: scene1.scene,
  });

  // Verify mesh was updated in-place
  const mesh2 = scene2.scene.meshes?.find(m => m.metadata?.authoredId === 'uuid-podium');
  assert.ok(mesh2, 'Podium mesh should exist');
  assert.deepEqual(mesh2?.position, { x: 10, y: 20, z: 30 }, 'Position should be updated');
  assert.equal(scene2.scene.meshes?.length, 1, 'Should still be 1 mesh, not duplicated');
});

test('stale nodes are deactivated on re-import', async () => {
  const models1 = [
    createTestModel('uuid-podium', 'Podium'),
    createTestModel('uuid-flag', 'Flag'),
  ];

  // First import: 2 objects
  const manifest1 = buildSwim26Manifest({
    models: models1,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const scene1 = await assembleSwim26RuntimeScene({ manifest: manifest1 });
  assert.equal(scene1.scene.meshes?.length, 2);

  // User removes flag, keeps podium
  const models2 = [
    createTestModel('uuid-podium', 'Podium'),
  ];

  // Re-export without flag
  const manifest2 = buildSwim26Manifest({
    models: models2,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  // Re-import to existing scene
  const scene2 = await assembleSwim26RuntimeScene({
    manifest: manifest2,
    existingScene: scene1.scene,
  });

  // Verify: 2 meshes total (podium active + flag deactivated)
  assert.equal(scene2.scene.meshes?.length, 2);

  const podium = scene2.scene.meshes?.find(m => m.metadata?.authoredId === 'uuid-podium');
  const flag = scene2.scene.meshes?.find(m => m.metadata?.authoredId === 'uuid-flag');

  assert.ok(podium, 'Podium mesh should exist');
  assert.ok(flag, 'Flag mesh should exist');
  assert.equal(flag?.metadata?.isDeactivated, true, 'Flag should be marked as deactivated');
});

test('multiple re-imports do not accumulate duplicates (stress test)', async () => {
  const baseModel = createTestModel('uuid-obj', 'Object', [0, 0, 0]);

  let scene: any = null;
  const meshCountHistory: number[] = [];

  // Simulate 5 re-imports with slight position changes
  for (let iteration = 0; iteration < 5; iteration++) {
    const models = [
      createTestModel('uuid-obj', 'Object', [iteration, 0, 0]),
    ];

    const manifest = buildSwim26Manifest({
      models,
      environment: DEFAULT_ENVIRONMENT,
      paths: [],
    });

    if (!scene) {
      // First import
      const result = await assembleSwim26RuntimeScene({ manifest });
      scene = result.scene;
    } else {
      // Re-import to existing scene
      const result = await assembleSwim26RuntimeScene({
        manifest,
        existingScene: scene,
      });
      scene = result.scene;
    }

    const meshCount = scene.meshes?.length ?? 0;
    meshCountHistory.push(meshCount);
  }

  // Verify no accumulation: should be exactly 1 mesh for all 5 iterations
  assert.deepEqual(meshCountHistory, [1, 1, 1, 1, 1], 'Mesh count should remain constant across re-imports');
});

test('duplicate authoredId in manifest generates warning', () => {
  const manifest = {
    version: '1.1.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          authoredId: 'uuid-duplicate',
          id: 'runtime-1',
          name: 'Object A',
          assetRef: { type: 'url' as const, value: 'a.glb' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
        {
          authoredId: 'uuid-duplicate',  // ← Same as first!
          id: 'runtime-2',
          name: 'Object B',
          assetRef: { type: 'url' as const, value: 'b.glb' },
          transform: { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#000000' },
      paths: [],
    },
    runtimeOwned: [],
    unsupported: [],
  };

  const result = importSwim26Manifest(manifest as any);

  assert.equal(result.ok, true);
  // Should have warning about duplicate ID
  const duplicateWarning = result.warnings.find(w => w.message.includes('Duplicate authoredId'));
  assert.ok(duplicateWarning, 'Should warn about duplicate authoredId');
});

test('metadata is preserved without runtime state corruption', async () => {
  const models = [
    createTestModel('uuid-podium', 'Podium'),
  ];

  // First import
  const manifest1 = buildSwim26Manifest({
    models,
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const scene1 = await assembleSwim26RuntimeScene({ manifest: manifest1 });
  const mesh1 = scene1.scene.meshes?.[0];

  // Simulate runtime system adding gameplay data
  if (mesh1) {
    mesh1.metadata = {
      ...mesh1.metadata,
      gameplayData: { score: 100, active: true },
      runtimeState: { lastHitTime: Date.now() },
    };
  }

  // Re-import same manifest
  const scene2 = await assembleSwim26RuntimeScene({
    manifest: manifest1,
    existingScene: scene1.scene,
  });

  const mesh2 = scene2.scene.meshes?.[0];

  // Verify runtime metadata was preserved
  assert.equal(mesh2?.metadata?.gameplayData?.score, 100, 'Gameplay score should be preserved');
  assert.equal(mesh2?.metadata?.gameplayData?.active, true, 'Gameplay active flag should be preserved');
  assert.ok(mesh2?.metadata?.runtimeState?.lastHitTime, 'Runtime state should be preserved');
});

test('v1.0.0 backward compat manifests work but warn about limitations', () => {
  const manifest = {
    version: '1.0.0',  // Old version without authoredId
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          id: 'old-editor-id',  // ← No authoredId field
          name: 'Podium',
          assetRef: { type: 'url' as const, value: 'podium.glb' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#000000' },
      paths: [],
    },
    runtimeOwned: [],
    unsupported: [],
  };

  const result = importSwim26Manifest(manifest as any);

  assert.equal(result.ok, true);
  assert.equal(result.scene?.nodes.length, 1);

  // Should have warning about v1.0.0
  const v1Warning = result.warnings.find(w => w.message.includes('v1.0.0'));
  assert.ok(v1Warning, 'Should warn about v1.0.0 limitations');
  assert.ok(
    v1Warning?.message.includes('legacy object/path IDs are reused when present'),
    'Warning should explain backward-compat ID behavior',
  );

  // Backward compatibility should preserve legacy ID when authoredId is unavailable.
  const node = result.scene?.nodes[0];
  assert.equal(node?.id, 'old-editor-id', 'Should preserve legacy object ID in v1.0.0 imports');
});

test('end-to-end sanity path: no duplicates, updates apply, removals deactivate, runtime-owned preserved', async () => {
  const first = buildSwim26Manifest({
    models: [
      createTestModel('uuid-a', 'Node A', [0, 0, 0]),
      createTestModel('uuid-b', 'Node B', [2, 0, 0]),
    ],
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const initial = await assembleSwim26RuntimeScene({ manifest: first });
  assert.equal(initial.scene.meshes?.length, 2);
  initial.scene.meshes?.push({
    id: 'runtime-owned-system',
    name: 'RuntimeSystem',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scaling: { x: 1, y: 1, z: 1 },
    metadata: { gameplayData: { protected: true } },
  });

  const second = buildSwim26Manifest({
    models: [
      createTestModel('uuid-a', 'Node A', [10, 0, 0]), // updated
      createTestModel('uuid-c', 'Node C', [5, 0, 0]),  // added
      // uuid-b removed
    ],
    environment: DEFAULT_ENVIRONMENT,
    paths: [],
  });

  const reimported = await assembleSwim26RuntimeScene({
    manifest: second,
    existingScene: initial.scene,
  });

  const authoredMeshes = reimported.scene.meshes?.filter(m => typeof m.metadata?.authoredId === 'string') ?? [];
  assert.equal(authoredMeshes.length, 3, 'two active + one deactivated should remain');
  const nodeA = authoredMeshes.find(m => m.metadata?.authoredId === 'uuid-a');
  const nodeB = authoredMeshes.find(m => m.metadata?.authoredId === 'uuid-b');
  const nodeC = authoredMeshes.find(m => m.metadata?.authoredId === 'uuid-c');
  assert.deepEqual(nodeA?.position, { x: 10, y: 0, z: 0 });
  assert.equal(nodeB?.metadata?.isDeactivated, true);
  assert.ok(nodeC);

  const runtimeOwned = reimported.scene.meshes?.find(m => m.id === 'runtime-owned-system');
  assert.equal(runtimeOwned?.metadata?.gameplayData?.protected, true);
  assert.ok(reimported.diagnostics.some(d => d.code === 'ROUNDTRIP_SYNC_DUPLICATE_AUTHORED_ID') === false);
  assert.ok(reimported.diagnostics.some(d => d.code === 'ROUNDTRIP_SYNC_NODE_DEACTIVATED' && (d.context as any)?.authoredId === 'uuid-b'));
});
