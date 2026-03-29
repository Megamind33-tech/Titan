# TypeScript Debt Baseline Report (Core Safety Baseline Refresh)

Date: 2026-03-29

## 1) Captured repo-wide baseline

Command:

- `npm run lint -- --pretty false`

Result:

- **0 TypeScript compiler errors** (`tsc --noEmit` clean).

This means current debt is predominantly **structural typing weakness** (not hard compiler blockers).

---

## 2) Subsystem classification snapshot

Pattern metric used for classification:

- `rg -n "\\bany\\b|as any|<any>" ...`

### Baseline (before this cleanup pass)

- project/session/import/activation: **1**
- export/import/persistence: **82**
- SWIM26 runtime/sync: **24**
- screenshot/tooling: **0**
- UI/hooks/coordinators: **36**

### After this cleanup pass

- project/session/import/activation: **1** (no change)
- export/import/persistence: **62** (↓20)
- SWIM26 runtime/sync: **5** (↓19)
- screenshot/tooling: **0** (no change)
- UI/hooks/coordinators: **36** (no change)

---

## 3) High-risk areas cleaned in this pass

### project/session/import/activation

- Preserved prior pass improvements:
  - typed imported-scene handoff payloads in `useGitHubProjectImport`
  - typed active-project summary contract
  - typed scene subscriber snapshot.

### export/import/persistence (focus of this pass)

- Introduced explicit structural contracts in `ExportPreflightValidation`:
  - `ExportModelLike`, `LayerLike`, `PrefabLike`, `PathLike`, `CollisionZoneLike`, `CameraPresetLike`, `ThreeSceneLike`
  - replaced repeated `any` signatures/collections and callback types
  - tightened scene traversal typing and selected-model filtering.

### SWIM26 runtime/sync

- Tightened `Swim26ManifestLoader` contracts by replacing broad `any` parsing and extraction types with:
  - `UnknownRecord`, `ManifestObject`, and typed extract/load return contracts
  - safer manifest-type narrowing and safer nested access (`safeGet` on `unknown`)
  - typed `LoadedSceneData` shapes (`environment` as unknown, typed transform payload).

---

## 4) Repeated weak patterns reduced

- Reduced repeated `any[]` state-transfer patterns in import completion.
- Replaced weak export preflight contracts with shared typed “*Like” interfaces.
- Removed broad `any` usage in export preflight traversal and validation signatures.
- Replaced broad SWIM26 manifest parsing `any` with safer unknown + narrowed contracts.

---

## 5) Before/after debt report

### Compiler baseline

- Before: **0 errors**
- After: **0 errors**

### Structural debt delta (pattern counts)

- Total across tracked subsystems:
  - Before: **143**
  - After: **104**
  - Improvement: **-39 instances** in this pass.

---

## 6) Remaining debt

### Deferred (explicit)

- export/import/persistence surfaces still carry most `any` density (`ExportPreflightValidation`, persistence repair/validation pathways).
- SWIM26 runtime/sync still has remaining weak areas in importer/sync edge handling outside manifest loader.

### Must-fix-next

1. Continue runtime/sync contract tightening in `Swim26ManifestImporter` and sync edge paths to match manifest loader strictness.
2. Reduce `any` in export/persistence validators with shared typed issue/result envelopes.
3. Continue replacing `as any` patch/update patterns in `App.tsx` prefab propagation path.

---

## 7) Repo-wide validation rerun

- `npm run lint -- --pretty false` → pass.

---

## 8) Workflow sanity-check result

Executed:

- `npx tsx --test src/tests/export-preflight-validation.unit.test.ts src/tests/imported-scene-loader.unit.test.ts src/tests/app-shell-workflows.unit.test.ts src/tests/github-import-integration.test.ts`

Result:

- pass (core import/app-shell sanity checks remained stable after typing cleanup).
