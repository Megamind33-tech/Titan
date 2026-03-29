/**
 * Round-Trip Synchronization Tests (PHASE 6)
 *
 * Verifies that scenes can survive multiple export/import cycles without:
 * - Duplicate node creation
 * - Identity drift
 * - Broken references
 *
 * Tests the incremental update policy from PHASE 3.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthoredSubsetIndex,
  applySwim26RoundTripSync,
  synchronizeSwim26ImportedScene,
} from '../services/Swim26RoundTripSync';
import { ImportedSwim26Node } from '../services/Swim26ManifestImporter';
import { BabylonLikeMesh, BabylonLikeScene } from '../services/swim26Runtime/types';

/**
 * Helper: Create a mock Babylon.js scene with meshes.
 */
const createMockScene = (meshes: any[] = []): BabylonLikeScene => ({
  meshes,
});

/**
 * Helper: Create a mock mesh with metadata.
 */
const createMockMesh = (authoredId: string, name: string, position: [number, number, number] = [0, 0, 0]): BabylonLikeMesh => ({
  id: `mesh-${authoredId}`,
  name,
  position: { x: position[0], y: position[1], z: position[2] },
  rotation: { x: 0, y: 0, z: 0 },
  scaling: { x: 1, y: 1, z: 1 },
  metadata: {
    authoredId,
    authoredName: name,
    authoredTags: [],
    isDeactivated: false,
  } as any,
  isEnabled: true,
  visibility: 1,
});

/**
 * Helper: Create a mock imported node.
 */
const createMockNode = (
  id: string,
  name: string,
  position: [number, number, number] = [0, 0, 0],
  options?: Partial<ImportedSwim26Node>
): ImportedSwim26Node => ({
  id,
  name,
  transform: {
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  tags: options?.tags ?? [],
  metadata: options?.metadata ?? {},
  assetRef: options?.assetRef,
  material: options?.material,
});

// ─── PHASE 6: FIXTURE-BASED TESTS ──────────────────────────────────────────

test('builds authored subset index correctly', () => {
  const mesh1 = createMockMesh('uuid-1', 'Podium');
  const mesh2 = createMockMesh('uuid-2', 'Flag');
  const mesh3 = {
    ...createMockMesh('uuid-3', 'Runtime Object'),
    metadata: { /* no authoredId */ } as any,
  };

  const scene = createMockScene([mesh1, mesh2, mesh3]);
  const index = buildAuthoredSubsetIndex(scene);

  assert.equal(index.authoredIdToMesh.size, 2);
  assert.ok(index.authoredIdToMesh.has('uuid-1'));
  assert.ok(index.authoredIdToMesh.has('uuid-2'));
  assert.equal(index.authoredIdToMesh.get('uuid-1'), mesh1);
});

test('detects and updates existing nodes by stable ID', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium', [0, 0, 0]);
  const scene = createMockScene([mesh1]);

  const newNode = createMockNode('uuid-podium', 'Podium', [5, 5, 5]);
  const result = applySwim26RoundTripSync(scene, [newNode]);

  assert.equal(result.updatedMeshCount, 1);
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].type, 'updated');

  // Verify mesh was updated in-place
  assert.deepEqual(mesh1.position, { x: 5, y: 5, z: 5 });
});

test('creates new nodes for content not in scene', () => {
  const scene = createMockScene([]);
  const newNode1 = createMockNode('uuid-podium', 'Podium');
  const newNode2 = createMockNode('uuid-flag', 'Flag');

  const { result, nodesToCreate } = synchronizeSwim26ImportedScene(scene, [newNode1, newNode2]);

  assert.equal(result.changes.filter(c => c.type === 'created').length, 2);
  assert.equal(nodesToCreate.length, 2);
});

test('deactivates stale nodes (removed from manifest)', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium');
  const mesh2 = createMockMesh('uuid-flag', 'Flag');
  const scene = createMockScene([mesh1, mesh2]);

  // Only podium in new manifest, flag is stale
  const newNodes = [createMockNode('uuid-podium', 'Podium')];
  const result = applySwim26RoundTripSync(scene, newNodes);

  assert.equal(result.deactivatedMeshCount, 1);
  assert.equal(result.changes.filter(c => c.type === 'deactivated').length, 1);

  // Verify mesh was deactivated
  assert.equal(mesh2.isEnabled, false);
  assert.equal(mesh2.visibility, 0);
  assert.equal(mesh2.metadata.isDeactivated, true);
});

test('idempotency: importing same manifest twice produces same result', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium', [0, 0, 0]);
  const scene1 = createMockScene([mesh1]);
  const scene2 = createMockScene([createMockMesh('uuid-podium', 'Podium', [0, 0, 0])]);

  const node = createMockNode('uuid-podium', 'Podium', [5, 5, 5]);

  const result1 = applySwim26RoundTripSync(scene1, [node]);
  const result2 = applySwim26RoundTripSync(scene2, [node]);

  // Both should have same number of updates (one update each)
  assert.equal(result1.updatedMeshCount, 1);
  assert.equal(result2.updatedMeshCount, 1);

  // Both scene meshes should be updated to same position
  assert.deepEqual(mesh1.position, { x: 5, y: 5, z: 5 });
  assert.deepEqual(scene2.meshes[0].position, { x: 5, y: 5, z: 5 });
});

test('handles mixed updates, creations, and deactivations in one sync', () => {
  // Start with: podium (stale), flag (to update), tower (runtime-owned)
  const podium = createMockMesh('uuid-podium', 'Podium');
  const flag = createMockMesh('uuid-flag', 'Flag', [0, 0, 0]);
  const tower = {
    ...createMockMesh('uuid-tower', 'Tower'),
    metadata: { /* no authoredId - runtime owned */ } as any,
  };
  const originalTowerMetadata = { ...tower.metadata };
  const scene = createMockScene([podium, flag, tower]);

  // New manifest: flag (updated), trophy (new), podium removed
  const newNodes = [
    createMockNode('uuid-flag', 'Flag', [10, 10, 10]),
    createMockNode('uuid-trophy', 'Trophy'),
  ];

  const result = applySwim26RoundTripSync(scene, newNodes);

  // Check results
  assert.equal(result.updatedMeshCount, 1); // flag updated
  assert.equal(result.changes.filter(c => c.type === 'created').length, 1); // trophy created
  assert.equal(result.deactivatedMeshCount, 1); // podium deactivated

  // Verify specific state
  assert.deepEqual(flag.position, { x: 10, y: 10, z: 10 }); // flag updated
  assert.equal(podium.isEnabled, false); // podium deactivated
  assert.equal(tower.metadata.authoredId, undefined); // tower untouched (no authoredId)
});

test('preserves runtime-injected metadata during updates', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium', [0, 0, 0]);
  mesh1.metadata.gameplayData = { points: 100, active: true };
  mesh1.metadata.runtimeState = { lastHit: Date.now() };

  const scene = createMockScene([mesh1]);
  const newNode = createMockNode('uuid-podium', 'Podium', [5, 5, 5]);

  applySwim26RoundTripSync(scene, [newNode]);

  // Verify runtime metadata was preserved
  assert.equal(mesh1.metadata.gameplayData.points, 100);
  assert.equal(mesh1.metadata.gameplayData.active, true);
  assert.ok(mesh1.metadata.runtimeState.lastHit);
});

test('handles empty manifest (all nodes removed)', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium');
  const mesh2 = createMockMesh('uuid-flag', 'Flag');
  const scene = createMockScene([mesh1, mesh2]);

  const result = applySwim26RoundTripSync(scene, []);

  assert.equal(result.deactivatedMeshCount, 2);
  assert.equal(mesh1.isEnabled, false);
  assert.equal(mesh2.isEnabled, false);
});

test('diagnostic reporting captures all changes', () => {
  const mesh1 = createMockMesh('uuid-podium', 'Podium');
  const scene = createMockScene([mesh1]);

  const nodes = [
    createMockNode('uuid-podium', 'Podium', [1, 1, 1]), // update
    createMockNode('uuid-flag', 'Flag'), // create
  ];

  const result = applySwim26RoundTripSync(scene, nodes);

  assert.equal(result.changes.length, 2);
  assert.ok(result.changes.some(c => c.type === 'updated'));
  assert.ok(result.changes.some(c => c.type === 'created'));
  assert.ok(result.diagnostics.length > 0);
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_SUMMARY'));
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_NODE_UPDATED' && d.authoredId === 'uuid-podium'));
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_NODE_CREATED' && d.authoredId === 'uuid-flag'));
  const summary = result.diagnostics.find(d => d.code === 'SYNC_SUMMARY');
  assert.equal((summary?.details as any)?.added, 1);
  assert.equal((summary?.details as any)?.updated, 1);
});

test('duplicate incoming authoredId entries are skipped and reported', () => {
  const scene = createMockScene([]);
  const duplicateA = createMockNode('uuid-dup', 'A');
  const duplicateB = createMockNode('uuid-dup', 'B', [5, 0, 0]);

  const result = applySwim26RoundTripSync(scene, [duplicateA, duplicateB]);

  assert.equal(result.conflictCount, 1);
  assert.ok(result.changes.some(c => c.type === 'skipped' && c.authoredId === 'uuid-dup'));
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_DUPLICATE_AUTHORED_ID'));

  const synchronized = synchronizeSwim26ImportedScene(scene, [duplicateA, duplicateB]);
  assert.equal(synchronized.nodesToCreate.length, 1, 'duplicate authored IDs should not create duplicate meshes');
});

test('unchanged nodes are skipped instead of counted as updates', () => {
  const mesh = createMockMesh('uuid-static', 'Static', [1, 2, 3]);
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-static', 'Static', [1, 2, 3]);

  const result = applySwim26RoundTripSync(scene, [node]);

  assert.equal(result.updatedMeshCount, 0);
  assert.equal(result.skippedMeshCount, 1);
  assert.ok(result.changes.some(c => c.type === 'skipped'));
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_NODE_SKIPPED' && d.authoredId === 'uuid-static'));
});

test('assetRef changes are updated in-place and diagnosed', () => {
  const mesh = createMockMesh('uuid-asset', 'Asset Node', [0, 0, 0]);
  mesh.metadata.authoredAssetRef = { type: 'url', value: 'old.glb' };
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-asset', 'Asset Node', [0, 0, 0], {
    assetRef: { type: 'url', value: 'new.glb' },
  });

  const result = applySwim26RoundTripSync(scene, [node]);

  assert.equal(result.updatedMeshCount, 1);
  const update = result.changes.find(c => c.type === 'updated' && c.authoredId === 'uuid-asset');
  assert.ok(update?.details.includes('assetRef'));
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_ASSETREF_REQUIRES_RUNTIME_RELOAD' && d.authoredId === 'uuid-asset'));
});

test('material and metadata changes are updated and diagnosed', () => {
  const mesh = createMockMesh('uuid-mat', 'Material Node', [0, 0, 0]);
  mesh.metadata.authoredTags = ['old'];
  mesh.metadata.authoredMetadata = { lane: 1 };
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-mat', 'Material Node', [0, 0, 0], {
    tags: ['new-tag'],
    metadata: { lane: 2 },
    material: { color: '#ff0000', roughness: 0.4, metalness: 0.2 },
  });

  const result = applySwim26RoundTripSync(scene, [node]);
  assert.equal(result.updatedMeshCount, 1);
  const details = result.changes.find(c => c.type === 'updated')?.details ?? '';
  assert.ok(details.includes('color'));
  assert.ok(details.includes('roughness'));
  assert.ok(details.includes('tags/metadata'));
});

test('removed authored nodes produce deactivation diagnostics with authoredId', () => {
  const mesh = createMockMesh('uuid-remove', 'Remove Me');
  const scene = createMockScene([mesh]);

  const result = applySwim26RoundTripSync(scene, []);
  assert.equal(result.deactivatedMeshCount, 1);
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_NODE_DEACTIVATED' && d.authoredId === 'uuid-remove'));
});

test('previously deactivated authored node is reactivated when it reappears', () => {
  const mesh = createMockMesh('uuid-return', 'Return Node');
  mesh.metadata.isDeactivated = true;
  mesh.isEnabled = false;
  mesh.visibility = 0;
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-return', 'Return Node', [3, 0, 0]);

  const result = applySwim26RoundTripSync(scene, [node]);
  assert.equal(result.updatedMeshCount, 1);
  assert.equal(mesh.metadata.isDeactivated, false);
  assert.equal(mesh.isEnabled, true);
  assert.equal(mesh.visibility, 1);
});

test('runtime-owned meshes are not deactivated when authored subset shrinks', () => {
  const authored = createMockMesh('uuid-authored', 'Authored');
  const runtimeOwned = {
    ...createMockMesh('runtime-1', 'Runtime'),
    metadata: { gameplayData: { score: 42 } } as any,
  };
  const scene = createMockScene([authored, runtimeOwned]);

  applySwim26RoundTripSync(scene, []);

  assert.equal(authored.metadata.isDeactivated, true);
  assert.equal(runtimeOwned.metadata.gameplayData.score, 42);
  assert.equal(runtimeOwned.metadata.isDeactivated, undefined);
});

test('parent drift is reported with warnings and skipped detail', () => {
  const mesh = createMockMesh('uuid-child', 'Child');
  mesh.metadata.parentAuthoredId = 'uuid-parent-a';
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-child', 'Child', [0, 0, 0], {
    metadata: { parentAuthoredId: 'uuid-parent-b' },
  });

  const result = applySwim26RoundTripSync(scene, [node]);
  assert.ok(result.changes.some(c => c.type === 'skipped' && c.details.includes('Parent relationship drift')));
});

test('prefab identity drift is fenced off with explicit warning', () => {
  const mesh = createMockMesh('uuid-prefab', 'Prefab Node');
  const scene = createMockScene([mesh]);
  const node = createMockNode('uuid-prefab', 'Prefab Node', [0, 0, 0], {
    metadata: { prefabInstanceId: 'prefab-123' },
  });

  const result = applySwim26RoundTripSync(scene, [node]);
  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_PREFAB_UNSUPPORTED'));
});

test('multiple iterations without duplication (round-trip stress test)', () => {
  // Simulate 5 re-imports of a scene with evolving content
  let scene = createMockScene([createMockMesh('uuid-1', 'Object 1')]);
  let meshCount = 1;

  for (let iteration = 0; iteration < 5; iteration++) {
    const newNodes = [
      createMockNode('uuid-1', 'Object 1', [iteration, 0, 0]), // evolve position
      ...(iteration > 1 ? [createMockNode('uuid-2', 'Object 2')] : []), // add after iteration 1
    ];

    const { result, nodesToCreate } = synchronizeSwim26ImportedScene(scene, newNodes);

    // New meshes are added to scene
    nodesToCreate.forEach(node => {
      scene.meshes!.push(createMockMesh(node.id, node.name));
    });

    // Mesh count should grow only as needed, not duplicate
    const expectedMeshCount = Math.max(1, iteration) + 1;
    if (iteration > 1) {
      // After iteration 1, expect 2 meshes (object 1 + object 2)
      assert.equal(scene.meshes!.length, 2, `Iteration ${iteration}: expected 2 meshes, got ${scene.meshes!.length}`);
    }
  }

  // Final check: should have only 2 meshes, not accumulating duplicates
  assert.equal(scene.meshes!.length, 2);
});

test('reports hierarchy drift when parent authoredId is missing', () => {
  const scene = createMockScene([]);
  const childNode = createMockNode('uuid-child', 'Child');
  childNode.metadata = { parentAuthoredId: 'uuid-missing-parent' };

  const result = applySwim26RoundTripSync(scene, [childNode]);

  assert.ok(result.diagnostics.some(d => d.code === 'SYNC_PARENT_DRIFT'));
});
