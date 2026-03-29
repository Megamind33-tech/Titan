import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { runSwim26VisualRegression } from '../services/swim26Runtime/Swim26VisualRegression';
import { Swim26BabylonHost } from '../services/swim26Runtime/Swim26BabylonHostVerifier';
import { BabylonLikeMesh } from '../services/swim26Runtime/types';

const createHost = (): Swim26BabylonHost => {
  const host: Swim26BabylonHost = {
    id: 'visual-regression-host',
    scene: { meshes: [] },
    telemetry: { loaderCalls: [] },
    sceneLoader: {
      importMeshAsync: async (_meshNames, rootUrl, sceneFilename) => {
        host.telemetry?.loaderCalls?.push({ rootUrl, sceneFilename });
        if (sceneFilename.includes('missing')) throw new Error('asset missing');
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

test('visual regression pipeline compares fixture renders against baselines', async () => {
  const results = await runSwim26VisualRegression({
    hostFactory: createHost,
    fixtures: [
      { id: 'swim26-live-handoff', manifestPath: path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json') },
      { id: 'swim26-showcase-handoff', manifestPath: path.join(process.cwd(), 'src/tests/fixtures/swim26-showcase-handoff.manifest.json') },
    ],
    baselineDir: path.join(process.cwd(), 'artifacts/baselines'),
    outputDir: path.join(process.cwd(), 'artifacts/current'),
    threshold: 0.995,
  });

  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.pass), JSON.stringify(results, null, 2));
  assert.ok(results.every(result => result.hostPass));
  assert.ok(results.every(result => result.usedEngineLoaderPath));
  assert.ok(results.every(result => fs.existsSync(result.diffPath)));
});
