import { useCallback } from 'react';
import { Asset } from '../types/assets';
import { generateAuthoredId } from '../utils/idUtils';
import { ModelData } from '../App';

interface UseAssetWorkflowArgs {
  setModels: (next: ModelData[] | ((prev: ModelData[]) => ModelData[]), options?: { transient?: boolean; replace?: boolean }) => void;
  setSelectedModelId: (id: string | null) => void;
  selectedModelId: string | null;
  setReplacementAsset: (asset: Asset | null) => void;
  setIsReplacementModalOpen: (open: boolean) => void;
  setIsAssetBrowserOpen: (open: boolean) => void;
}

export const useAssetWorkflow = ({
  setModels,
  setSelectedModelId,
  selectedModelId,
  setReplacementAsset,
  setIsReplacementModalOpen,
  setIsAssetBrowserOpen,
}: UseAssetWorkflowArgs) => {
  const handlePlaceAsset = useCallback((asset: Asset, position: [number, number, number] = [0, 0, 0]) => {
    const newModel: ModelData = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      authoredId: generateAuthoredId(),
      name: asset.metadata.name,
      url: asset.url,
      assetId: asset.id,
      file: asset.file,
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      wireframe: false,
      lightIntensity: asset.metadata.type === 'light' ? 1 : 0,
      castShadow: true,
      receiveShadow: true,
      type: asset.metadata.type === 'model'
        ? 'model'
        : asset.metadata.type === 'light'
          ? 'light'
          : asset.metadata.type === 'environment'
            ? 'environment'
            : 'model',
      visible: true,
      locked: false,
      classification: asset.metadata.classification,
      behavior: asset.metadata.type === 'environment' ? 'environment' : 'movable',
      childrenIds: [],
    };
    setModels(models => [...models, newModel]);
    setSelectedModelId(newModel.id);
  }, [setModels, setSelectedModelId]);

  const handleCloneModels = useCallback((
    sourceModel: ModelData,
    placements: Array<{ position: [number, number, number]; rotation: [number, number, number] }>
  ): string[] => {
    const newIds = placements.map((_, index) => `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`);

    const clones = placements.map((placement, index): ModelData => ({
      ...sourceModel,
      id: newIds[index],
      authoredId: generateAuthoredId(),
      position: placement.position,
      rotation: placement.rotation,
      parentId: null,
      childrenIds: [],
      prefabInstanceId: undefined,
      isPrefabRoot: false,
      overriddenProperties: [],
      name: `${sourceModel.name} ${index + 1}`,
    }));

    setModels(prev => [...prev, ...clones]);
    if (newIds.length > 0) {
      setSelectedModelId(newIds[0]);
    }

    return newIds;
  }, [setModels, setSelectedModelId]);

  const handleCreateModelsFromAsset = useCallback((
    asset: Asset,
    placements: Array<{ position: [number, number, number]; rotation: [number, number, number] }>
  ): string[] => {
    const ids = placements.map((_, index) => `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`);
    const created: ModelData[] = placements.map((placement, index) => ({
      id: ids[index],
      authoredId: generateAuthoredId(),
      name: asset.metadata.name,
      url: asset.url,
      assetId: asset.id,
      file: asset.file,
      position: placement.position,
      rotation: placement.rotation,
      scale: [1, 1, 1],
      wireframe: false,
      lightIntensity: asset.metadata.type === 'light' ? 1 : 0,
      castShadow: true,
      receiveShadow: true,
      type: asset.metadata.type === 'model'
        ? 'model'
        : asset.metadata.type === 'light'
          ? 'light'
          : asset.metadata.type === 'environment'
            ? 'environment'
            : 'model',
      visible: true,
      locked: false,
      classification: asset.metadata.classification,
      behavior: asset.metadata.type === 'environment' ? 'environment' : 'movable',
      childrenIds: [],
    }));

    setModels(prev => [...prev, ...created]);
    if (ids.length > 0) setSelectedModelId(ids[0]);
    return ids;
  }, [setModels, setSelectedModelId]);

  const handleReplaceAsset = useCallback((asset: Asset) => {
    if (!selectedModelId) return;
    setReplacementAsset(asset);
    setIsReplacementModalOpen(true);
    setIsAssetBrowserOpen(false);
  }, [selectedModelId, setIsAssetBrowserOpen, setIsReplacementModalOpen, setReplacementAsset]);

  const handleConfirmReplacement = useCallback((
    newAsset: Asset,
    scaleMultiplier: [number, number, number],
    positionOffset: [number, number, number],
    materialRemap: { [oldMat: string]: string }
  ) => {
    if (!selectedModelId) return;

    setModels(models => models.map(m => {
      if (m.id !== selectedModelId) return m;
      return {
        ...m,
        name: newAsset.metadata.name,
        url: newAsset.url,
        assetId: newAsset.id,
        file: newAsset.file,
        type: newAsset.metadata.type === 'model'
          ? 'model'
          : newAsset.metadata.type === 'light'
            ? 'light'
            : newAsset.metadata.type === 'environment'
              ? 'environment'
              : 'model',
        classification: newAsset.metadata.classification,
        scale: [
          m.scale[0] * scaleMultiplier[0],
          m.scale[1] * scaleMultiplier[1],
          m.scale[2] * scaleMultiplier[2],
        ],
        position: [
          m.position[0] + positionOffset[0],
          m.position[1] + positionOffset[1],
          m.position[2] + positionOffset[2],
        ],
        materialRemap,
      };
    }));

    setIsReplacementModalOpen(false);
    setReplacementAsset(null);
  }, [selectedModelId, setIsReplacementModalOpen, setModels, setReplacementAsset]);

  return {
    handlePlaceAsset,
    handleCloneModels,
    handleCreateModelsFromAsset,
    handleReplaceAsset,
    handleConfirmReplacement,
  };
};
