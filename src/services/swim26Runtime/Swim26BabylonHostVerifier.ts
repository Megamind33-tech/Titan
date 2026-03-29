import { assembleSwim26RuntimeScene } from './Swim26RuntimeSceneAssembler';
import { createBabylonSceneLoaderResolver } from './Swim26BabylonAssetLoader';
import { BabylonLikeMesh, BabylonLikeScene, RuntimeDiagnostic } from './types';
import { verifyRenderedSwim26Scene } from './Swim26RenderedVerificationHarness';

export interface Swim26BabylonHost {
  id: string;
  scene: BabylonLikeScene;
  sceneLoader: {
    importMeshAsync: (
      meshNames: string | string[] | null | undefined,
      rootUrl: string,
      sceneFilename: string,
      scene: BabylonLikeScene
    ) => Promise<{ meshes: BabylonLikeMesh[] }>;
  };
  telemetry?: {
    loaderCalls?: Array<{ rootUrl: string; sceneFilename: string }>;
  };
}

export interface Swim26HostVerificationResult {
  pass: boolean;
  hostId: string;
  status: 'success' | 'partial' | 'failed';
  diagnostics: RuntimeDiagnostic[];
  diagnosticSummary: {
    warnings: number;
    errors: number;
  };
  nodeOutcomes: Array<{
    nodeId: string;
    hadErrors: boolean;
    hadWarnings: boolean;
    codes: string[];
  }>;
  loaderCalls: Array<{ rootUrl: string; sceneFilename: string }>;
  usedEngineLoaderPath: boolean;
  visible: ReturnType<typeof verifyRenderedSwim26Scene>;
}

export const runSwim26HostVerification = async (input: {
  host: Swim26BabylonHost;
  manifest: string | object;
}): Promise<Swim26HostVerificationResult> => {
  const resolver = createBabylonSceneLoaderResolver({
    importMeshAsync: input.host.sceneLoader.importMeshAsync,
  });
  const assembled = await assembleSwim26RuntimeScene({
    manifest: input.manifest,
    resolver,
  });

  // host scene receives assembled meshes (verification host lifecycle)
  input.host.scene.meshes = assembled.scene.meshes;
  input.host.scene.clearColor = assembled.scene.clearColor;
  input.host.scene.environmentPresetId = assembled.scene.environmentPresetId;
  input.host.scene.environmentIntensity = assembled.scene.environmentIntensity;

  const visible = verifyRenderedSwim26Scene(assembled);
  const diagnosticsByNode = new Map<string, RuntimeDiagnostic[]>();
  for (const diagnostic of assembled.diagnostics) {
    const nodeId = diagnostic.context?.nodeId as string | undefined;
    if (!nodeId) continue;
    const list = diagnosticsByNode.get(nodeId) ?? [];
    list.push(diagnostic);
    diagnosticsByNode.set(nodeId, list);
  }

  const loaderCalls = (input.host.telemetry?.loaderCalls ?? []).slice();
  return {
    pass: assembled.ok && visible.pass,
    hostId: input.host.id,
    status: assembled.status,
    diagnostics: assembled.diagnostics,
    diagnosticSummary: {
      warnings: assembled.diagnostics.filter(d => d.severity === 'warning').length,
      errors: assembled.diagnostics.filter(d => d.severity === 'error').length,
    },
    nodeOutcomes: Array.from(diagnosticsByNode.entries()).map(([nodeId, issues]) => ({
      nodeId,
      hadErrors: issues.some(issue => issue.severity === 'error'),
      hadWarnings: issues.some(issue => issue.severity === 'warning'),
      codes: Array.from(new Set(issues.map(issue => issue.code))).sort(),
    })),
    loaderCalls,
    usedEngineLoaderPath: loaderCalls.length > 0,
    visible,
  };
};
