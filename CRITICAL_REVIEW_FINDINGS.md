# Critical Review of Export Pipeline - Deep Dive Findings

**Date**: 2026-03-29
**Status**: Issues Found - Actionable Fixes Available
**Severity**: Medium (data loss, loose validation, implicit assumptions)

---

## Executive Summary

While the export pipeline has comprehensive validation and testing, a critical review identified 7 categories of issues that should be tightened:

1. **Manifest fields still too loose** - Material maps incomplete, metadata hardcoded empty
2. **Editor state being dropped silently** - Material presets, custom metadata, other texture maps
3. **Malformed data slipping through** - Model names with special chars in filenames, untrusted editor state
4. **Validation too shallow** - Systems like prefabs/paths/zones not validated before export
5. **Tests lacking unhappy paths** - No tests for malformed material colors in fallback, invalid names
6. **Warning/error boundaries unclear** - Invalid colors are warnings but still used as fallback
7. **Editor-only exclusions accidental** - Export-Sensitive handling implicit, not explicit validation

---

## Issue Category 1: Manifest Fields Too Loose/Incomplete

### Issue 1.1: Material Maps Severely Incomplete
**Location**: `src/utils/exportUtils.ts:210-214`

**Problem**:
```typescript
const materialMaps: StrictMaterialMaps | undefined = (
  model.normalMapUrl || model.normalMapFile
) ? {
  normalMap: model.normalMapUrl || undefined,  // ← ONLY normalMap extracted
} : undefined;  // ← Other maps defined in schema are IGNORED
```

**Impact**: High
- Schema defines: normalMap, roughnessMap, metalnessMap, emissiveMap, alphaMap, aoMap
- Actually exported: Only normalMap (if any)
- 5 texture maps silently dropped even if present in editor

**Evidence**:
- StrictMaterialMaps schema line 122-129 defines all 6 maps
- Manifest building line 210-214 only extracts normalMap
- Downstream consumers will assume missing maps don't exist

**Root Cause**: Incomplete implementation - Phase 3 added schema but didn't extract all maps from editor

---

### Issue 1.2: Metadata Always Empty, Never Exported
**Location**: `src/utils/exportUtils.ts:245`

**Problem**:
```typescript
metadata: {},  // ← Always empty, ignores model.metadata
```

**Impact**: Medium
- StrictExportAssetManifest.metadata schema allows `Record<string, any>`
- Editor models may have custom metadata
- All custom metadata silently dropped
- No indication that it was lost

**Evidence**:
- Schema allows metadata on every asset (line 158)
- Export hardcodes empty object (line 245)
- No validation or warning for non-empty metadata

**Root Cause**: Placeholder implementation, never updated

---

### Issue 1.3: Material Preset References Stored But Never Validated
**Location**: `src/utils/exportUtils.ts:205-206`

**Problem**:
```typescript
presetId: model.material?.id,
presetName: model.material?.name,
```

**Impact**: Low-Medium
- Preset IDs/names stored without validation they exist
- Downstream consumer gets stale references
- No way to detect if preset was deleted after export
- No validation that presetId/Name are consistent with material properties

**Root Cause**: Stored for reference but no validation/documentation of expected behavior

---

## Issue Category 2: Editor State Being Dropped Silently

### Issue 2.1: Model Names with Special Characters in Filenames
**Location**: `src/utils/exportUtils.ts:143, 180, 186`

**Problem**:
```typescript
// Line 143
const filename = `${model.id}_${model.name}`;

// Line 180
const filename = `${model.id}_${model.name.split('.')[0]}.glb`;

// Line 186
const filename = `${model.id}_${model.name.split('.')[0]}.obj`;
```

**Risks**:
- Model name could contain: `../`, `\`, `/`, `\x00` (path traversal)
- Model name could contain: `:`, `*`, `?`, `"`, `<`, `>` (invalid in filenames)
- Model name could contain unicode that ZIP doesn't handle well
- File overwriting if two models have same name

**Evidence**:
- No sanitization of model.name before filename use
- No validation in preflight of filename-safe names
- ZIP will either fail or create malformed entries

**Root Cause**: Assumption that editor enforces valid names (but it doesn't)

---

### Issue 2.2: Transform Data Never Validated Before Export
**Location**: `src/utils/exportUtils.ts:235-239`

**Problem**:
```typescript
transform: {
  position: model.position,      // ← No type check, could be undefined, null, wrong format
  rotation: model.rotation,      // ← Directly from editor, not validated
  scale: model.scale,            // ← Could be [1] or [1, 1] instead of [x, y, z]
},
```

**Impact**: High
- Manifest validation will reject, but manifest is built after this point
- Data transferred without verification
- If preflight validation missed edge case, invalid data written to ZIP

**Evidence**:
- Preflight validates position/rotation/scale (ExportPreflightValidation.ts)
- But asset building trusts editor state directly
- If model bypassed preflight somehow, manifest building happens anyway

**Root Cause**: Assumption that preflight validation is sufficient

---

### Issue 2.3: Material Color Fallback Chain Can Export Invalid Color
**Location**: `src/utils/exportUtils.ts:199`

**Problem**:
```typescript
color: model.material?.color ?? model.colorTint ?? '#ffffff',
```

**Risks**:
- If both model.material?.color and model.colorTint are invalid hex (e.g., "red")
- Preflight validates and warns about colorTint
- But doesn't validate model.material?.color
- Fallback chain could still end up with invalid color
- Manifest validation would catch it, but data flow is implicit

**Evidence**:
- Preflight only checks model.colorTint (line 180)
- Doesn't check model.material?.color
- Editor could have invalid color in material object

**Root Cause**: Incomplete preflight validation + implicit fallback assumptions

---

## Issue Category 3: Malformed Scene Data Slipping Through

### Issue 3.1: System Data Not Validated Before Export
**Location**: `src/utils/exportUtils.ts:259-295`

**Problem**:
```typescript
// Paths - directly mapped, no validation
const exportPaths = options.paths?.map(p => ({
  id: p.id,           // ← Not validated
  name: p.name,       // ← Not validated
  type: p.type,       // ← Not validated enum
  closed: p.closed,   // ← Not validated boolean
  width: p.width,     // ← Not validated > 0
  points: p.points.map(pt => ({  // ← Points not validated
    id: pt.id,        // ← Not validated
    position: pt.position,  // ← Not validated array
  })),
}));

// Same for zones, terrain, camera presets, camera paths - all direct mapping
```

**Impact**: High
- Preflight validates top-level references but NOT internal structure
- validatePathExport exists but is never called
- Invalid paths/zones/cameras silently make it to ZIP
- Manifest validation would catch them, but only after asset building

**Evidence**:
- ExportPreflightValidation.ts has NO validation for paths, zones, terrain, etc.
- System validators exist (validatePathExport, validateCollisionZoneExport) but unused in preflight
- Only asset validators called in preflight

**Root Cause**: Preflight only validates models, not systems. Systems validated in manifest, not preflight.

---

### Issue 3.2: Terrain Data Not Validated at All
**Location**: `src/utils/exportUtils.ts:298`

**Problem**:
```typescript
const exportTerrain = options.terrain;  // ← Directly exported, no transformation
```

**Risks**:
- Terrain could have invalid heightMap (not 2D array)
- materialMap could be malformed
- size/resolution could be invalid
- No validation in preflight OR in pipeline

**Evidence**:
- validateTerrainExport exists but is never used in preflight
- Terrain passed directly to manifest
- No validation until manifest validation time

**Root Cause**: System validators created but not integrated into preflight

---

## Issue Category 4: Validation Too Shallow

### Issue 4.1: Preflight Only Validates Models, Not Systems
**Location**: `src/services/ExportPreflightValidation.ts:425-463`

**Problem**:
```typescript
// runPreflightValidation validates:
// - Model selection
// - Each model's data
// - Cross-references for models

// But does NOT validate:
// - Prefab structure (only cross-refs)
// - Path structure
// - Zone structure
// - Terrain structure
// - Camera preset structure
// - Camera path structure
// - Quality settings structure
```

**Impact**: Medium
- System validators exist but aren't called in preflight
- Systems only validated during manifest validation (late)
- Error messages don't distinguish system errors from asset errors

**Evidence**:
- validatePrefabReferences checks only "models exist in export"
- Doesn't call validatePrefabExport
- validatePathExport, validateCollisionZoneExport, etc. never called

**Root Cause**: Preflight focused on assets, systems added later but not integrated

---

### Issue 4.2: No Validation of Filename Safety
**Location**: `src/utils/exportUtils.ts:143, 180, 186`

**Problem**:
- Model names with special characters become invalid filenames
- No sanitization, no validation warning
- File I/O could fail or create corrupted ZIP

**Root Cause**: Assumption that editor enforces valid names

---

### Issue 4.3: No Validation of Material Property Consistency
**Location**: `src/utils/exportUtils.ts:193-207`

**Problem**:
```typescript
// Material could have:
// - Valid color in model.colorTint
// - Invalid color in model.material?.color
// - One is validated, other isn't
// Fallback chain hides the issue
```

**Root Cause**: Validation focused on individual fields, not consistency

---

## Issue Category 5: Tests Only Cover Happy Paths

### Issue 5.1: No Tests for Malformed Material Colors in Fallback
**Location**: Test suite

**Missing Tests**:
- Model with both model.material?.color (invalid) and model.colorTint (invalid)
- Model with invalid color in fallback chain
- Special case: empty string for color

**Impact**: Low-Medium
- Happy path tested: "colorTint is invalid, use default"
- Missing: "Both sources invalid, what happens?"

---

### Issue 5.2: No Tests for Model Names with Special Characters
**Location**: Test suite

**Missing Tests**:
- Model name with `../` (path traversal)
- Model name with `\`, `/`, `:`, `*`, `?`, `"`, `<`, `>`
- Model name with null bytes
- Model name with very long names (>256 chars)

**Impact**: Medium
- Could cause file I/O errors
- Could corrupt ZIP entries
- No test coverage for these scenarios

---

### Issue 5.3: No Tests for Invalid System Data
**Location**: Test suite

**Missing Tests**:
- Path with invalid width (zero, negative)
- Zone with invalid scale
- Camera with negative FOV
- Terrain with malformed heightMap
- Quality settings with invalid values

**Impact**: Medium
- Systems not validated in preflight
- Only caught at manifest validation time
- No specific tests for these failures

---

### Issue 5.4: No Tests for Filename Conflicts
**Location**: Test suite

**Missing Tests**:
- Two models with same name → filename collision
- Model name that becomes empty after special char removal
- Model name with extension that conflicts with generated extension

**Impact**: Low-Medium
- Could lose data in ZIP (silent overwrite)
- No test coverage

---

## Issue Category 6: Warning/Error Boundaries Unclear

### Issue 6.1: Invalid Material Color is Warning, But Still Used
**Location**: `src/services/ExportPreflightValidation.ts:180-191` and `src/utils/exportUtils.ts:199`

**Problem**:
```typescript
// Preflight says: WARNING, invalid color format
// Will use default

// But then exportUtils does:
color: model.material?.color ?? model.colorTint ?? '#ffffff',
// This could use the invalid color if both are present
```

**Ambiguity**:
- Is "invalid color format" a blocking error or warning?
- If warning, should it still be used in export?
- If used, why warn?
- If not used, should default to white?

**Current Behavior**:
- Preflight warns
- Export uses fallback (possibly to white)
- Unclear if actual export uses the warned value or default

**Root Cause**: Validation and export happen at different times, no state passed between them

---

### Issue 6.2: Missing Parent Reference is Warning, But Child Is Exported
**Location**: `src/services/ExportPreflightValidation.ts:275-295`

**Problem**:
```typescript
// Preflight warns: "Model X references non-existent parent Y"
// Severity: warning
// Recovery: "Clear parent relationship"

// But in manifest:
parent: model.parentId || null,  // ← Exported as-is, warning not applied
```

**Ambiguity**:
- If parent is missing, should parent be exported as missing ID?
- Or should parent be set to null as recovery suggests?
- Currently exported as-is (potentially invalid)

**Root Cause**: Recovery suggestion not applied during export

---

## Issue Category 7: Editor-Only Exclusions Accidental, Not Explicit

### Issue 7.1: Export-Sensitive Implicit, Not Validated
**Location**: `src/utils/exportUtils.ts:253-255`

**Problem**:
```typescript
const exportSensitiveModelIds = modelsToExport
  .filter(m => (m.behaviorTags || []).includes('Export-Sensitive'))
  .map(m => m.id);
```

**Issues**:
- 'Export-Sensitive' tag is implicit, not validated
- No preflight check for what this means
- No validation that sensitive models need special handling
- Downstream consumer may not know about this convention

**Root Cause**: Convention documented in code comment, not explicit validation

---

### Issue 7.2: Editor-Only Fields Not Explicitly Excluded
**Location**: Multiple locations

**Problem**:
- Model could have editor-only fields (e.g., isSelected, isDragging)
- These aren't intentionally excluded
- They're just not mentioned in asset building
- If editor adds new field, it silently gets dropped

**Root Cause**: Inclusion list (what to export), not exclusion list (what not to export)

**Risk**: Silent data loss if editor structure changes

---

### Issue 7.3: Metadata Placeholder Not Documented
**Location**: `src/utils/exportUtils.ts:245`

**Problem**:
```typescript
metadata: {},  // ← Placeholder, not implemented
```

**Issue**:
- No documentation that metadata is not currently exported
- No validation warning that metadata is dropped
- Downstream consumer expects metadata support (schema allows it)

**Root Cause**: Feature incomplete, no tracking

---

## Issue Category 8: Data Flow Assumptions Not Documented

### Issue 8.1: No Contract Between Preflight and Export
**Location**: Entire pipeline

**Problem**:
- Preflight validation warns but doesn't modify data
- Export assumes warned data is handled correctly
- But recovery suggestions from preflight aren't applied

**Example**:
```
Preflight: "Color invalid, will use default"
Export: Uses color ?? fallback (might not be white)
```

**Root Cause**: Validation and export are separate phases without contract

---

### Issue 8.2: Manifest Validation Happens After Asset Building
**Location**: `src/utils/exportUtils.ts:325-326`

**Problem**:
```typescript
// ─── PHASE 2: BUILD MANIFEST ─────────────────────────────────────────
// ... build assets and systems ...

// ─── PHASE 3: VALIDATE MANIFEST ──────────────────────────────────────
const validatedManifest = validateExportManifest(manifest);
```

**Risk**:
- Asset building happens before validation
- If validation fails, assets already built (wasted work)
- No schema validation happens during asset building
- Material objects could be malformed

**Better Pattern**:
- Validate each system as it's built
- Fail fast before building subsequent systems

**Root Cause**: Validation at end rather than incremental

---

## Summary Table of Issues

| Issue | Category | Severity | Impact | Fix Difficulty |
|-------|----------|----------|--------|-----------------|
| Material maps incomplete | 1.1 | High | Data loss | Medium |
| Metadata always empty | 1.2 | Medium | Data loss | Low |
| Preset refs not validated | 1.3 | Low | Stale refs | Low |
| Special chars in names | 2.1 | High | File errors | Medium |
| Transform data not validated | 2.2 | High | Invalid export | Low |
| Color fallback chain | 2.3 | Medium | Implicit behavior | Medium |
| Systems not validated in preflight | 3.1 | High | Invalid data | Medium |
| Terrain not validated | 3.2 | High | Invalid data | Low |
| Preflight shallow | 4.1 | Medium | Late error | Medium |
| No filename validation | 4.2 | High | File errors | Low |
| No fallback consistency | 4.3 | Medium | Implicit behavior | Medium |
| Missing happy path tests | 5.1-5.4 | Medium | Coverage gaps | Low |
| Warning boundaries unclear | 6.1-6.2 | Medium | Ambiguous behavior | Medium |
| Export-Sensitive implicit | 7.1 | Medium | Silent convention | Low |
| Editor fields not excluded | 7.2 | Medium | Possible data loss | Medium |
| Metadata placeholder | 7.3 | Medium | Feature incomplete | Low |
| No preflight/export contract | 8.1 | Medium | Data flow ambiguity | Medium |
| Late validation | 8.2 | Low | Efficiency | Low |

---

## High-Priority Fixes Needed

1. **Material maps**: Extract all defined texture maps from editor
2. **Filename safety**: Sanitize or validate model names before file operations
3. **System validation**: Call system validators in preflight, not just during manifest validation
4. **Recovery application**: Apply preflight recovery suggestions during export
5. **Metadata export**: Implement metadata export or remove from schema
6. **Tests**: Add tests for unhappy paths and edge cases

---

## Medium-Priority Improvements

1. **Consistency validation**: Validate material property consistency
2. **Documentation**: Explicit contracts between validation and export
3. **Incrementalvalidation**: Validate each system as built, not at end
4. **Explicit exclusions**: Document which editor fields are intentionally not exported

---

## Next Steps

These issues should be addressed in a "Tightening Phase" that:
1. Closes data loss gaps (material maps, metadata)
2. Tightens validation (systems, filenames, consistency)
3. Clarifies behavior (warning/error boundaries, recovery application)
4. Adds test coverage (unhappy paths, edge cases)

All within scope of export pipeline hardening, manifest validation, and preflight safety.

---

**End of Critical Review**
