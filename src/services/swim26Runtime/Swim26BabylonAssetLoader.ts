import { ImportedSwim26Node } from '../Swim26ManifestImporter';
import { BabylonLikeMesh, BabylonLikeScene, RuntimeDiagnostic } from './types';

export interface Swim26AssetLoadResult {
  meshes: BabylonLikeMesh[];
  diagnostics: RuntimeDiagnostic[];
}

export type Swim26AssetResolver = (input: {
  scene: BabylonLikeScene;
  node: ImportedSwim26Node;
}) => Promise<Swim26AssetLoadResult>;

const getExtension = (assetRef: string): string => {
  const normalized = assetRef.split('?')[0].toLowerCase();
  if (normalized.endsWith('.glb')) return 'glb';
  if (normalized.endsWith('.gltf')) return 'gltf';
  if (normalized.endsWith('.obj')) return 'obj';
  return '';
};

const splitAssetUrl = (assetRef: string): { rootUrl: string; sceneFilename: string } => {
  const normalized = assetRef.split('?')[0];
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {
    return { rootUrl: './', sceneFilename: normalized };
  }
  return {
    rootUrl: normalized.slice(0, lastSlash + 1),
    sceneFilename: normalized.slice(lastSlash + 1),
  };
};

const isSafeAssetUrl = (value: string): boolean => {
  if (value.startsWith('javascript:') || value.startsWith('data:')) return false;
  if (value.startsWith('/')) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return /^[a-zA-Z0-9._/\-]+$/.test(value);
};

export const validateRuntimeAssetRef = (node: ImportedSwim26Node): RuntimeDiagnostic[] => {
  if (!node.assetRef) {
    return [{
      severity: 'warning',
      code: 'ASSET_REF_MISSING',
      message: `Node "${node.id}" has no assetRef; runtime will create a placeholder mesh.`,
      context: { nodeId: node.id },
    }];
  }

  if (node.assetRef.type !== 'url') {
    return [{
      severity: 'warning',
      code: 'ASSET_REF_UNSUPPORTED_TYPE',
      message: `assetRef.type "${node.assetRef.type}" is not supported by runtime loader yet.`,
      context: { nodeId: node.id, assetRefType: node.assetRef.type },
    }];
  }

  if (!isSafeAssetUrl(node.assetRef.value)) {
    return [{
      severity: 'warning',
      code: 'ASSET_URL_UNSAFE',
      message: `Asset URL "${node.assetRef.value}" is not allowed.`,
      context: { nodeId: node.id, assetRef: node.assetRef.value },
    }];
  }

  const ext = getExtension(node.assetRef.value);
  if (!ext) {
    return [{
      severity: 'warning',
      code: 'ASSET_EXTENSION_UNSUPPORTED',
      message: `Asset extension is unsupported for "${node.assetRef.value}". Supported: .glb .gltf .obj`,
      context: { nodeId: node.id, assetRef: node.assetRef.value },
    }];
  }
  if (ext === 'obj') {
    return [{
      severity: 'warning',
      code: 'ASSET_OBJ_PLUGIN_REQUIRED',
      message: 'OBJ import depends on Babylon OBJ loader plugin availability at runtime.',
      context: { nodeId: node.id, assetRef: node.assetRef.value },
    }];
  }
  return [];
};

export const createBabylonAssetResolver = (deps: {
  loadMeshesFromUrl: (scene: BabylonLikeScene, url: string) => Promise<BabylonLikeMesh[]>;
}): Swim26AssetResolver => {
  return async ({ scene, node }) => {
    const diagnostics = validateRuntimeAssetRef(node);
    if (diagnostics.some(d => d.code !== 'ASSET_REF_MISSING')) {
      return { meshes: [], diagnostics };
    }
    if (!node.assetRef) {
      return { meshes: [], diagnostics };
    }

    try {
      const meshes = await deps.loadMeshesFromUrl(scene, node.assetRef.value);
      return { meshes, diagnostics };
    } catch (error) {
      return {
        meshes: [],
        diagnostics: [
          ...diagnostics,
          {
            severity: 'error',
            code: 'ASSET_LOAD_FAILED',
            message: `Failed to load asset "${node.assetRef.value}".`,
            context: { nodeId: node.id, error: String(error) },
          },
        ],
      };
    }
  };
};

export const createBabylonSceneLoaderResolver = (deps: {
  importMeshAsync: (
    meshNames: string | string[] | null | undefined,
    rootUrl: string,
    sceneFilename: string,
    scene: BabylonLikeScene
  ) => Promise<{ meshes: BabylonLikeMesh[] }>;
}): Swim26AssetResolver => createBabylonAssetResolver({
  loadMeshesFromUrl: async (scene, url) => {
    const { rootUrl, sceneFilename } = splitAssetUrl(url);
    const loaded = await deps.importMeshAsync(null, rootUrl, sceneFilename, scene);
    return loaded.meshes;
  },
});
