# TypeScript Debt Baseline & Cleanup Report (Phase: Core Safety Pass)

Date: 2026-03-29

## 1) Baseline capture (before fixes)

Repo-wide command:

- `npm run lint -- --pretty false`

Initial result:

- **1 TypeScript compiler error**
- Error: missing declaration for `react-dom/client` in `src/main.tsx`.

Raw baseline error:

```text
src/main.tsx(2,26): error TS7016: Could not find a declaration file for module 'react-dom/client'.
```

---

## 2) Subsystem classification snapshot

I grouped both hard compiler failures and structural weak-typing hotspots.

### Hard compiler failures (blocking)

- **App shell bootstrap**: missing module declaration for ReactDOM client import.

### Structural debt hotspots (`any`/weak contract density)

- **project/session/import/activation**: 4
- **export/import/persistence**: 138
- **SWIM26 runtime/sync**: 24
- **screenshot/tooling**: 0
- **UI/hooks/coordinators**: 38

These counts are pattern-density indicators (not compiler errors) used to prioritize cleanup.

---

## 3) High-risk cleanup completed in this pass

Priority order used for implemented cleanup:

1. project/session/import/activation
2. high-value UI/hooks/coordinators
3. shared GitHub response guards (import path safety)

### Implemented

- Added local declaration for `react-dom/client` to remove repo-wide TS blocking failure.
- Replaced weak `any` contracts in GitHub import flow:
  - `ImportPreparationResult.guidance` now strongly typed via `ReturnType<typeof getProjectSelectionGuidance>`.
  - `useGitHubImport.prepareImport` now returns `Promise<ImportPreparationResult | null>` instead of `Promise<any>`.
  - `GitHubImportModal` preview/result callback typing tightened (`ImportPreparationResult`, `LoadedSceneData`).
- Improved shared GitHub API response guards to reduce unsafe `any` parsing:
  - strict payload narrowing for repo metadata and directory listing responses.
  - explicit error path for malformed API shapes.

---

## 4) Repeated weak patterns reduced

- Reduced `any` in import orchestration contracts.
- Replaced unchecked JSON cast patterns in GitHub connector with shape guards.
- Removed modal-level `any` state for import preview data.

---

## 5) Shared guard/type improvements

- Added reusable object/payload guards in `GitHubConnector`:
  - `isObjectRecord`
  - `isGitHubRepoApiPayload`
  - `isGitHubDirectoryEntryPayload`

These centralize GitHub response validation and prevent unsafe structural assumptions.

---

## 6) Before/after debt report

### Compiler baseline

- Before: **1 error**
- After: **0 errors**

### Structural debt

- Still present in export/import/persistence and some UI/hooks/runtime surfaces.
- This pass focused on highest-risk import/activation safety and repo-wide compiler baseline.

---

## 7) Remaining debt

### Deferred (explicit)

- Large remaining `any` usage in:
  - export/preflight/manifest validation services
  - persistence repair/validation services
  - plugin bridge scene typing surfaces

### Must-fix next

- Introduce stronger shared model/scene contracts for export/persistence pipeline.
- Replace `any`-based plugin scene bridge contracts with typed patch/result envelopes.
- Continue narrowing JSON parse sites (`unknown` + guards) in SWIM26 import/runtime services.

---

## 8) Validation rerun

- `npm run lint -- --pretty false` → pass
- workflow sanity runs (tests) passed after cleanup.

---

## 9) Workflow sanity-check coverage executed

- GitHub import workflow tests
- App shell workflow tests
- Export workflow tests
- SWIM26 round-trip tests
- Screenshot runner contract tests

All executed checks passed in this pass.
