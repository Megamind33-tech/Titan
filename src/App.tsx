import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import Sidebar from './components/Sidebar';
import Scene from './components/Scene';
import InspectorPanel from './components/InspectorPanel';
import Toolbar from './components/Toolbar';
import ExportModal, { ExportOptions } from './components/ExportModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import AssetBrowser from './components/AssetBrowser/AssetBrowser';
import { exportScene } from './utils/exportUtils';
import { saveSceneVersion, loadSceneVersion, autoSaveScene, loadAutoSave } from './utils/storageUtils';
import { useUndoRedo } from './hooks/useUndoRedo';
import { AssetLibraryProvider } from './hooks/useAssetLibrary';
import { MaterialLibraryProvider } from './hooks/useMaterialLibrary';
import { EnvironmentLibraryProvider } from './hooks/useEnvironmentLibrary';
import { Asset } from './types/assets';
import { MaterialPreset } from './types/materials';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from './types/environment';

export interface ModelData {
  id: string;
  name: string;
  url: string;
  assetId?: string;
  file?: File;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  dimensions?: { width: number; height: number; depth: number };
  wireframe?: boolean;
  lightIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureUrl?: string;
  textureFile?: File;
  type?: 'model' | 'environment' | 'light' | 'camera';
  visible?: boolean;
  locked?: boolean;
  classification?: 'indoor' | 'outdoor' | 'both';
  behavior?: 'static' | 'movable' | 'decorative' | 'environment' | 'gameplay-critical';
  parentId?: string | null;
  childrenIds?: string[];
  colorTint?: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissiveColor?: string;
  normalMapUrl?: string;
  normalMapFile?: File;
  material?: MaterialPreset;
}

interface AppState {
  models: ModelData[];
  gridReceiveShadow: boolean;
  shadowSoftness: number;
  environment: EnvironmentPreset;
}

export default function App() {
  const { state: appState, set: setAppState, undo, redo, canUndo, canRedo } = useUndoRedo<AppState>({
    models: [],
    gridReceiveShadow: true,
    shadowSoftness: 0.5,
    environment: DEFAULT_ENVIRONMENT
  });

  const models = appState.models;
  const gridReceiveShadow = appState.gridReceiveShadow;
  const shadowSoftness = appState.shadowSoftness;
  const environment = appState.environment;

  const setModels = useCallback((newModels: ModelData[] | ((prev: ModelData[]) => ModelData[]), options?: { transient?: boolean, replace?: boolean }) => {
    setAppState(prev => ({
      ...prev,
      models: typeof newModels === 'function' ? newModels(prev.models) : newModels
    }), options);
  }, [setAppState]);

  const setGridReceiveShadow = useCallback((val: boolean) => {
    setAppState(prev => ({ ...prev, gridReceiveShadow: val }));
  }, [setAppState]);

  const setShadowSoftness = useCallback((val: number) => {
    setAppState(prev => ({ ...prev, shadowSoftness: val }));
  }, [setAppState]);

  const setEnvironment = useCallback((val: EnvironmentPreset | ((prev: EnvironmentPreset) => EnvironmentPreset)) => {
    setAppState(prev => ({
      ...prev,
      environment: typeof val === 'function' ? val(prev.environment) : val
    }));
  }, [setAppState]);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [translationSnap, setTranslationSnap] = useState(1);
  const [rotationSnap, setRotationSnap] = useState(Math.PI / 4);
  const [scaleSnap, setScaleSnap] = useState(0.1);
  const [groundSnap, setGroundSnap] = useState(true);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(false);
  const [assetBrowserMode, setAssetBrowserMode] = useState<'place' | 'replace'>('place');
  const [threeScene, setThreeScene] = useState<THREE.Scene | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Load auto-save on mount
  useEffect(() => {
    const init = async () => {
      try {
        const savedState = await loadAutoSave();
        if (savedState) {
          setAppState({
            models: savedState.models || [],
            gridReceiveShadow: savedState.sceneSettings?.gridReceiveShadow ?? true,
            shadowSoftness: savedState.sceneSettings?.shadowSoftness ?? 0.5,
            environment: savedState.sceneSettings?.environment ?? DEFAULT_ENVIRONMENT
          }, { replace: true });
        }
      } catch (e) {
        console.error("Failed to load auto-save", e);
      } finally {
        setIsInitialLoad(false);
      }
    };
    init();
  }, []);

  // Auto-save when models or settings change
  useEffect(() => {
    if (isInitialLoad) return;
    
    const timeoutId = setTimeout(() => {
      autoSaveScene(models, { gridReceiveShadow, shadowSoftness, environment });
    }, 2000); // Debounce auto-save by 2 seconds

    return () => clearTimeout(timeoutId);
  }, [models, gridReceiveShadow, shadowSoftness, environment, isInitialLoad]);

  const handleFocus = useCallback(() => {
    setFocusTrigger(Date.now());
  }, []);

  const handleLoadModel = useCallback((file: File, type: 'model' | 'environment' | 'light' | 'camera' = 'model') => {
    const url = URL.createObjectURL(file);
    
    // Heuristic for initial scale based on filename
    const name = file.name.toLowerCase();
    let initialScale: [number, number, number] = [1, 1, 1];
    
    if (name.includes('skyscraper') || name.includes('tower') || name.includes('building')) {
      initialScale = [5, 5, 5];
    } else if (name.includes('house') || name.includes('cottage') || name.includes('villa')) {
      initialScale = [2, 2, 2];
    } else if (name.includes('tree') || name.includes('bush') || name.includes('plant')) {
      initialScale = [1.5, 1.5, 1.5];
    } else if (name.includes('car') || name.includes('taxi') || name.includes('vehicle')) {
      initialScale = [0.8, 0.8, 0.8];
    } else if (name.includes('person') || name.includes('character') || name.includes('human')) {
      initialScale = [0.5, 0.5, 0.5];
    } else if (name.includes('prop') || name.includes('item') || name.includes('small')) {
      initialScale = [0.3, 0.3, 0.3];
    }

    const newModel: ModelData = {
      id: Date.now().toString(),
      name: file.name,
      url,
      file,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: initialScale,
      wireframe: false,
      lightIntensity: 0,
      castShadow: true,
      receiveShadow: true,
      type,
      visible: true,
      locked: false,
      classification: 'outdoor',
      behavior: 'movable',
      childrenIds: [],
    };
    setModels(models => [...models, newModel]);
    setSelectedModelId(newModel.id);
  }, [setModels]);

  const handlePlaceAsset = useCallback((asset: Asset, position: [number, number, number] = [0, 0, 0]) => {
    const newModel: ModelData = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
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
      type: asset.metadata.type === 'model' ? 'model' : 
            asset.metadata.type === 'light' ? 'light' : 
            asset.metadata.type === 'environment' ? 'environment' : 'model',
      visible: true,
      locked: false,
      classification: asset.metadata.classification,
      behavior: asset.metadata.type === 'environment' ? 'environment' : 'movable',
      childrenIds: [],
    };
    setModels(models => [...models, newModel]);
    setSelectedModelId(newModel.id);
    // Don't close browser if we are placing (allows multiple placements)
    // setIsAssetBrowserOpen(false);
  }, [setModels]);

  const handleReplaceAsset = useCallback((asset: Asset) => {
    if (!selectedModelId) return;
    setModels(models => models.map(m => m.id === selectedModelId ? {
      ...m,
      name: asset.metadata.name,
      url: asset.url,
      assetId: asset.id,
      file: asset.file,
      type: asset.metadata.type === 'model' ? 'model' : 
            asset.metadata.type === 'light' ? 'light' : 
            asset.metadata.type === 'environment' ? 'environment' : 'model',
      classification: asset.metadata.classification,
    } : m));
    setIsAssetBrowserOpen(false);
  }, [selectedModelId, setModels]);

  const handleScaleChange = useCallback((id: string, scale: number) => {
    setModels(models => models.map(m => m.id === id ? { ...m, scale: [scale, scale, scale] } : m));
  }, []);

  const handlePositionChange = useCallback((id: string, position: [number, number, number]) => {
    setModels(models => models.map(m => m.id === id ? { ...m, position } : m), { transient: true });
  }, [setModels]);

  const handleRotationChange = useCallback((id: string, rotation: [number, number, number]) => {
    setModels(models => models.map(m => m.id === id ? { ...m, rotation } : m), { transient: true });
  }, [setModels]);

  const handleScaleChangeFull = useCallback((id: string, scale: [number, number, number]) => {
    setModels(models => models.map(m => m.id === id ? { ...m, scale } : m), { transient: true });
  }, [setModels]);

  const handleModelDimensionsChange = useCallback((id: string, dimensions: { width: number; height: number; depth: number }) => {
    setModels(models => models.map(m => m.id === id ? { ...m, dimensions } : m), { replace: true });
  }, [setModels]);

  const handleUpdateModel = useCallback((id: string, updates: Partial<ModelData>) => {
    setModels(models => {
      let nextModels = [...models];
      const modelIndex = nextModels.findIndex(m => m.id === id);
      if (modelIndex === -1) return nextModels;
      
      const oldModel = nextModels[modelIndex];
      
      // Handle parentId changes
      if ('parentId' in updates && updates.parentId !== oldModel.parentId) {
        // Remove from old parent
        if (oldModel.parentId) {
          const oldParentIndex = nextModels.findIndex(m => m.id === oldModel.parentId);
          if (oldParentIndex !== -1) {
            nextModels[oldParentIndex] = {
              ...nextModels[oldParentIndex],
              childrenIds: (nextModels[oldParentIndex].childrenIds || []).filter(cid => cid !== id)
            };
          }
        }
        // Add to new parent
        if (updates.parentId) {
          const newParentIndex = nextModels.findIndex(m => m.id === updates.parentId);
          if (newParentIndex !== -1) {
            nextModels[newParentIndex] = {
              ...nextModels[newParentIndex],
              childrenIds: [...(nextModels[newParentIndex].childrenIds || []), id]
            };
          }
        }
      }

      // Handle childrenIds changes (e.g. removing a child from the list)
      if ('childrenIds' in updates) {
        const oldChildren = oldModel.childrenIds || [];
        const newChildren = updates.childrenIds || [];
        
        // Find removed children
        const removedChildren = oldChildren.filter(cid => !newChildren.includes(cid));
        removedChildren.forEach(cid => {
          const childIndex = nextModels.findIndex(m => m.id === cid);
          if (childIndex !== -1) {
            nextModels[childIndex] = { ...nextModels[childIndex], parentId: null };
          }
        });
        
        // Find added children
        const addedChildren = newChildren.filter(cid => !oldChildren.includes(cid));
        addedChildren.forEach(cid => {
          const childIndex = nextModels.findIndex(m => m.id === cid);
          if (childIndex !== -1) {
            // Remove from their old parent first
            const oldParentId = nextModels[childIndex].parentId;
            if (oldParentId && oldParentId !== id) {
              const oldParentIndex = nextModels.findIndex(m => m.id === oldParentId);
              if (oldParentIndex !== -1) {
                nextModels[oldParentIndex] = {
                  ...nextModels[oldParentIndex],
                  childrenIds: (nextModels[oldParentIndex].childrenIds || []).filter(c => c !== cid)
                };
              }
            }
            nextModels[childIndex] = { ...nextModels[childIndex], parentId: id };
          }
        });
      }

      nextModels[modelIndex] = { ...nextModels[modelIndex], ...updates };
      return nextModels;
    });
  }, [setModels]);

  const handleDuplicateModel = useCallback((id: string) => {
    setModels(models => {
      const modelToDuplicate = models.find(m => m.id === id);
      if (!modelToDuplicate) return models;
      const newModel = {
        ...modelToDuplicate,
        id: Math.random().toString(36).substring(7),
        name: `${modelToDuplicate.name} (Copy)`,
        position: [modelToDuplicate.position[0] + 1, modelToDuplicate.position[1], modelToDuplicate.position[2] + 1] as [number, number, number],
        parentId: null,
        childrenIds: []
      };
      return [...models, newModel];
    });
  }, [setModels]);

  const handleDeleteModel = useCallback((id: string) => {
    setModels(models => {
      let nextModels = [...models];
      const modelToDelete = nextModels.find(m => m.id === id);
      
      if (modelToDelete) {
        // Remove from parent
        if (modelToDelete.parentId) {
          const parentIndex = nextModels.findIndex(m => m.id === modelToDelete.parentId);
          if (parentIndex !== -1) {
            nextModels[parentIndex] = {
              ...nextModels[parentIndex],
              childrenIds: (nextModels[parentIndex].childrenIds || []).filter(cid => cid !== id)
            };
          }
        }
        
        // Clear parentId for children
        if (modelToDelete.childrenIds) {
          modelToDelete.childrenIds.forEach(cid => {
            const childIndex = nextModels.findIndex(m => m.id === cid);
            if (childIndex !== -1) {
              nextModels[childIndex] = { ...nextModels[childIndex], parentId: null };
            }
          });
        }
      }
      
      return nextModels.filter(m => m.id !== id);
    });
    setSelectedModelId(null);
  }, [setModels]);

  const handleResetModel = useCallback((id: string) => {
    setModels(models => models.map(m => m.id === id ? { ...m, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], wireframe: false, lightIntensity: 0, castShadow: true, receiveShadow: true, textureUrl: undefined, textureFile: undefined, normalMapUrl: undefined, normalMapFile: undefined, colorTint: '#ffffff', opacity: 1, roughness: 0.5, metalness: 0, emissiveColor: '#000000' } : m));
  }, [setModels]);

  const handleClearScene = useCallback(() => {
    setModels([]);
    setSelectedModelId(null);
  }, []);

  const handleExport = useCallback((selectedIds: string[], options: ExportOptions) => {
    exportScene(models, { gridReceiveShadow, shadowSoftness, environment }, threeScene, { selectedIds, ...options });
  }, [models, gridReceiveShadow, shadowSoftness, environment, threeScene]);

  const handleSaveVersion = useCallback(async (note: string) => {
    await saveSceneVersion(models, { gridReceiveShadow, shadowSoftness, environment }, note);
  }, [models, gridReceiveShadow, shadowSoftness, environment]);

  const handleLoadVersion = useCallback(async (versionId: string) => {
    const state = await loadSceneVersion(versionId);
    if (state) {
      setAppState({
        models: state.models || [],
        gridReceiveShadow: state.sceneSettings?.gridReceiveShadow ?? true,
        shadowSoftness: state.sceneSettings?.shadowSoftness ?? 0.5,
        environment: state.sceneSettings?.environment ?? DEFAULT_ENVIRONMENT
      });
      setSelectedModelId(null);
    } else {
      alert("Failed to load version. It may be corrupted or missing.");
    }
  }, [setAppState]);

  const handleTransformEnd = useCallback(() => {
    setAppState(prev => prev, { transient: false });
  }, [setAppState]);

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
    <AssetLibraryProvider>
      <MaterialLibraryProvider>
        <EnvironmentLibraryProvider>
          <div className="w-full h-screen flex relative overflow-hidden">
        <div className="absolute top-4 left-4 z-50 flex gap-2">
          <button
            onClick={() => setUiVisible(!uiVisible)}
            className="bg-gray-900 text-white p-2 px-4 rounded-md shadow-lg border border-gray-700 hover:bg-gray-800 flex items-center gap-2 transition-colors"
          >
            {uiVisible ? '👁️ Hide UI' : '👁️ Show UI'}
          </button>
          
          {uiVisible && (
            <>
              <button
                onClick={() => {
                  setAssetBrowserMode('place');
                  setIsAssetBrowserOpen(true);
                }}
                className="bg-blue-600 text-white p-2 px-4 rounded-md shadow-lg border border-blue-500 hover:bg-blue-500 flex items-center gap-2 transition-colors"
              >
                <span>📦</span> Asset Library
              </button>
              <button
                onClick={undo}
                disabled={!canUndo}
                className="bg-gray-900 text-white p-2 px-4 rounded-md shadow-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                title="Undo (Ctrl+Z)"
              >
                ↩️ Undo
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="bg-gray-900 text-white p-2 px-4 rounded-md shadow-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                title="Redo (Ctrl+Y)"
              >
                ↪️ Redo
              </button>
            </>
          )}
        </div>

        {uiVisible && (
          <Sidebar 
            onLoadModel={handleLoadModel} 
            onClearScene={handleClearScene}
            models={models}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
            onScaleChange={handleScaleChange}
            gridReceiveShadow={gridReceiveShadow}
            onGridReceiveShadowChange={setGridReceiveShadow}
            shadowSoftness={shadowSoftness}
            onShadowSoftnessChange={setShadowSoftness}
            onExportClick={() => setIsExportModalOpen(true)}
            onHistoryClick={() => setIsHistoryModalOpen(true)}
            onAssetLibraryClick={() => setIsAssetBrowserOpen(true)}
          />
        )}
        <div className="flex-1 h-full relative">
          {uiVisible && selectedModel && (
            <Toolbar 
              transformMode={transformMode}
              onTransformModeChange={setTransformMode}
              snapEnabled={snapEnabled}
              onSnapEnabledChange={setSnapEnabled}
              groundSnap={groundSnap}
              onGroundSnapChange={setGroundSnap}
              translationSnap={translationSnap}
              onTranslationSnapChange={setTranslationSnap}
              rotationSnap={rotationSnap}
              onRotationSnapChange={setRotationSnap}
              scaleSnap={scaleSnap}
              onScaleSnapChange={setScaleSnap}
            />
          )}
          <Scene 
            models={models} 
            selectedModelId={selectedModelId}
            focusTrigger={focusTrigger}
            transformMode={transformMode} 
            snapEnabled={snapEnabled}
            groundSnap={groundSnap}
            translationSnap={translationSnap}
            rotationSnap={rotationSnap}
            scaleSnap={scaleSnap}
            onModelDimensionsChange={handleModelDimensionsChange}
            onModelPositionChange={handlePositionChange}
            onModelRotationChange={handleRotationChange}
            onModelScaleChange={handleScaleChangeFull}
            onTransformEnd={handleTransformEnd}
            onSelect={setSelectedModelId}
            onDropAsset={handlePlaceAsset}
            gridReceiveShadow={gridReceiveShadow}
            shadowSoftness={shadowSoftness}
            environment={environment}
            onSceneReady={setThreeScene}
          />
        </div>
          {uiVisible && (
            <InspectorPanel 
              model={selectedModel}
              models={models}
              onUpdateModel={handleUpdateModel}
              onReset={handleResetModel}
              onFocus={handleFocus}
              onDuplicate={handleDuplicateModel}
              onDelete={handleDeleteModel}
              onReplaceAsset={() => {
                setAssetBrowserMode('replace');
                setIsAssetBrowserOpen(true);
              }}
              environment={environment}
              onUpdateEnvironment={setEnvironment}
            />
          )}
        <ExportModal 
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          models={models}
          onExport={handleExport}
        />
        <VersionHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onLoadVersion={handleLoadVersion}
          onSaveNewVersion={handleSaveVersion}
        />
        <AssetBrowser 
          isOpen={isAssetBrowserOpen}
          onClose={() => setIsAssetBrowserOpen(false)}
          onPlaceAsset={assetBrowserMode === 'place' ? handlePlaceAsset : handleReplaceAsset}
        />
      </div>
        </EnvironmentLibraryProvider>
      </MaterialLibraryProvider>
    </AssetLibraryProvider>
  );
}
