/**
 * Runner CLI contract tests.
 *
 * These tests verify the exit codes, stderr signals, and output file behavior
 * of runner.js without requiring a real GPU or installed puppeteer.
 *
 * Run with:  node runner.test.js
 *
 * Exit code: 0 = all pass, 1 = failures reported on stdout.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs            = require('node:fs');
const path          = require('node:path');
const os            = require('node:os');
const assert        = require('node:assert');

const runner = path.join(__dirname, 'runner.js');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (err) {
    console.error('FAIL: ' + name);
    console.error('      ' + err.message);
    failed++;
  }
}

function withTempDir(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swim26-runner-test-'));
  try {
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function makeManifest(tmp, overrides) {
  const base = {
    version:  '1.0.0',
    runtime:  'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: { objects: [], environment: { backgroundColor: '#1e90ff' } },
  };
  const merged = Object.assign({}, base, overrides);
  const p = path.join(tmp, 'manifest.json');
  fs.writeFileSync(p, JSON.stringify(merged));
  return p;
}

// ─────────────────────────────────────────────────────────────
// Exit code 2 — bad arguments
// ─────────────────────────────────────────────────────────────

test('no arguments → exit 2 with ARG_ERROR', () => {
  const r = spawnSync('node', [runner], { encoding: 'utf-8' });
  assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
  assert.ok(r.stderr.includes('ARG_ERROR'), 'Expected ARG_ERROR in stderr, got: ' + r.stderr);
});

test('only --manifest → exit 2 (missing --output and --metadata)', () => {
  withTempDir(tmp => {
    const m = makeManifest(tmp, {});
    const r = spawnSync('node', [runner, '--manifest', m], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
    assert.ok(r.stderr.includes('ARG_ERROR'), 'Expected ARG_ERROR in stderr');
  });
});

test('--manifest and --output but no --metadata → exit 2', () => {
  withTempDir(tmp => {
    const m = makeManifest(tmp, {});
    const r = spawnSync('node', [runner, '--manifest', m, '--output', path.join(tmp, 'out.png')], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
  });
});

test('non-existent manifest file → exit 2 with ARG_ERROR', () => {
  withTempDir(tmp => {
    const r = spawnSync('node', [runner,
      '--manifest',  '/does/not/exist/manifest.json',
      '--output',    path.join(tmp, 'out.png'),
      '--metadata',  path.join(tmp, 'meta.json'),
    ], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
    assert.ok(r.stderr.includes('ARG_ERROR'), 'Expected ARG_ERROR in stderr');
  });
});

test('manifest with invalid JSON → exit 2 with ARG_ERROR', () => {
  withTempDir(tmp => {
    const badManifest = path.join(tmp, 'bad.json');
    fs.writeFileSync(badManifest, '{ not valid json }');
    const r = spawnSync('node', [runner,
      '--manifest',  badManifest,
      '--output',    path.join(tmp, 'out.png'),
      '--metadata',  path.join(tmp, 'meta.json'),
    ], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
    assert.ok(r.stderr.includes('ARG_ERROR'), 'Expected ARG_ERROR in stderr');
  });
});

test('manifest missing required fields (version, runtime) → exit 2', () => {
  withTempDir(tmp => {
    const badManifest = path.join(tmp, 'incomplete.json');
    fs.writeFileSync(badManifest, JSON.stringify({ authoredContent: {} }));
    const r = spawnSync('node', [runner,
      '--manifest',  badManifest,
      '--output',    path.join(tmp, 'out.png'),
      '--metadata',  path.join(tmp, 'meta.json'),
    ], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2, got ' + r.status);
    assert.ok(r.stderr.includes('ARG_ERROR'), 'Expected ARG_ERROR in stderr');
  });
});

test('unknown flag → exit 2 with ARG_ERROR', () => {
  withTempDir(tmp => {
    const m = makeManifest(tmp, {});
    const r = spawnSync('node', [runner,
      '--manifest',  m,
      '--output',    path.join(tmp, 'out.png'),
      '--metadata',  path.join(tmp, 'meta.json'),
      '--unknown-flag', 'value',
    ], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 2, 'Expected exit 2 for unknown flag, got ' + r.status);
  });
});

// ─────────────────────────────────────────────────────────────
// Exit code 3 — blocked environment
// ─────────────────────────────────────────────────────────────

test('missing puppeteer → exit 3 with BLOCKED_ENV signal', () => {
  const puppeteerExists = fs.existsSync(
    path.join(__dirname, 'node_modules', 'puppeteer')
  );
  if (puppeteerExists) {
    console.log('  (skipped: puppeteer is installed — BLOCKED_ENV path not reachable)');
    return;
  }

  withTempDir(tmp => {
    const m = makeManifest(tmp, {});
    const r = spawnSync('node', [runner,
      '--manifest',  m,
      '--output',    path.join(tmp, 'out.png'),
      '--metadata',  path.join(tmp, 'meta.json'),
    ], { encoding: 'utf-8' });
    assert.strictEqual(r.status, 3, 'Expected exit 3, got ' + r.status);
    assert.ok(r.stderr.includes('BLOCKED_ENV'), 'Expected BLOCKED_ENV in stderr, got: ' + r.stderr);
    assert.ok(r.stderr.includes('puppeteer'), 'Expected "puppeteer" mentioned in BLOCKED_ENV message');
  });
});

// ─────────────────────────────────────────────────────────────
// Exit code 0 — successful render (requires puppeteer installed)
// ─────────────────────────────────────────────────────────────

test('valid manifest + puppeteer installed → exit 0 with screenshot and metadata', () => {
  const puppeteerExists  = fs.existsSync(path.join(__dirname, 'node_modules', 'puppeteer'));
  const babylonJsExists  = fs.existsSync(path.join(__dirname, 'node_modules', 'babylonjs', 'babylon.js'));

  if (!puppeteerExists || !babylonJsExists) {
    console.log('  (skipped: puppeteer or babylonjs not installed — run npm install to enable full render test)');
    return;
  }

  withTempDir(tmp => {
    // Use the live-handoff fixture manifest from Titan if available, else synthetic
    let manifestPath = path.join(__dirname, '..', '..', 'src', 'tests', 'fixtures', 'swim26-live-handoff.manifest.json');
    if (!fs.existsSync(manifestPath)) {
      manifestPath = makeManifest(tmp, {
        authoredContent: {
          objects: [],
          environment: { presetId: 'pool-competition', intensity: 0.9, backgroundColor: '#1e90ff' },
        },
      });
    }

    const outputPath   = path.join(tmp, 'screenshot.png');
    const metadataPath = path.join(tmp, 'metadata.json');

    const r = spawnSync('node', [runner,
      '--manifest',  manifestPath,
      '--output',    outputPath,
      '--metadata',  metadataPath,
      '--width',     '320',
      '--height',    '180',
      '--frames',    '3',
      '--timeout',   '90000',
    ], { encoding: 'utf-8', timeout: 120000 });

    if (r.status !== 0) {
      // Log full output to help diagnose CI failures
      console.log('  stdout:', r.stdout);
      console.log('  stderr:', r.stderr);
    }

    assert.strictEqual(r.status, 0, 'Expected exit 0, got ' + r.status + '\nstderr: ' + r.stderr);

    // Screenshot file must exist
    assert.ok(fs.existsSync(outputPath), 'Screenshot file was not written to ' + outputPath);
    const stat = fs.statSync(outputPath);
    assert.ok(stat.size > 0, 'Screenshot file is empty');

    // Metadata file must exist and be valid JSON
    assert.ok(fs.existsSync(metadataPath), 'Metadata file was not written');
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch (e) {
      assert.fail('Metadata file is not valid JSON: ' + e.message);
    }

    // Metadata must include required fields
    assert.ok(meta.engine,       'metadata.engine is required');
    assert.strictEqual(meta.captureMode, 'framebuffer', 'metadata.captureMode must be "framebuffer"');
    assert.strictEqual(meta.width,  320, 'metadata.width must match requested width');
    assert.strictEqual(meta.height, 180, 'metadata.height must match requested height');
    assert.ok(meta.framesRendered >= 3, 'metadata.framesRendered must be >= requested frames');
    assert.strictEqual(meta.deterministicCameraId, 'swim26-fixed-overhead', 'metadata.deterministicCameraId must be set');
    assert.strictEqual(typeof meta.loaderCallsObserved, 'number', 'metadata.loaderCallsObserved must be a number');
  });
});

// ─────────────────────────────────────────────────────────────
// stdout format contract
// ─────────────────────────────────────────────────────────────

test('stderr on arg error is prefixed with [swim26-screenshot-runner]', () => {
  const r = spawnSync('node', [runner], { encoding: 'utf-8' });
  assert.ok(
    r.stderr.startsWith('[swim26-screenshot-runner]'),
    'stderr should be prefixed with [swim26-screenshot-runner], got: ' + r.stderr
  );
});

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────');
console.log('Runner contract tests: ' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
  console.error('Some tests failed.');
  process.exit(1);
}
