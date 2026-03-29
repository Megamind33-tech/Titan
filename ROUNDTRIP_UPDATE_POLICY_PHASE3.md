# PHASE 3: Incremental Update Policy for Round-Trip Synchronization

## Objective

Define explicit, predictable behavior for how SWIM26 runtime applies scene updates when a manifest is imported after the initial import. This policy prevents duplication, ensures consistency, and makes authored content round-trip behavior transparent.

---

## 1. Incremental Update Principles

### 1.1 **Idempotency**
- Importing the same manifest multiple times produces the same runtime result.
- No duplicates accumulate; no phantom nodes persist.
- Importing manifest A, then A again, then A again yields the same scene state as importing A once.

### 1.2 **Authored Subset Isolation**
- Authored content (models, paths, environment from manifest) is tracked separately from runtime-owned content (gameplay, physics, scoring).
- Updates apply only to authored content; runtime systems are never touched by import.

### 1.3 **Predictable Change Behavior**
- User edits a model's transform in Titan and re-exports → Runtime reflects the change.
- User removes a model from Titan and re-exports → Runtime handles removal per policy.
- User adds a model to Titan and re-exports → Runtime adds the new model.
- Unchanged models are updated in-place, not recreated.

### 1.4 **No Implicit Removals**
- Removing authored content from Titan is deliberate; re-importing should reflect that intent.
- Stale nodes (in old import but not new) are not silently deleted without explicit policy.

---

## 2. Node Update State Transitions

### 2.1 State Machine

```
Node states during incremental update:

┌─────────────────────────────────────────────────────────────────┐
│ INPUT: Old Import State vs. New Import State                    │
├─────────────────────────────────────────────────────────────────┤
│
│ NODE IDENTIFIED BY: authoredId (stable round-trip identifier)
│
├─────────────────────────────────────────────────────────────────┤
│
│ ┌──────────────────────────────────────────────────────────────┐
│ │ Case 1: Node in new manifest, NOT in old runtime state      │
│ │ STATE: NEW                                                   │
│ │ ACTION: Create runtime mesh for this node                   │
│ │ RESULT: Mesh added to scene, indexed by authoredId          │
│ │ IDEMPOTENT: Yes (if run twice, second run does nothing)     │
│ └──────────────────────────────────────────────────────────────┘
│
│ ┌──────────────────────────────────────────────────────────────┐
│ │ Case 2: Node in new manifest, exists in old runtime state   │
│ │ STATE: EXISTING / UPDATING                                  │
│ │ ACTION: Update mesh in-place:                               │
│ │   - Apply new transform (position, rotation, scale)         │
│ │   - Apply new material hints                                │
│ │   - Update asset ref (if applicable)                        │
│ │   - Preserve runtime-modified metadata                      │
│ │ RESULT: Mesh updated, no new mesh created                   │
│ │ IDEMPOTENT: Yes (updates are applied consistently)          │
│ └──────────────────────────────────────────────────────────────┘
│
│ ┌──────────────────────────────────────────────────────────────┐
│ │ Case 3: Node NOT in new manifest, existed in old state      │
│ │ STATE: STALE / REMOVED                                      │
│ │ ACTION (POLICY): See Section 2.2 below                      │
│ │ RESULT (POLICY): Deactivate, mark for removal, or preserve  │
│ │ IDEMPOTENT: Depends on policy choice                        │
│ └──────────────────────────────────────────────────────────────┘
│
│ ┌──────────────────────────────────────────────────────────────┐
│ │ Case 4: Node unchanged (in both old and new, same data)     │
│ │ STATE: UNCHANGED / IDEMPOTENT SKIP                          │
│ │ ACTION: Skip update (no-op)                                 │
│ │ RESULT: Mesh left as-is                                     │
│ │ IDEMPOTENT: Yes (no change = no change)                     │
│ └──────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stale Node Handling Policy (Case 3)

**Scenario**: A model was imported in the first import (manifest v1), but is absent from the second import (manifest v2). The model's runtime mesh still exists in the scene.

**Policy Options**:

#### Option A: **Preserve Stale Nodes** (Conservative)
- **Behavior**: Stale nodes are left in the scene, but marked as orphaned.
- **Pros**: Safe; no accidental removal of authored content. User can audit what was removed and decide.
- **Cons**: Scene accumulates stale nodes over iterations; requires manual cleanup.
- **Use Case**: When round-trip workflows are evolving; gives time to verify before removal.

#### Option B: **Deactivate Stale Nodes** (Moderate)
- **Behavior**: Set `mesh.isEnabled = false` or `mesh.visibility = 0`.
- **Pros**: Nodes are not rendered but not deleted; can be re-enabled if needed. Safe middle ground.
- **Cons**: Hidden scene cruft; still consume memory.
- **Use Case**: Production workflows where accidental removals should be visibly recoverable.

#### Option C: **Remove Stale Nodes** (Aggressive)
- **Behavior**: Delete the mesh from the scene (`scene.removeMesh(mesh)`).
- **Pros**: Clean scene; no hidden cruft.
- **Cons**: Irreversible within the runtime session; if removal was unintended, content is lost (though it can be re-imported from manifest).
- **Use Case**: Stable production pipelines where manifest is the source of truth.

#### Option D: **Remove with Undo/Recovery** (Ideal but Complex)
- **Behavior**: Remove mesh, but record removal with timestamp and manifest version.
- **Pros**: Clean scene with recovery option.
- **Cons**: Requires persistence layer and UI for recovery.
- **Use Case**: Future enhancement; out of scope for Phase 3.

**Recommendation for Phase 3**: **Option B — Deactivate Stale Nodes**
- **Rationale**:
  - Safe: No irreversible deletion.
  - Transparent: Deactivated nodes are still findable in scene diagnostics.
  - Consistent: Authored content is preserved even if not rendered.
  - Future-proof: Easy to add Option C (removal) in a later phase once workflow is proven.

---

## 3. Data Update Rules by Field

### 3.1 Transform Data (Position, Rotation, Scale)

**Rule**: Always update from manifest.

**Reasoning**:
- Transform is purely visual and deterministic.
- No gameplay system should be modifying authored transform; it's authored content.
- Safe to update unconditionally on re-import.

**Implementation**:
```typescript
if (node.existing && node.updated) {
  mesh.position = { x: newTransform.position[0], y: newTransform.position[1], z: newTransform.position[2] };
  mesh.rotation = { x: newTransform.rotation[0], y: newTransform.rotation[1], z: newTransform.rotation[2] };
  mesh.scaling = { x: newTransform.scale[0], y: newTransform.scale[1], z: newTransform.scale[2] };
}
```

### 3.2 Material Hints

**Rule**: Update material properties, but only if they were explicitly authored (not runtime-inferred).

**Reasoning**:
- Material hints (color, roughness, metalness) are authored; should reflect Titan edits.
- Some material properties might be runtime-overridden by gameplay; distinguish between authored and runtime hints.

**Implementation**:
```typescript
if (node.material && node.material.presetId) {
  // Material preset specified in Titan; apply policy
  applyMaterialPreset(mesh, node.material.presetId);
}
if (node.material && node.material.color) {
  // Explicit color authored in Titan; update
  mesh.material.emissiveColor = parseColor(node.material.color);
}
// Numeric properties (roughness, metalness) always update if present
if (node.material && node.material.roughness !== undefined) {
  mesh.material.roughness = node.material.roughness;
}
```

**Metadata Preservation**:
- Preserve any runtime-specific metadata in mesh.metadata; don't overwrite.
```typescript
mesh.metadata = {
  ...mesh.metadata,  // Keep existing runtime metadata
  authoredMaterial: node.material,  // Record what was authored
  lastUpdateTime: Date.now(),
};
```

### 3.3 Asset Reference (Mesh/Model URL or Asset ID)

**Rule**: Update asset ref, but with safeguards.

**Reasoning**:
- If user changes the model in Titan (e.g., swaps podium.glb for trophy.glb), runtime should reflect that.
- Asset resolution failures should be handled gracefully (placeholder mesh, diagnostic warning).

**Implementation**:
```typescript
if (node.assetRef) {
  if (node.assetRef.value !== mesh.metadata.authoredAssetRef?.value) {
    // Asset ref changed; attempt to resolve new asset
    const newAsset = await resolver({ scene, node });
    if (newAsset.meshes.length > 0) {
      // Successfully resolved; replace mesh
      scene.removeMesh(mesh);
      newAsset.meshes.forEach(m => {
        applyNodeTransform(m, node);
        applyMaterial(m, node.material);
        m.metadata = { ...mesh.metadata, authoredAssetRef: node.assetRef };
        scene.addMesh(m);
      });
    } else {
      // Asset resolution failed; keep old mesh, emit diagnostic
      diagnostics.push({
        severity: 'warning',
        code: 'ASSET_UPDATE_FAILED',
        message: `Failed to update asset ref for node ${node.id}; keeping previous mesh.`,
      });
    }
  }
}
```

### 3.4 Tags and Metadata

**Rule**: Replace authored tags; preserve runtime-injected metadata.

**Reasoning**:
- Tags are authored in Titan; if Titan changes tags, runtime should reflect that.
- Metadata might contain runtime-injected or gameplay-specific data; don't erase it.

**Implementation**:
```typescript
// Replace tags with what's authored
mesh.metadata.authoredTags = node.tags;

// Preserve gameplay-injected metadata
const gameplayData = mesh.metadata.gameplayData ?? {};
const runtimeState = mesh.metadata.runtimeState ?? {};
mesh.metadata = {
  authoredId: node.id,
  authoredName: node.name,
  authoredTags: node.tags,
  authoredAssetRef: node.assetRef,
  gameplayData,        // Preserved
  runtimeState,        // Preserved
  ...node.metadata,    // Authored metadata from Titan
};
```

### 3.5 Name

**Rule**: Update from manifest.

**Reasoning**:
- Name is display metadata; safe to update.
- Helps with scene debugging and diagnostics.

**Implementation**:
```typescript
mesh.name = node.name;
mesh.metadata.authoredName = node.name;
```

---

## 4. Environment Update Policy

### 4.1 Rule
- **Environment preset ID**: Update if changed.
- **Ambient intensity**: Update if changed.
- **Background color**: Update if changed.

**Reasoning**:
- Environment is global authored content; should be synchronized on every import.
- No gameplay system should be modifying environment config.

**Implementation**:
```typescript
if (manifest.authoredContent.environment) {
  const env = manifest.authoredContent.environment;
  if (env.presetId !== scene.environmentPresetId) {
    scene.environmentPresetId = env.presetId;
    // Load environment preset
  }
  scene.environmentIntensity = env.intensity;
  scene.clearColor = env.backgroundColor;
  scene.metadata.authoredEnvironment = env;
}
```

---

## 5. Path Update Policy

### 5.1 Rule
- **Paths are imported but NOT rendered** (per current SWIM26 capabilities).
- On update:
  - Store path data in scene metadata.
  - Emit diagnostic warning (paths not yet visualized in runtime).
  - Allow future path visualization without breaking round-trip.

**Implementation**:
```typescript
scene.metadata.authoredPaths = manifest.authoredContent.paths;
// Future: When path visualization is implemented, paths are already available here.
```

### 5.2 Stale Path Handling
- Apply same deactivation policy as nodes: mark stale paths as inactive in metadata, but preserve data.

---

## 6. Idempotency and Safety Guarantees

### 6.1 **Guarantee 1: Single-Import Idempotency**
Importing manifest A once = importing manifest A twice = importing manifest A three times.

**Mechanism**:
- Match by `authoredId`.
- Update in-place (don't create new meshes).
- Deactivate (don't delete) stale nodes.

### 6.2 **Guarantee 2: Update-Then-Revert Idempotency**
If manifest A → manifest B → manifest A, the runtime state is the same as if A was imported once.

**Mechanism**:
- All updates are deterministic.
- Reverting to manifest A re-applies manifest A's state.
- Mesh metadata preserves authored state, allowing recovery.

### 6.3 **Guarantee 3: Authored Content Isolation**
Runtime-owned systems (gameplay, physics, scoring, user interactions) are never modified by import.

**Mechanism**:
- Import touches only:
  - Node transforms (position, rotation, scale).
  - Node materials and asset refs.
  - Global environment settings.
- Import does NOT touch:
  - Physics state.
  - Gameplay scoring or state.
  - Runtime-injected script systems.
  - User-placed runtime objects (not authored).

---

## 7. Implementation Checklist

- [ ] **Authored Subset Index**: Implement a `Map<authoredId, RuntimeNodeInfo>` to track imported nodes.
- [ ] **Node Diff Logic**: Before update, diff old state vs. new state; determine Case 1/2/3/4.
- [ ] **Update Application**: For Case 2 (existing), apply transform, material, asset ref updates.
- [ ] **Stale Node Handling**: For Case 3 (stale), deactivate (set `isEnabled = false`).
- [ ] **Metadata Preservation**: Ensure runtime metadata is merged, not overwritten.
- [ ] **Environment Update**: Handle environment preset, intensity, color updates.
- [ ] **Diagnostics Capture**: Log what was added, updated, deactivated, and why.
- [ ] **Tests**:
  - Single import produces one mesh.
  - Second import of same manifest: no duplication, no-op update.
  - Changed transform: mesh updates, others unchanged.
  - Changed asset ref: asset update attempted, fallback handled.
  - Stale node: deactivated, metadata preserved.
  - Runtime metadata: preserved through updates.

---

## 8. Unsupported / Out of Scope

- **Gameplay-Owned Property Updates**: Removing a node does not trigger gameplay cleanup (deactivation only).
- **Complex Asset Swaps**: If asset replacement fails, no fallback strategy beyond placeholder mesh.
- **Hierarchical Parent-Child Reconstruction**: If parent-child relationships are not exported, hierarchy is flattened on re-import.
- **Undo/Recovery of Removals**: Deactivated nodes can be re-enabled manually; no auto-recovery system in this phase.

---

## 9. Honesty Statement

**What This Update Policy Enables**:
- Repeated manifest imports without node duplication.
- Deterministic, idempotent behavior.
- Safe update of authored content (transforms, materials, asset refs).
- Clear handling of removed content (deactivation, not deletion).

**What This Update Policy Does NOT Enable**:
- Two-way gameplay authoring (SWIM26 edits exported to Titan).
- Automatic cleanup of removed nodes (deactivation is conservative).
- Complex asset migration or versioning.
- Conflict resolution for simultaneous Titan + SWIM26 edits.

**Guarantees**:
- A node can be updated multiple times; the final state matches the manifest.
- Stale nodes are never silently deleted; they are visibly deactivated.
- Runtime-owned systems are untouched by manifest import.

---

## 10. Sign-Off

**Incremental Update Policy Status**: ✅ **DEFINED**

**Core Policy**:
- **New nodes**: Created on first import, skipped on re-import (idempotent).
- **Existing nodes**: Updated in-place (transform, material, asset ref).
- **Stale nodes**: Deactivated (not deleted), marked in metadata.
- **Environment**: Always updated (no persistence between imports).
- **Gameplay systems**: Never modified by import.

**Next**: Implement this policy in PHASE 4 code.
