/**
 * Baseline generator for SWIM26 screenshot regression.
 *
 * Runs the Babylon screenshot runner against each fixture manifest and writes
 * the output directly to artifacts/baselines-real/ as the new baseline.
 *
 * Run from the Titan root:
 *   npm run baselines:generate
 *
 * Or directly:
 *   node tools/babylon-screenshot-runner/generate-baselines.js [--fixture <id>]
 *
 * Prerequisites:
 *   cd tools/babylon-screenshot-runner && npm install
 *
 * !! WARNING !!
 * This overwrites existing baselines. Review the generated screenshots before
 * committing. Do not generate baselines in a degraded or placeholder-only render
 * state and commit them as truth — that defeats the regression purpose.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const fs            = require('node:fs');
const path          = require('node:path');

const RUNNER = path.join(__dirname, 'runner.js');
const ROOT   = path.join(__dirname, '..', '..');

const FIXTURES = [
  {
    id:           'swim26-live-handoff',
    manifestPath: path.join(ROOT, 'src/tests/fixtures/swim26-live-handoff.manifest.json'),
  },
  {
    id:           'swim26-showcase-handoff',
    manifestPath: path.join(ROOT, 'src/tests/fixtures/swim26-showcase-handoff.manifest.json'),
  },
];

let parsedArgs;
try {
  parsedArgs = parseArgs({
    options: {
      fixture: { type: 'string', default: '' },
      width:   { type: 'string', default: '1280' },
      height:  { type: 'string', default: '720' },
      frames:  { type: 'string', default: '5' },
      timeout: { type: 'string', default: '90000' },
    },
    allowPositionals: false,
  });
} catch (err) {
  process.stderr.write('[generate-baselines] ARG_ERROR: ' + err.message + '\n');
  process.exit(2);
}

const args = parsedArgs.values;
const baselineDir = path.join(ROOT, 'artifacts', 'baselines-real');

fs.mkdirSync(baselineDir, { recursive: true });

const fixturesToRun = args.fixture
  ? FIXTURES.filter(f => f.id === args.fixture)
  : FIXTURES;

if (fixturesToRun.length === 0) {
  process.stderr.write('[generate-baselines] ERROR: No fixture matched id="' + args.fixture + '"\n');
  process.stderr.write('[generate-baselines] Available fixtures: ' + FIXTURES.map(f => f.id).join(', ') + '\n');
  process.exit(2);
}

console.log('[generate-baselines] Generating baselines for ' + fixturesToRun.length + ' fixture(s)');
console.log('[generate-baselines] Output: ' + baselineDir);
console.log('[generate-baselines] Resolution: ' + args.width + 'x' + args.height + ' frames=' + args.frames);
console.log('');

let passed = 0;
let failed = 0;

for (const fixture of fixturesToRun) {
  const outputPath   = path.join(baselineDir, fixture.id + '.png');
  const metadataPath = path.join(baselineDir, fixture.id + '.baseline-metadata.json');

  console.log('[generate-baselines] Running: ' + fixture.id);

  const result = spawnSync('node', [RUNNER,
    '--manifest', fixture.manifestPath,
    '--output',   outputPath,
    '--metadata', metadataPath,
    '--width',    args.width,
    '--height',   args.height,
    '--frames',   args.frames,
    '--timeout',  args.timeout,
    '--fixture-id', fixture.id,
  ], {
    encoding: 'utf-8',
    timeout:  parseInt(args.timeout, 10) + 30000,
    stdio:    'pipe',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    console.error('[generate-baselines] FAILED: ' + fixture.id + ' (exit ' + result.status + ')');

    if (result.stderr && result.stderr.includes('BLOCKED_ENV')) {
      console.error('[generate-baselines] BLOCKED: Runner is not installed. Run: cd tools/babylon-screenshot-runner && npm install');
    }

    failed++;
    continue;
  }

  if (!fs.existsSync(outputPath)) {
    console.error('[generate-baselines] FAILED: ' + fixture.id + ' — output file not written');
    failed++;
    continue;
  }

  const size = fs.statSync(outputPath).size;
  console.log('[generate-baselines] OK: ' + fixture.id + ' → ' + outputPath + ' (' + size + ' bytes)');

  if (fs.existsSync(metadataPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log('[generate-baselines]   engine=' + meta.engine + ' captureMode=' + meta.captureMode
        + ' resolution=' + meta.width + 'x' + meta.height
        + ' frames=' + meta.framesRendered
        + ' placeholder=' + meta.usedPlaceholderGeometry);

      if (meta.usedPlaceholderGeometry) {
        console.warn('[generate-baselines]   WARNING: Baseline uses placeholder geometry (real assets did not load).');
        console.warn('[generate-baselines]   WARNING: This baseline only captures structural layout, not real asset appearance.');
      }
    } catch {
      console.warn('[generate-baselines]   WARNING: Could not read baseline metadata.');
    }
  }

  passed++;
  console.log('');
}

console.log('[generate-baselines] Done: ' + passed + ' succeeded, ' + failed + ' failed.');
if (failed > 0) {
  console.error('[generate-baselines] Review stderr above for failure details.');
  process.exit(1);
}
console.log('[generate-baselines] Review screenshots in ' + baselineDir + ' before committing.');
