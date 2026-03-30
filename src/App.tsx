import { useState, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Sparkles } from 'lucide-react';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useGLTF } from '@react-three/drei';
import { Menu, X as CloseIcon, Settings as SettingsIcon, Layers as LayersIcon, Box as BoxIcon, LayoutGrid as LayoutGridIcon, List as ListIcon, Shield as ShieldIcon, Github, Download, History as HistoryIcon, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Scene from './components/Scene';
import InspectorPanel from './components/InspectorPanel';
import Toolbar from './components/Toolbar';
import ExportModal, { ExportOptions } from './components/ExportModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import AssetBrowser from './components/AssetBrowser/AssetBrowser';
import { GitHubImportModal } from './components/GitHubImportModal';
import { MenuBar } from './components/MenuBar';
import GeminiAssistant from './components/GeminiAssistant';
import SceneLayerPanel from './components/SceneLayerPanel';
import PrefabCreationModal from './components/PrefabCreationModal';
import AssetReplacementModal from './components/AssetReplacementModal';
import SettingsModal from './components/SettingsModal';
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
import { useAICommandExecutor } from './hooks/useAICommandExecutor';
import { activateProjectForEditor } from './services/ProjectLoadService';
import { ProjectMetadataProbe } from './types/projectAdapter';
import { ProjectSession } from './types/projectSession';
import { createProjectSession, loadProjectSession } from './services/ProjectSessionService';
import { getProjectSelectionGuidance } from './services/ProjectAdapterRegistry';
import ProjectOnboardingModal from './components/ProjectOnboardingModal';
import { generateAuthoredId } from './utils/idUtils';
import { useProjectSessionBootstrap } from './hooks/useProjectSessionBootstrap';
import { useProjectSessionPersistence } from './hooks/useProjectSessionPersistence';
import { useScenePersistenceCoordinator } from './hooks/useScenePersistenceCoordinator';
import { useProjectAwareExport } from './hooks/useProjectAwareExport';
import { usePluginBootstrap } from './hooks/usePluginBootstrap';
import { useGitHubProjectImport } from './hooks/useGitHubProjectImport';
import { useProjectActivationCoordinator } from './hooks/useProjectActivationCoordinator';
import { useAssetWorkflow } from './hooks/useAssetWorkflow';
import { useActiveProjectSummary } from './hooks/useActiveProjectSummary';

export interface ModelData {
  id: string;
  authoredId?: string;  // Stable round-trip identifier (UUID v4), never changes
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
  roughnessMapUrl?: string;
  roughnessMapFile?: File;
  metalnessMapUrl?: string;
  metalnessMapFile?: File;
  emissiveMapUrl?: string;
  emissiveMapFile?: File;
  alphaMapUrl?: string;
  alphaMapFile?: File;
  aoMapUrl?: string;
  aoMapFile?: File;
  metadata?: Record<string, unknown>;
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
  previewCameraPathId: string | null;
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
    cameraPaths: [{
      id: 'intro-path',
      name: 'Introduction Path',
      category: 'Cinematic Showcase',
      points: [
        { id: 'p1', position: [5, 5, 5], target: [0, 0, 0], duration: 2 },
        { id: 'p2', position: [-5, 5, 5], target: [0, 0, 0], duration: 2 }
      ],
      loop: true,
      interpolation: 'smooth'
    }],
    activeCameraPathId: null,
    previewCameraPathId: null,
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
  const previewCameraPathId = appState.previewCameraPathId;
  const layers = appState.layers;

  const [selectionFilter, setSelectionFilter] = useState<string[]>(['model', 'light', 'camera', 'environment', 'helper']);
  const [tagFilter, setTagFilter] = useState<string>('');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileActiveTab, setMobileActiveTab] = useState<'scene' | 'sidebar' | 'inspector'>('scene');

  // Sync mobileActiveTab with panel visibility
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(mobileActiveTab === 'sidebar');
      setInspectorOpen(mobileActiveTab === 'inspector');
    } else {
      setSidebarOpen(true);
      setInspectorOpen(true);
    }
  }, [isMobile, mobileActiveTab]);
  const [preSoloLayers, setPreSoloLayers] = useState<Layer[] | null>(null);
  const [placementPrefabId, setPlacementPrefabId] = useState<string | null>(null);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadataProbe>({});
  const [activeProject, setActiveProject] = useState(() => activateProjectForEditor({}));
  const [projectSession, setProjectSession] = useState<ProjectSession | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sessionRecoveryMessage, setSessionRecoveryMessage] = useState<string | null>(null);
  const [isGitHubImportModalOpen, setIsGitHubImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingImportRepoRef, setPendingImportRepoRef] = useState<string>('');

  const { activateFromMetadata, activateWithSession, updateSessionVersion } = useProjectActivationCoordinator({
    setProjectMetadata,
    setActiveProject,
    setProjectSession,
  });

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
      const hasParentInSelection = m.parentId && selectedModelIds.includes(m.parentId);
      
      let newPosition: [number, number, number];
      let newParentId: string | null = null;

      if (isRoot) {
        newPosition = [0, 0, 0];
        newParentId = null;
      } else if (hasParentInSelection) {
        // Already relative to its parent which is also in the prefab
        newPosition = m.position;
        newParentId = idMap[m.parentId!];
      } else {
        // Not hierarchical in selection, make it relative to the root
        newPosition = [m.position[0] - root.position[0], m.position[1] - root.position[1], m.position[2] - root.position[2]];
        newParentId = idMap[root.id];
      }

      return {
        ...m,
        id: idMap[m.id],
        parentId: newParentId,
        childrenIds: m.childrenIds?.map(cid => idMap[cid]).filter(Boolean) as string[],
        position: newPosition,
        isPrefabRoot: isRoot
      };
    });

    // Update childrenIds for the root (and others) based on the new parentIds
    prefabModels.forEach(pm => {
      pm.childrenIds = prefabModels.filter(m => m.parentId === pm.id).map(m => m.id);
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
    const idMap: Record<string, string> = {};
    prefab.models.forEach(pm => {
      idMap[pm.id] = crypto.randomUUID();
    });

    const newModels: ModelData[] = prefab.models.map(pm => {
      const isRoot = pm.isPrefabRoot;
      return {
        ...(pm as any),
        id: idMap[pm.id],
        authoredId: generateAuthoredId(),  // New authoredId for prefab instance
        prefabId: prefab.id,
        prefabInstanceId: instanceId,
        parentId: pm.parentId ? idMap[pm.parentId] : null,
        childrenIds: pm.childrenIds?.map(cid => idMap[cid]).filter(Boolean) as string[],
        position: isRoot ? position : pm.position,
        layerId: 'env'
      } as ModelData;
    });

    setModels(prev => [...prev, ...newModels]);
    setPlacementPrefabId(null); // Exit placement mode
  }, [placementPrefabId, prefabs, setModels]);

  const handleDeletePrefab = useCallback((id: string) => {
    setPrefabs(prev => prev.filter(p => p.id !== id));
  }, [setPrefabs]);

  const handleApplyToPrefab = useCallback((instanceId: string, prefabId: string) => {
    const clickedModel = models.find(m => m.id === instanceId);
    if (!clickedModel || !clickedModel.prefabInstanceId) return;

    const instanceModels = models.filter(m => m.prefabInstanceId === clickedModel.prefabInstanceId);
    const instanceRoot = instanceModels.find(m => m.isPrefabRoot) || clickedModel;
    const prefab = prefabs.find(p => p.id === prefabId);
    if (!prefab) return;

    // Map of instance IDs to prefab IDs for internal prefab references
    const instanceToPrefabIdMap: Record<string, string> = {};
    instanceModels.forEach(im => {
      const prefabModel = prefab.models.find(pm => pm.name === im.name);
      instanceToPrefabIdMap[im.id] = prefabModel?.id || crypto.randomUUID();
    });

    // Update prefab definition
    const updatedPrefabModels = instanceModels.map(im => {
      const isRoot = im.isPrefabRoot;
      const { id, prefabId: pid, prefabInstanceId: piid, isPrefabRoot: ipr, overriddenProperties, parentId, childrenIds, ...rest } = im;
      
      return {
        ...rest,
        id: instanceToPrefabIdMap[im.id],
        parentId: parentId ? instanceToPrefabIdMap[parentId] : null,
        childrenIds: childrenIds?.map(cid => instanceToPrefabIdMap[cid]).filter(Boolean) as string[],
        position: isRoot ? [0, 0, 0] : im.position, // Already relative if hierarchical
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
              // Preserve world transform for the root of other instances
              if (m.isPrefabRoot && ['position', 'rotation', 'scale'].includes(key)) {
                return;
              }
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
    const clickedModel = models.find(m => m.id === instanceId);
    if (!clickedModel || !clickedModel.prefabInstanceId || !clickedModel.prefabId) return;

    const instanceModels = models.filter(m => m.prefabInstanceId === clickedModel.prefabInstanceId);
    const instanceRoot = instanceModels.find(m => m.isPrefabRoot) || clickedModel;
    const prefab = prefabs.find(p => p.id === clickedModel.prefabId);
    if (!prefab) return;

    setModels(prev => prev.map(m => {
      if (m.prefabInstanceId === clickedModel.prefabInstanceId) {
        const prefabModel = prefab.models.find(pm => pm.name === m.name);
        if (prefabModel) {
          const { id, isPrefabRoot, parentId, childrenIds, position, ...rest } = prefabModel;
          return {
            ...m,
            ...rest,
            position: isPrefabRoot ? m.position : position, // Keep root's world position
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
  const [threeCamera, setThreeCamera] = useState<THREE.Camera | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [pluginUIVersion, setPluginUIVersion] = useState(0);
  type SceneSubscriberSnapshot = Pick<AppState, 'models' | 'layers' | 'paths' | 'prefabs'>;
  const sceneSubscribersRef = useRef(new Set<(state: SceneSubscriberSnapshot) => void>());
  const sceneStateRef = useRef({
    models: appState.models,
    layers: appState.layers,
    paths: appState.paths,
    prefabs: appState.prefabs,
  });
  const assetsRef = useRef(assets);
  const addAssetRef = useRef(addAsset);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;

      // Ctrl+I / Cmd+I: Open GitHub import
      if (isMeta && e.key === 'i') {
        e.preventDefault();
        setIsGitHubImportModalOpen(true);
      }

      // Ctrl+E / Cmd+E: Open export (if needed)
      // This might already be handled elsewhere
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
    addAssetRef.current = addAsset;
  }, [assets, addAsset]);

  usePluginBootstrap({
    sceneStateRef,
    sceneSubscribersRef,
    assetsRef,
    addAssetRef,
    setModels,
    setLayers,
    setAppState,
    triggerUIUpdate: () => setPluginUIVersion(v => v + 1),
    snapshot: {
      models: appState.models,
      layers: appState.layers,
      paths: appState.paths,
      prefabs: appState.prefabs,
    },
  });

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

  useProjectSessionBootstrap({
    applyRecoveredSceneState: (savedState) => {
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
        previewCameraPathId: null,
        layers: savedState.layers ?? DEFAULT_LAYERS,
        terrain: savedState.terrain ?? { heightMap: Array(64).fill(0).map(() => Array(64).fill(0)), materialMap: Array(64).fill(0).map(() => Array(64).fill('grass')), size: 64, resolution: 64 },
        paths: savedState.paths ?? [],
        collisionZones: savedState.collisionZones ?? [],
        activeProfileId: savedState.qualitySettings?.activeProfileId ?? 'high',
        customProfile: savedState.qualitySettings?.customProfile ?? DEFAULT_PROFILES[2].settings
      }, { replace: true });
    },
    setProjectMetadata,
    setActiveProject,
    setProjectSession,
    setShowOnboarding,
    setSessionRecoveryMessage,
    setIsInitialLoad,
  });

  useProjectSessionPersistence({
    projectSession,
    projectMetadata,
    activeProject,
  });

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

  const {
    handlePlaceAsset,
    handleCloneModels,
    handleCreateModelsFromAsset,
    handleReplaceAsset,
    handleConfirmReplacement,
  } = useAssetWorkflow({
    setModels,
    setSelectedModelId,
    selectedModelId,
    setReplacementAsset,
    setIsReplacementModalOpen,
    setIsAssetBrowserOpen,
  });

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
      
      const filteredModels = nextModels.filter(m => m.id !== id);
      
      // Mitigate Memory Leaks: Revoke blob URLs and trigger useGLTF cache clear
      if (modelToDelete && modelToDelete.url && modelToDelete.url.startsWith('blob:')) {
        const stillInUse = filteredModels.some(m => m.url === modelToDelete.url);
        if (!stillInUse) {
          URL.revokeObjectURL(modelToDelete.url);
          useGLTF.clear(modelToDelete.url);
        }
      }
      
      return filteredModels;
    });
    setSelectedModelId(null);
  }, [setModels]);

  const handleResetModel = useCallback((id: string) => {
    setModels(models => models.map(m => m.id === id ? { ...m, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], wireframe: false, lightIntensity: 0, castShadow: true, receiveShadow: true, textureUrl: undefined, textureFile: undefined, normalMapUrl: undefined, normalMapFile: undefined, colorTint: '#ffffff', opacity: 1, roughness: 0.5, metalness: 0, emissiveColor: '#000000' } : m));
  }, [setModels]);

  const handleClearScene = useCallback(() => {
    setModels(models => {
      // Mitigate Memory Leaks: Revoke all blob URLs when clearing scene
      const uniqueBlobUrls = new Set<string>();
      models.forEach(m => {
        if (m.url && m.url.startsWith('blob:')) {
          uniqueBlobUrls.add(m.url);
        }
      });
      uniqueBlobUrls.forEach(url => {
        URL.revokeObjectURL(url);
        useGLTF.clear(url);
      });
      return [];
    });
    setSelectedModelId(null);
  }, []);

  const { exportConfig, handleExport } = useProjectAwareExport({
    activeProject,
    models,
    sceneSettings: { gridReceiveShadow, shadowSoftness, environment },
    threeScene,
    cameraSettings: { presets: cameraPresets, activePresetId: activeCameraPresetId, paths: cameraPaths, activePathId: activeCameraPathId },
    layers,
  });

  const { saveVersion: handleSaveVersion, loadVersion: handleLoadVersion } = useScenePersistenceCoordinator({
    sceneState: {
      models,
      prefabs,
      gridReceiveShadow,
      shadowSoftness,
      environment,
      cameraPresets,
      activeCameraPresetId,
      cameraPaths,
      activeCameraPathId,
      previewCameraPathId: null,
      layers,
      terrain: appState.terrain,
      paths: appState.paths,
      collisionZones: appState.collisionZones,
      qualitySettings: { activeProfileId: appState.activeProfileId, customProfile: appState.customProfile },
    },
    projectMetadata,
    isInitialLoad,
    applyLoadedState: (nextState: any) => {
      setAppState({
        ...nextState,
        activeProfileId: nextState.qualitySettings?.activeProfileId ?? 'high',
        customProfile: nextState.qualitySettings?.customProfile ?? DEFAULT_PROFILES[2].settings,
      });
    },
    onVersionMetadata: (metadataProbe, versionId) => {
      activateFromMetadata(metadataProbe);
      updateSessionVersion(versionId);
    },
    clearSelectionAfterLoad: () => setSelectedModelId(null),
    defaultCameraPresets: DEFAULT_CAMERA_PRESETS,
  });

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
    const session = createProjectSession({
      projectName: payload.projectName,
      metadata: nextMetadata,
    });

    activateWithSession(session, nextMetadata);
    setShowOnboarding(false);
  }, [activateWithSession, projectMetadata]);

  const handleOpenLastProjectSession = useCallback(async () => {
    const recovered = await loadProjectSession();
    if (recovered.session) {
      activateWithSession(recovered.session);
      setShowOnboarding(false);
      if (recovered.requiresRecovery && recovered.recoveryReason) {
        console.warn('[ProjectSessionRecovery]', recovered.recoveryReason);
        setSessionRecoveryMessage('We restored your last project with safe defaults for a few missing settings.');
      }
    }
  }, [activateWithSession]);

  const handleGitHubImportComplete = useGitHubProjectImport({
    onActivateSession: (session) => activateWithSession(session),
    setShowOnboarding,
    applyImportedSceneState: ({ models: importedModels, environment: importedEnvironment, cameraPaths: importedPaths }) => {
      setAppState(prev => ({
        ...prev,
        models: importedModels,
        environment: importedEnvironment,
        cameraPaths: importedPaths,
        activeCameraPathId: null,
        previewCameraPathId: null,
      }), { replace: true });
    },
    clearSelection: () => {
      setSelectedModelId(null);
      setSelectedModelIds([]);
    },
    closeModal: () => setIsGitHubImportModalOpen(false),
  });

  const selectedModel = models.find(m => m.id === selectedModelId);
  const activeProjectSummary = useActiveProjectSummary(activeProject);

  const projectName = projectSession?.projectName;

  return (
          <div className="w-full h-[100dvh] flex flex-col relative overflow-hidden bg-bg-dark font-sans selection:bg-blue-500/30">
      {/* Top Menu Bar */}
      {!isMobile && (
        <MenuBar
          onImportClick={() => {
            setPendingImportRepoRef('');
            setIsGitHubImportModalOpen(true);
          }}
          onImportFromHistoryClick={(repoRef) => {
            setPendingImportRepoRef(repoRef);
            setIsGitHubImportModalOpen(true);
          }}
          onExportClick={() => setIsExportModalOpen(true)}
          onNewProject={() => setShowOnboarding(true)}
        />
      )}

      {/* Mobile Top Bar */}
      {isMobile && (
        <div className="h-14 bg-[#0d0e10] border-b border-white/5 flex items-center justify-between px-4 z-[100]">
          <div className="flex items-center gap-2">
            <BoxIcon className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-mono font-bold tracking-widest uppercase">{projectName || 'TITAN_ENGINE'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsGitHubImportModalOpen(true)} className="p-2 text-white/50 hover:text-white">
              <Github className="w-5 h-5" />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-white/50 hover:text-white">
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* UI Toggle Button */}
      <button
        onClick={() => setUiVisible(!uiVisible)}
        className="fixed bottom-20 right-4 md:bottom-4 md:right-4 z-[150] p-3 bg-black/50 backdrop-blur border border-white/10 rounded-full text-white/70 hover:text-white hover:bg-black/70 transition-all shadow-lg"
        title={uiVisible ? "Hide UI" : "Show UI"}
      >
        {uiVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Sidebar */}
        {uiVisible && (
          <div className={`
            ${isMobile ? 'fixed inset-0 z-[110] transition-transform duration-300' : 'relative'}
            ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          `}>
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
              isMobile={isMobile}
              onClose={() => setMobileActiveTab('scene')}
            />
          </div>
        )}
        
        <div className="flex-1 h-full relative flex flex-col min-w-0">
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
              isMobile={isMobile}
              inspectorOpen={inspectorOpen}
            />
          )}

          {/* Mobile Scene Overlay Controls */}
          {isMobile && mobileActiveTab === 'scene' && (
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20 pointer-events-none">
              <button 
                onClick={() => setMobileActiveTab('sidebar')}
                className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg text-white/70 pointer-events-auto"
              >
                <LayersIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {isMobile && mobileActiveTab === 'scene' && (
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-20 pointer-events-none">
              <button 
                onClick={() => setMobileActiveTab('inspector')}
                className={`p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg transition-colors pointer-events-auto ${selectedModelId ? 'text-blue-400' : 'text-white/30'}`}
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
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
            onSceneReady={(scene, camera) => {
              setThreeScene(scene);
              setThreeCamera(camera);
            }}
            activeCameraPresetId={activeCameraPresetId}
            cameraPresets={cameraPresets}
            activeCameraPathId={activeCameraPathId}
            previewCameraPathId={previewCameraPathId}
            cameraPaths={cameraPaths}
            onUpdateCameraPaths={(val) => setAppState(prev => ({
              ...prev,
              cameraPaths: typeof val === 'function' ? val(prev.cameraPaths) : val
            }))}
            layers={layers}
            selectionFilter={selectionFilter}
            terrain={appState.terrain}
            paths={appState.paths}
            onTransformModeChange={setTransformMode}
            activeProfileId={appState.activeProfileId}
            customProfile={appState.customProfile}
          />
        </div>

        {uiVisible && (
          <div className={`
            ${isMobile ? 'fixed inset-0 z-[110] transition-transform duration-300' : 'relative'}
            ${isMobile && !inspectorOpen ? 'translate-x-full' : 'translate-x-0'}
          `}>
            <InspectorPanel
              model={selectedModel ?? null}
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
              activeCameraPresetId={activeCameraPresetId ?? ''}
              onUpdateCameraPresets={setCameraPresets}
              onSetActiveCameraPreset={setActiveCameraPresetId}
              cameraPaths={cameraPaths}
              activeCameraPathId={activeCameraPathId}
              previewCameraPathId={previewCameraPathId}
              onUpdateCameraPaths={setCameraPaths}
              onSetActiveCameraPath={setActiveCameraPathId}
              onSetPreviewCameraPath={(id) => setAppState(prev => ({ ...prev, previewCameraPathId: id }))}
              onCaptureCamera={() => {
                if (!threeCamera || !(threeCamera instanceof THREE.PerspectiveCamera)) return null;
                
                const target = new THREE.Vector3();
                threeCamera.getWorldDirection(target);
                target.multiplyScalar(10).add(threeCamera.position); // Heuristic
                
                return {
                  position: [threeCamera.position.x, threeCamera.position.y, threeCamera.position.z] as [number, number, number],
                  target: [target.x, target.y, target.z] as [number, number, number],
                  fov: threeCamera.fov
                };
              }}
              isMobile={isMobile}
              onClose={() => setMobileActiveTab('scene')}
            />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="h-16 bg-[#0d0e10] border-t border-white/5 flex items-center justify-around px-2 z-[100]">
          <button 
            onClick={() => setMobileActiveTab('sidebar')}
            className={`flex flex-col items-center gap-1 flex-1 py-1 ${mobileActiveTab === 'sidebar' ? 'text-blue-500' : 'text-white/30'}`}
          >
            <LayersIcon className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase tracking-widest">Explorer</span>
          </button>
          <button 
            onClick={() => setMobileActiveTab('scene')}
            className={`flex flex-col items-center gap-1 flex-1 py-1 ${mobileActiveTab === 'scene' ? 'text-blue-500' : 'text-white/30'}`}
          >
            <LayoutGridIcon className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase tracking-widest">Scene</span>
          </button>
          <button 
            onClick={() => setMobileActiveTab('inspector')}
            className={`flex flex-col items-center gap-1 flex-1 py-1 ${mobileActiveTab === 'inspector' ? 'text-blue-500' : 'text-white/30'}`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase tracking-widest">Inspector</span>
          </button>
        </div>
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
        onImportFromGitHub={() => {
          setShowOnboarding(false);
          setIsGitHubImportModalOpen(true);
        }}
      />

      <GitHubImportModal
        isOpen={isGitHubImportModalOpen}
        initialRepoInput={pendingImportRepoRef}
        onImportComplete={handleGitHubImportComplete}
        onClose={() => {
          setIsGitHubImportModalOpen(false);
          setPendingImportRepoRef('');
        }}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProfileId={appState.activeProfileId}
        onProfileChange={(id) => setAppState(prev => ({ ...prev, activeProfileId: id }))}
        customSettings={appState.customProfile}
        onUpdateCustomSettings={(settings) => setAppState(prev => ({ ...prev, customProfile: settings }))}
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
        currentModel={selectedModel ?? null}
        newAsset={replacementAsset}
        onConfirm={handleConfirmReplacement}
      />
    </div>
  );
}
