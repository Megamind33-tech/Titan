import { MutableRefObject, useEffect } from 'react';
import { pluginManager } from '../services/PluginManager';
import { validatePluginScenePatch } from '../services/PluginSceneValidation';
import { DiagnosticsPlugin } from '../plugins/DiagnosticsPlugin';

interface SceneSnapshot {
  models: any;
  layers: any;
  paths: any;
  prefabs: any;
}

interface UsePluginBootstrapArgs {
  sceneStateRef: MutableRefObject<SceneSnapshot>;
  sceneSubscribersRef: MutableRefObject<Set<(snapshot: SceneSnapshot) => void>>;
  assetsRef: MutableRefObject<any[]>;
  addAssetRef: MutableRefObject<(file: File, category: any) => void>;
  setModels: (models: any) => void;
  setLayers: (layers: any) => void;
  setAppState: (updater: any) => void;
  triggerUIUpdate: () => void;
  snapshot: SceneSnapshot;
}

export const usePluginBootstrap = ({
  sceneStateRef,
  sceneSubscribersRef,
  assetsRef,
  addAssetRef,
  setModels,
  setLayers,
  setAppState,
  triggerUIUpdate,
  snapshot,
}: UsePluginBootstrapArgs) => {
  useEffect(() => {
    pluginManager.initCoreApi({
      getSceneState: () => sceneStateRef.current,
      updateSceneState: (updater: (state: any) => any) => {
        if (typeof updater !== 'function') {
          throw new Error('updateSceneState requires an updater function');
        }
        const currentState = sceneStateRef.current;
        const newState = validatePluginScenePatch(updater(currentState));

        if (newState?.models !== undefined && newState.models !== currentState.models) {
          setModels(newState.models);
        }
        if (newState?.layers !== undefined && newState.layers !== currentState.layers) {
          setLayers(newState.layers);
        }
        if (newState?.paths !== undefined || newState?.prefabs !== undefined) {
          setAppState((prev: any) => ({
            ...prev,
            ...(newState?.paths !== undefined && { paths: newState.paths }),
            ...(newState?.prefabs !== undefined && { prefabs: newState.prefabs }),
          }));
        }
      },
      subscribeToScene: (listener: any) => {
        listener(sceneStateRef.current);
        sceneSubscribersRef.current.add(listener);
        return () => sceneSubscribersRef.current.delete(listener);
      },
      getAssetLibrary: () => assetsRef.current,
      addAsset: (assetPayload: { file: File; category: any }) => {
        if (!assetPayload?.file || !assetPayload?.category) {
          throw new Error('addAsset requires { file, category }');
        }
        addAssetRef.current(assetPayload.file, assetPayload.category);
      },
      triggerUIUpdate,
    });

    pluginManager.register(DiagnosticsPlugin);
  }, [addAssetRef, assetsRef, sceneStateRef, sceneSubscribersRef, setAppState, setLayers, setModels, triggerUIUpdate]);

  useEffect(() => {
    sceneStateRef.current = snapshot;
    sceneSubscribersRef.current.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Plugin scene subscriber failed', error);
      }
    });
  }, [sceneStateRef, sceneSubscribersRef, snapshot]);
};
