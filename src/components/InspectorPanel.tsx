import React, { useState, useRef } from 'react';
import { 
  FolderOpen, 
  Upload, 
  X, 
  Save, 
  Search, 
  Trash2, 
  Maximize2, 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  ArrowDown, 
  Focus, 
  Copy,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Camera,
  Video,
  Play,
  Pause,
  Plus,
  Settings,
  Clock,
  Navigation
} from 'lucide-react';
import { ModelData } from '../App';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { useMaterialLibrary } from '../hooks/useMaterialLibrary';
import { useEnvironmentLibrary } from '../hooks/useEnvironmentLibrary';
import { MaterialPreset, DEFAULT_MATERIAL, MaterialCategory } from '../types/materials';
import { EnvironmentPreset, EnvironmentCategory } from '../types/environment';
import { Asset } from '../types/assets';
import { CameraPreset, CameraPath, CameraPathPoint } from '../types/camera';
import { Layer } from '../types/layers';
import { Prefab } from '../types/prefabs';

interface InspectorPanelProps {
  model: ModelData | null;
  models: ModelData[];
  onUpdateModel: (id: string, updates: Partial<ModelData>) => void;
  onReset: (id: string) => void;
  onFocus: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReplaceAsset: () => void;
  environment: EnvironmentPreset;
  onUpdateEnvironment: (val: EnvironmentPreset | ((prev: EnvironmentPreset) => EnvironmentPreset)) => void;
  cameraPresets: CameraPreset[];
  activeCameraPresetId: string;
  onUpdateCameraPresets: (val: CameraPreset[] | ((prev: CameraPreset[]) => CameraPreset[])) => void;
  onSetActiveCameraPreset: (id: string) => void;
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
  onUpdateCameraPaths: (val: CameraPath[] | ((prev: CameraPath[]) => CameraPath[])) => void;
  onSetActiveCameraPath: (id: string | null) => void;
  onCaptureCamera: () => { position: [number, number, number], target: [number, number, number], fov: number } | null;
  layers: Layer[];
  prefabs: Prefab[];
  onApplyToPrefab: (instanceId: string, prefabId: string) => void;
  onResetInstanceOverrides: (instanceId: string) => void;
}

const Section = ({ title, children, defaultOpen = false, badge }: { title: string, children: React.ReactNode, defaultOpen?: boolean, badge?: string }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10">
      <button 
        className="w-full text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest flex justify-between items-center hover:bg-white/5 transition-colors group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <span className="group-hover:text-white transition-colors">{title}</span>
          {badge && (
            <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold tracking-tighter">
              {badge}
            </span>
          )}
        </div>
        <span className="text-[8px] opacity-50">
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
      </button>
      {isOpen && <div className="p-4 pt-0 space-y-4">{children}</div>}
    </div>
  );
};

export default function InspectorPanel({ 
  model, 
  models, 
  onUpdateModel, 
  onReset, 
  onFocus, 
  onDuplicate, 
  onDelete, 
  onReplaceAsset,
  environment,
  onUpdateEnvironment,
  cameraPresets,
  activeCameraPresetId,
  onUpdateCameraPresets,
  onSetActiveCameraPreset,
  cameraPaths,
  activeCameraPathId,
  onUpdateCameraPaths,
  onSetActiveCameraPath,
  onCaptureCamera,
  layers,
  prefabs,
  onApplyToPrefab,
  onResetInstanceOverrides
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'object' | 'environment' | 'camera'>('object');
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const normalMapInputRef = useRef<HTMLInputElement>(null);
  const { assets } = useAssetLibrary();
  const { 
    presets: materialPresets, 
    addPreset: addMaterialPreset, 
    deletePreset: deleteMaterialPreset, 
    filteredPresets: filteredMaterialPresets, 
    searchQuery: materialSearchQuery, 
    setSearchQuery: setMaterialSearchQuery, 
    selectedCategory: selectedMaterialCategory, 
    setSelectedCategory: setSelectedMaterialCategory 
  } = useMaterialLibrary();

  const {
    presets: envPresets,
    addPreset: addEnvPreset,
    deletePreset: deleteEnvPreset,
    filteredPresets: filteredEnvPresets,
    searchQuery: envSearchQuery,
    setSearchQuery: setEnvSearchQuery,
    selectedCategory: selectedEnvCategory,
    setSelectedCategory: setSelectedEnvCategory
  } = useEnvironmentLibrary();

  const [showMaterialPresetBrowser, setShowMaterialPresetBrowser] = useState(false);
  const [showEnvPresetBrowser, setShowEnvPresetBrowser] = useState(false);
  const [showCameraPresetBrowser, setShowCameraPresetBrowser] = useState(false);
  const [showSaveMaterialModal, setShowSaveMaterialModal] = useState(false);
  const [showSaveEnvModal, setShowSaveEnvModal] = useState(false);
  const [showSaveCameraModal, setShowSaveCameraModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ id: string, type: 'material' | 'environment' | 'camera' | 'path' } | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newEnvPresetName, setNewEnvPresetName] = useState('');
  const [newCameraPresetName, setNewCameraPresetName] = useState('');
  const [showTexturePicker, setShowTexturePicker] = useState<{ open: boolean, type: keyof MaterialPreset } | null>(null);
  const [selectedCameraCategory, setSelectedCameraCategory] = useState<string>('All');
  const [cameraSearchQuery, setCameraSearchQuery] = useState('');

  const activePreset = cameraPresets.find(p => p.id === activeCameraPresetId);
  const activePath = cameraPaths.find(p => p.id === activeCameraPathId);

  const asset = model?.assetId ? assets.find(a => a.id === model.assetId) : null;
  const currentMaterial = model?.material || DEFAULT_MATERIAL;

  const updateMaterial = (updates: Partial<MaterialPreset>) => {
    if (!model) return;
    const newMaterial = { ...currentMaterial, ...updates };
    onUpdateModel(model.id, { material: newMaterial });
  };

  const handleApplyMaterialPreset = (preset: MaterialPreset) => {
    if (!model) return;
    onUpdateModel(model.id, { material: { ...preset } });
    setShowMaterialPresetBrowser(false);
  };

  const handleSaveMaterialAsPreset = () => {
    setNewPresetName(currentMaterial.name);
    setShowSaveMaterialModal(true);
  };

  const confirmSaveMaterialPreset = () => {
    if (newPresetName.trim()) {
      addMaterialPreset({ ...currentMaterial, name: newPresetName });
      setShowSaveMaterialModal(false);
    }
  };

  const handleSaveEnvAsPreset = () => {
    setNewEnvPresetName(environment.name || 'New Environment');
    setShowSaveEnvModal(true);
  };

  const confirmSaveEnvPreset = () => {
    if (newEnvPresetName.trim()) {
      addEnvPreset({ ...environment, name: newEnvPresetName });
      setShowSaveEnvModal(false);
    }
  };

  const handleSaveCameraAsPreset = () => {
    if (!activePreset) return;
    setNewCameraPresetName(activePreset.name + ' (Copy)');
    setShowSaveCameraModal(true);
  };

  const confirmSaveCameraPreset = () => {
    if (newCameraPresetName.trim() && activePreset) {
      const newPreset: CameraPreset = {
        ...activePreset,
        id: `preset-${Date.now()}`,
        name: newCameraPresetName,
        category: 'Custom'
      };
      onUpdateCameraPresets(prev => [...prev, newPreset]);
      onSetActiveCameraPreset(newPreset.id);
      setShowSaveCameraModal(false);
    }
  };

  const confirmDeletePreset = () => {
    if (!showConfirmDelete) return;
    if (showConfirmDelete.type === 'material') {
      deleteMaterialPreset(showConfirmDelete.id);
    } else if (showConfirmDelete.type === 'environment') {
      deleteEnvPreset(showConfirmDelete.id);
    } else if (showConfirmDelete.type === 'camera') {
      onUpdateCameraPresets(prev => prev.filter(p => p.id !== showConfirmDelete.id));
      if (activeCameraPresetId === showConfirmDelete.id) {
        onSetActiveCameraPreset('default-orbit');
      }
    } else if (showConfirmDelete.type === 'path') {
      onUpdateCameraPaths(prev => prev.filter(p => p.id !== showConfirmDelete.id));
      if (activeCameraPathId === showConfirmDelete.id) {
        onSetActiveCameraPath(null);
      }
    }
    setShowConfirmDelete(null);
  };

  const handleApplyEnvPreset = (preset: EnvironmentPreset) => {
    onUpdateEnvironment({ ...preset });
    setShowEnvPresetBrowser(false);
  };

  const handleApplyCameraPreset = (preset: CameraPreset) => {
    onSetActiveCameraPreset(preset.id);
    onSetActiveCameraPath(null);
    setShowCameraPresetBrowser(false);
  };

  const updateEnvironment = (updates: Partial<EnvironmentPreset>) => {
    onUpdateEnvironment(prev => ({ ...prev, ...updates }));
  };

  const updateCameraPreset = (updates: Partial<CameraPreset>) => {
    if (!activeCameraPresetId) return;
    onUpdateCameraPresets(prev => prev.map(p => p.id === activeCameraPresetId ? { ...p, ...updates } : p));
  };

  const handleCreatePath = () => {
    const newPath: CameraPath = {
      id: `path-${Date.now()}`,
      name: 'New Cinematic Path',
      category: 'Custom',
      points: [
        { id: `pt-${Date.now()}-1`, position: [10, 10, 10], target: [0, 0, 0], duration: 2, fov: 50 },
        { id: `pt-${Date.now()}-2`, position: [-10, 10, 10], target: [0, 0, 0], duration: 2, fov: 50 }
      ],
      loop: true,
      interpolation: 'smooth'
    };
    onUpdateCameraPaths(prev => [...prev, newPath]);
    onSetActiveCameraPath(newPath.id);
  };

  const updateActivePath = (updates: Partial<CameraPath>) => {
    if (!activeCameraPathId) return;
    onUpdateCameraPaths(prev => prev.map(p => p.id === activeCameraPathId ? { ...p, ...updates } : p));
  };

  const handleAddPathPoint = () => {
    if (!activePath) return;
    const lastPoint = activePath.points[activePath.points.length - 1];
    const newPoint: CameraPathPoint = {
      ...lastPoint,
      id: `pt-${Date.now()}`,
      position: [lastPoint.position[0] + 2, lastPoint.position[1], lastPoint.position[2]]
    };
    updateActivePath({ points: [...activePath.points, newPoint] });
  };

  const handleRemovePathPoint = (index: number) => {
    if (!activePath || activePath.points.length <= 2) return;
    const newPoints = [...activePath.points];
    newPoints.splice(index, 1);
    updateActivePath({ points: newPoints });
  };

  const updatePathPoint = (index: number, updates: Partial<CameraPathPoint>) => {
    if (!activePath) return;
    const newPoints = [...activePath.points];
    newPoints[index] = { ...newPoints[index], ...updates };
    updateActivePath({ points: newPoints });
  };

  const handleCapturePoint = (index: number) => {
    const captured = onCaptureCamera();
    if (captured) {
      updatePathPoint(index, {
        position: captured.position,
        target: captured.target,
        fov: captured.fov
      });
    }
  };

  const handleApplyToAll = () => {
    if (!model?.assetId) return;
    models.forEach(m => {
      if (m.assetId === model.assetId) {
        onUpdateModel(m.id, { material: { ...currentMaterial } });
      }
    });
  };

  const handleTextureChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof MaterialPreset) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Warning: This texture is large (>5MB). Large textures may impact mobile performance.');
      }
      const url = URL.createObjectURL(file);
      updateMaterial({ [type]: url });
    }
  };

  const handleSelectAssetAsTexture = (asset: Asset, type: keyof MaterialPreset) => {
    if (asset.metadata.fileSize > 5 * 1024 * 1024) {
      alert('Warning: This texture is large (>5MB). Large textures may impact mobile performance.');
    }
    updateMaterial({ [type]: asset.url });
    setShowTexturePicker(null);
  };

  const updateTransform = (axis: number, value: number, type: 'position' | 'rotation' | 'scale') => {
    if (!model) return;
    const current = [...model[type]] as [number, number, number];
    current[axis] = value;
    onUpdateModel(model.id, { [type]: current });
  };

  return (
    <div className="w-80 bg-[#151619] text-white z-10 border-l border-white/10 overflow-y-auto h-full flex-shrink-0 text-sm shadow-2xl flex flex-col">
      <div className="flex border-b border-white/10 bg-black/20">
        <button 
          onClick={() => setActiveTab('object')}
          className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'object' ? 'bg-white/10 text-white border-b-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          Object
        </button>
        <button 
          onClick={() => setActiveTab('environment')}
          className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'environment' ? 'bg-white/10 text-white border-b-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          Environment
        </button>
        <button 
          onClick={() => setActiveTab('camera')}
          className={`flex-1 py-3 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'camera' ? 'bg-white/10 text-white border-b-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          Camera
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'object' ? (
          model ? (
            <>
              <div className="p-4 border-b border-white/10 sticky top-0 bg-[#151619]/95 backdrop-blur-md z-10 flex justify-between items-center">
                <h2 className="text-xs font-mono uppercase tracking-widest truncate pr-2">{model.name}</h2>
                <div className="flex gap-1">
                  <button 
                    onClick={() => onUpdateModel(model.id, { visible: model.visible === false ? true : false })} 
                    className="p-1.5 hover:bg-white/10 rounded border border-white/5 transition-colors text-white/60 hover:text-white" 
                    title="Toggle Visibility"
                  >
                    {model.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button 
                    onClick={() => onUpdateModel(model.id, { locked: !model.locked })} 
                    className="p-1.5 hover:bg-white/10 rounded border border-white/5 transition-colors text-white/60 hover:text-white" 
                    title="Toggle Lock"
                  >
                    {model.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {model.prefabId && (
                <Section title="Prefab Instance" defaultOpen={true} badge="PREFAB">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="hardware-label">SOURCE_PREFAB</span>
                      <span className="text-[10px] font-mono text-white/80">{prefabs.find(p => p.id === model.prefabId)?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="hardware-label">INSTANCE_ID</span>
                      <span className="text-[8px] font-mono text-white/40">{model.prefabInstanceId}</span>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="hardware-label">OVERRIDES</span>
                        <span className="text-[8px] font-mono text-blue-400">{model.overriddenProperties?.length || 0} ACTIVE</span>
                      </div>
                      {model.overriddenProperties && model.overriddenProperties.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {model.overriddenProperties.map(prop => (
                            <span key={prop} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400/80 rounded-[2px] text-[7px] font-mono uppercase tracking-tighter border border-blue-500/20">
                              {prop}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <button 
                        onClick={() => onApplyToPrefab(model.id, model.prefabId!)}
                        className="hardware-button py-2 bg-blue-600/10 text-blue-400 border-blue-500/30 hover:bg-blue-600/20 flex items-center justify-center gap-2 group"
                      >
                        <Save className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px]">APPLY_TO_PREFAB</span>
                      </button>
                      <button 
                        onClick={() => onResetInstanceOverrides(model.id)}
                        className="hardware-button py-2 bg-white/5 text-white/40 border-white/10 hover:text-white/60 flex items-center justify-center gap-2 group"
                      >
                        <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-[9px]">RESET_OVERRIDES</span>
                      </button>
                    </div>
                    <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest leading-relaxed">
                      Applying to prefab will update the source definition and propagate changes to all other instances.
                    </p>
                  </div>
                </Section>
              )}

      <Section title="Organization" defaultOpen>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="hardware-label">Scene Layer</span>
            <select 
              className="hardware-input w-full py-2 px-3 text-xs bg-black/40 border-white/10 rounded focus:border-blue-500/50 outline-none transition-all cursor-pointer hover:bg-black/60"
              value={model.layerId || 'env'}
              onChange={(e) => onUpdateModel(model.id, { layerId: e.target.value })}
            >
              {layers.sort((a, b) => a.order - b.order).map(layer => (
                <option key={layer.id} value={layer.id} className="bg-[#1a1b1e] text-white">
                  {layer.name}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-white/30 font-mono italic px-1">
              Layers help organize complex scenes and manage visibility.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Behavior Tags" defaultOpen>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(model.behaviorTags || []).map(tag => (
              <span key={tag} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-[10px] font-mono border border-purple-500/30 flex items-center gap-1">
                {tag}
                <button 
                  onClick={() => onUpdateModel(model.id, { behaviorTags: (model.behaviorTags || []).filter(t => t !== tag) })}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(!model.behaviorTags || model.behaviorTags.length === 0) && (
              <span className="text-[10px] text-white/30 font-mono italic">No tags assigned</span>
            )}
          </div>
          
          <div className="pt-2 border-t border-white/5">
            <span className="hardware-label mb-2 block">Add Tag</span>
            <select 
              className="hardware-input w-full py-2 px-3 text-xs bg-black/40 border-white/10 rounded focus:border-purple-500/50 outline-none transition-all cursor-pointer hover:bg-black/60"
              value=""
              onChange={(e) => {
                if (e.target.value && !(model.behaviorTags || []).includes(e.target.value)) {
                  onUpdateModel(model.id, { behaviorTags: [...(model.behaviorTags || []), e.target.value] });
                }
              }}
            >
              <option value="" disabled>Select a tag...</option>
              <optgroup label="General">
                <option value="Decorative">Decorative</option>
                <option value="Structural">Structural</option>
                <option value="Environment">Environment</option>
              </optgroup>
              <optgroup label="Placement">
                <option value="Grounded">Grounded</option>
                <option value="Surface Object">Surface Object</option>
              </optgroup>
              <optgroup label="Location">
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
              </optgroup>
              <optgroup label="Interaction">
                <option value="Clickable">Clickable</option>
                <option value="Selectable">Selectable</option>
                <option value="Movable">Movable</option>
              </optgroup>
              <optgroup label="Editor">
                <option value="Replaceable">Replaceable</option>
                <option value="Prefab Source">Prefab Source</option>
                <option value="Prefab Instance">Prefab Instance</option>
                <option value="Export-Sensitive">Export-Sensitive</option>
                <option value="Locked Layout Asset">Locked Layout Asset</option>
                <option value="Helper Object">Helper Object</option>
              </optgroup>
              <optgroup label="Logic">
                <option value="Gameplay-Critical">Gameplay-Critical</option>
                <option value="Camera Anchor">Camera Anchor</option>
                <option value="Light Anchor">Light Anchor</option>
                <option value="Collision-Sensitive">Collision-Sensitive</option>
                <option value="Hidden Support Object">Hidden Support Object</option>
              </optgroup>
              <optgroup label="Swimming Game">
                <option value="Ad Placement">Ad Placement</option>
                <option value="Flag Placement">Flag Placement</option>
                <option value="Signage">Signage</option>
                <option value="Water-Related">Water-Related</option>
              </optgroup>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Metadata" defaultOpen>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="hardware-label">ID</span>
            <span className="hardware-value truncate w-32 text-right" title={model.id}>{model.id.substring(0, 8)}...</span>
          </div>
          {asset && (
            <div className="bg-white/5 border border-white/10 rounded p-3 mt-2 space-y-2">
              <div className="text-[9px] text-white/40 uppercase font-mono tracking-widest">Linked Asset</div>
              <div className="text-xs font-medium truncate text-white/90">{asset.metadata.name}</div>
              <div className="flex justify-between text-[9px] font-mono tracking-tighter">
                <span className="text-white/40">{asset.metadata.category}</span>
                <span className={asset.metadata.optimizedStatus === 'heavy' ? 'text-red-400' : 'text-green-400'}>
                  {asset.metadata.optimizedStatus.toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={onReplaceAsset}
            className="hardware-button w-full py-2 text-[10px] mt-2 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3 h-3" /> {model.assetId ? 'Replace Asset' : 'Link to Library'}
          </button>
          <div className="flex justify-between items-center pt-2">
            <span className="hardware-label">Type</span>
            <select 
              className="hardware-input text-[10px] py-1"
              value={model.type || 'model'}
              onChange={(e) => onUpdateModel(model.id, { type: e.target.value as any })}
            >
              <option value="model">3D Model</option>
              <option value="environment">Environment</option>
              <option value="light">Light</option>
              <option value="camera">Camera</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="hardware-label">Class</span>
            <select 
              className="hardware-input text-[10px] py-1"
              value={model.classification || 'both'}
              onChange={(e) => onUpdateModel(model.id, { classification: e.target.value as any })}
            >
              <option value="both">Both</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="hardware-label">Behavior</span>
            <select 
              className="hardware-input text-[10px] py-1"
              value={model.behavior || 'static'}
              onChange={(e) => onUpdateModel(model.id, { behavior: e.target.value as any })}
            >
              <option value="static">Static</option>
              <option value="movable">Movable</option>
              <option value="decorative">Decorative</option>
              <option value="environment">Environment</option>
              <option value="gameplay-critical">Gameplay Critical</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Transform" defaultOpen>
        <div className="space-y-4">
          {['Position', 'Rotation', 'Scale'].map((type) => {
            const propName = type.toLowerCase() as 'position' | 'rotation' | 'scale';
            const values = model[propName];
            return (
              <div key={type} className="space-y-2">
                <div className="hardware-label">{type}</div>
                <div className="flex gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1 flex items-center bg-black/40 rounded px-2 py-1.5 border border-white/5 focus-within:border-white/20 transition-all">
                      <span className={`text-[9px] font-mono font-bold mr-1.5 ${axis === 'X' ? 'text-red-500' : axis === 'Y' ? 'text-green-500' : 'text-blue-500'}`}>{axis}</span>
                      <input 
                        type="number" 
                        className="w-full bg-transparent outline-none text-right font-mono text-[10px] text-white/90"
                        value={Number(values[i].toFixed(3))}
                        onChange={(e) => updateTransform(i, parseFloat(e.target.value) || 0, propName)}
                        step={type === 'Scale' ? 0.1 : 1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => onUpdateModel(model.id, { position: [model.position[0], 0, model.position[2]] })} 
              className="hardware-button flex-1 py-2 text-[10px] flex items-center justify-center gap-2"
              title="Align to Ground"
            >
              <ArrowDown className="w-3 h-3" /> Ground
            </button>
            <button onClick={() => onReset(model.id)} className="hardware-button flex-1 py-2 text-[10px]">Reset</button>
            <button onClick={() => onFocus(model.id)} className="hardware-button flex-1 py-2 text-[10px] bg-white/10 border-white/20">Focus</button>
          </div>
        </div>
      </Section>

      <Section title="Material & Textures" defaultOpen>
        <div className="space-y-4">
          {/* Preset Selection */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="hardware-label">Category Filter</label>
              <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
                {['All', 'Concrete', 'Tile', 'Water', 'Metal', 'Wood', 'Sports Surface', 'Custom'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedMaterialCategory(cat as any)}
                    className={`px-3 py-1 rounded text-[9px] font-mono uppercase tracking-tighter whitespace-nowrap transition-all border ${
                      selectedMaterialCategory === cat 
                        ? 'bg-white text-black border-white' 
                        : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <label className="hardware-label">Material Preset</label>
              <button 
                onClick={() => setShowMaterialPresetBrowser(true)}
                className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors"
              >
                Browse
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 hardware-input px-3 py-2 text-[10px] truncate">
                {currentMaterial.name}
              </div>
              <button 
                onClick={handleSaveMaterialAsPreset}
                className="hardware-button p-2"
                title="Save as Preset"
              >
                <Save className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Texture Maps */}
          <div className="space-y-3 pt-4 border-t border-white/5">
            <label className="hardware-label">Texture Maps</label>
            
            {[
              { label: 'Base Map', key: 'mapUrl' },
              { label: 'Normal Map', key: 'normalMapUrl' },
              { label: 'Roughness Map', key: 'roughnessMapUrl' },
              { label: 'Metalness Map', key: 'metalnessMapUrl' },
              { label: 'Emissive Map', key: 'emissiveMapUrl' },
              { label: 'Alpha Map', key: 'alphaMapUrl' },
            ].map((map) => (
              <div key={map.key} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black/40 rounded border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center group relative">
                  {currentMaterial[map.key as keyof MaterialPreset] ? (
                    <img 
                      src={currentMaterial[map.key as keyof MaterialPreset] as string} 
                      alt={map.label} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[8px] font-mono opacity-20 uppercase">Empty</span>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => setShowTexturePicker({ open: true, type: map.key as keyof MaterialPreset })}
                      className="text-white/80 hover:scale-110 transition-transform"
                      title="Open Texture Picker"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-white/60 uppercase tracking-tighter truncate">{map.label}</span>
                    <button 
                      onClick={() => setShowTexturePicker({ open: true, type: map.key as keyof MaterialPreset })}
                      className="text-[8px] font-mono text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors"
                    >
                      Browse
                    </button>
                  </div>
                  {currentMaterial[map.key as keyof MaterialPreset] && (
                    <div className="text-[8px] font-mono text-white/20 truncate uppercase">
                      {typeof currentMaterial[map.key as keyof MaterialPreset] === 'string' && (currentMaterial[map.key as keyof MaterialPreset] as string).split('/').pop()?.split('?')[0]}
                    </div>
                  )}
                </div>
                {currentMaterial[map.key as keyof MaterialPreset] && (
                  <button 
                    onClick={() => updateMaterial({ [map.key]: undefined })}
                    className="p-1.5 hover:bg-red-900/30 text-red-400 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Color & PBR Properties */}
          <div className="space-y-4 pt-4 border-t border-white/5">
            <label className="hardware-label">Properties</label>
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-white/60 uppercase">Base Color</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/40">{currentMaterial.color}</span>
                <input 
                  type="color" 
                  value={currentMaterial.color} 
                  onChange={(e) => updateMaterial({ color: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                <span className="text-white/40">Roughness</span>
                <span className="text-white/90">{currentMaterial.roughness.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.roughness} 
                onChange={(e) => updateMaterial({ roughness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                <span className="text-white/40">Metalness</span>
                <span className="text-white/90">{currentMaterial.metalness.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.metalness} 
                onChange={(e) => updateMaterial({ metalness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-white/60 uppercase">Emissive Color</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-white/40">{currentMaterial.emissiveColor}</span>
                <input 
                  type="color" 
                  value={currentMaterial.emissiveColor} 
                  onChange={(e) => updateMaterial({ emissiveColor: e.target.value })}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                <span className="text-white/40">Emissive Intensity</span>
                <span className="text-white/90">{currentMaterial.emissiveIntensity.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="10" step="0.1" 
                value={currentMaterial.emissiveIntensity} 
                onChange={(e) => updateMaterial({ emissiveIntensity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                <span className="text-white/40">Opacity</span>
                <span className="text-white/90">{currentMaterial.opacity.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.opacity} 
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateMaterial({ opacity: val, transparent: val < 1 });
                }}
                className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          {/* UV Transform */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <label className="text-gray-400 text-[10px] uppercase font-bold">UV Transform</label>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">Tiling X</span>
                <input 
                  type="number" step="0.1"
                  value={currentMaterial.tiling[0]} 
                  onChange={(e) => updateMaterial({ tiling: [parseFloat(e.target.value) || 1, currentMaterial.tiling[1]] })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">Tiling Y</span>
                <input 
                  type="number" step="0.1"
                  value={currentMaterial.tiling[1]} 
                  onChange={(e) => updateMaterial({ tiling: [currentMaterial.tiling[0], parseFloat(e.target.value) || 1] })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">Offset X</span>
                <input 
                  type="number" step="0.01"
                  value={currentMaterial.offset[0]} 
                  onChange={(e) => updateMaterial({ offset: [parseFloat(e.target.value) || 0, currentMaterial.offset[1]] })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500">Offset Y</span>
                <input 
                  type="number" step="0.01"
                  value={currentMaterial.offset[1]} 
                  onChange={(e) => updateMaterial({ offset: [currentMaterial.offset[0], parseFloat(e.target.value) || 0] })}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Advanced */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input 
                type="checkbox" 
                checked={currentMaterial.wireframe} 
                onChange={(e) => updateMaterial({ wireframe: e.target.checked })} 
                className="rounded bg-gray-800 border-gray-700"
              />
              <span>Wireframe</span>
            </label>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Side</span>
              <select 
                value={currentMaterial.side}
                onChange={(e) => updateMaterial({ side: e.target.value as any })}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
              >
                <option value="front">Front</option>
                <option value="back">Back</option>
                <option value="double">Double</option>
              </select>
            </div>
          </div>

          {/* Global Actions */}
          {model.assetId && (
            <div className="pt-2">
              <button 
                onClick={handleApplyToAll}
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/50 py-2 rounded text-xs font-bold transition-colors"
              >
                Apply to All Instances
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title="Lighting & Rendering">
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={!!model.wireframe} 
              onChange={(e) => onUpdateModel(model.id, { wireframe: e.target.checked })} 
              className="rounded bg-gray-800 border-gray-700"
            />
            <span>Wireframe</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={model.castShadow !== false} 
              onChange={(e) => onUpdateModel(model.id, { castShadow: e.target.checked })} 
              className="rounded bg-gray-800 border-gray-700"
            />
            <span>Cast Shadows</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={model.receiveShadow !== false} 
              onChange={(e) => onUpdateModel(model.id, { receiveShadow: e.target.checked })} 
              className="rounded bg-gray-800 border-gray-700"
            />
            <span>Receive Shadows</span>
          </label>
          
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between">
              <label className="text-gray-400 text-xs uppercase tracking-wider">Light Intensity</label>
              <span className="text-xs">{model.lightIntensity?.toFixed(1) || '0.0'}</span>
            </div>
            <input 
              type="range" min="0" max="10" step="0.1" 
              value={model.lightIntensity || 0} 
              onChange={(e) => onUpdateModel(model.id, { lightIntensity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </Section>

      <div className="p-4 border-t border-white/10 bg-black/40 flex gap-2 sticky bottom-0 z-10 backdrop-blur-md">
        <button 
          onClick={() => onFocus(model.id)}
          className="hardware-button flex-1 py-2.5 flex items-center justify-center gap-2"
        >
          <Focus className="w-3 h-3" /> Focus
        </button>
        <button 
          onClick={() => onDuplicate(model.id)}
          className="hardware-button flex-1 py-2.5 flex items-center justify-center gap-2"
        >
          <Copy className="w-3 h-3" /> Clone
        </button>
        <button 
          onClick={() => onDelete(model.id)}
          className="hardware-button flex-1 py-2.5 flex items-center justify-center gap-2 text-red-400 border-red-900/30 hover:bg-red-900/20"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </>
          ) : (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-4">
              <span className="text-4xl">🖱️</span>
              <p>Select an object to inspect its properties.</p>
            </div>
          )
        ) : activeTab === 'environment' ? (
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowEnvPresetBrowser(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <span>🌍</span> Browse Presets
                </button>
                <button 
                  onClick={handleSaveEnvAsPreset}
                  className="bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-700 transition-colors"
                  title="Save as Preset"
                >
                  💾
                </button>
              </div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center">
                Current: {environment.name}
              </div>
            </div>

            <Section title="Ambient & Hemisphere" defaultOpen>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase">Ambient Light</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      value={environment.ambientColor}
                      onChange={(e) => updateEnvironment({ ambientColor: e.target.value })}
                    />
                    <input 
                      type="range" min="0" max="2" step="0.01"
                      className="flex-1 accent-blue-500"
                      value={environment.ambientIntensity}
                      onChange={(e) => updateEnvironment({ ambientIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="text-[10px] font-mono w-8 text-right text-blue-400">{environment.ambientIntensity.toFixed(1)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Hemisphere Light</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-gray-950 p-1 rounded border border-gray-800">
                      <input 
                        type="color" 
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                        value={environment.hemisphereColor}
                        onChange={(e) => updateEnvironment({ hemisphereColor: e.target.value })}
                      />
                      <span className="text-[9px] text-gray-500 uppercase font-bold">Sky</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-950 p-1 rounded border border-gray-800">
                      <input 
                        type="color" 
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                        value={environment.hemisphereGroundColor}
                        onChange={(e) => updateEnvironment({ hemisphereGroundColor: e.target.value })}
                      />
                      <span className="text-[9px] text-gray-500 uppercase font-bold">Ground</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="2" step="0.01"
                      className="flex-1 accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                      value={environment.hemisphereIntensity}
                      onChange={(e) => updateEnvironment({ hemisphereIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="text-[10px] font-mono w-8 text-right text-blue-400">{environment.hemisphereIntensity.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Directional Light" defaultOpen>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 uppercase">Shadows</label>
                  <button 
                    onClick={() => updateEnvironment({ castShadows: !environment.castShadows })}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${environment.castShadows ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    {environment.castShadows ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      value={environment.directionalColor}
                      onChange={(e) => updateEnvironment({ directionalColor: e.target.value })}
                    />
                    <input 
                      type="range" min="0" max="5" step="0.1"
                      className="flex-1 accent-blue-500"
                      value={environment.directionalIntensity}
                      onChange={(e) => updateEnvironment({ directionalIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="text-xs w-8 text-right">{environment.directionalIntensity.toFixed(1)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase">Position</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <input 
                        key={axis}
                        type="number" 
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center text-xs"
                        value={environment.directionalPosition[i]}
                        onChange={(e) => {
                          const newPos = [...environment.directionalPosition] as [number, number, number];
                          newPos[i] = parseFloat(e.target.value);
                          updateEnvironment({ directionalPosition: newPos });
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Sky & Background">
              <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="hardware-label">Type</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowEnvPresetBrowser(true)}
                  className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors"
                >
                  Browse
                </button>
                <button 
                  onClick={handleSaveEnvAsPreset}
                  className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
                  <select 
                    className="hardware-input w-full"
                    value={environment.backgroundType}
                    onChange={(e) => updateEnvironment({ backgroundType: e.target.value as any })}
                  >
                    <option value="color">Solid Color</option>
                    <option value="preset">Environment Preset</option>
                  </select>
                {environment.backgroundType === 'color' ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10"
                      value={environment.backgroundColor}
                      onChange={(e) => updateEnvironment({ backgroundColor: e.target.value })}
                    />
                    <span className="hardware-label">Background Color</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select 
                        className="hardware-input flex-1"
                        value={environment.environmentPreset}
                        onChange={(e) => updateEnvironment({ environmentPreset: e.target.value as any })}
                      >
                        <option value="studio">Studio</option>
                        <option value="apartment">Apartment</option>
                        <option value="city">City</option>
                        <option value="forest">Forest</option>
                        <option value="dawn">Dawn</option>
                        <option value="night">Night</option>
                        <option value="warehouse">Warehouse</option>
                        <option value="sunset">Sunset</option>
                        <option value="park">Park</option>
                        <option value="lobby">Lobby</option>
                      </select>
                      <button 
                        onClick={() => setShowEnvPresetBrowser(true)}
                        className="hardware-button"
                        title="Browse Presets"
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    <span>Env Intensity</span>
                    <span className="text-white/80">{environment.environmentIntensity.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1"
                    className="w-full accent-blue-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                    value={environment.environmentIntensity}
                    onChange={(e) => updateEnvironment({ environmentIntensity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Fog">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="hardware-label">Enabled</label>
                  <button 
                    onClick={() => updateEnvironment({ fogEnabled: !environment.fogEnabled })}
                    className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${environment.fogEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-accent' : 'bg-white/5 text-white/20 border border-white/5'}`}
                  >
                    {environment.fogEnabled ? 'ACTIVE' : 'INACTIVE'}
                  </button>
                </div>
                {environment.fogEnabled && (
                  <>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10"
                        value={environment.fogColor}
                        onChange={(e) => updateEnvironment({ fogColor: e.target.value })}
                      />
                      <span className="hardware-label">Fog Color</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="hardware-label">Near</label>
                        <input 
                          type="number" 
                          className="hardware-input w-full"
                          value={environment.fogNear}
                          onChange={(e) => updateEnvironment({ fogNear: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="hardware-label">Far</label>
                        <input 
                          type="number" 
                          className="hardware-input w-full"
                          value={environment.fogFar}
                          onChange={(e) => updateEnvironment({ fogFar: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Section>

            <Section title="Post-Processing">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    <span>Exposure</span>
                    <span className="text-white/80">{environment.exposure.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="3" step="0.1"
                    className="w-full accent-blue-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer"
                    value={environment.exposure}
                    onChange={(e) => updateEnvironment({ exposure: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="hardware-label">Tone Mapping</label>
                  <select 
                    className="hardware-input w-full"
                    value={environment.toneMapping}
                    onChange={(e) => updateEnvironment({ toneMapping: e.target.value as any })}
                  >
                    <option value="None">None</option>
                    <option value="Linear">Linear</option>
                    <option value="Reinhard">Reinhard</option>
                    <option value="Cineon">Cineon</option>
                    <option value="ACESFilmic">ACES Filmic</option>
                  </select>
                </div>
              </div>
            </Section>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Camera Presets Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="hardware-label">Camera Preset</label>
                <button 
                  onClick={() => setShowCameraPresetBrowser(true)}
                  className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors"
                >
                  Browse
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 hardware-input px-3 py-2 text-[10px] truncate">
                  {activePreset?.name || 'No Preset Selected'}
                </div>
                <button 
                  onClick={handleSaveCameraAsPreset}
                  className="hardware-button p-2"
                  title="Save Current as Preset"
                >
                  <Save className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[9px] text-white/40 uppercase font-mono tracking-widest text-center">
                Category: {activePreset?.category || 'None'}
              </div>
            </div>

            {activePreset && (
              <Section title="Preset Settings" defaultOpen>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="hardware-label">Type</span>
                    <select 
                      className="hardware-input text-[10px] py-1"
                      value={activePreset.type}
                      onChange={(e) => updateCameraPreset({ type: e.target.value as any })}
                    >
                      <option value="perspective">Perspective</option>
                      <option value="orthographic">Orthographic</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest">
                      <span className="text-white/40">Field of View</span>
                      <span className="text-white/90">{activePreset.fov}°</span>
                    </div>
                    <input 
                      type="range" min="10" max="120" step="1" 
                      value={activePreset.fov} 
                      onChange={(e) => updateCameraPreset({ fov: parseInt(e.target.value) })}
                      className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="hardware-label">Orbit Limits (Vertical)</div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[8px] text-white/40 uppercase">Min Angle</span>
                        <input 
                          type="number" 
                          className="hardware-input w-full py-1 text-[10px]"
                          value={activePreset.orbitLimits?.minPolar || 0}
                          onChange={(e) => updateCameraPreset({ 
                            orbitLimits: { 
                              minAzimuth: 0, maxAzimuth: Math.PI * 2, 
                              minDistance: 0, maxDistance: 1000,
                              maxPolar: Math.PI,
                              ...activePreset.orbitLimits, 
                              minPolar: parseFloat(e.target.value) 
                            } 
                          })}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[8px] text-white/40 uppercase">Max Angle</span>
                        <input 
                          type="number" 
                          className="hardware-input w-full py-1 text-[10px]"
                          value={activePreset.orbitLimits?.maxPolar || Math.PI}
                          onChange={(e) => updateCameraPreset({ 
                            orbitLimits: { 
                              minAzimuth: 0, maxAzimuth: Math.PI * 2, 
                              minDistance: 0, maxDistance: 1000,
                              minPolar: 0,
                              ...activePreset.orbitLimits, 
                              maxPolar: parseFloat(e.target.value) 
                            } 
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="hardware-label">Distance Limits</div>
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-1">
                        <span className="text-[8px] text-white/40 uppercase">Min Dist</span>
                        <input 
                          type="number" 
                          className="hardware-input w-full py-1 text-[10px]"
                          value={activePreset.orbitLimits?.minDistance || 0}
                          onChange={(e) => updateCameraPreset({ 
                            orbitLimits: { 
                              minAzimuth: 0, maxAzimuth: Math.PI * 2, 
                              maxDistance: 1000,
                              minPolar: 0, maxPolar: Math.PI,
                              ...activePreset.orbitLimits, 
                              minDistance: parseFloat(e.target.value) 
                            } 
                          })}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-[8px] text-white/40 uppercase">Max Dist</span>
                        <input 
                          type="number" 
                          className="hardware-input w-full py-1 text-[10px]"
                          value={activePreset.orbitLimits?.maxDistance || 1000}
                          onChange={(e) => updateCameraPreset({ 
                            orbitLimits: { 
                              minAzimuth: 0, maxAzimuth: Math.PI * 2, 
                              minDistance: 0,
                              minPolar: 0, maxPolar: Math.PI,
                              ...activePreset.orbitLimits, 
                              maxDistance: parseFloat(e.target.value) 
                            } 
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="hardware-label">Indoor Restrictions</span>
                    <button 
                      onClick={() => updateCameraPreset({ indoorRestrictions: !activePreset.indoorRestrictions })}
                      className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${activePreset.indoorRestrictions ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-white/20 border border-white/5'}`}
                    >
                      {activePreset.indoorRestrictions ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              </Section>
            )}

            {/* Cinematic Paths Section */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Cinematic Paths</h3>
                <button 
                  onClick={handleCreatePath}
                  className="p-1.5 hover:bg-white/10 rounded border border-white/5 transition-colors text-blue-400 hover:text-blue-300"
                  title="Create New Path"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {cameraPaths.length === 0 ? (
                  <div className="p-4 bg-white/5 rounded border border-dashed border-white/10 text-center">
                    <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest">No paths created</p>
                  </div>
                ) : (
                  cameraPaths.map(path => (
                    <div 
                      key={path.id}
                      className={`p-3 rounded border transition-all cursor-pointer group ${activeCameraPathId === path.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                      onClick={() => onSetActiveCameraPath(activeCameraPathId === path.id ? null : path.id)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <Video className={`w-3.5 h-3.5 ${activeCameraPathId === path.id ? 'text-blue-400' : 'text-white/40'}`} />
                          <span className={`text-[10px] font-mono uppercase tracking-widest ${activeCameraPathId === path.id ? 'text-white' : 'text-white/60'}`}>{path.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowConfirmDelete({ id: path.id, type: 'path' });
                            }}
                            className="p-1 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      {activeCameraPathId === path.id && (
                        <div className="space-y-3 mt-3 pt-3 border-t border-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="space-y-1">
                            <span className="text-[8px] text-white/40 uppercase font-mono">Path Name</span>
                            <input 
                              type="text" 
                              className="hardware-input w-full py-1 text-[10px]"
                              value={path.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateActivePath({ name: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] text-white/40 uppercase font-mono">Loop Animation</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateActivePath({ loop: !path.loop });
                              }}
                              className={`px-2 py-0.5 rounded text-[8px] font-mono transition-all ${path.loop ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 text-white/20'}`}
                            >
                              {path.loop ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[8px] text-white/40 uppercase font-mono">Path Points ({path.points.length})</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddPathPoint();
                                }}
                                className="text-[8px] text-blue-400 hover:text-blue-300 uppercase font-mono tracking-widest"
                              >
                                Add Point
                              </button>
                            </div>
                            
                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                              {path.points.map((point, idx) => (
                                <div key={point.id || idx} className="bg-black/40 rounded border border-white/5 overflow-hidden transition-all">
                                  <div 
                                    className={`flex justify-between items-center p-2 cursor-pointer hover:bg-white/5 transition-colors ${expandedPointId === point.id ? 'bg-white/5 border-b border-white/5' : ''}`}
                                    onClick={() => setExpandedPointId(expandedPointId === point.id ? null : point.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedPointId === point.id ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />}
                                      <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">POINT_{idx + 1}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCapturePoint(idx);
                                        }}
                                        className="p-1 hover:text-blue-400 transition-colors"
                                        title="Capture Current View"
                                      >
                                        <Focus className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemovePathPoint(idx);
                                        }}
                                        className="p-1 text-red-400/40 hover:text-red-400 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {expandedPointId === point.id && (
                                    <div className="p-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <span className="text-[7px] text-white/20 uppercase font-mono">Duration (s)</span>
                                          <input 
                                            type="number" 
                                            className="hardware-input w-full py-1 text-[10px]"
                                            value={point.duration}
                                            onChange={(e) => updatePathPoint(idx, { duration: parseFloat(e.target.value) || 1 })}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <span className="text-[7px] text-white/20 uppercase font-mono">Pause (s)</span>
                                          <input 
                                            type="number" 
                                            className="hardware-input w-full py-1 text-[10px]"
                                            value={point.pause || 0}
                                            onChange={(e) => updatePathPoint(idx, { pause: parseFloat(e.target.value) || 0 })}
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[7px] text-white/20 uppercase font-mono">Position</span>
                                        <div className="grid grid-cols-3 gap-1">
                                          {['X', 'Y', 'Z'].map((axis, i) => (
                                            <div key={axis} className="relative">
                                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[6px] font-mono text-white/20">{axis}</span>
                                              <input 
                                                type="number" 
                                                className="hardware-input w-full pl-4 py-1 text-[9px]"
                                                value={point.position[i]}
                                                onChange={(e) => {
                                                  const newPos = [...point.position] as [number, number, number];
                                                  newPos[i] = parseFloat(e.target.value) || 0;
                                                  updatePathPoint(idx, { position: newPos });
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <span className="text-[7px] text-white/20 uppercase font-mono">Target</span>
                                        <div className="grid grid-cols-3 gap-1">
                                          {['X', 'Y', 'Z'].map((axis, i) => (
                                            <div key={axis} className="relative">
                                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[6px] font-mono text-white/20">{axis}</span>
                                              <input 
                                                type="number" 
                                                className="hardware-input w-full pl-4 py-1 text-[9px]"
                                                value={point.target[i]}
                                                onChange={(e) => {
                                                  const newTarget = [...point.target] as [number, number, number];
                                                  newTarget[i] = parseFloat(e.target.value) || 0;
                                                  updatePathPoint(idx, { target: newTarget });
                                                }}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[7px] font-mono uppercase tracking-widest">
                                          <span className="text-white/20">FOV Override</span>
                                          <span className="text-white/60">{point.fov || 50}°</span>
                                        </div>
                                        <input 
                                          type="range" min="10" max="120" step="1" 
                                          value={point.fov || 50} 
                                          onChange={(e) => updatePathPoint(idx, { fov: parseInt(e.target.value) })}
                                          className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <button 
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Path is already active, user can see it in scene
                            }}
                          >
                            <Play className="w-3 h-3" /> Preview Path
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Camera Preset Modal */}
      {showSaveCameraModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">SAVE_CAMERA_PRESET</h3>
              <button onClick={() => setShowSaveCameraModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="hardware-label">PRESET_NAME</label>
              <input 
                type="text" 
                className="hardware-input w-full py-2 px-3"
                value={newCameraPresetName}
                onChange={(e) => setNewCameraPresetName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmSaveCameraPreset()}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowSaveCameraModal(false)} className="hardware-button flex-1 py-2.5">CANCEL</button>
              <button 
                onClick={confirmSaveCameraPreset} 
                className="hardware-button flex-1 py-2.5 bg-blue-600/20 text-blue-400 border-blue-500/30 glow-accent"
              >
                SAVE_PRESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Preset Browser Modal */}
      {showCameraPresetBrowser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 flex items-center gap-2">
                <Camera className="w-4 h-4" /> CAMERA_PRESETS
              </h3>
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text" 
                    placeholder="SEARCH..." 
                    value={cameraSearchQuery}
                    onChange={(e) => setCameraSearchQuery(e.target.value)}
                    className="hardware-input pl-7 w-40"
                  />
                </div>
                <button 
                  onClick={() => setShowCameraPresetBrowser(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Category Filter */}
            <div className="p-4 bg-black/20 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
              {['All', 'Editor Orbit', 'Indoor Walkthrough', 'Outdoor Explore', 'Gameplay Follow', 'Broadcast Side View', 'Broadcast Overhead', 'Race Start View', 'Finish View', 'Entrance Camera', 'Replay Camera', 'Cinematic Showcase', 'Custom'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCameraCategory(cat)}
                  className={`px-3 py-1 rounded text-[9px] font-mono uppercase tracking-tighter whitespace-nowrap transition-all border ${
                    selectedCameraCategory === cat 
                      ? 'bg-white text-black border-white' 
                      : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 custom-scrollbar">
              {cameraPresets
                .filter(p => (selectedCameraCategory === 'All' || p.category === selectedCameraCategory) && 
                            (p.name.toLowerCase().includes(cameraSearchQuery.toLowerCase())))
                .map(preset => (
                <div 
                  key={preset.id}
                  className={`group relative bg-black/40 border rounded-lg overflow-hidden transition-all ${activeCameraPresetId === preset.id ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-white/5 hover:border-white/40'}`}
                >
                  <div 
                    className="aspect-video w-full cursor-pointer bg-black/60 flex flex-col items-center justify-center relative p-4 text-center"
                    onClick={() => handleApplyCameraPreset(preset)}
                  >
                    <Camera className={`w-8 h-8 mb-2 transition-all ${activeCameraPresetId === preset.id ? 'text-blue-400' : 'text-white/20 group-hover:text-white/60'}`} />
                    <span className="text-[9px] font-mono text-white/80 uppercase tracking-widest">{preset.name}</span>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] font-mono text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded">APPLY</span>
                    </div>
                  </div>
                  <div className="p-2 flex justify-between items-center bg-black/40 border-t border-white/5">
                    <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">{preset.category}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmDelete({ id: preset.id, type: 'camera' });
                      }}
                      className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save Material Preset Modal */}
      {showSaveMaterialModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">SAVE_MATERIAL_PRESET</h3>
              <button onClick={() => setShowSaveMaterialModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="hardware-label">PRESET_NAME</label>
              <input 
                type="text" 
                className="hardware-input w-full py-2 px-3"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmSaveMaterialPreset()}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowSaveMaterialModal(false)} className="hardware-button flex-1 py-2.5">CANCEL</button>
              <button 
                onClick={confirmSaveMaterialPreset} 
                className="hardware-button flex-1 py-2.5 bg-blue-600/20 text-blue-400 border-blue-500/30 glow-accent"
              >
                SAVE_PRESET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Environment Preset Modal */}
      {showSaveEnvModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">SAVE_ENVIRONMENT_PRESET</h3>
              <button onClick={() => setShowSaveEnvModal(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="hardware-label">PRESET_NAME</label>
              <input 
                type="text" 
                className="hardware-input w-full py-2 px-3"
                value={newEnvPresetName}
                onChange={(e) => setNewEnvPresetName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && confirmSaveEnvPreset()}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowSaveEnvModal(false)} className="hardware-button flex-1 py-2.5">CANCEL</button>
              <button 
                onClick={confirmSaveEnvPreset} 
                className="hardware-button flex-1 py-2.5 bg-blue-600/20 text-blue-400 border-blue-500/30 glow-accent"
              >
                SAVE_PRESET
              </button>
            </div>
          </div>
        </div>
      )}
      {showTexturePicker?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">SELECT_TEXTURE: {showTexturePicker.type.replace('Url', '').toUpperCase()}</h3>
              <button 
                onClick={() => setShowTexturePicker(null)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-3 gap-3 custom-scrollbar">
              {/* Upload Option */}
              <label className="aspect-square bg-black/40 border-2 border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all group">
                <Upload className="w-6 h-6 text-white/20 group-hover:text-white/60 transition-all group-hover:scale-110" />
                <span className="text-[8px] text-white/30 mt-2 font-mono uppercase tracking-widest">UPLOAD_NEW</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      updateMaterial({ [showTexturePicker.type]: url });
                      setShowTexturePicker(null);
                    }
                  }}
                />
              </label>

              {/* Asset Library Textures */}
              {assets.filter(a => a.metadata.type === 'texture').map(asset => (
                <button
                  key={asset.id}
                  onClick={() => {
                    updateMaterial({ [showTexturePicker.type]: asset.url });
                    setShowTexturePicker(null);
                  }}
                  className="aspect-square bg-black/60 rounded-lg border border-white/5 overflow-hidden hover:border-white/40 transition-all relative group"
                  title={asset.metadata.name}
                >
                  <img 
                    src={asset.url} 
                    alt={asset.metadata.name} 
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[7px] font-mono text-white/60 truncate block">{asset.metadata.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-white/5 bg-black/20 text-center">
              <p className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Select from library or upload custom map</p>
            </div>
          </div>
        </div>
      )}

      {/* Material Preset Browser Modal */}
      {showMaterialPresetBrowser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 flex items-center gap-2">
                <Layers className="w-4 h-4" /> MATERIAL_PRESETS
              </h3>
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text" 
                    placeholder="SEARCH..." 
                    value={materialSearchQuery}
                    onChange={(e) => setMaterialSearchQuery(e.target.value)}
                    className="hardware-input pl-7 w-40"
                  />
                </div>
                <button 
                  onClick={() => setShowMaterialPresetBrowser(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 custom-scrollbar">
              {filteredMaterialPresets.map(preset => (
                <div 
                  key={preset.id}
                  className="group relative bg-black/40 border border-white/5 rounded-lg overflow-hidden hover:border-white/40 transition-all"
                >
                  <div 
                    className="aspect-square w-full cursor-pointer relative"
                    onClick={() => handleApplyMaterialPreset(preset)}
                    style={{ backgroundColor: preset.color }}
                  >
                    {preset.mapUrl && (
                      <img 
                        src={preset.mapUrl} 
                        alt={preset.name} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] font-mono text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded">APPLY</span>
                    </div>
                  </div>
                  <div className="p-2 flex justify-between items-center bg-black/40 border-t border-white/5">
                    <span className="text-[8px] font-mono text-white/60 truncate uppercase tracking-tighter">{preset.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmDelete({ id: preset.id, type: 'material' });
                      }}
                      className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Environment Preset Browser Modal */}
      {showEnvPresetBrowser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> ENVIRONMENT_PRESETS
              </h3>
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text" 
                    placeholder="SEARCH..." 
                    value={envSearchQuery}
                    onChange={(e) => setEnvSearchQuery(e.target.value)}
                    className="hardware-input pl-7 w-40"
                  />
                </div>
                <button 
                  onClick={() => setShowEnvPresetBrowser(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 custom-scrollbar">
              {filteredEnvPresets.map(preset => (
                <div 
                  key={preset.id}
                  className="group relative bg-black/40 border border-white/5 rounded-lg overflow-hidden hover:border-white/40 transition-all"
                >
                  <div 
                    className="aspect-video w-full cursor-pointer bg-black/60 flex items-center justify-center relative"
                    onClick={() => handleApplyEnvPreset(preset)}
                  >
                    <div className="w-full h-full flex flex-col" style={{ background: `linear-gradient(to bottom, ${preset.hemisphereColor}, ${preset.backgroundColor})` }}>
                      <div className="flex-1 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] font-mono text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded">APPLY</span>
                    </div>
                  </div>
                  <div className="p-2 flex justify-between items-center bg-black/40 border-t border-white/5">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[8px] font-mono text-white/60 truncate uppercase tracking-tighter">{preset.name}</span>
                      <span className="text-[6px] font-mono text-white/20 uppercase tracking-widest">{preset.category}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirmDelete({ id: preset.id, type: 'environment' });
                      }}
                      className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="hardware-card w-full max-w-xs p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono uppercase tracking-widest text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> CONFIRM_DELETE
              </h3>
            </div>
            <p className="text-[10px] font-mono text-white/60 uppercase tracking-widest leading-relaxed">
              Are you sure you want to delete this {showConfirmDelete.type} preset? This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowConfirmDelete(null)} className="hardware-button flex-1 py-2.5">CANCEL</button>
              <button 
                onClick={confirmDeletePreset} 
                className="hardware-button flex-1 py-2.5 bg-red-600/20 text-red-400 border-red-500/30"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
