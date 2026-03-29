import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Sparkles } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Scene from './components/Scene';
import InspectorPanel from './components/InspectorPanel';
import Toolbar from './components/Toolbar';
import ExportModal, { ExportOptions } from './components/ExportModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import AssetBrowser from './components/AssetBrowser/AssetBrowser';
import { GitHubImportModal } from './components/GitHubImportModal';
import GeminiAssistant from './components/GeminiAssistant';
import SceneLayerPanel from './components/SceneLayerPanel';
import PrefabCreationModal from './components/PrefabCreationModal';
import AssetReplacementModal from './components/AssetReplacementModal';
import { exportScene } from './utils/exportUtils';
import { saveSceneVersion, loadSceneVersion, autoSaveScene, loadAutoSave, SceneState } from './utils/storageUtils';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useMaterialLibrary } from './hooks/useMaterialLibrary';
import { useEnvironmentLibrary } from './hooks/useEnvironmentLibrary';
import { useAssetLibrary } from './hooks/useAssetLibrary';
import { Asset } from './types/assets';
import { MaterialPreset } from './types/materials';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from './types/environment';
import { CameraPreset, CameraPath, CameraCategory } from './types/camera';
import { Layer, DEFAULT_LAYERS } from './types/layers';
import { CollisionZone } from './types/collision';
import { Prefab, PREFAB_CATEGORIES, PrefabCategory } from './types/prefabs';
import { TerrainData } from './types/terrain';
import { Path } from './types/paths';
import { AssetMetrics } from './types/performance';
import { DeviceProfile, QualitySettings } from './types/quality';
import { DEFAULT_PROFILES } from './constants/qualityProfiles';
import { pluginManager } from './services/PluginManager';
import { validatePluginScenePatch } from './services/PluginSceneValidation';
import { DiagnosticsPlugin } from './plugins/DiagnosticsPlugin';
import { useAICommandExecutor } from './hooks/useAICommandExecutor';
import { activateProjectForEditor } from './services/ProjectLoadService';
import { validateExportFormatForAdapter } from './services/ProjectAdapterRegistry';
import { ProjectMetadataProbe } from './types/projectAdapter';
import { ProjectSession } from './types/projectSession';
import { createProjectSession, loadProjectSession, persistProjectSession } from './services/ProjectSessionService';
import { getProjectSelectionGuidance } from './services/ProjectAdapterRegistry';
import ProjectOnboardingModal from './components/ProjectOnboardingModal';
import { getProjectAwareExportConfig } from './services/ProjectExportWorkflow';
import { generateAuthoredId } from './utils/idUtils';
import {
  loadImportedObjects,
  loadImportedEnvironment,
  loadImportedPaths,
  createImportSummary,
} from './services/ImportedSceneLoader';
import { LoadedSceneData } from './services/Swim26ManifestLoader';

export interface ModelData {
  id: string;
  authoredId: string;  // Stable round-trip identifier (UUID v4), never changes
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
  layerId?: string;
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
  // Prefab fields
  prefabId?: string;
  prefabInstanceId?: string;
  isPrefabRoot?: boolean;
  overriddenProperties?: string[];
  performanceMetrics?: AssetMetrics;
  materialRemap?: { [oldMat: string]: string };
  behaviorTags?: string[];
}

interface AppState {
  models: ModelData[];
  prefabs: Prefab[];
  gridReceiveShadow: boolean;
  shadowSoftness: number;
  environment: EnvironmentPreset;
  cameraPresets: CameraPreset[];
  activeCameraPresetId: string | null;
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
  layers: Layer[];
  terrain: TerrainData;
  paths: Path[];
  collisionZones: CollisionZone[];
  activeProfileId: string;
  customProfile: QualitySettings;
}

const DEFAULT_CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'default-orbit',
    name: 'Default Orbit',
    category: 'Editor Orbit',
    type: 'perspective',
    position: [10, 10, 10],
    rotation: [0, 0, 0],
    target: [0, 0, 0],
    fov: 50,
    near: 0.1,
    far: 1000,
    sensitivity: 1,
  },
  {
    id: 'swimming-poolside',
    name: 'Poolside View',
    category: 'Swimming: Poolside',
    type: 'perspective',
    position: [15, 5, 0],
    rotation: [0, -Math.PI / 2, 0],
    target: [0, 0, 0],
    fov: 45,
    near: 0.1,
    far: 1000,
    sensitivity: 1,
  },
  {
    id: 'swimming-topdown',
    name: 'Top-down Lanes',
    category: 'Swimming: Top-down Lane',
    type: 'perspective',
    position: [0, 20, 0],
    rotation: [-Math.PI / 2, 0, 0],
    target: [0, 0, 0],
    fov: 40,
    near: 0.1,
    far: 1000,
    sensitivity: 1,
  }
];

export default function App() {
  const { assets, addAsset } = useAssetLibrary();
  const { presets: materialPresets } = useMaterialLibrary();
  const { presets: environmentPresets } = useEnvironmentLibrary();

  const { state: appState, set: setAppState, undo, redo, canUndo, canRedo } = useUndoRedo<AppState>({
    models: [],
    prefabs: [],
    gridReceiveShadow: true,
    shadowSoftness: 0.5,
    environment: DEFAULT_ENVIRONMENT,
    cameraPresets: DEFAULT_CAMERA_PRESETS,
    activeCameraPresetId: 'default-orbit',
    cameraPaths: [],
    activeCameraPathId: null,
    layers: DEFAULT_LAYERS,
    terrain: {
      heightMap: Array(64).fill(0).map(() => Array(64).fill(0)),
      materialMap: Array(64).fill(0).map(() => Array(64).fill('grass')),
      size: 64,
      resolution: 64
    },
    paths: [],
    collisionZones: [],
    activeProfileId: 'high',
    customProfile: DEFAULT_PROFILES[2].settings
  });

  const models = appState.models;
  const prefabs = appState.prefabs;
  const gridReceiveShadow = appState.gridReceiveShadow;
  const shadowSoftness = appState.shadowSoftness;
  const environment = appState.environment;
  const cameraPresets = appState.cameraPresets;
  const activeCameraPresetId = appState.activeCameraPresetId;
  const cameraPaths = appState.cameraPaths;
  const activeCameraPathId = appState.activeCameraPathId;
  const layers = appState.layers;

  const [selectionFilter, setSelectionFilter] = useState<string[]>(['model', 'light', 'camera', 'environment', 'helper']);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [preSoloLayers, setPreSoloLayers] = useState<Layer[] | null>(null);
  const [placementPrefabId, setPlacementPrefabId] = useState<string | null>(null);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadataProbe>({});
  const [activeProject, setActiveProject] = useState(() => activateProjectForEditor({}));
  const [projectSession, setProjectSession] = useState<ProjectSession | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sessionRecoveryMessage, setSessionRecoveryMessage] = useState<string | null>(null);
  const [isGitHubImportModalOpen, setIsGitHubImportModalOpen] = useState(false);

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

  const setCameraPresets = useCallback((val: CameraPreset[] | ((prev: CameraPreset[]) => CameraPreset[])) => {
    setAppState(prev => ({
      ...prev,
      cameraPresets: typeof val === 'function' ? val(prev.cameraPresets) : val
    }));
  }, [setAppState]);

  const setActiveCameraPresetId = useCallback((id: string | null) => {
    setAppState(prev => ({ ...prev, activeCameraPresetId: id }));
  }, [setAppState]);

  const setCameraPaths = useCallback((val: CameraPath[] | ((prev: CameraPath[]) => CameraPath[])) => {
    setAppState(prev => ({
      ...prev,
      cameraPaths: typeof val === 'function' ? val(prev.cameraPaths) : val
    }));
  }, [setAppState]);

  const setLayers = useCallback((val: Layer[] | ((prev: Layer[]) => Layer[])) => {
    setAppState(prev => ({
      ...prev,
      layers: typeof val === 'function' ? val(prev.layers) : val
    }));
  }, [setAppState]);

  const setPrefabs = useCallback((val: Prefab[] | ((prev: Prefab[]) => Prefab[])) => {
    setAppState(prev => ({
      ...prev,
      prefabs: typeof val === 'function' ? val(prev.prefabs) : val
    }));
  }, [setAppState]);

  const setCollisionZones = useCallback((val: CollisionZone[] | ((prev: CollisionZone[]) => CollisionZone[])) => {
    setAppState(prev => ({
      ...prev,
      collisionZones: typeof val === 'function' ? val(prev.collisionZones) : val
    }));
  }, [setAppState]);

  const handleAddZone = useCallback((zone: CollisionZone) => {
    setCollisionZones(prev => [...prev, zone]);
  }, [setCollisionZones]);

  const handleUpdateZone = useCallback((id: string, updates: Partial<CollisionZone>) => {
    setCollisionZones(prev => prev.map(z => z.id === id ? { ...z, ...updates } : z));
  }, [setCollisionZones]);

  const handleDeleteZone = useCallback((id: string) => {
    setCollisionZones(prev => prev.filter(z => z.id !== id));
  }, [setCollisionZones]);

  const handleUpdateLayer = useCallback((id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, [setLayers]);

  const handleAddLayer = useCallback((name: string) => {
    const id = `custom-${Date.now()}`;
    const order = layers.length;
    setLayers(prev => [...prev, { id, name, visible: true, locked: false, isCustom: true, order }]);
  }, [layers.length, setLayers]);

  const handleDeleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    // Move objects in deleted layer to 'env'
    setModels(prev => prev.map(m => m.layerId === id ? { ...m, layerId: 'env' } : m));
  }, [setLayers, setModels]);

  const handleSoloLayer = useCallback((id: string) => {
    const isAlreadySolo = layers.every(l => l.id === id ? l.visible : !l.visible);
    
    if (isAlreadySolo && preSoloLayers) {
      // Restore previous state
      setLayers(preSoloLayers);
      setPreSoloLayers(null);
    } else {
      // If we're already soloing something else, we don't want to overwrite the original pre-solo state
      if (!preSoloLayers) {
        setPreSoloLayers(layers);
      }
      setLayers(prev => prev.map(l => ({ ...l, visible: l.id === id })));
    }
  }, [layers, preSoloLayers, setLayers]);

  const handleUnhideAllLayers = useCallback(() => {
    setLayers(prev => prev.map(l => ({ ...l, visible: true })));
    setPreSoloLayers(null);
  }, [setLayers]);

  const setActiveCameraPathId = useCallback((id: string | null) => {
    setAppState(prev => ({ ...prev, activeCameraPathId: id }));
  }, [setAppState]);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isPrefabModalOpen, setIsPrefabModalOpen] = useState(false);
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [replacementAsset, setReplacementAsset] = useState<Asset | null>(null);

  const handleSelectModel = useCallback((id: string | null) => {
    setSelectedModelId(id);
    setSelectedModelIds(id ? [id] : []);
  }, []);

  const handleToggleSelectModel = useCallback((id: string) => {
    setSelectedModelIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(i => i !== id);
        if (selectedModelId === id) setSelectedModelId(next[0] || null);
        return next;
      } else {
        setSelectedModelId(id);
        return [...prev, id];
      }
    });
  }, [selectedModelId]);

  const handleCreatePrefab = useCallback((name: string, category: PrefabCategory, tags: string[]) => {
    const selectedModels = models.filter(m => selectedModelIds.includes(m.id));
    if (selectedModels.length === 0) return;

    // Find the root (the one with no parent in the selection, or the first one)
    const root = selectedModels.find(m => !m.parentId || !selectedModelIds.includes(m.parentId)) || selectedModels[0];
    
    // Map of old IDs to new IDs for internal prefab references
    const idMap: Record<string, string> = {};
    selectedModels.forEach(m => {
      idMap[m.id] = crypto.randomUUID();
    });

    const prefabModels = selectedModels.map(m => {
      const isRoot = m.id === root.id;
      const newPosition: [number, number, number] = isRoot
        ? [0, 0, 0]
        : [m.position[0] - root.position[0], m.position[1] - root.position[1], m.position[2] - root.position[2]];
      return {
        ...m,
        id: idMap[m.id],
        parentId: m.parentId && idMap[m.parentId] ? idMap[m.parentId] : null,
        childrenIds: m.childrenIds?.map(cid => idMap[cid]).filter(Boolean) as string[],
        position: newPosition,
        isPrefabRoot: isRoot
      };
    });

    const newPrefab: Prefab = {
      id: `prefab-${Date.now()}`,
      name,
      category,
      tags,
      models: prefabModels
    };

    setPrefabs(prev => [...prev, newPrefab]);
  }, [models, selectedModelIds, setPrefabs]);

  const handlePlacePrefab = useCallback((prefab: Prefab) => {
    // Enter placement mode
    setPlacementPrefabId(prefab.id);
  }, []);

  const handlePlacePrefabAtPosition = useCallback((position: [number, number, number]) => {
    if (!placementPrefabId) return;
    const prefab = prefabs.find(p => p.id === placementPrefabId);
    if (!prefab) return;

    const instanceId = `instance-${Date.now()}`;
    const newModels: ModelData[] = prefab.models.map(pm => {
      const isRoot = pm.isPrefabRoot;
      return {
        ...(pm as any),
        id: crypto.randomUUID(),
        authoredId: generateAuthoredId(),  // New authoredId for prefab instance
        prefabId: prefab.id,
        prefabInstanceId: instanceId,
        position: (isRoot ? position : [
          (pm.position as [number, number, number])[0] + position[0],
          (pm.position as [number, number, number])[1] + position[1],
          (pm.position as [number, number, number])[2] + position[2]
        ]) as [number, number, number],
        layerId: 'env'
      } as ModelData;
    });

    setModels(prev => [...prev, ...newModels]);
  }, [placementPrefabId, prefabs, setModels]);

  const handleDeletePrefab = useCallback((id: string) => {
    setPrefabs(prev => prev.filter(p => p.id !== id));
  }, [setPrefabs]);

  const handleApplyToPrefab = useCallback((instanceId: string, prefabId: string) => {
    const instanceRoot = models.find(m => m.id === instanceId);
    if (!instanceRoot || !instanceRoot.prefabInstanceId) return;

    const instanceModels = models.filter(m => m.prefabInstanceId === instanceRoot.prefabInstanceId);
    const prefab = prefabs.find(p => p.id === prefabId);
    if (!prefab) return;

    // Update prefab definition
    const updatedPrefabModels = instanceModels.map(im => {
      const isRoot = im.isPrefabRoot;
      const prefabModel = prefab.models.find(pm => pm.name === im.name);
      
      const { id, prefabId: pid, prefabInstanceId: piid, isPrefabRoot: ipr, overriddenProperties, ...rest } = im;
      
      return {
        ...rest,
        id: prefabModel?.id || crypto.randomUUID(),
        position: isRoot ? [0, 0, 0] : [im.position[0] - instanceRoot.position[0], im.position[1] - instanceRoot.position[1], im.position[2] - instanceRoot.position[2]],
        isPrefabRoot: isRoot
      } as ModelData;
    });

    setPrefabs(prev => prev.map(p => p.id === prefabId ? { ...p, models: updatedPrefabModels } : p));

    // Propagate to all other instances
    setModels(prev => prev.map(m => {
      if (m.prefabId === prefabId && m.prefabInstanceId !== instanceRoot.prefabInstanceId) {
        const prefabModel = updatedPrefabModels.find(pm => pm.name === m.name);
        if (prefabModel) {
          const overrides = m.overriddenProperties || [];
          const updates: Partial<ModelData> = {};
          
          Object.keys(prefabModel).forEach(key => {
            if (!['id', 'isPrefabRoot', 'parentId', 'childrenIds'].includes(key) && !overrides.includes(key)) {
              (updates as any)[key] = (prefabModel as any)[key];
            }
          });

          return { ...m, ...updates };
        }
      }
      return m;
    }));
  }, [models, prefabs, setModels, setPrefabs]);

  const handleResetInstanceOverrides = useCallback((instanceId: string) => {
    const instanceRoot = models.find(m => m.id === instanceId);
    if (!instanceRoot || !instanceRoot.prefabInstanceId || !instanceRoot.prefabId) return;

    const prefab = prefabs.find(p => p.id === instanceRoot.prefabId);
    if (!prefab) return;

    setModels(prev => prev.map(m => {
      if (m.prefabInstanceId === instanceRoot.prefabInstanceId) {
        const prefabModel = prefab.models.find(pm => pm.name === m.name);
        if (prefabModel) {
          const { id, isPrefabRoot, parentId, childrenIds, ...rest } = prefabModel;
          return {
            ...m,
            ...rest,
            overriddenProperties: []
          };
        }
      }
      return m;
    }));
  }, [models, prefabs, setModels]);

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
  const [pluginUIVersion, setPluginUIVersion] = useState(0);
  const sceneSubscribersRef = useRef(new Set<(state: any) => void>());
  const sceneStateRef = useRef({
    models: appState.models,
    layers: appState.layers,
    paths: appState.paths,
    prefabs: appState.prefabs,
  });
  const assetsRef = useRef(assets);
  const addAssetRef = useRef(addAsset);

  useEffect(() => {
    assetsRef.current = assets;
    addAssetRef.current = addAsset;
  }, [assets, addAsset]);

  // Initialize Plugin System with stable API bridge
  useEffect(() => {
    pluginManager.initCoreApi({
      getSceneState: () => sceneStateRef.current,
      updateSceneState: (updater: (state: any) => any) => {
        if (typeof updater !== 'function') {
          throw new Error('updateSceneState requires an updater function');
        }
        const currentState = sceneStateRef.current;
        let newState: any;

        try {
          // Validate the entire patch before applying any state changes
          newState = validatePluginScenePatch(updater(currentState));
        } catch (error) {
          // Validation failed - NO state changes applied (atomic)
          throw error;
        }

        // ATOMIC: Collect all state updates and apply together
        // This prevents partial state mutations if any setter fails
        const stateUpdates: { models?: any; layers?: any; paths?: any; prefabs?: any } = {};
        let hasUpdates = false;

        if (newState?.models !== undefined && newState.models !== currentState.models) {
          stateUpdates.models = newState.models;
          hasUpdates = true;
        }
        if (newState?.layers !== undefined && newState.layers !== currentState.layers) {
          stateUpdates.layers = newState.layers;
          hasUpdates = true;
        }
        if (newState?.paths !== undefined && newState.paths !== currentState.paths) {
          stateUpdates.paths = newState.paths;
          hasUpdates = true;
        }
        if (newState?.prefabs !== undefined && newState.prefabs !== currentState.prefabs) {
          stateUpdates.prefabs = newState.prefabs;
          hasUpdates = true;
        }

        // Apply all collected updates atomically
        if (hasUpdates) {
          if (stateUpdates.models !== undefined) {
            setModels(stateUpdates.models);
          }
          if (stateUpdates.layers !== undefined) {
            setLayers(stateUpdates.layers);
          }
          if (stateUpdates.paths !== undefined || stateUpdates.prefabs !== undefined) {
            setAppState(prev => ({
              ...prev,
              ...(stateUpdates.paths !== undefined && { paths: stateUpdates.paths }),
              ...(stateUpdates.prefabs !== undefined && { prefabs: stateUpdates.prefabs })
            }));
          }
        }
      },
      subscribeToScene: (listener: any) => {
        listener(sceneStateRef.current);
        sceneSubscribersRef.current.add(listener);
        return () => {
          sceneSubscribersRef.current.delete(listener);
        };
      },
      getAssetLibrary: () => assetsRef.current,
      addAsset: (assetPayload: { file: File; category: any }) => {
        if (!assetPayload?.file || !assetPayload?.category) {
          throw new Error('addAsset requires { file, category }');
        }
        addAssetRef.current(assetPayload.file, assetPayload.category);
      },
      triggerUIUpdate: () => {
        setPluginUIVersion(v => v + 1);
      }
    });

    // Register built-in plugins
    pluginManager.register(DiagnosticsPlugin);
  }, [setModels, setLayers, setPrefabs, setAppState]);

  useEffect(() => {
    const snapshot = {
      models: appState.models,
      layers: appState.layers,
      paths: appState.paths,
      prefabs: appState.prefabs,
    };
    sceneStateRef.current = snapshot;
    sceneSubscribersRef.current.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Plugin scene subscriber failed', error);
      }
    });
  }, [appState.models, appState.layers, appState.paths, appState.prefabs]);

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
      } else if (e.key === 'Escape') {
        setPlacementPrefabId(null);
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
        const persistedSession = await loadProjectSession();

        const urlParams = new URLSearchParams(window.location.search);
        const guidedProbe: ProjectMetadataProbe = {
          profileHint: urlParams.get('projectProfile') ?? undefined,
          runtimeHint: (urlParams.get('runtime') as ProjectMetadataProbe['runtimeHint']) ?? undefined,
          adapterHint: urlParams.get('adapterId') ?? undefined,
        };

        const baseMetadata = persistedSession.session?.metadata ?? savedState?.projectMetadata ?? {};
        const metadataProbe = { ...baseMetadata, ...guidedProbe };
        const activatedProject = activateProjectForEditor(metadataProbe);
        setProjectMetadata(metadataProbe);
        setActiveProject(activatedProject);

        if (persistedSession.session) {
          setProjectSession({
            ...persistedSession.session,
            metadata: metadataProbe,
            profileId: activatedProject.profile.id,
            adapterId: activatedProject.adapter.id,
            bridgeId: activatedProject.bridgeId,
            runtimeTarget: activatedProject.adapter.runtime,
            capabilities: activatedProject.activeCapabilities,
          });
        } else {
          setShowOnboarding(true);
        }

        if (persistedSession.requiresRecovery && persistedSession.recoveryReason) {
          setSessionRecoveryMessage(`Recovered using safe defaults: ${persistedSession.recoveryReason}`);
          setShowOnboarding(true);
        }

        if (savedState) {
          setAppState({
            models: (savedState.models as ModelData[]) || [],
            prefabs: savedState.prefabs || [],
            gridReceiveShadow: savedState.sceneSettings?.gridReceiveShadow ?? true,
            shadowSoftness: savedState.sceneSettings?.shadowSoftness ?? 0.5,
            environment: savedState.sceneSettings?.environment ?? DEFAULT_ENVIRONMENT,
            cameraPresets: savedState.cameraSettings?.presets ?? DEFAULT_CAMERA_PRESETS,
            activeCameraPresetId: savedState.cameraSettings?.activePresetId ?? 'default-orbit',
            cameraPaths: savedState.cameraSettings?.paths ?? [],
            activeCameraPathId: savedState.cameraSettings?.activePathId ?? null,
            layers: savedState.layers ?? DEFAULT_LAYERS,
            terrain: savedState.terrain ?? { heightMap: Array(64).fill(0).map(() => Array(64).fill(0)), materialMap: Array(64).fill(0).map(() => Array(64).fill('grass')), size: 64, resolution: 64 },
            paths: savedState.paths ?? [],
            collisionZones: savedState.collisionZones ?? [],
            activeProfileId: 'high',
            customProfile: DEFAULT_PROFILES[2].settings
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
      autoSaveScene(
        models,
        prefabs,
        { gridReceiveShadow, shadowSoftness, environment }, 
        { presets: cameraPresets, activePresetId: activeCameraPresetId, paths: cameraPaths, activePathId: activeCameraPathId },
        layers,
        appState.terrain,
        appState.paths,
        appState.collisionZones,
        projectMetadata
      );
    }, 2000); // Debounce auto-save by 2 seconds

    return () => clearTimeout(timeoutId);
  }, [models, prefabs, gridReceiveShadow, shadowSoftness, environment, cameraPresets, activeCameraPresetId, cameraPaths, activeCameraPathId, layers, appState.terrain, appState.paths, appState.collisionZones, isInitialLoad, projectMetadata]);


  useEffect(() => {
    if (!projectSession) return;
    persistProjectSession({
      ...projectSession,
      metadata: projectMetadata,
      profileId: activeProject.profile.id,
      adapterId: activeProject.adapter.id,
      bridgeId: activeProject.bridgeId,
      runtimeTarget: activeProject.adapter.runtime,
      capabilities: activeProject.activeCapabilities,
      lastOpenedAt: new Date().toISOString(),
    });
  }, [projectSession, projectMetadata, activeProject]);

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
      authoredId: generateAuthoredId(),  // Stable round-trip ID
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
      authoredId: generateAuthoredId(),  // Stable round-trip ID
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

  const handleCloneModels = useCallback((
    sourceModel: ModelData,
    placements: Array<{ position: [number, number, number]; rotation: [number, number, number] }>
  ): string[] => {
    const newIds = placements.map((_, index) => `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`);

    const clones = placements.map((placement, index): ModelData => ({
      ...sourceModel,
      id: newIds[index],
      authoredId: generateAuthoredId(),  // Each clone gets a new authoredId
      position: placement.position,
      rotation: placement.rotation,
      parentId: null,
      childrenIds: [],
      prefabInstanceId: undefined,
      isPrefabRoot: false,
      overriddenProperties: [],
      name: `${sourceModel.name} ${index + 1}`
    }));

    setModels(prev => [...prev, ...clones]);
    if (newIds.length > 0) {
      setSelectedModelId(newIds[0]);
    }

    return newIds;
  }, [setModels]);

  const handleCreateModelsFromAsset = useCallback((
    asset: Asset,
    placements: Array<{ position: [number, number, number]; rotation: [number, number, number] }>
  ): string[] => {
    const ids = placements.map((_, index) => `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`);
    const created: ModelData[] = placements.map((placement, index) => ({
      id: ids[index],
      authoredId: generateAuthoredId(),  // Each placement gets a new authoredId
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
      type: asset.metadata.type === 'model' ? 'model' :
            asset.metadata.type === 'light' ? 'light' :
            asset.metadata.type === 'environment' ? 'environment' : 'model',
      visible: true,
      locked: false,
      classification: asset.metadata.classification,
      behavior: asset.metadata.type === 'environment' ? 'environment' : 'movable',
      childrenIds: [],
    }));

    setModels(prev => [...prev, ...created]);
    if (ids.length > 0) setSelectedModelId(ids[0]);
    return ids;
  }, [setModels]);

  const handleReplaceAsset = useCallback((asset: Asset) => {
    if (!selectedModelId) return;
    setReplacementAsset(asset);
    setIsReplacementModalOpen(true);
    setIsAssetBrowserOpen(false);
  }, [selectedModelId]);

  const handleConfirmReplacement = useCallback((
    newAsset: Asset, 
    scaleMultiplier: [number, number, number], 
    positionOffset: [number, number, number],
    materialRemap: { [oldMat: string]: string }
  ) => {
    if (!selectedModelId) return;
    
    setModels(models => models.map(m => {
      if (m.id === selectedModelId) {
        return {
          ...m,
          name: newAsset.metadata.name,
          url: newAsset.url,
          assetId: newAsset.id,
          file: newAsset.file,
          type: newAsset.metadata.type === 'model' ? 'model' : 
                newAsset.metadata.type === 'light' ? 'light' : 
                newAsset.metadata.type === 'environment' ? 'environment' : 'model',
          classification: newAsset.metadata.classification,
          // Apply AI-suggested offsets
          scale: [
            m.scale[0] * scaleMultiplier[0],
            m.scale[1] * scaleMultiplier[1],
            m.scale[2] * scaleMultiplier[2]
          ],
          position: [
            m.position[0] + positionOffset[0],
            m.position[1] + positionOffset[1],
            m.position[2] + positionOffset[2]
          ],
          // Store material remap info for the renderer to use
          materialRemap: materialRemap
        };
      }
      return m;
    }));
    
    setIsReplacementModalOpen(false);
    setReplacementAsset(null);
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
      
      // Track prefab overrides
      if (oldModel.prefabId) {
        const currentOverrides = new Set(oldModel.overriddenProperties || []);
        Object.keys(updates).forEach(key => {
          if (!['id', 'prefabId', 'prefabInstanceId', 'isPrefabRoot', 'overriddenProperties', 'parentId', 'childrenIds'].includes(key)) {
            currentOverrides.add(key);
          }
        });
        updates.overriddenProperties = Array.from(currentOverrides);
      }

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
        authoredId: generateAuthoredId(),  // New authoredId for duplicate
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

  const exportConfig = getProjectAwareExportConfig(activeProject);

  const handleExport = useCallback((selectedIds: string[], options: ExportOptions) => {
    validateExportFormatForAdapter(activeProject.adapter.id, options.format);
    exportScene(models, { gridReceiveShadow, shadowSoftness, environment }, threeScene, { selectedIds, ...options, cameraSettings: { presets: cameraPresets, activePresetId: activeCameraPresetId, paths: cameraPaths, activePathId: activeCameraPathId }, layers });
  }, [models, gridReceiveShadow, shadowSoftness, environment, threeScene, cameraPresets, activeCameraPresetId, cameraPaths, activeCameraPathId, layers, activeProject.adapter.id]);

  const handleSaveVersion = useCallback(async (note: string) => {
    await saveSceneVersion(
      models,
      prefabs,
      { gridReceiveShadow, shadowSoftness, environment },
      note,
      { presets: cameraPresets, activePresetId: activeCameraPresetId, paths: cameraPaths, activePathId: activeCameraPathId },
      layers,
      appState.terrain,
      appState.paths,
      appState.collisionZones,
      projectMetadata
    );
  }, [models, prefabs, gridReceiveShadow, shadowSoftness, environment, cameraPresets, activeCameraPresetId, cameraPaths, activeCameraPathId, layers, appState.terrain, appState.paths, appState.collisionZones, projectMetadata]);

  const handleLoadVersion = useCallback(async (versionId: string) => {
    const state = await loadSceneVersion(versionId) as SceneState | null;
    if (state) {
      const metadataProbe = state.projectMetadata ?? {};
      const activatedProject = activateProjectForEditor(metadataProbe);
      setProjectMetadata(metadataProbe);
      setActiveProject(activatedProject);
      setProjectSession(prev => prev ? { ...prev, sceneVersionId: state.versionId } : prev);

      setAppState({
        models: (state.models as ModelData[]) || [],
        prefabs: state.prefabs || [],
        gridReceiveShadow: state.sceneSettings?.gridReceiveShadow ?? true,
        shadowSoftness: state.sceneSettings?.shadowSoftness ?? 0.5,
        environment: state.sceneSettings?.environment ?? DEFAULT_ENVIRONMENT,
        cameraPresets: state.cameraSettings?.presets ?? DEFAULT_CAMERA_PRESETS,
        activeCameraPresetId: state.cameraSettings?.activePresetId ?? 'default-orbit',
        cameraPaths: state.cameraSettings?.paths ?? [],
        activeCameraPathId: state.cameraSettings?.activePathId ?? null,
        layers: state.layers ?? DEFAULT_LAYERS,
        terrain: state.terrain ?? { heightMap: Array(64).fill(0).map(() => Array(64).fill(0)), materialMap: Array(64).fill(0).map(() => Array(64).fill('grass')), size: 64, resolution: 64 },
        paths: state.paths ?? [],
        collisionZones: state.collisionZones ?? [],
        activeProfileId: 'high',
        customProfile: DEFAULT_PROFILES[2].settings
      });
      setSelectedModelId(null);
    } else {
      alert("Failed to load version. It may be corrupted or missing.");
    }
  }, [setAppState]);

  const handleExecuteAICommand = useAICommandExecutor({
    context: {
      models,
      selectedModelId,
      layers,
      environment,
      cameraPresets,
      activeCameraPresetId,
      cameraPaths,
      activeCameraPathId,
      prefabs,
      collisionZones: appState.collisionZones,
      materialLibrary: materialPresets,
      environmentLibrary: environmentPresets,
      paths: appState.paths,
      assets,
    },
    callbacks: {
      onModelsChange: setModels,
      onLayersChange: setLayers,
      onEnvironmentChange: setEnvironment,
      onCameraPresetsChange: setCameraPresets,
      onActiveCameraPresetChange: setActiveCameraPresetId,
      onCameraPathsChange: setCameraPaths,
      onActiveCameraPathChange: setActiveCameraPathId,
      onCollisionZonesChange: setCollisionZones,
      onOpenAssetBrowser: (mode) => {
        setAssetBrowserMode(mode);
        setIsAssetBrowserOpen(true);
      },
      onOpenExportModal: () => setIsExportModalOpen(true),
      onSelectModel: setSelectedModelId,
      onTagFilterChange: setTagFilter,
      onCloneModels: handleCloneModels,
      onCreateModelsFromAsset: handleCreateModelsFromAsset,
    }
  });

  const handleTransformEnd = useCallback(() => {
    setAppState(prev => prev, { transient: false });
  }, [setAppState]);


  const handleCreateProjectSession = useCallback((payload: { projectName: string; profileHint?: string }) => {
    const nextMetadata: ProjectMetadataProbe = {
      ...projectMetadata,
      profileHint: payload.profileHint ?? projectMetadata.profileHint,
    };
    const activation = activateProjectForEditor(nextMetadata);
    const session = createProjectSession({
      projectName: payload.projectName,
      metadata: nextMetadata,
    });

    setProjectMetadata(nextMetadata);
    setActiveProject(activation);
    setProjectSession(session);
    setShowOnboarding(false);
  }, [projectMetadata]);

  const handleOpenLastProjectSession = useCallback(async () => {
    const recovered = await loadProjectSession();
    if (recovered.session) {
      const activation = activateProjectForEditor(recovered.session.metadata);
      setProjectSession(recovered.session);
      setProjectMetadata(recovered.session.metadata);
      setActiveProject(activation);
      setShowOnboarding(false);
      if (recovered.requiresRecovery && recovered.recoveryReason) {
        console.warn('[ProjectSessionRecovery]', recovered.recoveryReason);
        setSessionRecoveryMessage('Your previous project session could not be restored.');
      }
    }
  }, []);

  const handleGitHubImportComplete = useCallback((importedSession: ProjectSession, sceneData?: LoadedSceneData) => {
    try {
      // Activate the project with the imported session's metadata
      const activation = activateProjectForEditor(importedSession.metadata);

      // Set the session and metadata
      setProjectSession(importedSession);
      setProjectMetadata(importedSession.metadata);
      setActiveProject(activation);
      setShowOnboarding(false);

      // Load imported scene data if available
      if (sceneData) {
        try {
          // Load objects
          const importedObjects = loadImportedObjects(sceneData);
          setModels(importedObjects);

          // Load environment if available
          const importedEnvironment = loadImportedEnvironment(sceneData, environment);
          setEnvironment(importedEnvironment);

          // Load camera paths if available
          const importedPaths = loadImportedPaths(sceneData);
          if (importedPaths.length > 0) {
            setCameraPaths(importedPaths);
          }

          // Create and log summary
          const summary = createImportSummary(sceneData, importedSession.metadata.rootPath || 'unknown');
          console.log('[GitHub Import] Scene data loaded:', {
            projectName: summary.projectName,
            objects: summary.objectCount,
            assets: summary.assetCount,
            paths: summary.pathCount,
            warnings: summary.warnings,
          });

          if (summary.warnings.length > 0) {
            console.warn('[GitHub Import] Warnings:', summary.warnings);
          }
        } catch (sceneError) {
          console.warn('[GitHub Import] Could not load scene data:', sceneError);
          // Continue anyway - session is valid even if scene data isn't
        }
      }

      // Persist the session
      persistProjectSession(importedSession);

      // Close the modal
      setIsGitHubImportModalOpen(false);

      console.log(`[GitHub Import] Successfully imported project: ${importedSession.projectName} from ${importedSession.metadata.rootPath}`);
    } catch (error) {
      console.error('[GitHub Import] Error handling import completion:', error);
      // Keep modal open so user can see error or retry
    }
  }, [environment, setModels, setEnvironment, setCameraPaths]);

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
          <div className="w-full h-screen flex relative overflow-hidden bg-bg-dark font-sans selection:bg-blue-500/30">
            {/* Top Bar / Global Actions */}
            <div className="absolute top-4 left-4 z-50 flex gap-2">
              <button
                onClick={() => setUiVisible(!uiVisible)}
                className="bg-[#151619]/90 backdrop-blur-md px-4 py-2 hover:bg-white/5 border border-white/10 rounded transition-all duration-200 flex items-center gap-2 group"
              >
                <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 group-hover:text-white/80">{uiVisible ? 'HIDE_INTERFACE' : 'SHOW_INTERFACE'}</span>
              </button>
              
              {uiVisible && (
                <>
                  {(activeProject.activeCapabilities.materialAuthoring ?? true) && <button
                    onClick={() => {
                      setAssetBrowserMode('place');
                      setIsAssetBrowserOpen(true);
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center gap-2 transition-all group"
                  >
                    <Sparkles className="w-3 h-3 text-white/50 group-hover:text-white" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold">ASSET_LIBRARY</span>
                  </button>}
                  <div className="bg-[#151619]/90 backdrop-blur-md px-3 py-2 border border-white/10 rounded" data-testid="active-project-summary">
                    <div className="text-[9px] uppercase font-mono tracking-widest text-white/50">ACTIVE PROJECT</div>
                    <div className="text-[10px] font-mono text-white/80">{activeProject.profile.displayName}</div>
                    <div className="text-[9px] font-mono text-white/40">RUNTIME TARGET: {activeProject.profile.runtimeTarget.toUpperCase()}</div>
                    <div className="text-[9px] font-mono text-white/35">ADAPTER: {activeProject.adapter.displayName}</div>
                    <div className="text-[9px] font-mono text-white/35">RUNTIME BRIDGE: {activeProject.bridgeId}</div>
                    <div className="text-[9px] font-mono text-white/30">ACTIVATION: {activeProject.detection.mode.toUpperCase()}</div>
                  </div>
                  <div className="flex bg-[#151619]/90 backdrop-blur-md p-1 gap-1 border border-white/10 rounded">
                    <button
                      onClick={undo}
                      disabled={!canUndo}
                      className="p-2 hover:bg-white/10 rounded disabled:opacity-10 transition-colors text-white/50 hover:text-white"
                      title="Undo (Ctrl+Z)"
                    >
                      <span className="text-[10px] font-mono">UNDO</span>
                    </button>
                    <div className="w-px h-4 bg-white/5 self-center" />
                    <button
                      onClick={redo}
                      disabled={!canRedo}
                      className="p-2 hover:bg-white/10 rounded disabled:opacity-10 transition-colors text-white/50 hover:text-white"
                      title="Redo (Ctrl+Y)"
                    >
                      <span className="text-[10px] font-mono">REDO</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {sessionRecoveryMessage && (
              <div className="absolute top-20 left-4 z-50 bg-amber-500/20 border border-amber-400/40 rounded px-3 py-2 text-[10px] font-mono text-amber-100 flex items-center gap-3" data-testid="project-session-recovery-banner">
                <span>{sessionRecoveryMessage} We reset to a safe project setup. Please choose your project type to continue.</span>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="px-2 py-1 border border-amber-200/40 rounded text-amber-50 hover:bg-amber-400/20"
                >
                  REVIEW SETUP
                </button>
              </div>
            )}

            {uiVisible && (
              <Sidebar 
                onLoadModel={handleLoadModel} 
                onClearScene={handleClearScene}
                models={models}
                layers={layers}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                onUpdateModel={handleUpdateModel}
                onUpdateLayer={handleUpdateLayer}
                onAddLayer={handleAddLayer}
                onDeleteLayer={handleDeleteLayer}
                onSoloLayer={handleSoloLayer}
                onUnhideAllLayers={handleUnhideAllLayers}
                isSoloActive={!!preSoloLayers}
                prefabs={prefabs}
                onPlacePrefab={handlePlacePrefab}
                onCreatePrefabClick={() => setIsPrefabModalOpen(true)}
                onDeletePrefab={handleDeletePrefab}
                canCreatePrefab={selectedModelIds.length > 0}
                selectionFilter={selectionFilter}
                onUpdateSelectionFilter={setSelectionFilter}
                tagFilter={tagFilter}
                onUpdateTagFilter={setTagFilter}
                onScaleChange={handleScaleChange}
                gridReceiveShadow={gridReceiveShadow}
                onGridReceiveShadowChange={setGridReceiveShadow}
                shadowSoftness={shadowSoftness}
                onShadowSoftnessChange={setShadowSoftness}
                onExportClick={() => setIsExportModalOpen(true)}
                onHistoryClick={() => setIsHistoryModalOpen(true)}
                onAssetLibraryClick={() => setIsAssetBrowserOpen(true)}
                onImportFromGitHubClick={() => setIsGitHubImportModalOpen(true)}
                pluginUIVersion={pluginUIVersion}
                collisionZones={appState.collisionZones}
                onAddZone={handleAddZone}
                onUpdateZone={handleUpdateZone}
                onDeleteZone={handleDeleteZone}
                capabilities={activeProject.activeCapabilities}
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
                placementPrefabId={placementPrefabId}
                onPlacePrefabAtPosition={handlePlacePrefabAtPosition}
                gridReceiveShadow={gridReceiveShadow}
                shadowSoftness={shadowSoftness}
                tagFilter={tagFilter}
                environment={environment}
                onSceneReady={setThreeScene}
                activeCameraPresetId={activeCameraPresetId}
                cameraPresets={cameraPresets}
                activeCameraPathId={activeCameraPathId}
                cameraPaths={cameraPaths}
                layers={layers}
                selectionFilter={selectionFilter}
                terrain={appState.terrain}
                paths={appState.paths}
              />
            </div>

            {uiVisible && (
              <InspectorPanel 
                model={selectedModel}
                models={models}
                layers={layers}
                onUpdateModel={handleUpdateModel}
                onReset={handleResetModel}
                onFocus={handleFocus}
                onDuplicate={handleDuplicateModel}
                onDelete={handleDeleteModel}
                onReplaceAsset={() => {
                  setAssetBrowserMode('replace');
                  setIsAssetBrowserOpen(true);
                }}
                prefabs={prefabs}
                onApplyToPrefab={handleApplyToPrefab}
                onResetInstanceOverrides={handleResetInstanceOverrides}
                capabilities={activeProject.activeCapabilities}
                environment={environment}
                onUpdateEnvironment={setEnvironment}
                cameraPresets={cameraPresets}
                activeCameraPresetId={activeCameraPresetId}
                onUpdateCameraPresets={setCameraPresets}
                onSetActiveCameraPreset={setActiveCameraPresetId}
                cameraPaths={cameraPaths}
                activeCameraPathId={activeCameraPathId}
                onUpdateCameraPaths={setCameraPaths}
                onSetActiveCameraPath={setActiveCameraPathId}
                onCaptureCamera={() => {
                  if (!threeScene) return null;
                  const camera = threeScene.getObjectByName('scene-camera') as THREE.PerspectiveCamera || threeScene.children.find(c => c instanceof THREE.PerspectiveCamera);
                  if (!camera) return null;
                  
                  // Find the OrbitControls target
                  // In our Scene.tsx, we use OrbitControls from @react-three/drei
                  // It's hard to get the target directly from here without a ref
                  // But we can assume the target is what the camera is looking at
                  const target = new THREE.Vector3();
                  camera.getWorldDirection(target);
                  target.multiplyScalar(10).add(camera.position); // Heuristic
                  
                  return {
                    position: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
                    target: [target.x, target.y, target.z] as [number, number, number],
                    fov: camera.fov
                  };
                }}
              />
            )}

            {uiVisible && (
              <GeminiAssistant 
                context={{
                  models,
                  selectedModelId,
                  layers,
                  environment,
                  activeCameraPresetId,
                  cameraPresets
                }}
                onExecuteCommand={handleExecuteAICommand}
              />
            )}

            <ProjectOnboardingModal
              isOpen={showOnboarding}
              guidance={getProjectSelectionGuidance(projectMetadata)}
              onCreateProject={handleCreateProjectSession}
              onOpenExisting={handleOpenLastProjectSession}
            />

            <GitHubImportModal
              isOpen={isGitHubImportModalOpen}
              onImportComplete={handleGitHubImportComplete}
              onClose={() => setIsGitHubImportModalOpen(false)}
            />

            <ExportModal 
              isOpen={isExportModalOpen}
              onClose={() => setIsExportModalOpen(false)}
              models={models}
              onExport={handleExport}
              allowedFormats={exportConfig.allowedFormats}
              recommendedFormat={exportConfig.recommendedFormat}
              contextNote={exportConfig.contextNote}
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
            <PrefabCreationModal 
              isOpen={isPrefabModalOpen}
              onClose={() => setIsPrefabModalOpen(false)}
              onConfirm={handleCreatePrefab}
              selectionCount={selectedModelIds.length}
            />
            <AssetReplacementModal
              isOpen={isReplacementModalOpen}
              onClose={() => {
                setIsReplacementModalOpen(false);
                setReplacementAsset(null);
              }}
              currentModel={selectedModel}
              newAsset={replacementAsset}
              onConfirm={handleConfirmReplacement}
            />
          </div>
  );
}
