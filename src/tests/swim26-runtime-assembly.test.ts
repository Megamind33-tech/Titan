import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assembleSwim26RuntimeScene } from '../services/swim26Runtime/Swim26RuntimeSceneAssembler';
import { BabylonLikeMesh } from '../services/swim26Runtime/types';
import { createBabylonSceneLoaderResolver } from '../services/swim26Runtime/Swim26BabylonAssetLoader';
import { renderRuntimeVerificationSvg, verifyRenderedSwim26Scene } from '../services/swim26Runtime/Swim26RenderedVerificationHarness';

const fixturePath = path.join(process.cwd(), 'src/tests/fixtures/swim26-live-handoff.manifest.json');
const fixtureManifest = fs.readFileSync(fixturePath, 'utf-8');

const makeLoadedMesh = (name: string): BabylonLikeMesh => ({
  id: `mesh-${name}`,
  name,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scaling: { x: 1, y: 1, z: 1 },
});

test('assembles a visible runtime scene from valid SWIM26 handoff manifest', async () => {
  const result = await assembleSwim26RuntimeScene({
    manifest: fixtureManifest,
    resolver: async () => ({ meshes: [makeLoadedMesh('lane')], diagnostics: [] }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'success');
  assert.equal(result.scene.meshes.length, 1);
  assert.equal(result.scene.meshes[0].position.x, 0);
  assert.equal(result.scene.environmentPresetId, 'pool-competition');
  assert.equal(result.scene.clearColor, '#1e90ff');
  assert.ok(result.diagnostics.some(d => d.code === 'PATH_VISUALIZATION_NOT_IMPLEMENTED'));
});

test('isolates failing asset loads and keeps scene reconstruction alive with placeholders', async () => {
  const manifest = JSON.stringify({
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          id: 'ok',
          name: 'Good',
          assetRef: { type: 'url', value: '/good.glb' },
          transform: { position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
        {
          id: 'bad',
          name: 'Bad',
          assetRef: { type: 'url', value: '/missing.glb' },
          transform: { position: [2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#111111' },
      paths: [],
    },
    runtimeOwned: [],
    unsupported: [],
  });

  const result = await assembleSwim26RuntimeScene({
    manifest,
    resolver: async ({ node }) => {
      if (node.id === 'bad') {
        return {
          meshes: [],
          diagnostics: [{ severity: 'error', code: 'ASSET_LOAD_FAILED', message: 'missing asset' }],
        };
      }
      return { meshes: [makeLoadedMesh(node.id)], diagnostics: [] };
    },
  });

  assert.equal(result.scene.meshes.length, 2);
  assert.equal(result.status, 'partial');
  assert.ok(result.scene.meshes.some(mesh => mesh.id.startsWith('placeholder-bad')));
  assert.ok(result.diagnostics.some(d => d.code === 'ASSET_LOAD_FAILED'));
});

test('applies runtime material policy hints and warns on approximation', async () => {
  const manifest = JSON.stringify({
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          id: 'm1',
          name: 'Material Node',
          assetRef: { type: 'url', value: '/marker.glb' },
          transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          material: {
            color: '#336699',
            texture: '/tex.png',
            presetId: 'pool-standard',
            opacity: 0.7,
            roughness: 0.2,
            metalness: 0.4,
            emissiveColor: '#112233',
          },
          tags: [],
          metadata: {},
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#111111' },
      paths: [],
    },
    runtimeOwned: [],
    unsupported: [],
  });

  const result = await assembleSwim26RuntimeScene({
    manifest,
    resolver: async () => ({ meshes: [makeLoadedMesh('m1')], diagnostics: [] }),
  });

  const mesh = result.scene.meshes[0];
  assert.ok(mesh.material);
  assert.equal(mesh.material?.albedoTextureUrl, '/tex.png');
  assert.equal(mesh.material?.alpha, 0.7);
  assert.equal(mesh.material?.roughness, 0.2);
  assert.equal(mesh.material?.metallic, 0.4);
  assert.ok(mesh.material?.emissiveColor);
  assert.ok(result.diagnostics.some(d => d.code === 'MATERIAL_PRESET_APPROXIMATED'));
  assert.ok(result.diagnostics.some(d => d.code === 'MATERIAL_POLICY_APPROXIMATION'));
});

test('produces blocking failure when manifest import fails', async () => {
  const result = await assembleSwim26RuntimeScene({
    manifest: '{"bad":true}',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'failed');
  assert.ok(result.diagnostics.some(d => d.code === 'IMPORT_BLOCKING_FAILURE'));
  assert.equal(result.scene.meshes.length, 0);
});

test('rejects unsafe asset urls before load attempt', async () => {
  const manifest = JSON.stringify({
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: [
        {
          id: 'unsafe',
          name: 'Unsafe',
          assetRef: { type: 'url', value: 'javascript:alert(1)' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        },
      ],
      environment: { presetId: 'pool', intensity: 1, backgroundColor: '#111111' },
      paths: [],
    },
    runtimeOwned: [],
    unsupported: [],
  });

  const result = await assembleSwim26RuntimeScene({
    manifest,
    resolver: async () => {
      throw new Error('should not reach loader');
    },
  });

  assert.equal(result.ok, true);
  assert.ok(result.diagnostics.some(d => d.code === 'ASSET_URL_UNSAFE'));
  assert.ok(result.scene.meshes.some(mesh => mesh.id.startsWith('placeholder-unsafe')));
});

test('SceneLoader-backed resolver uses Babylon-style ImportMeshAsync signature', async () => {
  let captured!: { rootUrl: string; sceneFilename: string };
  const resolver = createBabylonSceneLoaderResolver({
    importMeshAsync: async (_meshNames, rootUrl, sceneFilename) => {
      captured = { rootUrl, sceneFilename };
      return { meshes: [makeLoadedMesh('from-loader')] };
    },
  });

  const result = await assembleSwim26RuntimeScene({
    manifest: JSON.stringify({
      version: '1.0.0',
      runtime: 'babylon',
      projectType: 'swim26-babylon',
      authoredBy: 'titan',
      authoredContent: {
        objects: [{
          id: 'loader-node',
          name: 'Loader Node',
          assetRef: { type: 'url', value: 'https://cdn.swim26.dev/assets/lane.glb' },
          transform: { position: [4, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        }],
        environment: { presetId: 'pool', intensity: 1, backgroundColor: '#111111' },
        paths: [],
      },
      runtimeOwned: [],
      unsupported: [],
    }),
    resolver,
  });

  assert.equal(result.ok, true);
  assert.equal(captured?.sceneFilename, 'lane.glb');
  assert.equal(captured?.rootUrl, 'https://cdn.swim26.dev/assets/');
});

test('SceneLoader-backed resolver supports relative urls without hidden host assumptions', async () => {
  let captured!: { rootUrl: string; sceneFilename: string };
  const resolver = createBabylonSceneLoaderResolver({
    importMeshAsync: async (_meshNames, rootUrl, sceneFilename) => {
      captured = { rootUrl, sceneFilename };
      return { meshes: [makeLoadedMesh('relative')] };
    },
  });

  const result = await assembleSwim26RuntimeScene({
    manifest: JSON.stringify({
      version: '1.0.0',
      runtime: 'babylon',
      projectType: 'swim26-babylon',
      authoredBy: 'titan',
      authoredContent: {
        objects: [{
          id: 'rel-node',
          name: 'Relative Node',
          assetRef: { type: 'url', value: 'assets/scene/marker.glb' },
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          tags: [],
          metadata: {},
        }],
        environment: { presetId: 'pool', intensity: 1, backgroundColor: '#111111' },
        paths: [],
      },
      runtimeOwned: [],
      unsupported: [],
    }),
    resolver,
  });

  assert.equal(result.ok, true);
  assert.equal(captured?.rootUrl, 'assets/scene/');
  assert.equal(captured?.sceneFilename, 'marker.glb');
});

test('render verification harness produces visible snapshot report', async () => {
  const assembled = await assembleSwim26RuntimeScene({
    manifest: fixtureManifest,
    resolver: async () => ({ meshes: [makeLoadedMesh('lane')], diagnostics: [] }),
  });
  const report = verifyRenderedSwim26Scene(assembled);

  assert.equal(report.pass, true);
  assert.equal(report.snapshot.meshCount, 1);
  assert.equal(report.snapshot.meshNames[0], 'lane');
  assert.equal(report.snapshot.clearColor, '#1e90ff');

  const artifactDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const svg = renderRuntimeVerificationSvg(report);
  const artifactPath = path.join(artifactDir, 'swim26-runtime-verification.svg');
  fs.writeFileSync(artifactPath, svg, 'utf-8');
  assert.ok(fs.existsSync(artifactPath));
});
