# PHASE 1: Round-Trip Audit — Titan ↔ SWIM26

## Executive Summary

The current Titan → SWIM26 handoff has a **critical stability problem**: scene object IDs are generated using timestamps and random values, making them **unstable across repeated iterations**. Re-exporting the same authored scene produces different object IDs, which means round-trip synchronization cannot use IDs for identity matching. This audit identifies the specific risks and requirements for safe round-trip support.

---

## 1. Current Identity Schemes

### 1.1 ModelData ID Generation (Titan Editor)

**Location**: `src/App.tsx:777`, `src/App.tsx:808`, `src/App.tsx:835`

**Current Implementation**:
```typescript
// Primary ID generation:
id: Date.now().toString() + Math.random().toString(36).substring(7)

// Alternate ID generation for batch operations:
const newIds = placements.map((_, index) =>
  `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`
);
```

**Problem**: These IDs are **generated fresh** each time a model is added to the scene, and there is **no persistence mechanism** that guarantees the same model keeps the same ID across save/load cycles or across multiple exports.

**Risk Level**: 🔴 **CRITICAL** — IDs are not stable for round-trip use.

### 1.2 Manifest Export IDs (Swim26ManifestService)

**Location**: `src/services/Swim26ManifestService.ts:61-62`

**Current Implementation**:
```typescript
objects: input.models.map(model => ({
  id: model.id,  // Direct pass-through of editor ID
  ...
}))
```

**Observation**: The manifest dutifully exports whatever `model.id` the editor provides. If the editor ID is unstable, the exported manifest IDs are also unstable.

**Risk Level**: 🔴 **CRITICAL** — Inherits the editor's ID instability.

### 1.3 Runtime Import & Mesh Reconstruction (Swim26RuntimeSceneAssembler)

**Location**: `src/services/swim26Runtime/Swim26RuntimeSceneAssembler.ts:64-90`

**Current Implementation**:
```typescript
for (const node of importResult.scene.nodes) {
  const meshes = asset.meshes.length > 0
    ? asset.meshes
    : [createPlaceholderMesh(node.id, node.name)];
  for (const mesh of meshes) {
    applyNodeTransform(mesh, node);
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      importedNodeId: node.id,  // Capture the imported node ID
      importedTags: node.tags,
    };
    scene.meshes.push(mesh);
  }
}
```

**Observation**:
- The runtime **does** preserve `importedNodeId` in mesh metadata, which is good for diagnostics.
- However, there is **no matching logic** to detect if a mesh with the same `importedNodeId` already exists.
- Repeated imports will always create **new meshes** for the same authored nodes, leading to **duplicate runtime objects**.

**Risk Level**: 🔴 **CRITICAL** — No duplicate detection on re-import.

### 1.4 Other ID Schemes

#### Asset IDs
- **Source**: `model.assetId` (optional) or `model.url` as fallback
- **Export**: `assetRef: { type: 'asset-id' | 'url', value: string }`
- **Stability**: Asset IDs (if used) are more stable than model IDs, but asset resolution is complex and URL-based refs can break.

#### Prefab Instance IDs
- **Fields**: `prefabId`, `prefabInstanceId`, `isPrefabRoot`
- **Status**: Present in ModelData but **not currently exported** in the manifest.
- **Stability**: Unknown; needs investigation if prefab support is planned for round-trip.

#### Path IDs
- **Source**: `path.id` from `Path[]` type
- **Export**: Direct pass-through to manifest `paths[].id`
- **Stability**: Likely **unstable** if paths are also generated with timestamps/random values.
- **Duplication Risk**: Paths are imported but not matched by ID on re-import.

#### Collision Zone IDs
- **Status**: Not exported in manifest (collision zones are runtime-owned, not authored).
- **Duplication Risk**: Not a direct concern if runtime-owned.

#### Environment Preset IDs
- **Source**: `environment.id` (e.g., 'pool-competition')
- **Export**: Manifest `authoredContent.environment.presetId`
- **Stability**: **Good** — These are fixed preset identifiers, not generated.

---

## 2. What Identifiers Currently Serve Round-Trip?

### ✅ Stable Identifiers
- **Environment Preset ID**: `pool-competition`, `pool-finals-night`, etc. — preset names, not generated
- **Asset IDs** (if explicitly set): Editor-curated asset registry IDs

### ⚠️ Partially Stable Identifiers
- **Material Preset IDs**: Exported as `material.presetId`, but unclear if they're preserved through re-import
- **Metadata**: Exported but not matched on re-import

### ❌ **Unstable Identifiers**
- **Model IDs**: Generated with timestamp + random, no persistence
- **Path IDs**: Likely generated, no persistence
- **Asset URLs**: Can change or break between iterations
- **Prefab instance IDs**: Not exported at all

---

## 3. Round-Trip Handoff Failure Points

### 3.1 Initial Export
```
Titan Editor → Manifest Export
├─ Models export with generated IDs (e.g., "1234567890abc123")
├─ Paths export with generated IDs
├─ Environment exports with stable preset ID
└─ Manifest is valid but contains non-persistent object IDs
```

### 3.2 First Import
```
Manifest Import → SWIM26 Runtime Assembly
├─ Nodes are reconstructed from manifest
├─ importedNodeId is stored in mesh.metadata
├─ Scene is assembled successfully (no duplication yet)
└─ Runtime now has authored content indexed by stable ID
```

### 3.3 User Modifies Scene in Titan
```
Titan Editor (after load/re-edit)
├─ If scene is reloaded from localStorage, model IDs are preserved
├─ If models are re-created (e.g., batch placement), new IDs are generated
├─ User makes a change and re-exports
└─ NEW manifest has DIFFERENT object IDs than before
```

### 3.4 Second Import (Re-import)
```
Modified Manifest Import → SWIM26 Runtime
├─ New nodes from manifest are imported
├─ OLD nodes from first import still exist in scene
├─ importedNodeId mismatch: new mesh.metadata.importedNodeId != existing mesh.importedNodeId
├─ NO MERGE LOGIC: both sets of meshes coexist
└─ RESULT: Duplicates accumulate, stale objects remain
```

**Concrete Example**:

**First Export**:
```json
{
  "objects": [
    { "id": "1234567890abc", "name": "Podium", ... }
  ]
}
```

**First Import** → Runtime has:
- Mesh with `metadata.importedNodeId = "1234567890abc"`

**User edits scene and re-exports** (IDs regenerated):
```json
{
  "objects": [
    { "id": "9876543210xyz", "name": "Podium", ... }
  ]
}
```

**Second Import** → Runtime now has:
- Mesh with `metadata.importedNodeId = "1234567890abc"` (old)
- Mesh with `metadata.importedNodeId = "9876543210xyz"` (new, same model)
- **Duplication!**

---

## 4. Where Duplicate Reconstruction Can Occur

1. **Re-exported scenes with regenerated IDs** — Different IDs mean no match-by-ID, so new meshes are created alongside old ones.
2. **Batch model placement in Titan** — If the workflow involves re-selecting and re-placing models, IDs change.
3. **Missing merge/update logic in runtime** — The `Swim26RuntimeSceneAssembler` has no facility to detect or merge existing nodes by stable ID.
4. **No incremental apply mechanism** — The import process is all-or-nothing: import the nodes, create meshes. No distinction between "new node" and "existing node with same ID."

---

## 5. Where Asset/Node Identity Could Drift

### 5.1 Drift in Titan Editor Persistence
- **Scenario**: User loads scene from storage, the ModelData is restored, but subsequent placements generate new IDs.
- **Problem**: Some models have original (persisted) IDs, others have new (generated) IDs.
- **Drift**: When re-exported, the manifest contains a mix of old and new object IDs.

### 5.2 Drift in SWIM26 Runtime After Re-import
- **Scenario**: First import created nodes `A`, `B`, `C`. User edits in Titan, IDs become `A'`, `B'`, `C'`. Second import adds meshes for `A'`, `B'`, `C'` without removing old meshes.
- **Problem**: Runtime now has both versions; parent-child links, collision references, or gameplay systems referencing old node IDs become stale.
- **Drift**: The runtime scene is internally inconsistent.

### 5.3 Drift in Parent-Child Relationships
- **Status**: ModelData has `parentId` and `childrenIds` fields.
- **Export**: These are **not currently exported** in the manifest.
- **Risk**: On re-import, parent-child relationships are lost. If re-exported and imported again, hierarchy is flat, causing structural drift.

---

## 6. What Currently Prevents Clean Incremental Updates

1. **No ID matching in importer** — The `Swim26ManifestImporter` does no diffing; it just parses the manifest.
2. **No update logic in assembler** — `Swim26RuntimeSceneAssembler` always creates new meshes; it never modifies or removes existing ones.
3. **No "authored subset" tracking** — There is no way to distinguish which runtime nodes came from the imported manifest (and can be updated) vs. which are runtime-owned (and must not be touched).
4. **No synchronization policy** — There is no defined behavior for:
   - What to do when a node ID exists in the old import but not the new import (removal? deprecation?).
   - How to handle changed transform/material data (replace or merge?).
   - When to skip updates (e.g., if a node has been modified by gameplay systems).

---

## 7. Safe First Round-Trip Workflow Requirements

For the Titan ↔ SWIM26 workflow to support repeated iteration without duplication or drift:

### 7.1 **Stable Object Identity**
- **Requirement**: A given authored node must have a **deterministic, persistent ID** that survives:
  - Multiple exports from Titan
  - Multiple imports to SWIM26
  - Reloads and re-edits in Titan
- **Current State**: ❌ **NOT MET** — IDs are generated with timestamps and random values.
- **Solution**: Use a stable ID scheme (e.g., content-addressed hash, persistent UUID from model, or deterministic stable name-based ID).

### 7.2 **Imported Node Tracking**
- **Requirement**: SWIM26 runtime must track which nodes were imported from the manifest, so that:
  - Repeated imports can identify and update existing nodes
  - Stale nodes (removed from manifest) can be detected
  - Runtime-owned systems are not accidentally overwritten
- **Current State**: ⚠️ **PARTIAL** — Metadata stores `importedNodeId`, but no tracking structure or update logic.
- **Solution**: Introduce a "authored subset" index or scene partition that maps manifest node IDs to runtime mesh instances.

### 7.3 **Incremental Update Policy**
- **Requirement**: Define clear behavior for node updates:
  - **New nodes**: Create meshes.
  - **Existing nodes by ID**: Update transform, material, asset refs (if applicable).
  - **Removed nodes**: Flag for removal or deactivation (policy TBD).
  - **Unchanged nodes**: Skip unnecessary updates.
- **Current State**: ❌ **NOT DEFINED** — No policy document.
- **Solution**: Write explicit update logic and test it.

### 7.4 **Parent-Child Relationship Stability**
- **Requirement**: Nested/parented nodes must survive round-trip intact.
- **Current State**: ❌ **NOT EXPORTED** — ModelData has `parentId`/`childrenIds`, but manifest doesn't include them.
- **Solution**: Extend manifest to optionally include parent-child links if they're authored (not runtime-owned).

### 7.5 **Duplicate Prevention**
- **Requirement**: Same authored node, when re-imported, must not create a second copy.
- **Current State**: ❌ **FAILS** — No ID matching, always creates new meshes.
- **Solution**: Match by stable ID on import; update in-place rather than create-and-abandon.

### 7.6 **Unsupported Round-Trip Transparency**
- **Requirement**: Clearly document what can and cannot be edited in SWIM26 and survive round-trip back to Titan.
- **Current State**: ⚠️ **VAGUE** — The manifest has `runtimeOwned` and `unsupported` fields, but their semantics are unclear.
- **Solution**: Clarify that authored content (models, paths, environment) can round-trip; runtime gameplay modifications cannot.

---

## 8. Identity Audit Checklist

### For Model Objects
- [ ] **ID Source**: Determine if models should use a **stable deterministic ID** (e.g., based on name or content) or a **persistent UUID** (stored with the model in Titan and preserved across saves).
- [ ] **ID Uniqueness**: Ensure IDs are unique within a scene.
- [ ] **ID Persistence**: Ensure IDs survive Titan save/load cycles.
- [ ] **ID Export**: Ensure the manifest exports the stable ID.
- [ ] **ID Import**: Ensure the runtime can match imported nodes by stable ID and detect updates/removals.

### For Paths
- [ ] **ID Generation**: Paths likely use the same unstable ID scheme as models.
- [ ] **Duplicate Risk**: Paths are imported but never updated or matched on re-import.
- [ ] **Stability Fix**: Apply the same stable ID strategy as models.

### For Environment
- [ ] **ID Scheme**: Environment uses preset IDs (`pool-competition`), which are stable.
- [ ] **Round-Trip**: Environment re-imports cleanly; no duplication risk.
- [ ] **Status**: ✅ **STABLE** — No changes needed here.

### For Prefab Instances
- [ ] **Export Status**: Prefab fields are in ModelData but not exported to manifest.
- [ ] **Scope**: Determine if prefab round-trip is in scope for this phase.
- [ ] **Decision**: If in scope, extend manifest to include prefab metadata; if out of scope, document as unsupported.

---

## 9. Current Test Coverage for Round-Trip

**Location**: `src/tests/swim26-manifest-importer.test.ts`

**Current Tests**:
- ✅ `imports a valid live handoff manifest sample` — Single import, no re-import.
- ✅ `rejects malformed manifests with blocking validation errors` — Validation only.
- ✅ `emits warnings for recoverable missing fields` — Single-pass behavior.
- ✅ `treats invalid json as blocking parse failure` — Error handling.
- ✅ `drops editor-only and malformed runtime fields` — Data cleanup.
- ✅ `blocks manifest with invalid runtime contract identity` — Contract validation.

**Missing Tests**:
- ❌ **Re-import of same manifest** — No test for idempotence.
- ❌ **Second import with updated node data** — No test for update behavior.
- ❌ **Duplicate detection** — No test for whether duplicates are created on re-import.
- ❌ **Removal of stale nodes** — No test for handling nodes that existed in old import but not new import.
- ❌ **Transform/material updates** — No test for applying changes to existing nodes.

---

## 10. Recommendations for Phase 2

### 10.1 Implement Stable Identity Contract
**Action**: Define a stable ID scheme and update:
1. **ModelData creation** in Titan to use a stable, deterministic ID (e.g., UUIDv5 based on name/position, or a persistent UUID field).
2. **ID persistence** in storage utilities to ensure IDs are preserved across save/load.
3. **Manifest export** to include a "stableId" or "authoredId" field separate from transient runtime IDs.

### 10.2 Extend Manifest with Relationship Data
**Action**: Add optional fields to `Swim26SceneManifest`:
- `parentId` for parent-child relationships.
- Possibly `prefabId` / `prefabInstanceId` if prefabs are to be round-trip-capable.

### 10.3 Implement Incremental Scene Update Policy
**Action**: Define and document:
- How the runtime scene responds to a second import of the same manifest.
- When nodes are created vs. updated vs. removed.
- How parent-child relationships are reconstructed.

### 10.4 Add Round-Trip Synchronization Layer
**Action**: Implement a new service or enhance `Swim26RuntimeSceneAssembler` to:
- Accept an optional "existing authored subset" mapping.
- Match nodes by stable ID.
- Diff and apply changes incrementally.
- Report what was added, updated, removed.

### 10.5 Add Fixture-Based Round-Trip Tests
**Action**: Create fixtures and tests that verify:
- Initial import succeeds.
- Second import of the same manifest produces no duplicates.
- Updates to node transforms/materials are applied.
- Stale nodes are handled according to policy.
- No duplicates accumulate over 3+ iterations.

---

## Summary: The Core Problem

**The current Titan ↔ SWIM26 handoff is a one-way, single-use pipeline:**
- Export generates a manifest with unstable object IDs.
- First import creates runtime nodes successfully.
- Re-importing the same or updated scene **duplicates nodes** instead of updating them, because there is no identity matching or merge logic.

**To achieve safe round-trip iteration:**
1. **Stable IDs** must be introduced and persisted through the cycle.
2. **Import logic** must match existing nodes by stable ID and update in-place.
3. **Update policy** must be defined and tested.
4. **Diagnostics** must surface what changed on each synchronization.

---

## Audit Sign-Off

**Date**: 2026-03-29
**Finding**: Titan ↔ SWIM26 round-trip is **blocked by unstable object identity** and **missing incremental update logic**. Single-iteration export/import works; repeated iteration causes duplicates.

**Severity**: 🔴 **CRITICAL** — Must be fixed before round-trip support is safe for production use.
