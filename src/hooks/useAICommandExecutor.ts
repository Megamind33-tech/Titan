import { useCallback } from 'react';
import { ModelData } from '../App';
import { CommandExecutor, CommandExecutorCallbacks, CommandExecutorContext } from '../services/CommandExecutor';

interface UseAICommandExecutorParams {
  context: Omit<CommandExecutorContext, 'selectedModelId'> & { selectedModelId: string | null };
  callbacks: Omit<CommandExecutorCallbacks, 'onCloneModels'> & {
    onCloneModels: (sourceModel: ModelData, placements: Array<{ position: [number, number, number]; rotation: [number, number, number] }>) => string[];
  };
}

export function useAICommandExecutor({ context, callbacks }: UseAICommandExecutorParams) {
  return useCallback((command: any, onResult?: (result: { success: boolean; message: string }) => void) => {
    const executorContext: CommandExecutorContext = {
      models: context.models,
      selectedModelId: context.selectedModelId,
      layers: context.layers,
      environment: context.environment,
      cameraPresets: context.cameraPresets,
      activeCameraPresetId: context.activeCameraPresetId,
      cameraPaths: context.cameraPaths,
      activeCameraPathId: context.activeCameraPathId,
      prefabs: context.prefabs,
      collisionZones: context.collisionZones,
      materialLibrary: context.materialLibrary,
      environmentLibrary: context.environmentLibrary,
      paths: context.paths,
      assets: context.assets,
    };

    const executorCallbacks: CommandExecutorCallbacks = {
      ...callbacks,
      onCloneModels: callbacks.onCloneModels,
    };

    const executor = new CommandExecutor(executorContext, executorCallbacks);
    executor.execute(command).then(result => {
      if (onResult) {
        onResult({ success: result.success, message: result.message });
      }

      if (!result.success) {
        console.warn(`Command ${command.type} failed:`, result.message);
      } else {
        console.log(`Command ${command.type} succeeded:`, result.message);
      }
    }).catch(error => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (onResult) {
        onResult({ success: false, message: `Error: ${errorMessage}` });
      }
      console.error(`Error executing command ${command.type}:`, error);
    });
  }, [context, callbacks]);
}
