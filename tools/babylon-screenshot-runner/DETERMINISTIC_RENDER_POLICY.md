# SWIM26 Screenshot Runner — Deterministic Render Policy

This document defines the deterministic controls applied during screenshot
capture. These values are part of the stable baseline contract and must not
change between runs without explicit baseline regeneration.

---

## Purpose

Screenshot baselines are only meaningful if the same manifest input produces
the same pixel output across runs. The following controls enforce this.

---

## Fixed controls

### Camera

| Property | Value | Why fixed |
|----------|-------|-----------|
| Camera ID | `swim26-fixed-overhead` | Consistent artifact labeling |
| Camera type | `BABYLON.FreeCamera` | No orbit/animation |
| Position | `(0, 8, 20)` | Stable overhead angle |
| Target | `(0, 0, 0)` | Origin of scene |
| FOV | `0.8 radians` | Consistent framing |
| Near clip | `0.1` | Stable depth range |
| Far clip | `500` | Stable depth range |

Camera position can be overridden via `--camera` (ID only) but the position
values themselves are fixed in `scene-renderer.html`. Overriding `--camera`
only changes the camera node ID in metadata.

**If you need a different camera position**, update `scene-renderer.html` and
regenerate all baselines. Document the change.

### Rendering

| Property | Value | Why fixed |
|----------|-------|-----------|
| Anti-aliasing | `false` | Eliminates per-run AA jitter |
| Hardware scaling | `1` | 1:1 pixel output, no DPI scaling |
| Device scale factor | `1` | No HiDPI multiplier |
| `preserveDrawingBuffer` | `true` | Required for `page.screenshot()` to read pixels |
| `adaptToDeviceRatio` | `false` | Prevents viewport-ratio scaling |

### Resolution

Default: `1280 × 720`. Overridable via `--width` and `--height`.

Changing resolution requires baseline regeneration.
All comparison runs must use the same resolution as the baseline.
Titan's regression service validates `metadata.width` and `metadata.height`
against `expectedResolution` if set.

### Frame warmup

Default: `5` frames. Overridable via `--frames`.

The Babylon render loop runs for `N` warmup frames before capture. This ensures:
- Materials and textures are fully uploaded to the GPU
- Initial animation/simulation state is settled
- The canvas shows the intended frame, not a partial initialization state

5 frames is sufficient for static scenes. Dynamic scenes may require more.

### Lighting

| Property | Value |
|----------|-------|
| Light type | `HemisphericLight` |
| Light ID | `swim26-ambient` |
| Direction | `(0, 1, 0)` (upward) |
| Intensity | `0.9` |
| Diffuse | `(1, 1, 1)` white |
| Specular | `(0.2, 0.2, 0.2)` low specular |
| Ground color | `(0.3, 0.3, 0.4)` blue-grey |

No IBL, no environment texture, no shadows. Flat deterministic lighting only.

Environment intensity from the manifest is not applied to the Babylon scene
in the current implementation (SWIM26 gameplay owns IBL setup). Only the
`backgroundColor` field is applied as `scene.clearColor`.

### Clear color

Sourced from `manifest.authoredContent.environment.backgroundColor`. Hex RGB.
Falls back to `#1e2a44` if not set.

---

## Asset loading and placeholder behavior

Real GLB/GLTF assets are attempted via `BABYLON.SceneLoader.ImportMeshAsync()`.
If loading fails (404, network error, parse error):

1. A `BABYLON.MeshBuilder.CreateBox()` placeholder is used at the authored position
2. The placeholder uses `StandardMaterial` with `manifest.material.color` as `diffuseColor`
3. `metadata.usedPlaceholderGeometry` is set to `true`
4. `metadata.loadWarnings` lists each failure

**Baselines generated with placeholder geometry only capture structural layout.**
They will pass regression as long as the number of objects, their positions,
and their colors remain the same. They will NOT detect changes in actual GLB mesh
appearance.

---

## Stability expectations

Under the same:
- Manifest input
- Runner version
- Node.js version
- Puppeteer version (and thus Chromium version)
- OS and GPU driver (software renderer)

Output should be pixel-identical between runs.

### Known sources of variance

1. **Chromium version change**: Software renderer output can differ across
   Chromium versions. Regenerate baselines when updating Puppeteer.

2. **Font rendering**: Any text in the scene may differ across OS versions.
   The current runner does not render text.

3. **Floating-point precision**: Minor variance (1-2 LSB per channel) is
   possible across CPU architectures. The regression service uses
   `perChannelTolerance: 6` by default to absorb this.

4. **Asset load timing**: If a real asset loads on one run but not another,
   the output will differ. CI uses placeholder geometry consistently.

---

## Recommended regression thresholds

| Scenario | threshold | perChannelTolerance |
|----------|-----------|---------------------|
| Placeholder-only (CI) | 0.995 | 6 |
| Real asset (local) | 0.99 | 10 |
| Strict pixel-perfect | 1.0 | 0 |

The defaults in `Swim26RealScreenshotRegression.ts` are `threshold: 0.995` and
`perChannelTolerance: 6`, which tolerate up to 0.5% changed pixels and minor
per-channel noise.

---

## What changes require baseline regeneration

- Camera position or FOV change
- Resolution change
- Lighting model change
- Clear color / environment change in the manifest
- New objects added to the manifest
- Object positions changed in the manifest
- Puppeteer / Chromium version update
- `scene-renderer.html` render behavior change

Baselines should be regenerated with `npm run baselines:generate`, reviewed
visually, and committed with a message explaining the change.
