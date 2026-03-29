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

## Blocked vs failed classification

- **Blocked environment**: runner exits `3` or emits `BLOCKED_ENV:` (no render-capable environment).
- **Render failure**: runner exits non-zero without blocked signal (environment existed, rendering failed).

These states are intentionally separate and visible in diff JSON.

## Artifacts for debugging

Each fixture writes:

- `*.real.diff.json` (result + reasons + diagnostics)
- `*.real.diff.ppm` (pixel diff image)
- `*.runner.stdout.log`
- `*.runner.stderr.log`

Use logs to diagnose command wiring, dependency issues, and blocked-environment signals.

## Baseline discipline

- Baselines are source-of-truth and must be reviewed before commit.
- Do not accept placeholder/degraded captures as permanent baselines unless explicitly intended.
- Regenerate with:
  - `npm run baselines:generate`
