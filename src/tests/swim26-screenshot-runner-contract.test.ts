/**
 * Titan-side contract test: external Babylon screenshot runner integration.
 *
 * Verifies that Titan's regression service correctly consumes runner output
 * (or correctly reports blocked state) when invoked via SWIM26_REAL_SCREENSHOT_CMD.
 *
 * These tests do NOT require the runner to be installed. They use the
 * createExternalBabylonScreenshotCapture() function with controlled environments:
 *
 *   - SWIM26_REAL_SCREENSHOT_CMD unset  → blocked with clear message
 *   - SWIM26_REAL_SCREENSHOT_CMD set but runner returns exit 3 → blocked
 *   - SWIM26_REAL_SCREENSHOT_CMD set but runner returns exit 1 → blocked (render failure)
 *   - SWIM26_REAL_SCREENSHOT_CMD set and runner succeeds → ok with metadata
 *
 * The "runner actually renders" path is covered by runner.test.js in
 * tools/babylon-screenshot-runner/ (requires puppeteer + babylonjs installed).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createExternalBabylonScreenshotCapture,
  Swim26ScreenshotFixture,
} from '../services/swim26Runtime/Swim26RealScreenshotRegression';

const FIXTURE_MANIFEST = path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json');

function withTemp(fn: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swim26-runner-contract-'));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    const result = fn(dir);
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>).then(cleanup, (err) => { cleanup(); throw err; });
    }
    cleanup();
    return Promise.resolve();
  } catch (err) {
    cleanup();
    return Promise.reject(err);
  }
}

const fixture: Swim26ScreenshotFixture = {
  id: 'swim26-live-handoff',
  manifestPath: FIXTURE_MANIFEST,
};

// ─────────────────────────────────────────────────────────────
// SWIM26_REAL_SCREENSHOT_CMD unset → blocked
// ─────────────────────────────────────────────────────────────

test('createExternalBabylonScreenshotCapture: unset SWIM26_REAL_SCREENSHOT_CMD → blocked', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;
  const savedJson = process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON;
  const savedBin = process.env.SWIM26_REAL_SCREENSHOT_BIN;
  delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  delete process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON;
  delete process.env.SWIM26_REAL_SCREENSHOT_BIN;

  try {
    const capture = createExternalBabylonScreenshotCapture();
    await withTemp(async (dir) => {
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });
      assert.equal(result.ok, false);
      assert.equal(result.blocked, true);
      assert.ok(result.blockedReason, 'blockedReason must be set');
      assert.ok(
        result.blockedReason!.includes('SWIM26_REAL_SCREENSHOT_CMD'),
        'blockedReason must reference SWIM26_REAL_SCREENSHOT_CMD, got: ' + result.blockedReason
      );
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
    if (savedJson !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON = savedJson;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON;
    if (savedBin !== undefined) process.env.SWIM26_REAL_SCREENSHOT_BIN = savedBin;
    else delete process.env.SWIM26_REAL_SCREENSHOT_BIN;
  }
});

test('createExternalBabylonScreenshotCapture: invalid SWIM26_REAL_SCREENSHOT_CMD_JSON → blocked', async () => {
  const savedJson = process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON;
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;
  delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON = '{bad json}';
  try {
    const capture = createExternalBabylonScreenshotCapture();
    await withTemp(async (dir) => {
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });
      assert.equal(result.ok, false);
      assert.equal(result.blocked, true);
      assert.ok(result.blockedReason?.includes('invalid JSON'));
    });
  } finally {
    if (savedJson !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON = savedJson;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD_JSON;
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
  }
});

// ─────────────────────────────────────────────────────────────
// Runner exits 3 → blocked (explicit blocked-env signal)
// Runner exits 1 → ok=false but blocked=false (render failure, not env block)
// These must be distinguished so callers can report accurately.
// ─────────────────────────────────────────────────────────────

test('createExternalBabylonScreenshotCapture: runner exit 3 → blocked=true', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  try {
    await withTemp(async (dir) => {
      const scriptPath = path.join(dir, 'exit3.js');
      // Runner exits 3 with BLOCKED_ENV: on stderr — the canonical blocked signal
      fs.writeFileSync(scriptPath,
        "'use strict';\nprocess.stderr.write('[swim26-screenshot-runner] BLOCKED_ENV: puppeteer_not_installed\\n');\nprocess.exit(3);\n"
      );

      process.env.SWIM26_REAL_SCREENSHOT_CMD = `node ${scriptPath}`;
      const capture = createExternalBabylonScreenshotCapture();
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });

      assert.equal(result.ok, false);
      assert.equal(result.blocked, true, 'exit 3 must set blocked=true');
      assert.ok(result.blockedReason, 'blockedReason must be set');
      assert.ok(
        result.blockedReason!.includes('blocked environment'),
        'blockedReason must mention blocked environment, got: ' + result.blockedReason
      );
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  }
});

test('createExternalBabylonScreenshotCapture: runner exit 1 (render failure) → blocked=false', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  try {
    await withTemp(async (dir) => {
      const scriptPath = path.join(dir, 'exit1.js');
      // Runner exits 1 with RENDER_ERROR — present in env but rendering failed
      fs.writeFileSync(scriptPath,
        "'use strict';\nprocess.stderr.write('[swim26-screenshot-runner] RENDER_ERROR: Babylon.js Engine creation failed\\n');\nprocess.exit(1);\n"
      );

      process.env.SWIM26_REAL_SCREENSHOT_CMD = `node ${scriptPath}`;
      const capture = createExternalBabylonScreenshotCapture();
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });

      assert.equal(result.ok, false);
      assert.equal(result.blocked, false, 'exit 1 (render failure) must NOT set blocked=true');
      assert.ok(result.blockedReason, 'blockedReason should describe the failure');
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  }
});

// ─────────────────────────────────────────────────────────────
// Runner exits 0 but writes no output file → ok=false, blocked=false
// (runner reached the environment but failed to write output — not a
//  blocked-environment condition, a runner bug)
// ─────────────────────────────────────────────────────────────

test('createExternalBabylonScreenshotCapture: runner exit 0 but no output file → ok=false blocked=false', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  try {
    await withTemp(async (dir) => {
      // Write a real script file so there are no shell-quoting issues with spawnSync
      const scriptPath = path.join(dir, 'silent-exit.js');
      fs.writeFileSync(scriptPath, "'use strict';\nprocess.exit(0);\n");

      process.env.SWIM26_REAL_SCREENSHOT_CMD = `node ${scriptPath}`;
      const capture = createExternalBabylonScreenshotCapture();
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });

      assert.equal(result.ok, false);
      // Exit 0 but no file is NOT a blocked-env condition.
      // The runner reached the environment but misbehaved.
      assert.equal(result.blocked, false);
      assert.ok(
        result.blockedReason!.includes('without producing'),
        'blockedReason must mention missing output, got: ' + result.blockedReason
      );
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  }
});

// ─────────────────────────────────────────────────────────────
// Runner exits 0 and writes output → ok with metadata
// ─────────────────────────────────────────────────────────────

test('createExternalBabylonScreenshotCapture: runner writes PNG + metadata → ok', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  // A command that writes a minimal valid PNG and metadata to the paths
  // provided via --output and --metadata flags.
  // This simulates the real runner's success path without requiring Babylon.js.
  const script = `
    const fs = require('fs');
    const args = process.argv.slice(2);
    const getArg = (name) => {
      const i = args.indexOf(name);
      return i !== -1 ? args[i + 1] : null;
    };
    const outputPath   = getArg('--output');
    const metadataPath = getArg('--metadata');
    if (!outputPath || !metadataPath) {
      process.stderr.write('ARG_ERROR: missing required args\\n');
      process.exit(2);
    }
    // 1x1 transparent PNG (the smallest valid PNG)
    const PNG_1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    fs.mkdirSync(require('path').dirname(outputPath),   { recursive: true });
    fs.mkdirSync(require('path').dirname(metadataPath), { recursive: true });
    fs.writeFileSync(outputPath, PNG_1x1);
    fs.writeFileSync(metadataPath, JSON.stringify({
      engine:               'Babylon.js 7.0.0-test',
      captureMode:          'framebuffer',
      width:                1280,
      height:               720,
      framesRendered:       5,
      deterministicCameraId: 'swim26-fixed-overhead',
      loaderCallsObserved:  1,
    }));
    process.exit(0);
  `;
  process.env.SWIM26_REAL_SCREENSHOT_CMD = `node -e "${script.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;

  // Use a simpler inline script approach
  const saved2 = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  try {
    await withTemp(async (dir) => {
      const scriptPath = path.join(dir, 'mock-runner.js');
      const PNG_1x1 = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
      fs.writeFileSync(scriptPath, `
        'use strict';
        const fs   = require('fs');
        const path = require('path');
        const args = process.argv.slice(2);
        const getArg = n => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : null; };
        const outPng  = getArg('--output');
        const outMeta = getArg('--metadata');
        if (!outPng || !outMeta) { process.stderr.write('[test-runner] ARG_ERROR\\n'); process.exit(2); }
        fs.mkdirSync(path.dirname(outPng),  { recursive: true });
        fs.mkdirSync(path.dirname(outMeta), { recursive: true });
        fs.writeFileSync(outPng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
        fs.writeFileSync(outMeta, JSON.stringify({
          engine: 'Babylon.js 7.0.0-test',
          captureMode: 'framebuffer',
          width: 1280, height: 720,
          framesRendered: 5,
          deterministicCameraId: 'swim26-fixed-overhead',
          loaderCallsObserved: 1,
        }));
        process.exit(0);
      `);

      process.env.SWIM26_REAL_SCREENSHOT_CMD = `node ${scriptPath}`;
      const capture = createExternalBabylonScreenshotCapture();
      const outputPath = path.join(dir, 'out.png');
      const result = await capture({ fixture, outputPath });

      assert.equal(result.ok, true, 'Expected ok: true, got: ' + JSON.stringify(result));
      assert.equal(result.blocked, undefined);
      assert.ok(result.screenshotPath, 'screenshotPath must be set');
      assert.ok(fs.existsSync(result.screenshotPath!), 'Screenshot file must exist');

      // Metadata must be present and contain required fields
      assert.ok(result.metadata, 'metadata must be present');
      assert.equal(result.metadata!.captureMode, 'framebuffer');
      assert.equal(result.metadata!.engine, 'Babylon.js 7.0.0-test');
      assert.equal(result.metadata!.width, 1280);
      assert.equal(result.metadata!.height, 720);
      assert.equal(result.metadata!.framesRendered, 5);
      assert.equal(result.metadata!.deterministicCameraId, 'swim26-fixed-overhead');
      assert.equal(result.metadata!.loaderCallsObserved, 1);
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  }
});

// ─────────────────────────────────────────────────────────────
// Runner writes output but no metadata → ok but metadata undefined
// ─────────────────────────────────────────────────────────────

test('createExternalBabylonScreenshotCapture: runner writes PNG but no metadata → ok with undefined metadata', async () => {
  const saved = process.env.SWIM26_REAL_SCREENSHOT_CMD;

  try {
    await withTemp(async (dir) => {
      const scriptPath = path.join(dir, 'no-meta-runner.js');
      fs.writeFileSync(scriptPath, `
        'use strict';
        const fs   = require('fs');
        const path = require('path');
        const args = process.argv.slice(2);
        const getArg = n => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : null; };
        const outPng = getArg('--output');
        if (!outPng) { process.exit(2); }
        fs.mkdirSync(path.dirname(outPng), { recursive: true });
        fs.writeFileSync(outPng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
        // Intentionally does NOT write --metadata file
        process.exit(0);
      `);

      process.env.SWIM26_REAL_SCREENSHOT_CMD = `node ${scriptPath}`;
      const capture = createExternalBabylonScreenshotCapture();
      const result = await capture({ fixture, outputPath: path.join(dir, 'out.png') });

      assert.equal(result.ok, true, 'Should be ok when PNG written even if metadata absent');
      assert.equal(result.metadata, undefined, 'metadata should be undefined when not written by runner');
    });
  } finally {
    if (saved !== undefined) process.env.SWIM26_REAL_SCREENSHOT_CMD = saved;
    else delete process.env.SWIM26_REAL_SCREENSHOT_CMD;
  }
});

// ─────────────────────────────────────────────────────────────
// Full regression pipeline with mock capture
// ─────────────────────────────────────────────────────────────

import {
  runSwim26RealScreenshotRegression,
} from '../services/swim26Runtime/Swim26RealScreenshotRegression';
import { Swim26BabylonHost } from '../services/swim26Runtime/Swim26BabylonHostVerifier';
import { BabylonLikeMesh } from '../services/swim26Runtime/types';

const DETERMINISTIC_1x1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

function makeHost(): Swim26BabylonHost {
  const host: Swim26BabylonHost = {
    id: 'runner-contract-test-host',
    scene: { meshes: [] },
    telemetry: { loaderCalls: [] },
    sceneLoader: {
      importMeshAsync: async (_names, rootUrl, sceneFilename) => {
        host.telemetry?.loaderCalls?.push({ rootUrl, sceneFilename });
        const mesh: BabylonLikeMesh = {
          id: `mesh-${sceneFilename}`,
          name: sceneFilename,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scaling:  { x: 1, y: 1, z: 1 },
        };
        return { meshes: [mesh] };
      },
    },
  };
  return host;
}

test('runSwim26RealScreenshotRegression: mock capture produces full pipeline result', async () => {
  await withTemp(async (dir) => {
    const baselineDir = path.join(dir, 'baselines');
    const outputDir   = path.join(dir, 'current');
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.mkdirSync(outputDir,   { recursive: true });

    const fixtureId = 'swim26-live-handoff';
    fs.writeFileSync(path.join(baselineDir, fixtureId + '.png'), DETERMINISTIC_1x1_PNG);

    const results = await runSwim26RealScreenshotRegression({
      hostFactory: makeHost,
      fixtures: [{ id: fixtureId, manifestPath: FIXTURE_MANIFEST }],
      baselineDir,
      outputDir,
      threshold: 1.0,
      expectedResolution: { width: 1, height: 1 },
      capture: async ({ outputPath }) => {
        fs.writeFileSync(outputPath, DETERMINISTIC_1x1_PNG);
        return {
          ok: true,
          screenshotPath: outputPath,
          metadata: {
            engine:               'Babylon.js 7.0.0-test',
            captureMode:          'framebuffer',
            width:                1,
            height:               1,
            framesRendered:       5,
            deterministicCameraId: 'swim26-fixed-overhead',
            loaderCallsObserved:  1,
          },
        };
      },
    });

    assert.equal(results.length, 1);
    const r = results[0];

    assert.equal(r.fixtureId, fixtureId);
    assert.equal(r.hostPass,           true,  'host verification must pass');
    assert.equal(r.usedEngineLoaderPath, true, 'must have SceneLoader evidence');
    assert.equal(r.screenshotPass,     true,  'screenshot comparison must pass');
    assert.equal(r.fullPass,           true,  'fullPass requires all three');
    assert.equal(r.blocked,            false, 'must not be blocked');
    assert.equal(r.reasons.length,     0,     'no failure reasons expected');

    // Diff artifacts must be written
    assert.ok(fs.existsSync(r.diffPath),      'diff JSON must be written');
    assert.ok(fs.existsSync(r.diffImagePath), 'diff PPM image must be written');

    // Verify diff JSON structure
    const diff = JSON.parse(fs.readFileSync(r.diffPath, 'utf-8'));
    assert.equal(diff.fixtureId, fixtureId);
    assert.ok(diff.hostVerification,   'diff.hostVerification must be present');
    assert.ok(diff.screenshot,         'diff.screenshot must be present');
    assert.equal(diff.screenshot.pass, true);
    assert.equal(diff.screenshot.blocked, false);
    assert.ok(diff.screenshot.metadata, 'diff.screenshot.metadata must be present');
    assert.equal(diff.screenshot.metadata.captureMode, 'framebuffer');
    assert.equal(diff.screenshot.metadata.deterministicCameraId, 'swim26-fixed-overhead');
  });
});

test('runSwim26RealScreenshotRegression: blocked capture → diff JSON records blockedReason', async () => {
  await withTemp(async (dir) => {
    const baselineDir = path.join(dir, 'baselines');
    const outputDir   = path.join(dir, 'current');
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.mkdirSync(outputDir,   { recursive: true });

    const BLOCKED_REASON = 'No GPU/headless Babylon runtime — runner exited with BLOCKED_ENV';

    const results = await runSwim26RealScreenshotRegression({
      hostFactory: makeHost,
      fixtures: [{ id: 'swim26-live-handoff', manifestPath: FIXTURE_MANIFEST }],
      baselineDir,
      outputDir,
      capture: async () => ({
        ok:           false,
        blocked:      true,
        blockedReason: BLOCKED_REASON,
      }),
    });

    const r = results[0];
    assert.equal(r.fullPass,  false);
    assert.equal(r.blocked,   true);
    assert.equal(r.blockedReason, BLOCKED_REASON);
    assert.ok(r.reasons.some(reason => reason === BLOCKED_REASON));

    // Diff JSON must distinguish blocked from regression
    const diff = JSON.parse(fs.readFileSync(r.diffPath, 'utf-8'));
    assert.equal(diff.screenshot.blocked, true);
    assert.equal(diff.screenshot.blockedReason, BLOCKED_REASON);
    assert.equal(diff.screenshot.pass, false);
  });
});
