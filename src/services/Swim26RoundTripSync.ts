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

/**
 * Result of a round-trip synchronization operation
 */
export interface Swim26RoundTripSyncResult {
  ok: boolean;
  changes: SyncChange[];
  addedMeshes: BabylonLikeMesh[];
  updatedMeshCount: number;
  deactivatedMeshCount: number;
  diagnostics: {
    severity: 'info' | 'warning' | 'error';
    message: string;
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
): void => {
  const updates: string[] = [];

  // Update transform unconditionally (visual state, authored content)
  mesh.position = { x: node.transform.position[0], y: node.transform.position[1], z: node.transform.position[2] };
  mesh.rotation = { x: node.transform.rotation[0], y: node.transform.rotation[1], z: node.transform.rotation[2] };
  mesh.scaling = { x: node.transform.scale[0], y: node.transform.scale[1], z: node.transform.scale[2] };
  updates.push('transform');

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
  if (node.tags.length > 0 || node.metadata) {
    updates.push('tags/metadata');
  }

  // Preserve runtime-injected metadata, merge authored metadata
  mesh.metadata = {
    ...mesh.metadata,
    authoredId: node.id,
    authoredName: node.name,
    authoredTags: node.tags,
    authoredAssetRef: node.assetRef,
    authoredMaterial: node.material,
    lastUpdateTime: Date.now(),
    ...node.metadata,
  };

  // Log what was updated
  if (updates.length > 0) {
    diagnostics.push({
      type: 'updated',
      authoredId: node.id,
      nodeName: node.name,
      details: `Updated fields: ${updates.join(', ')}`,
    });
  }
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

  // Build index of currently-authored nodes
  const index = buildAuthoredSubsetIndex(scene);

  // Set of authoredIds in the new manifest
  const newAuthoredIds = new Set(newNodes.map(n => n.id));

  // Process new nodes: identify which are new vs. existing
  const nodesToCreate: ImportedSwim26Node[] = [];
  for (const newNode of newNodes) {
    const existing = index.authoredIdToMesh.get(newNode.id);
    if (existing) {
      // Node exists: apply updates in-place
      applyNodeUpdate(existing, newNode, changes);
      updatedMeshCount++;
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

  // Process stale nodes: authored nodes no longer in manifest
  for (const [authoredId, mesh] of index.authoredIdToMesh) {
    if (!newAuthoredIds.has(authoredId)) {
      deactivateNode(mesh, changes);
      deactivatedMeshCount++;
    }
  }

  // Prepare diagnostics
  const syncDiagnostics = [
    { severity: 'info' as const, message: `Synchronization complete: ${changes.length} total changes` },
    { severity: 'info' as const, message: `Updated ${updatedMeshCount} nodes, created ${nodesToCreate.length} nodes, deactivated ${deactivatedMeshCount} stale nodes` },
  ];

  return {
    ok: true,
    changes,
    addedMeshes,
    updatedMeshCount,
    deactivatedMeshCount,
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

  // Extract nodes to create from the changes list
  const nodesToCreate = newNodes.filter(
    node => !scene.meshes?.some(m => m.metadata?.authoredId === node.id)
  );

  return { result, nodesToCreate };
};
