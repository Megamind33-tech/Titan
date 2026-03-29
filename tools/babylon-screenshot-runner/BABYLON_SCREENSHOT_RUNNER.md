# Babylon Screenshot Runner Operational Guide

## Canonical command wiring

Prefer these env vars (in this order):

1. `SWIM26_REAL_SCREENSHOT_CMD_JSON` (JSON object):
   - Example: `{"cmd":"node","args":["/abs/path/tools/babylon-screenshot-runner/runner.js"]}`
2. `SWIM26_REAL_SCREENSHOT_BIN` + `SWIM26_REAL_SCREENSHOT_ARGS_JSON`:
   - Example: `SWIM26_REAL_SCREENSHOT_BIN=node`
   - Example: `SWIM26_REAL_SCREENSHOT_ARGS_JSON=["/abs/path/tools/babylon-screenshot-runner/runner.js"]`
3. Legacy fallback: `SWIM26_REAL_SCREENSHOT_CMD` (space-split string).

The JSON/bin forms avoid whitespace quoting ambiguity.

## CI reproducibility checklist

- Use a fixed Node major version (`20` in workflow).
- Install runner deps in `tools/babylon-screenshot-runner/`.
- Install Chromium system libraries on Ubuntu.
- Run `runner.test.js` before full screenshot regression.
- Ensure baselines exist in `artifacts/baselines-real/`.

## Real-environment proof command

From repo root, this executes the real external runner path (not a mock):

```bash
SWIM26_REAL_SCREENSHOT_CMD_JSON='{"cmd":"node","args":["/abs/path/to/tools/babylon-screenshot-runner/runner.js"]}' \
node_modules/.bin/tsx -e "/* invoke runSwim26RealScreenshotRegression with default capture */"
```

If Chromium dependencies are missing, this should fail as `blocked_environment`
with `BLOCKED_ENV` details rather than as a visual regression.

## Blocked vs failed classification

- **Blocked environment**: runner exits `3` or emits `BLOCKED_ENV:` (no render-capable environment).
- **Setup failure**: command wiring/spawn could not start runner process reliably.
- **Runner execution failure**: runner executed but failed (`exit 1`, missing output, etc.).
- **Host verification failure**: SceneLoader/engine evidence failed before screenshot pass criteria.
- **Screenshot parity failure**: baseline compare failed (real regression signal).

These states are intentionally separate and visible in diff JSON.

## Artifacts for debugging

Each fixture writes:

- `*.real.diff.json` (result + reasons + diagnostics)
- `*.host.verification.json` (host verification report)
- `*.real.diff.ppm` (pixel diff image, when capture reaches comparison)
- `*.runner.stdout.log`
- `*.runner.stderr.log`

Use logs to diagnose command wiring, dependency issues, and blocked-environment signals.

## Baseline discipline

- Baselines are source-of-truth and must be reviewed before commit.
- Do not accept placeholder/degraded captures as permanent baselines unless explicitly intended.
- Regenerate with:
  - `npm run baselines:generate`
