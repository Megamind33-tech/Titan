import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runSwim26HostVerification, Swim26BabylonHost } from '../services/swim26Runtime/Swim26BabylonHostVerifier';
import { BabylonLikeMesh } from '../services/swim26Runtime/types';
import { renderRuntimeVerificationSvg } from '../services/swim26Runtime/Swim26RenderedVerificationHarness';

const minimalFixture = fs.readFileSync(path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json'), 'utf-8');
const showcaseFixture = fs.readFileSync(path.join(process.cwd(), 'src/tests/fixtures/swim26-showcase-handoff.manifest.json'), 'utf-8');

const meshFromFilename = (name: string): BabylonLikeMesh => ({
  id: `mesh-${name}`,
  name,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scaling: { x: 1, y: 1, z: 1 },
});

const createHost = (): Swim26BabylonHost => {
  const host: Swim26BabylonHost = {
    id: 'swim26-babylon-host',
    scene: { meshes: [] },
    telemetry: { loaderCalls: [] },
    sceneLoader: {
      importMeshAsync: async (_meshNames, rootUrl, sceneFilename) => {
        host.telemetry?.loaderCalls?.push({ rootUrl, sceneFilename });
        if (sceneFilename.includes('missing')) {
          throw new Error('asset missing');
        }
        return { meshes: [meshFromFilename(sceneFilename)] };
      },
    },
  };
  return host;
};

test('host-level verification passes for minimal fixture in real host path', async () => {
  const runtimeHost = createHost();
  const result = await runSwim26HostVerification({ host: runtimeHost, manifest: minimalFixture });

  assert.equal(result.pass, true);
  assert.equal(result.status, 'success');
  assert.ok(runtimeHost.scene.meshes.length > 0);
  assert.equal(result.visible.snapshot.environmentPresetId, 'pool-competition');
  assert.ok(result.loaderCalls.length > 0);
  assert.equal(result.usedEngineLoaderPath, true);
  assert.equal(result.diagnosticSummary.errors, 0);
});

test('showcase fixture proves node-level failure isolation in host path', async () => {
  const runtimeHost = createHost();
  const result = await runSwim26HostVerification({ host: runtimeHost, manifest: showcaseFixture });

  assert.equal(result.status, 'partial');
  assert.ok(result.diagnostics.some(d => d.code === 'ASSET_LOAD_FAILED'));
  assert.ok(runtimeHost.scene.meshes.some(mesh => mesh.id.startsWith('placeholder-flag-01')));
  assert.ok(result.nodeOutcomes.some(node => node.nodeId === 'flag-01' && node.hadErrors));
});

test('host verification writes deterministic artifact outputs for repeatability', async () => {
  const runtimeHost = createHost();
  const result = await runSwim26HostVerification({ host: runtimeHost, manifest: minimalFixture });

  const artifactDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const hostReportPath = path.join(artifactDir, 'swim26-host-verification-report.json');
  const svgPath = path.join(artifactDir, 'swim26-host-verification.svg');
  fs.writeFileSync(hostReportPath, JSON.stringify({
    summary: result.diagnosticSummary,
    visible: result.visible.snapshot,
    loaderCalls: result.loaderCalls,
    usedEngineLoaderPath: result.usedEngineLoaderPath,
  }, null, 2), 'utf-8');
  fs.writeFileSync(svgPath, renderRuntimeVerificationSvg(result.visible), 'utf-8');

  assert.ok(fs.existsSync(hostReportPath));
  assert.ok(fs.existsSync(svgPath));
});
