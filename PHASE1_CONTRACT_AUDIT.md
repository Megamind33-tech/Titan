# Phase 1: Save/Load Contract Audit

**Date**: 2026-03-29
**Status**: Completed
**Scope**: Formal audit of persistence contract after recent hardening work

---

## Executive Summary

This audit evaluates the save/load persistence contract after recent hardening fixes. The system has improved significantly but still has gaps and risks.

**Overall Assessment**: Medium-to-High strictness. The contract is now explicit, but some recovery behavior is still too permissive, and field coverage is incomplete.

---

## 1. What Scene State Is Currently Saved

### Primary Save Flow: `saveSceneVersion()`

**Models** (persisted):
- id, name, type
- position, rotation, scale [stored as [number, number, number]]
- visible, locked, parentId
- material properties: color, opacity, roughness, metalness, emissiveColor
- light properties: wireframe, lightIntensity, castShadow, receiveShadow
- texture map URLs (6 maps): normalMapUrl, roughnessMapUrl, metalnessMapUrl, emissiveMapUrl, alphaMapUrl, aoMapUrl
- behavioral: behaviorTags, classification, metadata
- optional fields: layerId, material (object), prefabId, etc.

**NOT persisted** (transient):
- File objects: file, textureFile, normalMapFile, roughnessMapFile, metalnessMapFile, emissiveMapFile, alphaMapFile, aoMapFile
- Blob URLs: url, textureUrl (cannot be reconstructed after page reload)

**Prefabs** (persisted):
- All fields from Prefab type (id, name, category, models[], metadata)

**Scene Settings** (persisted):
- gridReceiveShadow: boolean
- shadowSoftness: number
- environment: EnvironmentPreset (object with id, name, colors, intensities, etc.)

**Layers** (persisted):
- All Layer fields (id, name, visible, locked, color)

**Camera Settings** (persisted):
- presets: CameraPreset[]
- activePresetId: string | null
- paths: CameraPath[]
- activePathId: string | null

**Paths** (persisted):
- id, name, type, closed, width, points[], materialId

**Collision Zones** (persisted):
- id, name, type, enabled, position, rotation, scale, shape, allowedTags, blockedTags, color, exportToRuntime

**Terrain** (persisted, optional):
- All TerrainData fields

**Metadata** (persisted):
- schemaVersion: string ('2.0.0')
- versionId: string (Date.now().toString())
- timestamp: ISO string
- note: string
- changesSummary: { added, removed, edited }

### Autosave Flow: `autoSaveScene()`

**Same field preservation as saveSceneVersion()**, EXCEPT:
- NO versionId
- NO note
- NO changesSummary
- Only timestamp and schemaVersion metadata
- Latest-only (no history, replaces previous autosave)

---

## 2. What Scene State Is Currently Restored

### Manual Version Load: `loadSceneVersion(versionId)`

**Returns**: Complete SceneState with:
- All persisted models (validated post-migration)
- All system data (prefabs, layers, paths, zones, camera, terrain)
- Scene settings (validated post-migration)
- Metadata (versionId, timestamp, note, changesSummary)

**Schema Migration Applied**:
- If loaded data lacks schemaVersion, assumes 1.0.0
- Applies migration(1.0.0 → 2.0.0) if needed
- Adds schemaVersion: '2.0.0' to migrated data

**Defaults Applied for Missing Fields**:
- prefabs: [] (if undefined)
- layers: [] (if undefined)
- paths: [] (if undefined)
- collisionZones: [] (if undefined)
- cameraSettings: { presets: [], activePresetId: null, paths: [], activePathId: null } (if undefined)
- terrain: undefined (if not present, left undefined)

**Validation on Load** (non-blocking):
- Model IDs and names checked (non-empty string)
- Transform fields checked (3-element number array, finite values)
- Optional colors validated (hex format if present)
- Optional opacity validated (0-1 range if present)
- Scene settings validated (boolean, number, object fields)
- Issues logged as warnings, does NOT block load

### Autosave Load: `loadAutoSave()`

**Returns**: Complete AutoSaveState with:
- All persisted models (validated post-migration)
- All system data (prefabs, layers, paths, zones, camera, terrain)
- Scene settings (validated post-migration)
- NO metadata (no versionId, timestamp is auto-generated if missing)

**Schema Migration Applied**:
- Same as manual load (applies 1.0.0 → 2.0.0 migration)

**Defaults Applied for Missing Fields**:
- All optional fields defaulted same as manual load
- ADDITIONAL: sceneSettings fully defaulted if missing
  - gridReceiveShadow: true
  - shadowSoftness: 0.5
  - environment: DEFAULT_ENVIRONMENT

**Validation on Load** (non-blocking):
- Same as manual load
- Additional scene settings defaults if completely missing

---

## 3. What Fields Are Required vs Optional

### Explicitly Required (validation fails if missing)

**Models**:
- id (non-empty string) - BLOCKING if missing
- name (non-empty string) - BLOCKING if missing
- position (3-tuple of finite numbers) - BLOCKING if missing
- rotation (3-tuple of finite numbers) - BLOCKING if missing
- scale (3-tuple of finite numbers) - BLOCKING if missing

**SceneSettings**:
- gridReceiveShadow (boolean) - BLOCKING if missing
- shadowSoftness (finite number) - BLOCKING if missing
- environment (object) - BLOCKING if missing

### Optional but Should Exist (soft requirement, defaulted)

**Models**:
- type, visible, locked, parentId, layerId
- material properties (color, opacity, roughness, metalness, emissiveColor)
- light properties (wireframe, lightIntensity, castShadow, receiveShadow)
- behavioral (behaviorTags, classification, metadata)
- texture map URLs (6 maps, individually optional)

**Scene State**:
- prefabs, layers, paths, collisionZones, terrain, cameraSettings
- changesSummary (manual save only)

### Transient (NOT persisted, explicitly excluded)

**Models**:
- file, textureFile, normalMapFile, roughnessMapFile, metalnessMapFile, emissiveMapFile, alphaMapFile, aoMapFile (File objects)
- url, textureUrl (Blob URLs, cannot serialize)

---

## 4. What Fields Are Inconsistently Handled

### High Risk: Implicit Optional Behavior

**Problem**: Many model properties (lightIntensity, castShadow, receiveShadow, wireframe, etc.) are optional and may not be persisted if undefined at save time, but are expected at runtime.

**Current Behavior**:
- Saved only if defined at save time
- Not validated on load
- Runtime code may assume they exist
- No defaults applied on load (falls back to undefined)

**Example**:
```typescript
// At save time: model.castShadow might be undefined
// Persisted: models don't include castShadow
// At load time: No default applied
// At runtime: Code may assume castShadow exists and crash
```

**Status**: ⚠️ INCONSISTENT - Should be either:
1. Always persisted with explicit default, OR
2. Runtime code should handle undefined

### Medium Risk: Environment Preset Structure

**Problem**: `environment` is a complex nested object (EnvironmentPreset) with many optional sub-fields. Load function doesn't deeply validate this structure.

**Current Behavior**:
- Validated that environment exists as object
- No validation of nested properties
- Defaults to DEFAULT_ENVIRONMENT only if completely missing
- Partial/malformed environment not rejected

**Status**: ⚠️ INCONSISTENT - Deep validation not performed

### Medium Risk: Transform Validation Post-Load

**Problem**: Transforms validated on save and on load, but no guarantee they stay valid after migration.

**Current Behavior**:
- Validated before save (non-blocking warnings)
- Migrated (without re-validation)
- Validated post-load (non-blocking warnings)
- BUT: Migration could inject invalid transforms

**Status**: ⚠️ INCONSISTENT - Migration output not validated

### Low Risk: Texture Map URLs

**Problem**: All 6 texture maps are optional individually. Can mix present/absent map URLs without clear intent.

**Current Behavior**:
- Each URL individually optional (string | undefined)
- No requirement for consistent presence/absence
- No format validation (could be invalid URL strings)

**Status**: ⚠️ INCOMPLETE - No URL format validation

---

## 5. Where Blob/File Restoration Is Fragile

### File Objects Cannot Be Restored

**Problem**: Fundamental limitation of browser serialization.

**Current Status**:
- Explicitly documented (comment in SceneState interface)
- File objects explicitly excluded from Omit type
- Users must re-upload files after load

**Severity**: HIGH (data loss, but intentional and documented)
**Workaround**: Texture map URLs preserved; geometry files require re-upload
**Risk**: Users may be surprised that models lose their geometry file on load

### Blob URLs Cannot Be Reconstructed

**Problem**: Blob URLs (e.g., object://) are browser-specific and cannot be serialized.

**Current Status**:
- url field excluded from persistence
- textureUrl field excluded from persistence
- Texture map URLs ARE preserved instead

**Severity**: HIGH (data loss, but expected)
**Workaround**: Texture URLs provided separately for each map
**Risk**: Models with Blob-based textures (uploaded files) will lose texture data on load; users must re-upload

### Recovery Path Weak

**Current Status**:
- No fallback mechanism (models load with undefined geometry)
- UI may break if code assumes model.file exists
- No warning to user that files were lost

**Severity**: MEDIUM (affects UX, not data corruption)
**Improvement Needed**: Better user communication on load failure

---

## 6. Where Versioning Is Too Weak or Implicit

### Schema Version Is Now Explicit ✅

**Current Status**:
- schemaVersion field added to both SceneState and AutoSaveState
- Current version: '2.0.0'
- Migrations applied on load (1.0.0 → 2.0.0)

**Strength**: Good, but...

### Migration Registry Is Minimal

**Current Status**:
- Only one migration defined (1.0.0 → 2.0.0)
- Migration just adds schemaVersion field
- No transformation of actual data structure

**Problems**:
1. If data at 1.0.0 was actually persisted without schemaVersion, migration won't detect what version it actually was
2. Migration registry uses string keys, no version ordering guarantees
3. Only supports linear progression (no branching/compatibility matrix)

**Status**: ⚠️ MINIMAL - Sufficient for current needs, fragile for future expansion

### Version Ordering Not Formalized

**Current Status**:
- Hard-coded version order: ['1.0.0', '2.0.0']
- No formal versioning spec (semantic versioning implied)
- No way to reject "too old" versions

**Status**: ⚠️ IMPLICIT - No explicit version compatibility matrix

### No Version Bounds

**Current Status**:
- Code will attempt to load ANY version, applying migrations up to current
- Unknown versions logged as warning but not rejected
- Could accept malformed data as "version 0.5.0" and attempt migrations anyway

**Status**: ⚠️ UNSAFE - No validation of version number format

---

## 7. Where Older Saved Scenes Could Fail Under Newer Code

### Major Risk: Incomplete Model Properties

**Scenario**: Scene saved in old version without certain optional properties (e.g., behaviorTags, classification, metadata).

**Load Behavior**:
- Properties undefined on load
- No default values applied
- Runtime code may assume they exist and fail

**Example**:
```typescript
// Old save: model without behaviorTags
// Load: behaviorTags = undefined
// Runtime code: model.behaviorTags.includes('Export-Sensitive') → TypeError
```

**Likelihood**: HIGH
**Severity**: MEDIUM (crashes code that assumes fields exist)

### Major Risk: Missing System Data

**Scenario**: Scene saved before certain systems existed (no paths, collision zones, etc.).

**Load Behavior**:
- Missing fields defaulted to []
- Safe for load, but code must handle empty systems

**Likelihood**: MEDIUM
**Severity**: LOW (gracefully handled)

### Medium Risk: Malformed Nested Objects

**Scenario**: Environment preset malformed (missing sub-properties like hemisphereColor, directionalIntensity).

**Load Behavior**:
- Environment object exists but incomplete
- Not deeply validated
- Runtime code using specific properties may fail

**Example**:
```typescript
// Old save: environment.hemisphereColor = undefined
// Load: No error, environment object exists but property missing
// Runtime: scene.lighting.hemisphere.color → undefined (crash)
```

**Likelihood**: MEDIUM
**Severity**: MEDIUM (crashes if code assumes structure)

### Medium Risk: Transform Corruption

**Scenario**: Old data with NaN or Infinity in transforms (edge case from prior editor bugs).

**Load Behavior**:
- Validated post-load (warnings logged)
- Data NOT corrected or rejected
- Continues with invalid transforms
- Three.js rendering may fail silently or produce artifacts

**Example**:
```typescript
// Old save: position: [NaN, 0, 0]
// Load: Warning logged, but data unchanged
// Three.js: Updates object with NaN position → undefined behavior
```

**Likelihood**: LOW
**Severity**: MEDIUM (corrupt scene state)

### Medium Risk: Texture URL Invalidity

**Scenario**: Texture URLs point to external sites that no longer exist or have moved.

**Load Behavior**:
- URLs loaded as-is
- No validation of URL format or reachability
- Textures may fail to load at runtime

**Example**:
```typescript
// Old save: normalMapUrl: 'https://old-server.com/texture.png'
// Load: No error
// Runtime: fetch fails silently, texture missing
```

**Likelihood**: MEDIUM
**Severity**: LOW (visual degradation, not data corruption)

---

## 8. Where Malformed Persisted State Could Still Be Accepted Too Easily

### Critical Hole: Validation Is Non-Blocking

**Current Status**:
- Validation runs on load
- Issues logged as console.warn
- Data returned REGARDLESS of validation failures

**Example**:
```typescript
// Load data with missing model ID
validatePersistedModel(model) → { valid: false, errors: ['Model id must be a non-empty string'] }
console.warn(...errors)
// But model is still returned with empty ID
```

**Risk**: Application accepts invalid data, may crash later

**Severity**: HIGH
**Impact**: Malformed scenes load and corrupt runtime state

### Moderate Hole: No Schema-Level Validation

**Current Status**:
- validateSceneSettings checks field types
- But doesn't validate against a formal schema
- Could add new fields that don't match SceneState interface

**Example**:
```typescript
// Old save with extra fields: { ...state, customField: 'value' }
// Load: No error, extra field ignored or accepted
// SceneState: Type system allows it
```

**Risk**: Schema drift (old saves add fields newer code doesn't expect)

**Severity**: MEDIUM
**Impact**: Unexpected properties in state

### Moderate Hole: Migration Doesn't Re-Validate Output

**Current Status**:
- Migration(1.0.0 → 2.0.0) transforms data
- Transformed data NOT re-validated
- Could produce invalid output

**Example**:
```typescript
// Migration adds schemaVersion field
// But doesn't validate that models array is valid after transformation
```

**Risk**: Migration silently produces invalid state

**Severity**: MEDIUM
**Impact**: Corrupt data after migration

### Moderate Hole: Defaults Applied Without Validation

**Current Status**:
- Missing optional fields get default values
- Default values NOT validated
- DEFAULT_ENVIRONMENT could be invalid

**Example**:
```typescript
// DEFAULT_ENVIRONMENT defined somewhere else
// Load: If DEFAULT_ENVIRONMENT is malformed, it's accepted
```

**Risk**: Invalid defaults corrupt runtime state

**Severity**: LOW (defaults usually safe, but not guaranteed)

### Low Hole: Type Safety At Runtime

**Current Status**:
- TypeScript interfaces define expected structure
- Load returns `as Partial<any>` without strict type checking
- Runtime type could mismatch

**Example**:
```typescript
let state = raw as Partial<any>;  // Loses type safety
state = applyMigrations(state);   // Could return anything
return {...state, ...}            // Forced into AutoSaveState shape
```

**Risk**: Type mismatches at runtime

**Severity**: LOW (mitigated by validation)

---

## 9. Plugin Data Handling

**Current Status**: NOT PERSISTED

- No plugin data included in SceneState or AutoSaveState
- Plugin state is not validated on load
- No migration for plugin data

**Risk**: Plugins lose state on scene load/save

**Severity**: MEDIUM (out of scope for this audit, but noted)

---

## Summary Table: Persistence Contract Completeness

| Aspect | Status | Risk | Notes |
|--------|--------|------|-------|
| Schema Versioning | ✅ Explicit | Low | Version 2.0.0 explicit, but minimal migration registry |
| Model Fields | ⚠️ Partial | Medium | Core fields preserved, optional fields inconsistent |
| Material Properties | ✅ Complete | Low | All 6 texture maps preserved |
| System Data | ✅ Complete | Low | Paths, zones, cameras all preserved |
| File Objects | ⚠️ Excluded | High | Intentional, documented, but users may be surprised |
| Blob URLs | ⚠️ Excluded | High | Intentional, documented, texture URLs preserved |
| Load-Time Validation | ✅ Present | Medium | Validates but non-blocking, logs warnings |
| Migration System | ⚠️ Minimal | Medium | Only one migration, no version bounds |
| Error Boundaries | ⚠️ Unclear | Medium | Validation warnings don't prevent load |
| Defaults Application | ✅ Consistent | Low | Applied in load functions consistently |
| Malformed Data Handling | ❌ Too Permissive | Medium | Invalid data accepted, logged, but not corrected |
| Plugin Data | ❌ Not Persisted | Medium | No plugin state preservation |

---

## Critical Findings

### 1. Validation Is Non-Blocking ⚠️

**Finding**: Validation runs but doesn't prevent load. Invalid data flows into runtime.

**Consequence**: Corrupt scenes load silently, may crash later

**Example**: Model with empty ID loads successfully, crashes when code tries to reference model.id

**Recommendation**: Distinguish between:
- Blocking errors (reject load entirely)
- Recoverable warnings (load with degraded data)
- Fixable issues (auto-repair if possible)

### 2. Optional Model Fields Not Defaulted ⚠️

**Finding**: Properties like lightIntensity, castShadow, metadata persist only if defined at save time. No defaults applied on load.

**Consequence**: Runtime code may assume fields exist and fail

**Example**: Old save without castShadow → loaded model has undefined castShadow → Three.js code assumes boolean and crashes

**Recommendation**: Either:
- Always persist all optional fields with sensible defaults, OR
- Explicitly document which fields are optional and ensure runtime code handles undefined

### 3. Migration Is Minimal ⚠️

**Finding**: Only one migration (1.0.0 → 2.0.0), which only adds schemaVersion. No actual data transformation.

**Consequence**: Future schema changes may break old scenes

**Example**: If v2.1.0 adds required field, old v2.0.0 scenes lack it

**Recommendation**: Expand migration system to:
- Handle future schema changes automatically
- Apply sensible defaults for new required fields
- Validate migration output

### 4. No Format Validation for URLs ⚠️

**Finding**: Texture map URLs stored as strings without validation.

**Consequence**: Invalid URLs load silently, fail at runtime

**Example**: normalMapUrl: 'not-a-url' loads without error

**Recommendation**: Either:
- Validate URL format on load, OR
- Document that URLs are trust-on-load (assume user-provided data is valid)

### 5. Deep Structure Not Validated ⚠️

**Finding**: Nested objects like environment preset, camera presets, paths only validated at top level.

**Consequence**: Malformed nested data accepted

**Example**: environment object exists but hemisphereColor missing → runtime error when accessing property

**Recommendation**: Add deep/recursive validation for complex nested types

---

## Positive Findings

### ✅ Schema Version Explicit

SceneState and AutoSaveState both include schemaVersion field. Makes version detection possible.

### ✅ File Objects Intentionally Excluded

File and Blob objects explicitly excluded from persistence. Documented with clear rationale.

### ✅ Texture URLs Preserved

Despite file objects being excluded, texture map URLs are preserved. Better than total loss.

### ✅ Migrations Exist

Migration infrastructure in place. Foundation for handling future schema changes.

### ✅ Load-Time Validation Present

Validation runs on load, issues logged. Prevents completely undetected corruption.

### ✅ Defaults Applied

Missing optional fields get sensible defaults (empty arrays, default environment).

### ✅ Autosave and Manual Save Unified

Both use same field preservation logic. Consistent behavior.

---

## Gaps Requiring Further Work

### Gap 1: Validation Blocking Strategy

Current validation is non-blocking (logs warnings, continues). Need to decide:
- What makes a load fail completely?
- What issues are auto-recoverable?
- What requires user intervention?

### Gap 2: Optional Field Defaults

Core optional fields (castShadow, lightIntensity, behaviorTags, metadata) have no load-time defaults. Need:
- Audit which properties must exist at runtime
- Define defaults for all properties
- Apply defaults consistently

### Gap 3: Deep Schema Validation

Only top-level fields validated. Nested structures (environment, camera presets, etc.) not deeply validated. Need:
- Recursive validation for complex types
- Clear error messages for malformed nested data

### Gap 4: URL Validation

Texture URLs not validated for format or reachability. Need:
- Define what constitutes valid URL
- Validate on load or document as trust-on-load

### Gap 5: Migration Future-Proofing

Only one migration defined. Future schema versions need migration path. Need:
- Formalize version ordering (semantic versioning)
- Define version compatibility matrix
- Auto-apply defaults for new required fields

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Optional fields missing at runtime | HIGH | MEDIUM | Apply defaults on load |
| Old scenes fail under new code | MEDIUM | MEDIUM | Expand migration system |
| Malformed data corrupts runtime state | MEDIUM | HIGH | Make validation blocking where needed |
| Nested object validation fails | MEDIUM | MEDIUM | Add deep validation |
| URL format errors at runtime | LOW | LOW | Add URL validation |

---

## Conclusion

**Current State**: Persistence contract is significantly improved from pre-hardening state. Schema versioning explicit, validation present, migrations exist.

**Remaining Weaknesses**: Validation is non-blocking (allows invalid data through), optional field defaults not comprehensive, migration system minimal, nested structures not deeply validated.

**Verdict**: Medium-to-High strictness achieved. Ready for use, but needs iterative improvements as schema evolves.

**Next Steps**: Move to Phase 2 (Persistence Contract Hardening) to address identified gaps.
