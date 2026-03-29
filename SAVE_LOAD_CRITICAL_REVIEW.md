# Critical Review: Save/Load and Migration Implementation

**Date**: 2026-03-29
**Status**: Issues Found - Significant Gaps Identified
**Severity**: High (data loss, schema drift, migration gaps)

---

## Executive Summary

The save/load implementation has critical gaps that could lead to:
- **Silent data loss** (persisted fields not recoverable)
- **Schema drift** (autosave vs manual save have different structures)
- **No versioning** (cannot handle future breaking changes)
- **No migration logic** (incompatible old saves will crash)
- **Incomplete field coverage** (many new fields never persisted)
- **Happy-path-only tests** (edge cases uncovered)

---

## Issue Category 1: Persisted Fields Underspecified

### Issue 1.1: File/Blob URLs Cannot Be Restored (Data Loss)

**Location**: `src/utils/storageUtils.ts:30-38, 71-74`

**Problem**:
```typescript
export interface SceneState {
  // URL fields explicitly excluded:
  models: Omit<ModelData, 'url' | 'textureUrl' | 'normalMapUrl' | 'file' | 'textureFile' | 'normalMapFile'>[];
}

// In saveSceneVersion:
const persistedModels = models.map(m => {
  const { url, file, textureUrl, textureFile, normalMapUrl, normalMapFile, ...rest } = m;
  return rest;  // ← All URL/File fields silently dropped
});
```

**Severity**: HIGH

**Impact**:
- Model geometry URLs dropped silently (no error, no warning)
- Texture URLs dropped silently
- Normal map URLs dropped silently
- When loaded, models have `undefined` URLs
- User must manually re-upload all files after loading save

**Root Cause**:
- Assumption that URLs/Files cannot persist (true for browser Blob URLs)
- But no mechanism to store file references or versioned content
- No warning when saving
- No indication when loading

**Hidden Data Loss**:
```
Saved: { models: [{ id: '1', name: 'Cube', url: 'blob:...' }] }
                                         ↓ (dropped)
Persisted: { models: [{ id: '1', name: 'Cube' }] }  // url undefined!
Loaded: { models: [{ id: '1', name: 'Cube', url: undefined }] }
```

---

### Issue 1.2: Many New Fields Never Persisted

**Location**: `src/App.tsx:38-78` vs `src/utils/storageUtils.ts:34-51`

**Problem - Fields Added to ModelData But Not Saved**:
```typescript
// ModelData has these fields (App.tsx):
export interface ModelData {
  // ... existing fields ...
  // NEW FIELDS NEVER PERSISTED:
  dimensions?: { width: number; height: number; depth: number };
  assetId?: string;
  prefabId?: string;
  prefabInstanceId?: string;
  isPrefabRoot?: boolean;
  overriddenProperties?: string[];
  performanceMetrics?: AssetMetrics;
  materialRemap?: { [oldMat: string]: string };
  // roughnessMapUrl, metalnessMapUrl, etc. also missing
}

// But only these are persisted (storageUtils.ts:38):
models: Omit<ModelData, 'url' | 'textureUrl' | 'normalMapUrl' | 'file' | 'textureFile' | 'normalMapFile'>[]
// Missing from Omit: dimensions, assetId, prefabId, prefabInstanceId, isPrefabRoot,
//                    overriddenProperties, performanceMetrics, materialRemap,
//                    roughnessMapUrl, roughnessMapFile, metalnessMapUrl, metalnessMapFile, etc.
```

**Severity**: CRITICAL

**Impact**:
- Dimensions lost (affects export, asset browser)
- Prefab metadata lost (prefabId, prefabInstanceId, isPrefabRoot, overriddenProperties)
- Asset library references lost (assetId)
- Performance metrics lost
- Material remaps lost
- New texture maps lost (roughness, metalness, emissive, alpha, AO)

**Silent Data Loss**: No error, no warning - just discarded

**Evidence**:
```typescript
// Model with all these fields in memory:
{
  id: 'model-1',
  name: 'Box',
  url: 'assets/box.glb',
  assetId: 'asset-1',               // ← Not persisted
  dimensions: {width: 1, height: 1, depth: 1},  // ← Not persisted
  prefabId: 'prefab-1',             // ← Not persisted
  roughnessMapUrl: 'rough.png',     // ← Not persisted
  // ...
}

// After save/load:
{
  id: 'model-1',
  name: 'Box',
  url: undefined,                   // ← Lost
  assetId: undefined,               // ← Lost
  dimensions: undefined,            // ← Lost
  prefabId: undefined,              // ← Lost
  roughnessMapUrl: undefined,       // ← Lost
  // All lost, no error
}
```

---

### Issue 1.3: Autosave Structure Differs from Manual Save

**Location**: `src/utils/storageUtils.ts:155-183, 186-196`

**Problem**:
```typescript
// SceneState (manual save) has:
export interface SceneState {
  versionId: string;        // ← Has version tracking
  timestamp: string;
  note: string;             // ← Has user note
  changesSummary?: {...};   // ← Has change tracking
  models: [...];
  // ... other fields
}

// AutoSaveState has:
export interface AutoSaveState {
  // NO versionId!
  timestamp: string;
  // NO note!
  // NO changesSummary!
  models: [...];
  // ... other fields
}

// But both are missing:
// NO schema version
// NO migration field
// NO format identifier
```

**Severity**: MEDIUM

**Impact**:
- Manual saves and autosaves are incompatible types
- Cannot easily migrate between them
- No version info on either format
- If schema changes, can't distinguish old from new

---

## Issue Category 2: Version Handling Too Shallow

### Issue 2.1: No Schema Version Field

**Location**: Entire `src/utils/storageUtils.ts`

**Problem**:
```typescript
// Neither SceneState nor AutoSaveState has a version field
export interface SceneState {
  versionId: string;  // ← This is the save ID (timestamp), NOT schema version
  timestamp: string;
  note: string;
  models: [...];
  // NO schemaVersion or formatVersion field
}
```

**Severity**: CRITICAL

**Impact**:
- Cannot distinguish v1.0 saves from v2.0 saves
- Cannot apply migrations (don't know which version is which)
- If fields change, loading old saves breaks silently
- No forward compatibility path

**Example Problem**:
```
Save 1 (v1 schema): { timestamp: '2026-01-01', models: [...] }
Save 2 (v1 schema): { timestamp: '2026-02-01', models: [...] }
  ↓ Code is updated, schema changes
Load Save 2: Assuming new schema, but it's old format → crash or data loss
```

---

### Issue 2.2: versionId is Save ID, Not Schema Version

**Location**: `src/utils/storageUtils.ts:69, 78`

**Problem**:
```typescript
export const saveSceneVersion = async (...) => {
  const versionId = Date.now().toString();  // ← This is save timestamp, not version

  const state: SceneState = {
    versionId,  // ← Confusing: looks like schema version, but it's timestamp
    timestamp: new Date().toISOString(),
    // ...
  };
}
```

**Severity**: MEDIUM

**Impact**:
- Field name is misleading (versionId implies schema version)
- Confuses developers
- Makes migration logic impossible
- Can't tell if save is v1, v2, v3 of schema

---

### Issue 2.3: No Migration Entry Point

**Location**: `src/utils/storageUtils.ts:202-230` (loadAutoSave)

**Problem**:
```typescript
export const loadAutoSave = async (): Promise<AutoSaveState | null> => {
  const raw = await localforage.getItem('autosave');
  if (!raw) return null;

  const state = raw as Partial<AutoSaveState>;  // ← Force cast, no validation

  // Just apply defaults, no migration
  return {
    timestamp: state.timestamp ?? new Date().toISOString(),
    models: state.models ?? [],  // ← Just default empty if missing
    prefabs: state.prefabs ?? [],
    // ...
  };
};
```

**Severity**: HIGH

**Impact**:
- No migration logic at all
- If schema changes, loading old data could:
  - Silently use wrong defaults
  - Lose incompatible fields
  - Crash if required field is missing
- No way to handle breaking changes

---

## Issue Category 3: Migration Logic Too Brittle/Ad Hoc

### Issue 3.1: No Migration System At All

**Location**: Entire codebase

**Problem**:
- Zero migration logic
- No migration registry
- No versioned migration functions
- No test cases for migrations

**Severity**: CRITICAL (for future compatibility)

**Impact**:
- Cannot add new required fields without breaking old saves
- Cannot rename fields
- Cannot restructure data
- Application becomes frozen after release

**Example Scenario**:
```
v1.0: saves have models: [{ id, name, position, ... }]
v1.1: Code adds new REQUIRED field (e.g., createdAt)
      Loading v1.0 save now crashes (createdAt required but missing)
      No way to migrate
```

---

### Issue 3.2: Load-Time Defaults Are Ad Hoc

**Location**: `src/utils/storageUtils.ts:126-140` (loadSceneVersion)

**Problem**:
```typescript
export const loadSceneVersion = async (versionId: string) => {
  const state = history.find(s => s.versionId === versionId);
  if (!state) return null;

  // Defaults are hardcoded at load time
  return {
    ...state,
    prefabs: state.prefabs ?? [],  // ← Default empty array
    layers: state.layers ?? [],     // ← Default empty array
    cameraSettings: state.cameraSettings ?? {
      // ← Defaults hardcoded here, might diverge from CREATE defaults
      presets: [],
      activePresetId: null,
      paths: [],
      activePathId: null
    },
    // ...
  };
};
```

**Severity**: MEDIUM

**Impact**:
- If defaults change elsewhere, load-time defaults become stale
- No single source of truth for defaults
- Different code paths have different defaults
- Inconsistent state after loading

---

## Issue Category 4: Malformed Persisted State Slips Into Runtime

### Issue 4.1: No Validation on Load

**Location**: `src/utils/storageUtils.ts:120-141`

**Problem**:
```typescript
export const loadSceneVersion = async (versionId: string): Promise<SceneState | null> => {
  const history: SceneState[] = await localforage.getItem('scene_history') || [];
  const state = history.find(s => s.versionId === versionId);
  if (!state) return null;

  // NO VALIDATION
  // state could have:
  // - Missing required fields
  // - Wrong type fields
  // - NaN values in position/rotation/scale
  // - Invalid enum values
  // - Circular references
  // - XSS payloads in strings

  return { ...state, /* just defaults */ };
};
```

**Severity**: CRITICAL

**Impact**:
- Malformed data from corrupted save → silently used in app
- Data type errors: `position: NaN` → will break Three.js
- Enum violations: `type: 'unknown'` → runtime errors
- String injection: `name: '<script>'` → potential XSS
- Circular references: could cause memory issues

**Example**:
```javascript
// Corrupted save in localStorage:
{
  versionId: '1234',
  models: [
    {
      id: 'model-1',
      position: [NaN, Infinity, -0],  // ← Invalid, should be finite
      rotation: "not-an-array",        // ← Wrong type
      scale: [-1, 0, 1],               // ← Non-positive scale invalid
      type: 'invalid-type',            // ← Not in enum
    }
  ]
}

// Loads without error, breaks later
```

---

### Issue 4.2: Type Casting Without Validation

**Location**: `src/utils/storageUtils.ts:207`

**Problem**:
```typescript
const state = raw as Partial<AutoSaveState>;  // ← Force cast

// Raw data from localforage is unknown
// Could be anything: null, string, corrupted object, etc.
// Force casting doesn't validate, just tells TypeScript to ignore type errors
```

**Severity**: HIGH

**Impact**:
- TypeScript type safety is bypassed
- Compiler won't catch type mismatches
- Runtime type errors possible
- Corrupted data accepted silently

---

## Issue Category 5: Defaults Applied Inconsistently

### Issue 5.1: Multiple Sources of Truth for Defaults

**Location**: Multiple files

**Problem**:
```
// In storageUtils.ts (load-time defaults):
const cameraSettings = state.cameraSettings ?? {
  presets: [],
  activePresetId: null,
  paths: [],
  activePathId: null
};

// In App.tsx (runtime defaults):
const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'default-orbit',
    name: 'Orbit',
    type: 'perspective',
    // ... full definition
  }
];

// In Scene.tsx (component defaults):
const [cameraSettings, setCameraSettings] = useState<CameraSettings>({
  presets: [DEFAULT_CAMERA_PRESETS[0]],
  activePresetId: null,
  paths: [],
  activePathId: null
});

// Three different sources! Which is "correct"?
```

**Severity**: MEDIUM

**Impact**:
- Loaded save uses empty presets `[]`
- But new scene initializes with `[DEFAULT_CAMERA_PRESETS[0]]`
- Inconsistent state after load
- Difficult to reason about state

---

### Issue 5.2: No Default Validator

**Location**: No centralized place

**Problem**:
- SceneSettings defaults in storageUtils (one place)
- CameraSettings defaults in storageUtils (one place)
- Some defaults in App.tsx
- Some defaults in component files
- No way to validate defaults are valid

**Severity**: MEDIUM

**Impact**:
- If a default is invalid (e.g., negative shadowSoftness), it fails silently
- New developers don't know where defaults come from
- Easy to introduce inconsistencies

---

## Issue Category 6: Autosave/Manual History Schema Drift

### Issue 6.1: Autosave Has No Versioning, Manual Save Does

**Location**: `src/utils/storageUtils.ts:34-51, 186-196`

**Problem**:
```typescript
// Manual saves (SceneState):
export interface SceneState {
  versionId: string;        // Has some form of ID
  timestamp: string;
  note: string;
  changesSummary?: {...};
  models: Omit<ModelData, ...>[];
  // ... 9 fields
}

// Autosaves (AutoSaveState):
export interface AutoSaveState {
  // NO versionId
  timestamp: string;
  // NO note
  // NO changesSummary
  models: Omit<ModelData, ...>[];
  // ... same fields but no metadata
}

// Both missing: schemaVersion, format, migrationPath
```

**Severity**: MEDIUM

**Impact**:
- Autosave format might not survive migrations
- Cannot distinguish old autosave from new
- If you need to restore from autosave after schema change, will fail

---

### Issue 6.2: Both Lose Fields on Save

**Location**: `src/utils/storageUtils.ts:71-75, 166-169`

**Problem**:
```typescript
// Manual save discards these fields:
const persistedModels = models.map(m => {
  const { url, file, textureUrl, textureFile, normalMapUrl, normalMapFile, ...rest } = m;
  return rest;  // ← Only keeps rest
});

// Autosave discards same fields:
const persistedModels = models.map(m => {
  const { url, file, textureUrl, textureFile, normalMapUrl, normalMapFile, ...rest } = m;
  return rest;  // ← Same discarding logic
});

// Both are identical discard logic, but:
// - Manual save also discards fields via Omit in SceneState
// - Autosave also discards fields via Omit in AutoSaveState
// - Total fields lost: url, file, textureUrl, textureFile, normalMapUrl, normalMapFile,
//   assetId, dimensions, prefabId, prefabInstanceId, isPrefabRoot, overriddenProperties,
//   performanceMetrics, materialRemap, and any new texture maps
```

**Severity**: HIGH

**Impact**:
- Same fields lost in both paths
- Inconsistent message (different interfaces suggest different handling, but same loss)
- No clear policy on what's persisted vs transient

---

## Issue Category 7: Tests Only Cover Happy Paths

### Issue 7.1: No Storage Tests At All

**Location**: No test file found

**Problem**:
- No test file for storageUtils.ts
- No validation tests
- No migration tests
- No edge case tests
- No corrupted data tests

**Severity**: CRITICAL

**Gaps**:
- ❌ Save empty scene
- ❌ Save with many models
- ❌ Save with special characters in names
- ❌ Save with circular references
- ❌ Load corrupted saves
- ❌ Load with missing fields
- ❌ Load with wrong type fields
- ❌ Load with NaN/Infinity values
- ❌ Load very old saves (migration)
- ❌ Autosave vs manual save compatibility
- ❌ Version mismatch handling
- ❌ Concurrent saves
- ❌ Storage quota exceeded
- ❌ LocalForage failures
- ❌ History overflow (too many saves)

---

## Summary Table

| Issue | Category | Severity | Data Loss | Impact |
|-------|----------|----------|-----------|--------|
| 1.1 | URLs not restored | CRITICAL | Yes | Models have undefined URLs |
| 1.2 | New fields not persisted | CRITICAL | Yes | Dimensions, prefab data, metrics lost |
| 1.3 | Autosave struct differs | MEDIUM | No | Incompatible types |
| 2.1 | No schema version | CRITICAL | Potential | Can't migrate |
| 2.2 | versionId is save ID | MEDIUM | No | Confusion |
| 2.3 | No migration entry | CRITICAL | Yes | Breaking changes impossible |
| 3.1 | No migration system | CRITICAL | Yes | Future schema changes break |
| 3.2 | Ad hoc defaults | MEDIUM | No | Inconsistent state |
| 4.1 | No load validation | CRITICAL | No | Malformed data in runtime |
| 4.2 | Type cast without validation | HIGH | No | Type errors possible |
| 5.1 | Multiple default sources | MEDIUM | No | Inconsistent state |
| 5.2 | No default validator | MEDIUM | No | Invalid defaults possible |
| 6.1 | Autosave schema drift | MEDIUM | Potential | Migration breaks autosave |
| 6.2 | Both lose same fields | HIGH | Yes | Same data loss in both paths |
| 7.1 | No storage tests | CRITICAL | Potential | All gaps undetected |

---

## Recommendations for Tightening

### High Priority (Data Integrity)
1. **Add schema version to all persisted structures**
   - Add `schemaVersion: number` field
   - Increment on breaking changes
   - Document version history

2. **Implement proper load-time validation**
   - Validate all required fields present
   - Validate field types
   - Validate value ranges (NaN/Infinity check)
   - Validate enum values

3. **Create migration system**
   - Define migration functions for each version jump
   - Register migrations by (from, to) version pair
   - Apply migrations in sequence during load
   - Test each migration path

4. **Expand field coverage**
   - Identify all non-transient fields
   - Document why each field is/isn't persisted
   - Persist all recoverable fields
   - Explicitly mark transient fields

### Medium Priority (Consistency)
5. **Unify autosave and manual save structures**
   - Same base structure with optional metadata
   - Or separate concerns (versioning vs content)

6. **Centralize defaults**
   - Single source of truth for each data type
   - Validators for defaults
   - Runtime checks that defaults are valid

7. **Clear transient field policy**
   - Document which fields are transient and why
   - Mark transient fields in type comments
   - Have explicit Discard/Keep lists

### Test Priority
8. **Add comprehensive persistence tests**
   - Happy path: save and load complete scene
   - Edge cases: empty scene, massive scene, special chars
   - Validation: corrupted data, type mismatches, missing fields
   - Migration: old format → new format
   - Concurrent: multiple saves overlapping
   - Failure: storage quota, disk full

---

## Scope Definition

**In Scope**:
- Save/load contract hardening (add validation, versioning)
- Persisted versioning (schema version field)
- Migration compatibility (migration system, tests)
- Load-time validation (type, range, enum checks)
- Persistence tests (all edge cases)

**Out of Scope**:
- UI for migration
- Cloud sync
- Backup/restore from cloud
- Undo/redo (separate system)

---

## Next Steps

1. Add schema version field to SceneState and AutoSaveState
2. Implement validation functions for load-time
3. Create migration registry and system
4. Expand field coverage (identify all fields to persist)
5. Create comprehensive test suite (storage-persistence.test.ts)
6. Document versioning and migration policies

---

**End of Critical Review: Save/Load and Migration**
