import { importSwim26Manifest } from '../Swim26ManifestImporter';
import { createBabylonAssetResolver, Swim26AssetResolver, validateRuntimeAssetRef } from './Swim26BabylonAssetLoader';
import { buildRuntimeMaterialFromTitanHints } from './Swim26RuntimeMaterialPolicy';
import { BabylonLikeMesh, BabylonLikeScene, RuntimeDiagnostic } from './types';

export interface Swim26RuntimeAssemblyResult {
  ok: boolean;
  status: 'success' | 'partial' | 'failed';
  scene: BabylonLikeScene;
  diagnostics: RuntimeDiagnostic[];
}

const applyNodeTransform = (mesh: BabylonLikeMesh, node: { transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } }) => {
  mesh.position = { x: node.transform.position[0], y: node.transform.position[1], z: node.transform.position[2] };
  mesh.rotation = { x: node.transform.rotation[0], y: node.transform.rotation[1], z: node.transform.rotation[2] };
  mesh.scaling = { x: node.transform.scale[0], y: node.transform.scale[1], z: node.transform.scale[2] };
};

const createPlaceholderMesh = (nodeId: string, name: string): BabylonLikeMesh => ({
  id: `placeholder-${nodeId}`,
  name: `${name || nodeId}-placeholder`,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scaling: { x: 1, y: 1, z: 1 },
});

export const assembleSwim26RuntimeScene = async (input: {
  manifest: string | object;
  resolver?: Swim26AssetResolver;
}): Promise<Swim26RuntimeAssemblyResult> => {
  const importResult = importSwim26Manifest(input.manifest as any);
  const diagnostics: RuntimeDiagnostic[] = [...importResult.warnings, ...importResult.errors];
  const scene: BabylonLikeScene = { meshes: [] };

  if (!importResult.ok || !importResult.scene) {
    diagnostics.push({
      severity: 'error',
      code: 'IMPORT_BLOCKING_FAILURE',
      message: 'Manifest import failed, runtime scene assembly aborted.',
    });
    return { ok: false, status: 'failed', scene, diagnostics };
  }

  const resolver = input.resolver ?? createBabylonAssetResolver({
    loadMeshesFromUrl: async () => {
      throw new Error('No Babylon loader provided in this environment.');
    },
  });

  if (importResult.scene.environment) {
    scene.environmentPresetId = importResult.scene.environment.presetId;
    scene.environmentIntensity = importResult.scene.environment.intensity;
    scene.clearColor = importResult.scene.environment.backgroundColor;
  }
  if (importResult.scene.paths.length > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'PATH_VISUALIZATION_NOT_IMPLEMENTED',
      message: 'Imported path data is accepted but not yet rendered as visible runtime splines.',
      context: { pathCount: importResult.scene.paths.length },
    });
  }

  for (const node of importResult.scene.nodes) {
    const preflightAssetDiagnostics = validateRuntimeAssetRef(node);
    diagnostics.push(...preflightAssetDiagnostics);
    const blockingPreflightCodes = new Set([
      'ASSET_REF_UNSUPPORTED_TYPE',
      'ASSET_URL_UNSAFE',
      'ASSET_EXTENSION_UNSUPPORTED',
    ]);
    const shouldSkipResolve = preflightAssetDiagnostics.some(d => blockingPreflightCodes.has(d.code));
    const asset = shouldSkipResolve
      ? { meshes: [], diagnostics: [] }
      : await resolver({ scene, node });
    diagnostics.push(...asset.diagnostics);

    const meshes = asset.meshes.length > 0 ? asset.meshes : [createPlaceholderMesh(node.id, node.name)];
    for (const mesh of meshes) {
      applyNodeTransform(mesh, node);
      const materialPolicy = buildRuntimeMaterialFromTitanHints(node);
      diagnostics.push(...materialPolicy.diagnostics);
      if (materialPolicy.material) mesh.material = materialPolicy.material;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        importedNodeId: node.id,
        importedTags: node.tags,
      };
      scene.meshes.push(mesh);
    }
  }

  const hasBlocking = diagnostics.some(d => d.severity === 'error' && d.code === 'IMPORT_BLOCKING_FAILURE');
  const hasRecoverableErrors = diagnostics.some(d => d.severity === 'error' && d.code !== 'IMPORT_BLOCKING_FAILURE');
  return {
    ok: !hasBlocking,
    status: hasBlocking ? 'failed' : hasRecoverableErrors ? 'partial' : 'success',
    scene,
    diagnostics,
  };
};
