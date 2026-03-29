# Phase 1: Export Pipeline Audit Report

**Status**: Complete
**Date**: 2026-03-29
**Scope**: Full export pipeline analysis (exportUtils.ts, AppState, type definitions, manifest structure)

---

## Executive Summary

The Titan export pipeline has **significant gaps in coverage, validation, and completeness**. The current implementation:
- Exports only a subset of scene data (models, basic lighting, layers, camera)
- Lacks validation before export (manifests can contain invalid data)
- Has a loose manifest structure with many optional fields and weak assumptions
- Provides no preflight checks to catch common export failures
- Cannot be fully trusted by downstream consumers due to incomplete data and missing error handling

---

## Section 1: Currently Exported Data

### 1.1 What IS Being Exported

**Model Data** (per-model in assets array):
- `id`, `name`, `type` (model|environment|light|camera)
- `layerId` - which layer the model belongs to
- `visible`, `locked` - visibility and edit state
- `file` - path to exported model file (GLB/OBJ/original)
- **Transform**: position [x, y, z], rotation [x, y, z], scale [x, y, z]
- **Material**: wireframe, lightIntensity, castShadow, receiveShadow, texture path
- **Material Properties**: color, opacity, roughness, metalness, emissiveColor
- **Material Preset**: presetId, presetName (if applied)
- `metadata` - empty object (TODO in code)
- `parent` - always null (hardcoded)
- `version` - always 1

**Scene-Level Data**:
- **Lighting**: ambient intensity, hemisphere (intensity/color/groundColor), directional (intensity/position), shadowSoftness
- **Environment**: presetId, presetName, environmentPreset string, exposure, toneMapping
- **Grid**: gridReceiveShadow
- **Camera**: CameraSettings (if provided in options)
- **Layers**: Array of Layer objects (if provided in options)

**Files**:
- Original model files (if format='original')
- GLB exports (if format='glb')
- OBJ exports (if format='obj')
- Texture files (if includeTextures=true)
- scene-manifest.json

---

## Section 2: Scene Data NOT Being Exported (Critical Gaps)

### 2.1 Prefab System (Complete Gap)
**In AppState**: `prefabs: Prefab[]`
**Exported**: Nothing

- Prefab definitions are not exported
- Prefab instance relationships lost (prefabId, prefabInstanceId, isPrefabRoot, overriddenProperties)
- Prefab category, thumbnail, tags, metadata all missing
- Models contain prefab references but prefabs themselves are unrecoverable post-export

**Impact**: Downstream consumer cannot reconstruct prefab structure or understand asset organization.

### 2.2 Behavior Tags (Incomplete Export)
**In Model**: `behaviorTags?: string[]`
**Exported**: Only 'Export-Sensitive' recognized (warns, doesn't export)

- 'Decorative', 'Structural', 'Clickable', 'Gameplay-Critical', etc. are all lost
- Export-Sensitive flag is tracked but not persisted for all models
- No way for consumers to understand asset role or purpose

**Impact**: Consumers lose critical behavioral metadata needed for game/app integration.

### 2.3 Paths/Splines (Complete Gap)
**In AppState**: `paths: Path[]`
**Exported**: Nothing

- Path definitions (walkways, roads, barriers, guides) completely missing
- Control points and path properties (type, width, materialId) not exported
- Path metadata lost

**Impact**: Cannot reconstruct navigation, barriers, or decorative spline structures.

### 2.4 Collision Zones (Complete Gap)
**In AppState**: `collisionZones: CollisionZone[]`
**Exported**: Nothing

- Zone definitions (ground_surface, floor, no_placement, water, etc.) missing
- Zone rules (allowedTags, blockedTags, allowedCategories, blockedCategories) missing
- Zone geometry (position, rotation, scale, shape) missing
- Editor visualization (color, visible) missing

**Impact**: Consumers cannot validate asset placement rules, enforce zones, or reconstruct level design constraints.

### 2.5 Terrain Data (Complete Gap)
**In AppState**: `terrain: TerrainData`
**Exported**: Nothing

- Height maps not exported
- Material maps not exported
- Terrain size/resolution not exported

**Impact**: Terrain system is completely unrecoverable post-export.

### 2.6 Camera Presets and Paths (Incomplete Export)
**In AppState**:
- `cameraPresets: CameraPreset[]`
- `cameraPaths: CameraPath[]`
- `activeCameraPresetId`, `activeCameraPathId`

**Exported**: Only the current camera settings (if provided in options)

- Camera preset library lost
- Camera paths (with keyframes, timing, interpolation) lost
- Active camera selection not exported
- Camera categories and names lost

**Impact**: Consumers cannot access saved camera states or recreate camera animations.

### 2.7 Parent-Child Relationships (Always Lost)
**In Model**: `parentId?, childrenIds?`
**Exported**: `parent` field always null

- All hierarchical relationships are flattened
- No way to reconstruct object groups or hierarchies
- Import process cannot rebuild parent-child chains

**Impact**: Models arrive as flat list; assembly structure is lost.

### 2.8 Material Library (Partially Lost)
**In Hook**: `useMaterialLibrary()` provides MaterialPreset[]
**Exported**: Only preset ID/name if material is applied to a model

- Material presets not exported as a library
- Models without materials lose all context
- Unused materials in library disappear
- Material categories, texture maps completeness unclear

**Impact**: Cannot rebuild material palette or understand full material system.

### 2.9 Quality Settings and Performance Metrics (Complete Gap)
**In AppState**:
- `activeProfileId: string`
- `customProfile: QualitySettings`

**Exported**: Nothing

- Active quality profile lost
- Custom profile settings lost
- Performance optimization recommendations lost

**In Model**: `performanceMetrics?: AssetMetrics`
**Exported**: Not in manifest

**Impact**: Consumers cannot understand or respect performance constraints.

### 2.10 Model Classification and Type Data (Incomplete)
**In Model**:
- `classification?: 'indoor' | 'outdoor' | 'both'`
- `behavior?: 'static' | 'movable' | 'decorative' | 'environment' | 'gameplay-critical'`
- `assetId?: string` - reference to original asset

**Exported**:
- type: exported (model|environment|light|camera) but inconsistent with behavior field
- classification: NOT exported
- behavior: NOT exported
- assetId: NOT exported

**Impact**: Consumers cannot understand asset role or semantic meaning.

### 2.11 Texture and Normal Maps (Incomplete)
**In Model**:
- `textureUrl`, `textureFile`
- `normalMapUrl`, `normalMapFile`

**Exported**:
- Only textureFile exported (if includeTextures=true)
- normalMapUrl/normalMapFile NOT exported
- Other texture maps (roughness, metalness, emissive, alpha) NOT exported

**Impact**: Advanced material mapping is completely lost.

### 2.12 Model Hierarchy Metadata (Incomplete)
**In Model**: `colorTint?: string` - tint applied to model
**Exported**: As `color` in material (ambiguous with color property)

- Distinction between colorTint and actual material color is lost
- Consumers cannot tell if color came from material or tint

**Impact**: Color interpretation is ambiguous and error-prone.

---

## Section 3: Manifest Structure Defects (Loose Contract)

### 3.1 Too Many Optional Fields
The ExportAssetManifest has these optional/conditional fields:
- `layerId?` - models may not know their layer
- `file?` - models without files exported
- `metadata?` - currently empty
- `parent?` - always null
- Material fields (color, opacity, roughness, etc.) - conditional on whether material exists
- `exportSensitiveModels?` - only present if there are any

**Problem**: No way to distinguish between "field not applicable" vs. "field missing due to error" vs. "field present with null/undefined value".

### 3.2 Version Field is Meaningless
- Always set to `1` in code
- No versioning strategy
- Cannot detect schema changes or incompatibilities

**Problem**: Manifest version is not trustworthy.

### 3.3 Metadata Field is Unused
- Declared in manifest
- Always exported as empty `{}`
- TODO comment indicates it was never implemented

**Problem**: Extensibility point exists but is broken.

### 3.4 Parent/Child Hierarchy Impossible to Recover
- Parent always exported as `null`
- childrenIds not exported at all
- No flattening rules documented

**Problem**: Any hierarchical structures are permanently lost.

### 3.5 Transform Data Lacks Validation Context
- Exported as raw arrays [x, y, z]
- No constraints on values (NaN, Infinity, bounds)
- No documentation of coordinate system, units, or axis orientation

**Problem**: Downstream consumer must guess correctness; rotations could be Euler or quaternion; scale could be negative.

### 3.6 Material Data Has Conflicting Sources
- Can come from `model.material` preset (presetId, presetName)
- Can come from direct model properties (colorTint, opacity, roughness, etc.)
- Export code tries to merge both but may leave gaps

**Problem**: Unclear which source of truth to trust; merging logic is error-prone.

### 3.7 Export-Sensitive Flag Semantic Mismatch
- Models can be tagged 'Export-Sensitive'
- Warning is logged but flag is persisted
- No guidance on how consumer should handle this

**Problem**: Flag provides no actionable information.

### 3.8 Layer Array Has No Context
- Layers exported if provided in options
- But layer definitions may not match current layer state
- No way to validate that models' layerId values actually exist in the exported layers array

**Problem**: Models can reference non-existent layers.

---

## Section 4: Validation Gaps (Silent Failures)

### 4.1 No Preflight Validation
Before export starts, the system does NOT check:
- Whether all selected models have valid IDs
- Whether transforms contain valid numbers (NaN, Infinity)
- Whether material references are resolvable
- Whether layer IDs in models actually exist
- Whether parent IDs are valid
- Whether the export will result in valid geometry

**Impact**: Bad data silently passes through to the manifest.

### 4.2 No Transform Validation
- Position/rotation/scale are copied directly without checks
- Can be NaN, Infinity, or negative scale
- Rotation could be in degrees or radians (not documented)
- No upper/lower bounds enforced

**Scenario**: Model with `position: [NaN, Infinity, -1000]` would export successfully but be unusable.

### 4.3 No Material Validation
- Material preset ID might not exist
- Color strings not validated (could be malformed hex)
- Roughness/metalness could be < 0 or > 1
- Opacity could be < 0 or > 1

**Scenario**: `{ color: "not-a-hex", opacity: 999.5 }` exports without error.

### 4.4 No Texture Path Validation
- Texture file path assumed correct
- No verification that file actually exists in ZIP
- No MIME type checking

**Scenario**: Texture path could be garbage; consumers get 404.

### 4.5 No Asset Completeness Check
- Can export models missing required fields (id, name, type)
- Can export models with empty names
- No check that at least one model is selected for export

**Scenario**: Export with `selectedIds: []` succeeds and creates empty manifest.

### 4.6 No Metadata Consistency Checks
- Camera settings accepted without validation if provided
- Could contain invalid FOV, near/far planes, positions

**Scenario**: `{ fov: -1, near: -100, far: 50 }` in manifest.

### 4.7 No Error Handling
- Export function is async but has no try-catch
- ZIP generation could fail silently
- Exporter failures (GLTFExporter, OBJExporter) not caught

**Scenario**: If file writing fails, user gets silent failure with no feedback.

---

## Section 5: Weak Assumptions and Missing Contracts

### 5.1 Assumption: Three.js Scene is Synchronized
- exportScene() expects threeScene to contain objects with userData.id matching model.id
- If scene is out of sync, exports silently skip geometry (modelFilePath becomes "")
- No validation that objects exist before export

**Danger**: Scene desynchronization could produce incomplete exports without warning.

### 5.2 Assumption: Model.file is Valid
- If format='original', code assumes model.file exists and can be read
- No null check before accessing .name property

**Danger**: If file is undefined, export crashes with TypeError.

### 5.3 Assumption: Exporter Callbacks Work
- GLTFExporter and OBJExporter callbacks assumed to fire
- Promise never rejects if parsing fails
- Timeout not implemented

**Danger**: Export could hang indefinitely.

### 5.4 Assumption: Material Preset Data is Fresh
- Material data copied from model.material object
- If material object is later deleted from library, export still has stale data
- No consistency check

**Danger**: Manifest contains outdated material information.

### 5.5 Assumption: Export Options are Complete
- selectedIds could be empty
- format is trusted without enum validation
- includeTextures/includeMaterials assumed boolean

**Danger**: Invalid options could silently produce bad exports.

---

## Section 6: What Could Cause Bad Exports

### Critical Export Failure Points

| Issue | Severity | Current Handling | Risk |
|-------|----------|------------------|------|
| Model with NaN position | HIGH | No validation | Exports broken geometry |
| Missing texture file referenced | MEDIUM | No verification | Consumer gets broken link |
| Material preset doesn't exist | MEDIUM | No validation | Consumer loses material data |
| Parent model not in selectedIds | HIGH | No checking | Orphaned models in export |
| Layer ID doesn't exist | MEDIUM | No validation | Reference to non-existent layer |
| Three.js sync mismatch | HIGH | Silent skip | Incomplete geometry export |
| Model file is undefined | CRITICAL | No null check | Crash on .name access |
| Exporter parse() fails | CRITICAL | No error handling | Silent hang or failure |
| Empty transform vectors | HIGH | No validation | Invalid geometry |
| Color string malformed | MEDIUM | No format check | Bad material in export |

---

## Section 7: Downstream Consumer Trust Issues

A downstream consumer receiving a Titan export cannot reliably:

1. **Reconstruct scene structure** - parent/child relationships flattened, prefabs gone
2. **Understand asset roles** - behavior tags lost, classification lost, metadata empty
3. **Validate data correctness** - transform values not validated, material data incomplete
4. **Apply collision rules** - collision zones completely missing
5. **Navigate the space** - paths and splines completely missing
6. **Use camera systems** - only current camera, presets and paths missing
7. **Optimize performance** - quality settings and metrics missing
8. **Extend with metadata** - metadata field is empty stub
9. **Trust material fidelity** - material sources conflicting, advanced maps missing
10. **Verify completeness** - no validation that export is complete or correct

---

## Summary: Export Pipeline Health

### Coverage Score: 25%
- Models and basic transforms: ✓ Covered
- Materials (basic): ✓ Covered
- Lighting: ✓ Covered
- Layers: ✓ Covered
- Camera: ✓ Covered (current only)
- Prefabs: ✗ **Missing**
- Paths/Splines: ✗ **Missing**
- Collision Zones: ✗ **Missing**
- Terrain: ✗ **Missing**
- Behavior Tags: ✗ **Missing** (except Export-Sensitive warning)
- Camera Presets/Paths: ✗ **Missing**
- Quality Settings: ✗ **Missing**
- Advanced Materials: ✗ **Missing**
- Parent-Child Hierarchy: ✗ **Always Lost**
- Metadata: ✗ **Empty Stub**

### Validation Score: 5%
- Transform validation: ✗ **None**
- Material validation: ✗ **None**
- Texture validation: ✗ **None**
- Asset completeness: ✗ **None**
- Layer reference checking: ✗ **None**
- Preflight checks: ✗ **None**
- Error handling: ✗ **None**

### Trustworthiness Score: 20%
- Manifest schema: Loose, too many optionals
- Version field: Meaningless
- Data consistency: No checks
- Consumer guidance: Minimal
- Error reporting: Silent failures

---

## Recommendations for Phase 2+

1. **Tighten manifest schema** - make fields explicit, distinguish required vs optional
2. **Add validation layer** - preflight checks for all exported data
3. **Extend coverage** - implement missing systems (prefabs, paths, zones, terrain)
4. **Implement error handling** - catch and report export failures
5. **Add consumer guidance** - document manifest contract, guarantees, versioning strategy
6. **Complete metadata system** - make metadata field useful
7. **Validate transforms** - ensure position/rotation/scale are valid
8. **Validate materials** - ensure all material data is consistent and complete

---

**End of Phase 1 Audit**
