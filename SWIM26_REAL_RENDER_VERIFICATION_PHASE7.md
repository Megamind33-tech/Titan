# SWIM26 Real Render Verification (Phase 7)

## Audit: current proof vs missing proof

### What current host-level verification already proves
- Titan manifest import/assembly runs deterministically for canonical fixtures.
- SceneLoader path is exercised and recorded (`loaderCalls`, `usedEngineLoaderPath`).
- Visible scene structure (mesh list/transforms/clear color metadata) is stable enough for structural checks.
- Host-level `.svg` and `.diff.json` artifacts provide deterministic lower-layer diagnostics.

### What only real framebuffer screenshots can prove
- Actual Babylon raster output parity at the chosen resolution/camera/light state.
- Material/light/shadow/post-process rendering regressions that structural checks cannot detect.
- Real shader-level visual changes from runtime updates.

### Required environment/tooling for real screenshot capture
- A runnable Babylon render runtime (browser or headless-gl path) with framebuffer screenshot capability.
- Access to the same asset roots used by fixtures.
- Stable fonts/GPU/driver/runtime image where possible.
- A CI command that renders fixture manifests and writes PNG screenshots.

### Required deterministic controls
- Fixed camera pose/FOV/near/far.
- Fixed resolution and render scale.
- Fixed lighting/environment and clear color.
- Fixed render warm-up frame count / capture frame timing.
- Fixed asset versions and deterministic fixture manifests.

### Canonical fixture baseline set
- `swim26-live-handoff`
- `swim26-showcase-handoff`

### Resolution/baseline policy
- Baselines live under `artifacts/baselines-real/*.png`.
- Current run outputs live under `artifacts/current-real/*.png`.
- Per-fixture diagnostics live under `artifacts/current-real/*.real.diff.json`.
- Per-fixture visual diff heatmaps live under `artifacts/current-real/*.real.diff.ppm`.
- Baseline updates must be explicit and code-reviewed.

### Diff tolerance strategy
- Current implementation uses pixel-level PNG comparison (RGBA decode + per-channel tolerance), not file-byte equality.
- Similarity is based on changed-pixel ratio with deterministic thresholds.
- Diff heatmaps are emitted for debugging changed regions.

### What remains approximate even with screenshot capture
- Material preset parity remains approximate by design.
- Unsupported path visualization remains unsupported.
- Gameplay/runtime-owned systems are still out of Titan importer scope.
- Screenshot parity proves visual output for tested fixtures/settings, not universal runtime behavior.

## Practical external requirement
- Set `SWIM26_REAL_SCREENSHOT_CMD` to a command that can render a fixture manifest in real Babylon and output a PNG:
  - command receives `--manifest <path>` `--output <path>` `--metadata <path>`.
  - metadata must include capture mode, resolution, and frames rendered so Titan can verify deterministic capture preconditions.
  - if this command is missing/failing, regression reports `blocked` instead of faking a pass.
