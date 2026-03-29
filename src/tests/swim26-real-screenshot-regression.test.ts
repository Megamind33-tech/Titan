import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runSwim26RealScreenshotRegression } from '../services/swim26Runtime/Swim26RealScreenshotRegression';
import { Swim26BabylonHost } from '../services/swim26Runtime/Swim26BabylonHostVerifier';
import { BabylonLikeMesh } from '../services/swim26Runtime/types';

const createHost = (): Swim26BabylonHost => {
  const host: Swim26BabylonHost = {
    id: 'real-screenshot-host',
    scene: { meshes: [] },
    telemetry: { loaderCalls: [] },
    sceneLoader: {
      importMeshAsync: async (_meshNames, rootUrl, sceneFilename) => {
        host.telemetry?.loaderCalls?.push({ rootUrl, sceneFilename });
        const mesh: BabylonLikeMesh = {
          id: `mesh-${sceneFilename}`,
          name: sceneFilename,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scaling: { x: 1, y: 1, z: 1 },
        };
        return { meshes: [mesh] };
      },
    },
  };
  return host;
};

test('real screenshot regression requires both host evidence and screenshot parity', async () => {
  const baselineDir = path.join(process.cwd(), 'artifacts/baselines-real');
  const outputDir = path.join(process.cwd(), 'artifacts/current-real');
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const fixtureId = 'swim26-live-handoff';
  const baselinePath = path.join(baselineDir, `${fixtureId}.png`);
  const deterministicBytes = Buffer.from('fake-but-deterministic-png-bytes');
  const deterministicTinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(baselinePath, deterministicTinyPng);

  const results = await runSwim26RealScreenshotRegression({
    hostFactory: createHost,
    fixtures: [{ id: fixtureId, manifestPath: path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json') }],
    baselineDir,
    outputDir,
    threshold: 1,
    expectedResolution: { width: 1, height: 1 },
    capture: async ({ outputPath }) => {
      fs.writeFileSync(outputPath, deterministicTinyPng);
      return {
        ok: true,
        screenshotPath: outputPath,
        metadata: {
          engine: 'Babylon.js',
          captureMode: 'framebuffer',
          width: 1,
          height: 1,
          framesRendered: 2,
          deterministicCameraId: 'swim26-fixed-camera',
          loaderCallsObserved: 1,
        },
      };
    },
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].hostPass, true);
  assert.equal(results[0].usedEngineLoaderPath, true);
  assert.equal(results[0].screenshotPass, true);
  assert.equal(results[0].fullPass, true);
  assert.equal(fs.existsSync(results[0].diffPath), true);
  assert.equal(fs.existsSync(results[0].diffImagePath), true);
});

test('real screenshot regression reports blocked environment honestly', async () => {
  const results = await runSwim26RealScreenshotRegression({
    hostFactory: createHost,
    fixtures: [{ id: 'swim26-live-handoff', manifestPath: path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json') }],
    baselineDir: path.join(process.cwd(), 'artifacts/baselines-real'),
    outputDir: path.join(process.cwd(), 'artifacts/current-real'),
    capture: async () => ({
      ok: false,
      blocked: true,
      blockedReason: 'No GPU/headless Babylon runtime available in CI image.',
    }),
  });

  assert.equal(results[0].fullPass, false);
  assert.equal(results[0].blocked, true);
  assert.ok(results[0].reasons.some(reason => reason.includes('No GPU/headless Babylon runtime available')));
});
