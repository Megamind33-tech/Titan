# SWIM26 Host Verification (Phase 6)

## Host-level gap audit
- Already verified: importer contract validation, runtime assembly logic, deterministic snapshot checks.
- Not yet guaranteed: direct Babylon engine screenshot automation in this environment (package policy blocks browser/runtime tooling installs).
- New host proof added: host lifecycle execution path using SceneLoader-style host adapter and deterministic artifacts.

## Fixture showcase scenes
1. `swim26-live-handoff.manifest.json` (minimal known-good baseline)
2. `swim26-showcase-handoff.manifest.json` (more expressive + one failing node for isolation proof)

## Host-level outputs
- `artifacts/swim26-host-verification-report.json`
- `artifacts/swim26-host-verification.svg`
- `artifacts/swim26-runtime-verification.svg`
- `artifacts/current/*.svg` (current render outputs for visual regression)
- `artifacts/current/*.diff.json` (per-fixture visual comparison diagnostics: threshold, token deltas, host verification summary)
- `artifacts/baselines/*.svg` (canonical visual baselines)
- `artifacts/current-real/*.real.diff.json` (real screenshot regression diagnostics when framebuffer capture command is available)
- `artifacts/current-real/*.real.diff.ppm` (pixel-diff heatmaps for screenshot failures)

## Honest boundary notes
- OBJ remains plugin-dependent.
- Material fields beyond practical PBR mapping are approximations.
- Path visualization remains unsupported in host render output.
- Gameplay/collision/runtime logic remains runtime-owned and out of import scope.
- Full Babylon GPU screenshot automation remains environment-limited; current visual regression uses deterministic SVG render proxies from host output snapshots.
- Verification confidence is therefore strongest for importer/assembly/SceneLoader path correctness and weaker for pixel-level shader or post-process parity.
