# SWIM26 Babylon Screenshot Runner

External screenshot runner for Titan's SWIM26 screenshot regression pipeline.
Produces real Babylon.js framebuffer screenshots of SWIM26 fixture manifests
using headless Chromium via Puppeteer.

---

## What this is

`tools/babylon-screenshot-runner/runner.js` is the external executable that
Titan's regression service invokes via the `SWIM26_REAL_SCREENSHOT_CMD`
environment variable.

It:
1. Accepts `--manifest`, `--output`, and `--metadata` CLI arguments
2. Boots a headless Chromium instance via Puppeteer
3. Loads `scene-renderer.html` with Babylon.js served locally from `node_modules/`
4. Renders the SWIM26 fixture scene (placeholder geometry if assets are unavailable)
5. Captures a real framebuffer screenshot via `page.screenshot()`
6. Writes a PNG screenshot and a JSON metadata file
7. Exits `0` on success, `1` on render failure, `2` on bad arguments, `3` if blocked

---

## Quick start

```bash
# 1. Install runner dependencies (once)
cd tools/babylon-screenshot-runner
npm install

# 2. Set the command and run Titan's regression suite
SWIM26_REAL_SCREENSHOT_CMD="node tools/babylon-screenshot-runner/runner.js" \
  npm run test:swim26-real-render

# 3. Generate baselines (first time or after intentional scene changes)
npm run baselines:generate
```

---

## CLI contract

```
node runner.js --manifest <path> --output <png path> --metadata <json path>
               [--width <pixels>]     default: 1280
               [--height <pixels>]    default: 720
               [--frames <count>]     default: 5
               [--camera <id>]        default: swim26-fixed-overhead
               [--timeout <ms>]       default: 60000
               [--fixture-id <id>]    optional, for labeling
```

### Required arguments

| Argument     | Description |
|--------------|-------------|
| `--manifest` | Absolute or relative path to a SWIM26 manifest JSON file |
| `--output`   | Path to write the output PNG screenshot |
| `--metadata` | Path to write the output JSON metadata file |

### Exit codes

| Code | Meaning |
|------|---------|
| `0`  | Success — PNG and metadata written |
| `1`  | Render failure — Babylon/Chromium error; see stderr |
| `2`  | Bad arguments or bad manifest — fix invocation |
| `3`  | Blocked environment — Puppeteer or Babylon.js not installed |

### Blocked environment signal

Exit code `3` with stderr prefixed `BLOCKED_ENV:` means the runner is not
installed or the environment cannot execute it. Titan's regression service
reports this as `blocked: true` in the diff artifact, which is **distinct**
from a real screenshot regression failure.

### Metadata output format

```json
{
  "engine":                "Babylon.js 7.x.x",
  "captureMode":           "framebuffer",
  "width":                 1280,
  "height":                720,
  "framesRendered":        5,
  "deterministicCameraId": "swim26-fixed-overhead",
  "loaderCallsObserved":   1,
  "loaderCalls":           [{ "rootUrl": "...", "sceneFilename": "..." }],
  "loadedRealAssets":      false,
  "loadWarnings":          ["Asset load failed [/assets/swim/lane-marker.glb]: ... (using placeholder)"],
  "usedPlaceholderGeometry": true,
  "environmentPresetId":   "pool-competition",
  "clearColor":            "#1e90ff",
  "antialias":             false,
  "hardwareScalingLevel":  1,
  "preserveDrawingBuffer": true
}
```

---

## Environment requirements

### Node.js

Node.js >= 18.0.0 is required for `parseArgs` and other modern APIs.

### Chromium system libraries (Ubuntu/Debian)

Headless Chromium requires these system libraries on Ubuntu/Debian:

```bash
sudo apt-get install -y \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libgbm1 libgtk-3-0 libnss3 libxss1 libxshmfence1 \
  fonts-liberation
```

On GitHub Actions `ubuntu-latest` runners, most of these are pre-installed.

### GPU / software rendering

No hardware GPU is required. Chromium's headless mode uses software rendering
(SwiftShader/ANGLE) for WebGL. The runner passes `--disable-gpu` to force
software rendering for determinism.

**WebGL is required.** If the environment disables WebGL entirely (e.g.,
`--disable-webgl`), Babylon.js will fail to initialize and the runner exits 1.
The CI workflow does NOT disable WebGL.

### Babylon.js

`babylonjs` and `babylonjs-loaders` are installed locally in
`tools/babylon-screenshot-runner/node_modules/` and served from the runner's
own HTTP server. No CDN dependency.

---

## Asset loading behavior

The runner attempts `BABYLON.SceneLoader.ImportMeshAsync()` for each node in
the manifest. If the asset URL returns a 404 or network error, the runner:

1. Records the loader call attempt in metadata (`loaderCallsObserved`, `loaderCalls`)
2. Falls back to a colored placeholder box at the authored transform position
3. Sets `usedPlaceholderGeometry: true` in metadata
4. Continues rendering — does NOT abort

This means screenshots are always produced even when fixture GLBs are
unavailable (as they are in unit test environments). The structural scene
layout (positions, colors, counts) is still captured.

**If `usedPlaceholderGeometry: true`, do not use that baseline to assert
real asset appearance.** Document this in your baseline commit message.

---

## Baseline management

Baselines live in `artifacts/baselines-real/<fixture-id>.png`.

### Generating baselines

```bash
# Generate all fixtures
npm run baselines:generate

# Generate a specific fixture
node tools/babylon-screenshot-runner/generate-baselines.js --fixture swim26-live-handoff

# Custom resolution
node tools/babylon-screenshot-runner/generate-baselines.js --width 640 --height 360
```

**Review baselines before committing.** Open the PNG files and verify:
- The clear color matches the manifest `backgroundColor`
- Placeholder boxes are visible at authored positions
- The camera viewpoint is correct (overhead at (0,8,20), targeting origin)

### Updating baselines

After an intentional scene change:
1. Run `npm run baselines:generate`
2. Review the generated screenshots
3. Commit with a message explaining what changed

---

## CI integration

See `.github/workflows/screenshot-regression.yml`.

The workflow:
1. Installs Titan dependencies (`npm ci`)
2. Installs runner dependencies (`cd tools/babylon-screenshot-runner && npm ci`)
3. Installs Chromium system libraries
4. Caches the Puppeteer Chromium download
5. Sets `SWIM26_REAL_SCREENSHOT_CMD=node .../runner.js`
6. Runs `npm run test:swim26-real-render`
7. Uploads `artifacts/current-real/` and `artifacts/baselines-real/` as GitHub Actions artifacts

### First-run behavior (no baselines)

If `artifacts/baselines-real/` contains no PNGs, the regression test reports:

```
screenshotPass: false
reasons: ["Real screenshot baseline is missing."]
```

This is **not** a blocked failure — it means you need to generate baselines.
Run `npm run baselines:generate` locally, review, and commit the PNGs.

---

## Failure modes

| Failure | Exit code | Where to look |
|---------|-----------|---------------|
| puppeteer not installed | 3 | stderr: `BLOCKED_ENV: puppeteer_not_installed` |
| babylonjs not installed | 3 | stderr: `BLOCKED_ENV: babylonjs_not_installed` |
| Manifest file not found | 2 | stderr: `ARG_ERROR: Manifest file not found` |
| Invalid manifest JSON | 2 | stderr: `ARG_ERROR: Cannot parse manifest JSON` |
| Babylon.js script failed to load | 1 | stderr: `RENDER_ERROR: Babylon.js did not load` |
| Render timed out | 1 | stderr: `RENDER_ERROR: Render timed out` |
| WebGL unavailable | 1 | stderr: `RENDER_ERROR: Babylon.js Engine creation failed` |
| Screenshot file not written | 1 | stderr: `RENDER_ERROR: ...output file was not written` |
| Metadata not emitted | 1 | stderr: `RENDER_ERROR: Renderer did not produce metadata` |

Blocked failures (`exit 3`) are always distinguishable from render failures
(`exit 1`) in Titan's diff JSON: `screenshot.blocked` is `true` only for
non-zero runner exits.

---

## What "real framebuffer" means here

The `captureMode: "framebuffer"` in metadata means:

- Chromium's headless software renderer (SwiftShader) executed a real WebGL
  render pipeline
- Babylon.js called the WebGL draw APIs on a real canvas
- `page.screenshot()` read the actual framebuffer pixels from that canvas

It does **not** mean:
- Hardware GPU acceleration was used (it is explicitly disabled)
- Real production GLB assets were loaded (they are often unavailable in CI)
- The render output is visually identical to the SWIM26 game client

The value of these screenshots is structural regression detection:
- Clear color correct
- Camera viewpoint stable
- Object count and placement stable
- Material colors stable

They are not a substitute for visual QA on a real device.

---

## Known limitations

1. **Real asset loading**: SWIM26 production GLBs at `cdn.swim26.dev` are not
   accessible in CI. All CI screenshots use placeholder geometry. This is
   documented in `usedPlaceholderGeometry` in metadata.

2. **Rendering parity**: Software-rendered WebGL output differs from
   hardware-rendered output in lighting, shadow, and anti-aliasing details.
   Anti-aliasing is disabled for determinism but minor per-run pixel variance
   is still possible under different Chromium versions.

3. **First CI run requires baseline generation**: Baselines must be generated
   locally and committed. There is no auto-baseline generation in CI.

4. **Chromium version drift**: If Puppeteer updates Chromium, screenshot output
   may change slightly. Regenerate baselines when updating Puppeteer.
