# SWIM26 Manifest Import + First Live Handoff Audit

## 1) What Titan currently exports for SWIM26
- Manifest identity: `version`, `runtime`, `projectType`, `authoredBy`.
- Authored scene payload: `objects`, `environment`, `paths`.
- Object payload includes: `id`, `name`, `assetRef` (url/asset-id when available), `transform`, `material`, `tags`, `metadata`.
- Boundary metadata: `runtimeOwned`, `unsupported`.

## 2) What SWIM26 runtime importer now consumes
- Required (blocking if invalid):
  - `version: 1.0.0`
  - `runtime: babylon`
  - `projectType: swim26-babylon`
  - `authoredContent.objects[]` with valid transform vec3s.
- Optional/recoverable:
  - `assetRef` (warning if missing)
  - object `name` (fallback to `id`)
  - `environment` (warning + runtime default fallback)
  - `paths` (warning + ignore if malformed)

## 3) Direct mappings vs translations
- Direct:
  - object transform vectors
  - object tags/metadata
  - environment `presetId`, `intensity`, `backgroundColor`
  - path ids/types/points
- Translation:
  - `assetRef` remains a runtime lookup hint (URL or asset-id), not a loaded mesh.
  - material references are passed as authored hints; runtime decides shader/material binding details.

## 4) Runtime-owned and non-leak boundaries
- Runtime-owned gameplay systems are preserved in `runtimeOwned`; importer does not attempt to apply gameplay logic.
- Unsupported/editor-only concerns remain declared in `unsupported`.
- Importer avoids depending on editor UI concepts and only maps authored scene/layout data.

## 5) Minimum viable first live handoff (implemented now)
- One or more scene objects with:
  - stable id/name
  - transform
  - optional assetRef/material/tags/metadata
- Environment state
- Optional path data
- Validation diagnostics (errors vs warnings)

## 6) First handoff result (fixture-driven)
- Fixture: `src/tests/fixtures/swim26-live-handoff.manifest.json`
- Outcome:
  - Import passes validation
  - Nodes, environment, and paths map into runtime-consumable import result
  - Runtime boundaries preserved via `runtimeOwnership` payload
  - No gameplay/runtime-owned systems are mutated by importer

## 7) Tightening pass outcomes
- Importer now drops malformed/unsupported runtime fields during normalization instead of passing them through.
- Editor-only object fields (`layerId`, `prefabId`, `prefabInstanceId`, selection state) are explicitly warned + ignored.
- Path ingestion now filters out malformed path entries so invalid path points cannot poison runtime state.
- Validation now warns on unknown top-level fields and invalid runtime boundary arrays.
