import { useCallback, useEffect } from 'react';
import { autoSaveScene, loadSceneVersion, saveSceneVersion, SceneState } from '../utils/storageUtils';
import { DEFAULT_PROFILES } from '../constants/qualityProfiles';
import { ProjectMetadataProbe } from '../types/projectAdapter';
import { EnvironmentPreset } from '../types/environment';
import { CameraPath, CameraPreset } from '../types/camera';
import { Layer } from '../types/layers';
import { Prefab } from '../types/prefabs';
import { CollisionZone } from '../types/collision';
import { Path } from '../types/paths';
import { DEFAULT_ENVIRONMENT } from '../types/environment';
import { DEFAULT_LAYERS } from '../types/layers';
import { ModelData } from '../App';

interface SceneStatePayload {
  models: ModelData[];
  prefabs: Prefab[];
  gridReceiveShadow: boolean;
  shadowSoftness: number;
  environment: EnvironmentPreset;
  cameraPresets: CameraPreset[];
  activeCameraPresetId: string | null;
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
  previewCameraPathId: string | null;
  layers: Layer[];
  terrain: any;
  paths: Path[];
  collisionZones: CollisionZone[];
  qualitySettings: any;
}

interface UseScenePersistenceCoordinatorArgs {
  sceneState: SceneStatePayload;
  projectMetadata: ProjectMetadataProbe;
  isInitialLoad: boolean;
  applyLoadedState: (next: SceneStatePayload, options?: { replace?: boolean }) => void;
  onVersionMetadata: (metadata: ProjectMetadataProbe, versionId: string) => void;
  clearSelectionAfterLoad: () => void;
  defaultCameraPresets: CameraPreset[];
}

export const mapStoredSceneStateToAppState = (
  state: SceneState,
  defaultCameraPresets: CameraPreset[],
): SceneStatePayload => ({
  models: (state.models as ModelData[]) || [],
  prefabs: state.prefabs || [],
  gridReceiveShadow: state.sceneSettings?.gridReceiveShadow ?? true,
  shadowSoftness: state.sceneSettings?.shadowSoftness ?? 0.5,
  environment: state.sceneSettings?.environment ?? DEFAULT_ENVIRONMENT,
  cameraPresets: state.cameraSettings?.presets ?? defaultCameraPresets,
  activeCameraPresetId: state.cameraSettings?.activePresetId ?? 'default-orbit',
  cameraPaths: state.cameraSettings?.paths ?? [],
  activeCameraPathId: state.cameraSettings?.activePathId ?? null,
  previewCameraPathId: null,
  layers: state.layers ?? DEFAULT_LAYERS,
  terrain: state.terrain ?? { heightMap: Array(64).fill(0).map(() => Array(64).fill(0)), materialMap: Array(64).fill(0).map(() => Array(64).fill('grass')), size: 64, resolution: 64 },
  paths: state.paths ?? [],
  collisionZones: state.collisionZones ?? [],
  qualitySettings: state.qualitySettings ?? DEFAULT_PROFILES[2].settings,
});

export const useScenePersistenceCoordinator = ({
  sceneState,
  projectMetadata,
  isInitialLoad,
  applyLoadedState,
  onVersionMetadata,
  clearSelectionAfterLoad,
  defaultCameraPresets,
}: UseScenePersistenceCoordinatorArgs) => {
  useEffect(() => {
    if (isInitialLoad) return;

    const timeoutId = setTimeout(() => {
      autoSaveScene(
        sceneState.models,
        sceneState.prefabs,
        {
          gridReceiveShadow: sceneState.gridReceiveShadow,
          shadowSoftness: sceneState.shadowSoftness,
          environment: sceneState.environment,
        },
        {
          presets: sceneState.cameraPresets,
          activePresetId: sceneState.activeCameraPresetId,
          paths: sceneState.cameraPaths,
          activePathId: sceneState.activeCameraPathId,
        },
        sceneState.layers,
        sceneState.terrain,
        sceneState.paths,
        sceneState.collisionZones,
        sceneState.qualitySettings,
      );
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [isInitialLoad, projectMetadata, sceneState]);

  const saveVersion = useCallback(async (note: string) => {
    await saveSceneVersion(
      sceneState.models,
      sceneState.prefabs,
      {
        gridReceiveShadow: sceneState.gridReceiveShadow,
        shadowSoftness: sceneState.shadowSoftness,
        environment: sceneState.environment,
      },
      note,
      {
        presets: sceneState.cameraPresets,
        activePresetId: sceneState.activeCameraPresetId,
        paths: sceneState.cameraPaths,
        activePathId: sceneState.activeCameraPathId,
      },
      sceneState.layers,
      sceneState.terrain,
      sceneState.paths,
      sceneState.collisionZones,
      sceneState.qualitySettings,
      projectMetadata
    );
  }, [projectMetadata, sceneState]);

  const loadVersion = useCallback(async (versionId: string) => {
    const state = await loadSceneVersion(versionId) as SceneState | null;
    if (!state) {
      alert('Failed to load version. It may be corrupted or missing.');
      return;
    }

    const metadataProbe = state.projectMetadata ?? {};
    onVersionMetadata(metadataProbe, state.versionId);

    applyLoadedState(mapStoredSceneStateToAppState(state, defaultCameraPresets));

    clearSelectionAfterLoad();
  }, [applyLoadedState, clearSelectionAfterLoad, defaultCameraPresets, onVersionMetadata]);

  return { saveVersion, loadVersion };
};
