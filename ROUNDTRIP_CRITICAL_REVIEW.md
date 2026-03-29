# Round-Trip Synchronization: Critical Review

**Date**: 2026-03-29
**Status**: 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Executive Summary

The implementation has **12 critical issues** that undermine round-trip reliability:

1. **The assembler doesn't use the sync layer** — It creates brand-new scenes every time
2. **Metadata naming is inconsistent** — `importedNodeId` vs `authoredId` mismatch
3. **Placeholder meshes don't get authoredId** — Failed asset loads create orphaned nodes
4. **Metadata merge is unsafe** — Runtime state can be overwritten by node metadata
5. **No deduplication validation** — Can't detect duplicate authoredIds in manifest
6. **Parent-child silently dropped** — No warning, unclear round-trip limitation
7. **Prefab identity undefined** — How do prefab instances maintain identity?
8. **Stale nodes accumulate forever** — No cleanup policy implemented
9. **Tests don't validate with real assembler** — Only mock-based testing, no integration
10. **No round-trip end-to-end test** — Never imports twice in tests
11. **Runtime-owned detection fragile** — Based on presence of `authoredId` in metadata
12. **Backward compat warning vague** — v1.0.0 synthetic IDs may cause silent mismatches

---

## Issue 1: Assembler Doesn't Use Sync Layer ⚠️ **CRITICAL**

### Problem

```typescript
// Swim26RuntimeSceneAssembler.ts, line 27-100
export const assembleSwim26RuntimeScene = async (input: { ... }): Promise<...> {
  const importResult = importSwim26Manifest(input.manifest as any);
  const scene: BabylonLikeScene = { meshes: [] };
  // ... creates NEW scene from scratch
  for (const node of importResult.scene.nodes) {
    const meshes = asset.meshes.length > 0 ? asset.meshes : [createPlaceholderMesh(...)];
    for (const mesh of meshes) {
      // ... applies transform, material
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        importedNodeId: node.id,  // Should be authoredId!
        importedTags: node.tags,
      };
      scene.meshes.push(mesh);  // ALWAYS creates new mesh
    }
  }
  return { ok: !hasBlocking, status: ..., scene, diagnostics };
};
```

**Consequence**:
- On first import: Scene is created, 10 meshes added
- On second import (re-import same manifest): `assembleSwim26RuntimeScene()` is called again
- Result: Another 10 new meshes created, old 10 still exist = **20 meshes total (DUPLICATION)**
- The `Swim26RoundTripSync` layer is never called, so all the incremental logic is bypassed

### Why This Breaks Round-Trip

The sync layer's job is to:
1. Index existing nodes by `authoredId`
2. Update in-place
3. Deactivate stale

But the assembler **never calls** `synchronizeSwim26ImportedScene()`. It always creates fresh.

### Impact

**COMPLETE FAILURE OF ROUND-TRIP**: Every re-import duplicates all nodes.

---

## Issue 2: Metadata Naming Inconsistency ⚠️ **CRITICAL**

### Problem

```typescript
// Swim26RuntimeSceneAssembler.ts, line 86
mesh.metadata = {
  ...(mesh.metadata ?? {}),
  importedNodeId: node.id,    // ❌ Wrong name
  importedTags: node.tags,
};

// Swim26RoundTripSync.ts, line 128
mesh.metadata = {
  ...mesh.metadata,
  authoredId: node.id,         // ✅ Correct name
  authoredName: node.name,
  authoredTags: node.tags,
  authoredAssetRef: node.assetRef,
  authoredMaterial: node.material,
  lastUpdateTime: Date.now(),
  ...node.metadata,
};
```

**Consequence**:
- Assembler stores `metadata.importedNodeId`
- Sync layer looks for `metadata.authoredId`
- When sync layer tries to index: `const authoredId = mesh.metadata?.authoredId` → **undefined**
- Index is empty, all nodes treated as "new"
- Even if assembler is called, nothing matches

### Impact

**Index fails to find existing nodes** because of name mismatch.

---

## Issue 3: Placeholder Meshes Missing authoredId ⚠️ **HIGH**

### Problem

```typescript
// Swim26RuntimeSceneAssembler.ts, line 78-89
const meshes = asset.meshes.length > 0
  ? asset.meshes
  : [createPlaceholderMesh(node.id, node.name)];  // ❌ No authoredId set
for (const mesh of meshes) {
  applyNodeTransform(mesh, node);
  // ...
  mesh.metadata = {
    ...(mesh.metadata ?? {}),
    importedNodeId: node.id,  // Not authoredId
    importedTags: node.tags,
  };
  scene.meshes.push(mesh);
}

// createPlaceholderMesh doesn't set any metadata
const createPlaceholderMesh = (nodeId: string, name: string): BabylonLikeMesh => ({
  id: `placeholder-${nodeId}`,
  name: `${name || nodeId}-placeholder`,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scaling: { x: 1, y: 1, z: 1 },
  // ❌ No metadata
});
```

**Consequence**:
- Asset load fails → placeholder created
- Placeholder gets `importedNodeId` (not `authoredId`)
- On re-import, sync layer can't match it (looking for `authoredId`)
- Node is treated as "new" → another placeholder created
- **Duplicates accumulate**

### Impact

**Failed asset loads become unmatchable on re-import**.

---

## Issue 4: Unsafe Metadata Merge ⚠️ **HIGH**

### Problem

```typescript
// Swim26RoundTripSync.ts, line 126-135
mesh.metadata = {
  ...mesh.metadata,             // Existing metadata (runtime state)
  authoredId: node.id,
  authoredName: node.name,
  authoredTags: node.tags,
  authoredAssetRef: node.assetRef,
  authoredMaterial: node.material,
  lastUpdateTime: Date.now(),
  ...node.metadata,             // ❌ Overwrites with node metadata!
};
```

**Consequence**:
- Mesh has runtime state: `metadata.gameplayData = { score: 100 }`
- Also has: `metadata.isDeactivated = true` (from prior stale deactivation)
- Node manifest contains: `metadata: { isDeactivated: false }` (author thinks it's reactivating)
- After merge: `isDeactivated: false` → overwrites runtime flag
- **Deactivated node gets un-deactivated unintentionally**

### Impact

**Runtime state can be corrupted by authored metadata**.

---

## Issue 5: No Duplicate authoredId Validation ⚠️ **MEDIUM**

### Problem

```typescript
// Swim26ManifestImporter.ts, line 134-148
const scene: ImportedSwim26Scene = {
  nodes: manifest.authoredContent.objects.map(obj => {
    const nodeId = isV110 && (obj as any).authoredId
      ? (obj as any).authoredId
      : generateDeterministicId({ ... });
    // ❌ No check for duplicate nodeId in result array
    return {
      id: nodeId,
      name: obj.name || nodeId,
      // ...
    };
  }),
};
```

**Consequence**:
- Manifest has two objects with same `authoredId` (UUID collision, bad export, etc.)
- First object: `id = uuid-123`
- Second object: `id = uuid-123`
- Importer creates nodes array with both
- Sync layer processes both
- Index: `Map<uuid-123, mesh>` → second one overwrites first
- Only one gets updated, other is "new" → duplicates created

### Impact

**Duplicate IDs can silently cause partial updates**.

---

## Issue 6: Parent-Child Silently Dropped ⚠️ **MEDIUM**

### Problem

```typescript
// No export of parentId or childrenIds in Swim26ManifestService
objects: input.models.map(model => ({
  authoredId: model.authoredId,
  id: model.id,
  name: model.name,
  assetRef: model.assetRef,
  transform: model.transform,
  material: model.material,
  tags: model.behaviorTags ?? [],
  metadata: (model as any).metadata ?? {},
  // ❌ parentId, childrenIds NOT exported
})),
```

**Consequence**:
- Titan exports a hierarchy: parent + 3 children
- Children have `parentId: parent-uuid`
- Manifest exports: Each child as independent object (no parentId)
- Import: All objects imported as root level
- **Hierarchy is silently flattened**
- No warning, no error, no indication
- User doesn't know their hierarchy was lost until runtime

### Impact

**Silent feature loss** — Users don't know hierarchy isn't round-trip safe.

---

## Issue 7: Prefab Instance Identity Undefined ⚠️ **MEDIUM**

### Problem

```typescript
// In App.tsx, prefab instance creation
const newModels: ModelData[] = prefab.models.map(pm => {
  return {
    ...(pm as any),
    id: crypto.randomUUID(),     // New random ID per placement
    authoredId: generateAuthoredId(),  // ⚠️ NEW authoredId each time!
    prefabId: prefab.id,
    prefabInstanceId: instanceId,
    position: isRoot ? position : [...],
    layerId: 'env'
  } as ModelData;
});
```

**Consequence**:
1. User creates prefab instance A (3 objects)
   - Object 1: `authoredId = uuid-aaa`
   - Object 2: `authoredId = uuid-bbb`
   - Object 3: `authoredId = uuid-ccc`
2. Export → Manifest has these 3 objects with these IDs
3. Import → Scene has 3 meshes with these authoredIds
4. User moves prefab, creates instance B (same prefab, different location)
   - Object 1: `authoredId = uuid-xxx` (NEW, different from instance A!)
   - Object 2: `authoredId = uuid-yyy`
   - Object 3: `authoredId = uuid-zzz`
5. Export → Manifest now has 6 objects (instance A + instance B)
6. Import → Tries to match, succeeds (IDs are unique)
7. But **there's no way to recognize "this is the same prefab instance, just moved"**
   - Prefab definition is not round-trip aware
   - Can't update prefab instances as groups

### Impact

**Prefab instances can't be re-positioned and re-exported safely** — each placement gets new IDs.

---

## Issue 8: Stale Nodes Never Cleaned Up ⚠️ **MEDIUM**

### Problem

```typescript
// Swim26RoundTripSync.ts, line 155-176
const deactivateNode = (mesh: BabylonLikeMesh, diagnostics: SyncChange[]): void => {
  mesh.isEnabled = false;
  mesh.visibility = 0;
  mesh.metadata = {
    ...mesh.metadata,
    isDeactivated: true,
    deactivatedAt: Date.now(),
  };
  diagnostics.push({
    type: 'deactivated',
    // ...
  });
  // ❌ Mesh is NOT removed from scene.meshes array
};
```

**Consequence**:
- Import 1: 10 nodes → 10 meshes
- Import 2: Remove 5 nodes → 5 deactivated, 5 still active
- Import 3: Remove another 2 → 2 more deactivated
- After 10 imports: 10 deactivated, 0 active = **10 invisible meshes still in scene**
- Scene grows with hidden cruft
- Memory accumulates
- No recovery mechanism documented
- Comment says "preserved for recovery" but there's no recovery function

### Impact

**Scenes accumulate hidden dead meshes** — performance degrades silently.

---

## Issue 9: Tests Don't Use Real Assembler ⚠️ **HIGH**

### Problem

```typescript
// src/tests/swim26-roundtrip-sync.test.ts
const createMockScene = (meshes: any[] = []): BabylonLikeScene => ({
  meshes,
});

const createMockMesh = (authoredId: string, name: string, ...) => ({
  // ... mock implementation, NOT a real Babylon mesh
  metadata: { authoredId, ... },
});

// Tests never call Swim26RuntimeSceneAssembler.ts
// Tests never call buildSwim26Manifest + importSwim26Manifest + assembleSwim26RuntimeScene
```

**Consequence**:
- Sync layer tests pass (all green)
- But assembler creates meshes with `importedNodeId` (not `authoredId`)
- Real-world usage would fail immediately
- Tests validate sync logic in isolation, not the actual round-trip

### Impact

**False confidence** — Tests pass, but production would fail.

---

## Issue 10: No Round-Trip End-to-End Test ⚠️ **CRITICAL**

### Problem

```typescript
// Tests do:
test('idempotency: importing same manifest twice produces same result', () => {
  const scene1 = createMockScene([mesh1]);
  const result1 = applySwim26RoundTripSync(scene1, [node]);

  const scene2 = createMockScene([mesh2]);
  const result2 = applySwim26RoundTripSync(scene2, [node]);
  // Compares results, not actual scene state
});

// But NEVER does:
// 1. Create a real ModelData with authoredId
// 2. Export with buildSwim26Manifest()
// 3. Import with importSwim26Manifest()
// 4. Assemble with assembleSwim26RuntimeScene()
// 5. Export again
// 6. Import again
// 7. Verify no duplicates
```

**Consequence**:
- The full pipeline is untested
- Issues (like metadata mismatch) are invisible to tests
- A real developer testing locally would create a manifest, import it twice, and see duplicates

### Impact

**ZERO validation that end-to-end round-trip works**.

---

## Issue 11: Runtime-Owned Detection Too Fragile ⚠️ **MEDIUM**

### Problem

```typescript
// Swim26RoundTripSync.ts, line 64-68
for (const mesh of meshes) {
  const authoredId = mesh.metadata?.authoredId;
  if (typeof authoredId === 'string') {
    authoredIdToMesh.set(authoredId, mesh);  // Only if authoredId exists
  }
  // ❌ Else: silently skipped, treated as "runtime-owned"
}
```

**Consequence**:
- A mesh without `authoredId` is assumed runtime-owned
- But it could be a badly-created authored mesh (bug, malformed metadata, etc.)
- No way to distinguish between "legitimately runtime-owned" and "broken"
- No diagnostic warning for unindexed meshes

### Impact

**Can't tell if mesh is runtime-owned or broken**.

---

## Issue 12: Backward Compat Warning Too Vague ⚠️ **MEDIUM**

### Problem

```typescript
// Swim26ManifestImporter.ts, line 125-130
if (!isV110) {
  warnings.push({
    path: 'version',
    message: 'Manifest is v1.0.0 without stable authoredId; using synthesized IDs for round-trip (may not match original)',
    severity: 'warning',
  });
}
```

**Consequence**:
- User imports old manifest
- Warning says "may not match original"
- But it actually **will NOT match** if they re-export and re-import
- Synthetic ID is deterministic but based on `(name, position, assetRef)`
- If user moves an object, the synthetic ID changes
- Second import thinks it's a new object → duplicate

### Impact

**Warning doesn't explain the actual problem** — users still expect round-trip to work.

---

## Summary Table

| Issue | Severity | Root Cause | Impact |
|-------|----------|-----------|--------|
| Assembler doesn't use sync | 🔴 CRITICAL | No integration | Duplicates on re-import |
| Metadata naming mismatch | 🔴 CRITICAL | Inconsistent field names | Index fails, all treated as new |
| Placeholders missing authoredId | 🟠 HIGH | Incomplete initialization | Failed assets duplicate |
| Unsafe metadata merge | 🟠 HIGH | Overwrites runtime state | Runtime corruption |
| No duplicate validation | 🟡 MEDIUM | Missing check | Silent partial updates |
| Parent-child silent drop | 🟡 MEDIUM | Not exported | Hierarchy lost, user unaware |
| Prefab identity undefined | 🟡 MEDIUM | New ID per placement | Can't track prefab instances |
| Stale nodes accumulate | 🟡 MEDIUM | No cleanup | Memory waste, scene bloat |
| Tests don't use assembler | 🟠 HIGH | Isolated testing | False confidence |
| No e2e round-trip test | 🔴 CRITICAL | Missing integration test | Unvalidated pipeline |
| Runtime detection fragile | 🟡 MEDIUM | Absence-based detection | Can't diagnose problems |
| Backward compat warning vague | 🟡 MEDIUM | Poor messaging | Users confused |

---

## Recommendations

### Must Fix (Blocking Production Use)
1. **Integrate assembler with sync layer** — Call `synchronizeSwim26ImportedScene()` instead of creating new scene
2. **Fix metadata naming** — Use `authoredId` consistently everywhere
3. **Add end-to-end test** — Export → Import → Export → Import → Verify no duplication
4. **Fix metadata merge** — Only merge `authoredMetadata` field, don't overwrite runtime keys

### Should Fix (Before Production)
5. Validate unique authoredIds in importer
6. Set authoredId on placeholder meshes
7. Add deactivation cleanup policy
8. Make runtime-owned detection explicit and reportable

### Must Document (Cannot Ship Without)
9. Parent-child hierarchy not round-trip safe
10. Prefab instances not round-trip aware
11. Asset failure behavior (placeholders)
12. Backward compat limitations

---

## What Needs to Change

The synchronization layer itself is **sound** — the logic is correct. But:

1. **It's not connected to the assembler** (the code that creates real scenes)
2. **Metadata field names are inconsistent**
3. **Tests validate the layer in isolation, not end-to-end**
4. **Safety guarantees around metadata merge are weak**

**Bottom line**: The design is good, but the implementation is incomplete and untested. Fixing the integration points will make it work.

