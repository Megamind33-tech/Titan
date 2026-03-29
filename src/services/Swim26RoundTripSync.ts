/**
 * Swim26RoundTripSync.ts
 *
 * Incremental synchronization layer for round-trip scene updates.
 *
 * This module implements the PHASE 3 incremental update policy:
 * - Matches nodes by stable authoredId
 * - Updates existing nodes in-place (transform, material, asset ref)
 * - Creates new nodes for authored content not yet in the scene
 * - Deactivates stale nodes (authored content removed from manifest)
 * - Preserves runtime-owned content untouched
 * - Provides clear diagnostics of changes
 */

import { ImportedSwim26Node } from './Swim26ManifestImporter';
import { BabylonLikeMesh, BabylonLikeScene } from './swim26Runtime/types';

/**
 * Represents a change in the scene during synchronization
 */
export interface SyncChange {
  type: 'created' | 'updated' | 'deactivated' | 'skipped';
  authoredId: string;
  nodeName: string;
  details: string;
}

export const SWIM26_INCREMENTAL_UPDATE_POLICY = {
  identityKey: 'authoredId',
  add: 'Create mesh when authoredId not found in authored subset index.',
  update: 'Update transform/material/asset/tags/metadata for matching authoredId.',
  remove: 'Deactivate stale authored meshes (do not delete) to protect runtime recovery paths.',
  duplicateIncoming: 'Skip later duplicate incoming authoredId entries and emit warnings.',
  runtimeOwnedBoundary: 'Never mutate meshes without metadata.authoredId.',
} as const;

/**
 * Result of a round-trip synchronization operation
 */
export interface Swim26RoundTripSyncResult {
  ok: boolean;
  changes: SyncChange[];
  addedMeshes: BabylonLikeMesh[];
  updatedMeshCount: number;
  deactivatedMeshCount: number;
  skippedMeshCount: number;
  conflictCount: number;
  diagnostics: {
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    authoredId?: string;
  }[];
}

/**
 * Index of authored nodes in the runtime scene.
 * Maps authoredId → runtime mesh instance.
 */
export interface AuthoredSubsetIndex {
  authoredIdToMesh: Map<string, BabylonLikeMesh>;
  meshes: BabylonLikeMesh[];
}

/**
 * Build an index of authored nodes from the current scene.
 * Nodes are identified by `metadata.authoredId`.
 *
 * @param scene - Babylon.js scene
 * @returns Index mapping authoredIds to meshes
 */
export const buildAuthoredSubsetIndex = (scene: BabylonLikeScene): AuthoredSubsetIndex => {
  const authoredIdToMesh = new Map<string, BabylonLikeMesh>();
  const meshes = scene.meshes || [];

  for (const mesh of meshes) {
    const authoredId = mesh.metadata?.authoredId;
    if (typeof authoredId === 'string') {
      if (authoredIdToMesh.has(authoredId)) {
        continue;
      }
      authoredIdToMesh.set(authoredId, mesh);
    }
  }

  return { authoredIdToMesh, meshes };
};

/**
 * Apply a single node update to an existing mesh.
 * Updates transform, material hints, and asset references.
 *
 * @param mesh - Existing runtime mesh
 * @param node - Updated node data from manifest
 * @param diagnostics - Accumulator for diagnostic messages
 */
const applyNodeUpdate = (
  mesh: BabylonLikeMesh,
  node: ImportedSwim26Node,
  diagnostics: SyncChange[]
): boolean => {
  const updates: string[] = [];
  const existingTransform = mesh.position && mesh.rotation && mesh.scaling
    ? {
        position: [mesh.position.x, mesh.position.y, mesh.position.z],
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z],
      }
    : null;
  const transformChanged = !existingTransform ||
    existingTransform.position.some((v, i) => v !== node.transform.position[i]) ||
    existingTransform.rotation.some((v, i) => v !== node.transform.rotation[i]) ||
    existingTransform.scale.some((v, i) => v !== node.transform.scale[i]);

  // Update transform unconditionally (visual state, authored content)
  mesh.position = { x: node.transform.position[0], y: node.transform.position[1], z: node.transform.position[2] };
  mesh.rotation = { x: node.transform.rotation[0], y: node.transform.rotation[1], z: node.transform.rotation[2] };
  mesh.scaling = { x: node.transform.scale[0], y: node.transform.scale[1], z: node.transform.scale[2] };
  if (transformChanged) updates.push('transform');

  // Update material hints if provided
  if (node.material) {
    if (node.material.color) {
      updates.push('color');
    }
    if (node.material.roughness !== undefined) {
      updates.push('roughness');
    }
    if (node.material.metalness !== undefined) {
      updates.push('metalness');
    }
    if (node.material.opacity !== undefined) {
      updates.push('opacity');
    }
    // Note: Full material application is delegated to runtime materialPolicy
  }

  // Update asset reference if changed (with caution)
  if (node.assetRef) {
    const oldAssetRef = mesh.metadata?.authoredAssetRef;
    if (!oldAssetRef || oldAssetRef.value !== node.assetRef.value) {
      updates.push('assetRef');
      // Note: Asset re-resolution happens in runtime assembler
    }
  }

  // Update tags and authored metadata
  if (node.tags.length > 0 || Object.keys(node.metadata).length > 0) {
    const oldTags = mesh.metadata?.authoredTags;
    const oldMetadata = mesh.metadata?.authoredMetadata;
    const tagsChanged = JSON.stringify(oldTags ?? []) !== JSON.stringify(node.tags ?? []);
    const metadataChanged = JSON.stringify(oldMetadata ?? {}) !== JSON.stringify(node.metadata ?? {});
    if (tagsChanged || metadataChanged) updates.push('tags/metadata');
  }

  // Preserve runtime-injected metadata, only store authored data in explicit field
  // CRITICAL: Do NOT spread node.metadata at end, as it can overwrite runtime state
  mesh.metadata = {
    ...mesh.metadata,
    authoredId: node.id,
    authoredName: node.name,
    authoredTags: node.tags,
    authoredAssetRef: node.assetRef,
    authoredMaterial: node.material,
    authoredMetadata: node.metadata,  // Store separately, don't merge
    lastUpdateTime: Date.now(),
  };

  // Log what was updated
  if (updates.length > 0) {
    diagnostics.push({
      type: 'updated',
      authoredId: node.id,
      nodeName: node.name,
      details: `Updated fields: ${updates.join(', ')}`,
    });
    return true;
  }
  return false;
};

/**
 * Deactivate a mesh (mark as no longer authored).
 * The mesh is set invisible but preserved for recovery or diagnostics.
 *
 * @param mesh - Mesh to deactivate
 * @param diagnostics - Accumulator for diagnostic messages
 */
const deactivateNode = (
  mesh: BabylonLikeMesh,
  diagnostics: SyncChange[]
): void => {
  const authoredId = mesh.metadata?.authoredId ?? 'unknown';
  const authoredName = mesh.metadata?.authoredName ?? mesh.name ?? 'unnamed';

  if (mesh.metadata?.isDeactivated === true) return;
  mesh.isEnabled = false;
  mesh.visibility = 0;
  mesh.metadata = {
    ...mesh.metadata,
    isDeactivated: true,
    deactivatedAt: Date.now(),
  };

  diagnostics.push({
    type: 'deactivated',
    authoredId,
    nodeName: authoredName,
    details: `Stale authored node (removed from manifest); preserved but inactive`,
  });
};

/**
 * Apply incremental synchronization to a runtime scene.
 *
 * Behavior (per PHASE 3 update policy):
 * - New nodes: Created by caller (returns list to be added)
 * - Existing nodes: Updated in-place
 * - Stale nodes: Deactivated (not deleted)
 * - Unchanged nodes: Skipped (no-op)
 *
 * @param scene - Runtime Babylon.js scene
 * @param newNodes - Nodes from newly-imported manifest
 * @returns Sync result with changes and new meshes to add
 */
export const applySwim26RoundTripSync = (
  scene: BabylonLikeScene,
  newNodes: ImportedSwim26Node[]
): Swim26RoundTripSyncResult => {
  const changes: SyncChange[] = [];
  const diagnostics: SyncChange[] = [];
  const addedMeshes: BabylonLikeMesh[] = [];
  let updatedMeshCount = 0;
  let deactivatedMeshCount = 0;
  let skippedMeshCount = 0;
  let conflictCount = 0;
  let hierarchyDriftCount = 0;

  // Build index of currently-authored nodes
  const index = buildAuthoredSubsetIndex(scene);

  // Set of authoredIds in the new manifest
  const newAuthoredIds = new Set(newNodes.map(n => n.id));

  // Process new nodes: identify which are new vs. existing
  const incomingSeen = new Set<string>();
  const nodesToCreate: ImportedSwim26Node[] = [];
  for (const newNode of newNodes) {
    if (incomingSeen.has(newNode.id)) {
      conflictCount++;
      skippedMeshCount++;
      changes.push({
        type: 'skipped',
        authoredId: newNode.id,
        nodeName: newNode.name,
        details: 'Duplicate authoredId in incoming manifest entry (skipped).',
      });
      continue;
    }
    incomingSeen.add(newNode.id);

    const existing = index.authoredIdToMesh.get(newNode.id);
    if (existing) {
      // Node exists: apply updates in-place
      const didUpdate = applyNodeUpdate(existing, newNode, changes);
      if (didUpdate) {
        updatedMeshCount++;
      } else {
        skippedMeshCount++;
        changes.push({
          type: 'skipped',
          authoredId: newNode.id,
          nodeName: newNode.name,
          details: 'No authored changes detected.',
        });
      }
    } else {
      // Node is new: will be created by caller
      nodesToCreate.push(newNode);
      changes.push({
        type: 'created',
        authoredId: newNode.id,
        nodeName: newNode.name,
        details: `New authored node`,
      });
    }
  }

  // Detect hierarchy drift (parent reference missing) in incoming authored subset.
  for (const node of newNodes) {
    const metadata = node.metadata as Record<string, unknown> | undefined;
    const parentAuthoredId = typeof metadata?.parentAuthoredId === 'string' ? metadata.parentAuthoredId : null;
    if (parentAuthoredId && !incomingSeen.has(parentAuthoredId) && !index.authoredIdToMesh.has(parentAuthoredId)) {
      hierarchyDriftCount++;
    }
  }

  // Process stale nodes: authored nodes no longer in manifest
  for (const [authoredId, mesh] of index.authoredIdToMesh) {
    if (!newAuthoredIds.has(authoredId)) {
      deactivateNode(mesh, changes);
      deactivatedMeshCount++;
    }
  }

  // Prepare diagnostics
  const syncDiagnostics = [
    { severity: 'info' as const, code: 'SYNC_SUMMARY', message: `Synchronization complete: ${changes.length} total changes` },
    { severity: 'info' as const, code: 'SYNC_POLICY', message: `Policy identity key: ${SWIM26_INCREMENTAL_UPDATE_POLICY.identityKey}` },
    { severity: 'info' as const, code: 'SYNC_COUNTS', message: `Updated ${updatedMeshCount}, created ${nodesToCreate.length}, deactivated ${deactivatedMeshCount}, skipped ${skippedMeshCount}` },
    ...(conflictCount > 0
      ? [{ severity: 'warning' as const, code: 'SYNC_DUPLICATE_AUTHORED_ID', message: `${conflictCount} duplicate authoredId entries were skipped.` }]
      : []),
    ...(hierarchyDriftCount > 0
      ? [{ severity: 'warning' as const, code: 'SYNC_PARENT_DRIFT', message: `${hierarchyDriftCount} nodes reference missing parent authoredId.` }]
      : []),
  ];

  return {
    ok: true,
    changes,
    addedMeshes,
    updatedMeshCount,
    deactivatedMeshCount,
    skippedMeshCount,
    conflictCount,
    diagnostics: syncDiagnostics,
  };
};

/**
 * Apply a second import of the same or updated manifest to an existing scene.
 * This is the high-level round-trip function that:
 * 1. Indexes the current authored subset
 * 2. Applies updates to existing nodes
 * 3. Flags stale nodes
 * 4. Returns new nodes to be created
 *
 * Caller is responsible for:
 * - Creating new meshes for returned nodes
 * - Applying material and asset resolution
 * - Adding new meshes to the scene
 *
 * @param scene - Current runtime scene
 * @param newNodes - Nodes from newly-imported manifest
 * @returns Sync result with changes and list of nodes to create
 */
export const synchronizeSwim26ImportedScene = (
  scene: BabylonLikeScene,
  newNodes: ImportedSwim26Node[]
): {
  result: Swim26RoundTripSyncResult;
  nodesToCreate: ImportedSwim26Node[];
} => {
  const result = applySwim26RoundTripSync(scene, newNodes);

  const nodesToCreate: ImportedSwim26Node[] = [];
  const seenCreated = new Set<string>();
  for (const change of result.changes) {
    if (change.type !== 'created') continue;
    if (seenCreated.has(change.authoredId)) continue;
    const node = newNodes.find(candidate => candidate.id === change.authoredId);
    if (!node) continue;
    nodesToCreate.push(node);
    seenCreated.add(change.authoredId);
  }

  return { result, nodesToCreate };
};
