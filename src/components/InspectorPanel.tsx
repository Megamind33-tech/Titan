import React, { useState, useRef } from 'react';
import { ModelData } from '../App';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { useMaterialLibrary } from '../hooks/useMaterialLibrary';
import { useEnvironmentLibrary } from '../hooks/useEnvironmentLibrary';
import { MaterialPreset, DEFAULT_MATERIAL, MaterialCategory } from '../types/materials';
import { EnvironmentPreset, EnvironmentCategory } from '../types/environment';
import { Asset } from '../types/assets';

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
}

const Section = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-700">
      <button 
        className="w-full text-left py-3 px-4 font-semibold text-sm flex justify-between items-center hover:bg-gray-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
        <span>{isOpen ? '▼' : '▶'}</span>
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
  onUpdateEnvironment
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'object' | 'environment'>('object');
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
  const [showTexturePicker, setShowTexturePicker] = useState<{ open: boolean, type: keyof MaterialPreset } | null>(null);

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
    const name = prompt('Enter preset name:', currentMaterial.name);
    if (name) {
      addMaterialPreset({ ...currentMaterial, name });
    }
  };

  const handleApplyEnvPreset = (preset: EnvironmentPreset) => {
    onUpdateEnvironment({ ...preset });
    setShowEnvPresetBrowser(false);
  };

  const handleSaveEnvAsPreset = () => {
    const name = prompt('Enter environment preset name:', environment.name);
    if (name) {
      addEnvPreset({ ...environment, name });
    }
  };

  const updateEnvironment = (updates: Partial<EnvironmentPreset>) => {
    onUpdateEnvironment(prev => ({ ...prev, ...updates }));
  };

  const handleApplyToAll = () => {
    if (!model.assetId) return;
    if (confirm(`Apply this material to all ${models.filter(m => m.assetId === model.assetId).length} instances of "${model.name}"?`)) {
      models.forEach(m => {
        if (m.assetId === model.assetId) {
          onUpdateModel(m.id, { material: { ...currentMaterial } });
        }
      });
    }
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
    <div className="w-80 bg-gray-900 text-white z-10 border-l border-gray-700 overflow-y-auto h-full flex-shrink-0 text-sm shadow-xl flex flex-col">
      <div className="flex border-b border-gray-700 bg-gray-800/50">
        <button 
          onClick={() => setActiveTab('object')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'object' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Object
        </button>
        <button 
          onClick={() => setActiveTab('environment')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'environment' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
        >
          Environment
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'object' ? (
          model ? (
            <>
              <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-900 z-10 flex justify-between items-center">
                <h2 className="text-lg font-bold truncate pr-2">{model.name}</h2>
                <div className="flex gap-2">
                  <button onClick={() => onUpdateModel(model.id, { visible: model.visible === false ? true : false })} className="p-1 hover:bg-gray-700 rounded" title="Toggle Visibility">
                    {model.visible === false ? '👁️‍🗨️' : '👁️'}
                  </button>
                  <button onClick={() => onUpdateModel(model.id, { locked: !model.locked })} className="p-1 hover:bg-gray-700 rounded" title="Toggle Lock">
                    {model.locked ? '🔒' : '🔓'}
                  </button>
                </div>
              </div>

      <Section title="Metadata" defaultOpen>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">ID:</span>
            <span className="truncate w-32 text-right" title={model.id}>{model.id.substring(0, 8)}...</span>
          </div>
          {asset && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded p-2 mt-2 space-y-1">
              <div className="text-[10px] text-blue-400 uppercase font-bold">Linked Asset</div>
              <div className="text-xs font-medium truncate">{asset.metadata.name}</div>
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{asset.metadata.category}</span>
                <span className={asset.metadata.optimizedStatus === 'heavy' ? 'text-red-400' : 'text-green-400'}>
                  {asset.metadata.optimizedStatus.toUpperCase()}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={onReplaceAsset}
            className="w-full bg-gray-800 hover:bg-gray-700 py-1.5 rounded border border-gray-700 transition-colors text-xs mt-2 flex items-center justify-center gap-2"
          >
            <span>🔄</span> {model.assetId ? 'Replace Asset' : 'Link to Library'}
          </button>
          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-400">Type:</span>
            <select 
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
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
            <span className="text-gray-400">Class:</span>
            <select 
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
              value={model.classification || 'both'}
              onChange={(e) => onUpdateModel(model.id, { classification: e.target.value as any })}
            >
              <option value="both">Both</option>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Behavior:</span>
            <select 
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
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
        <div className="space-y-3">
          {['Position', 'Rotation', 'Scale'].map((type) => {
            const propName = type.toLowerCase() as 'position' | 'rotation' | 'scale';
            const values = model[propName];
            return (
              <div key={type} className="space-y-1">
                <div className="text-gray-400 text-xs uppercase tracking-wider">{type}</div>
                <div className="flex gap-2">
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} className="flex-1 flex items-center bg-gray-950 rounded px-2 py-1 border border-gray-800 focus-within:border-blue-500 transition-all">
                      <span className={`text-[10px] font-bold mr-1 ${axis === 'X' ? 'text-red-500' : axis === 'Y' ? 'text-green-500' : 'text-blue-500'}`}>{axis}</span>
                      <input 
                        type="number" 
                        className="w-full bg-transparent outline-none text-right font-mono text-xs text-gray-100"
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
              className="flex-1 bg-gray-800 hover:bg-gray-700 py-1.5 rounded border border-gray-700 transition-colors text-xs"
              title="Align to Ground"
            >
              ⬇️ Ground
            </button>
            <button onClick={() => onReset(model.id)} className="flex-1 bg-gray-800 hover:bg-gray-700 py-1.5 rounded border border-gray-700 transition-colors text-xs">Reset</button>
            <button onClick={() => onFocus(model.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 py-1.5 rounded transition-colors text-xs">Focus</button>
          </div>
        </div>
      </Section>

      <Section title="Material & Textures" defaultOpen>
        <div className="space-y-4">
          {/* Preset Selection */}
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-gray-400 text-[10px] uppercase font-bold">Category Filter</label>
              <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                {['All', 'Concrete', 'Tile', 'Water', 'Metal', 'Wood', 'Sports Surface', 'Custom'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedMaterialCategory(cat as any)}
                    className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap transition-colors ${
                      selectedMaterialCategory === cat 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <label className="text-gray-400 text-[10px] uppercase font-bold">Material Preset</label>
              <button 
                onClick={() => setShowMaterialPresetBrowser(true)}
                className="text-blue-400 hover:text-blue-300 text-[10px] font-bold uppercase"
              >
                Browse Presets
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs truncate">
                {currentMaterial.name}
              </div>
              <button 
                onClick={handleSaveMaterialAsPreset}
                className="bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-700"
                title="Save as Preset"
              >
                💾
              </button>
            </div>
          </div>

          {/* Texture Maps */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <label className="text-gray-400 text-[10px] uppercase font-bold">Texture Maps</label>
            
            {[
              { label: 'Base Map', key: 'mapUrl' },
              { label: 'Normal Map', key: 'normalMapUrl' },
              { label: 'Roughness Map', key: 'roughnessMapUrl' },
              { label: 'Metalness Map', key: 'metalnessMapUrl' },
              { label: 'Emissive Map', key: 'emissiveMapUrl' },
              { label: 'Alpha Map', key: 'alphaMapUrl' },
            ].map((map) => (
              <div key={map.key} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-950 rounded border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {currentMaterial[map.key as keyof MaterialPreset] ? (
                    <img 
                      src={currentMaterial[map.key as keyof MaterialPreset] as string} 
                      alt={map.label} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[10px] opacity-30">None</span>
                  )}
                </div>
                <div className="flex-1 text-[10px] text-gray-300 truncate">{map.label}</div>
                <button 
                  onClick={() => setShowTexturePicker({ open: true, type: map.key as keyof MaterialPreset })}
                  className="p-1.5 hover:bg-gray-800 rounded text-[10px] border border-gray-800"
                >
                  📁
                </button>
                {currentMaterial[map.key as keyof MaterialPreset] && (
                  <button 
                    onClick={() => updateMaterial({ [map.key]: undefined })}
                    className="p-1.5 hover:bg-red-900/30 text-red-400 rounded text-[10px]"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Color & PBR Properties */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center">
              <label className="text-gray-400 text-[10px] uppercase font-bold">Properties</label>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-300">Base Color</span>
              <input 
                type="color" 
                value={currentMaterial.color} 
                onChange={(e) => updateMaterial({ color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-gray-500 uppercase">Roughness</span>
                <span className="text-blue-400">{currentMaterial.roughness.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.roughness} 
                onChange={(e) => updateMaterial({ roughness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-gray-500 uppercase">Metalness</span>
                <span className="text-blue-400">{currentMaterial.metalness.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.metalness} 
                onChange={(e) => updateMaterial({ metalness: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-300">Emissive Color</span>
              <input 
                type="color" 
                value={currentMaterial.emissiveColor} 
                onChange={(e) => updateMaterial({ emissiveColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400 uppercase">Emissive Intensity</span>
                <span>{currentMaterial.emissiveIntensity.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="10" step="0.1" 
                value={currentMaterial.emissiveIntensity} 
                onChange={(e) => updateMaterial({ emissiveIntensity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400 uppercase">Opacity</span>
                <span>{currentMaterial.opacity.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={currentMaterial.opacity} 
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateMaterial({ opacity: val, transparent: val < 1 });
                }}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
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

      <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex gap-2 sticky bottom-0 z-10">
        <button 
          onClick={() => onFocus(model.id)}
          className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded border border-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <span>🎯</span> Focus
        </button>
        <button 
          onClick={() => onDuplicate(model.id)}
          className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded border border-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <span>👥</span> Clone
        </button>
        <button 
          onClick={() => onDelete(model.id)}
          className="flex-1 bg-red-900/40 hover:bg-red-900/60 py-2 rounded border border-red-800/50 transition-colors flex items-center justify-center gap-2 text-red-200"
        >
          <span>🗑️</span> Delete
        </button>
      </div>
    </>
          ) : (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-4">
              <span className="text-4xl">🖱️</span>
              <p>Select an object to inspect its properties.</p>
            </div>
          )
        ) : (
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
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase">Type</label>
                  <select 
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
                    value={environment.backgroundType}
                    onChange={(e) => updateEnvironment({ backgroundType: e.target.value as any })}
                  >
                    <option value="color">Solid Color</option>
                    <option value="preset">Environment Preset</option>
                  </select>
                </div>
                {environment.backgroundType === 'color' ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      value={environment.backgroundColor}
                      onChange={(e) => updateEnvironment({ backgroundColor: e.target.value })}
                    />
                    <span className="text-xs text-gray-400">Background Color</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select 
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5"
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
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                    <span>Env Intensity</span>
                    <span>{environment.environmentIntensity.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1"
                    className="w-full accent-blue-500"
                    value={environment.environmentIntensity}
                    onChange={(e) => updateEnvironment({ environmentIntensity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </Section>

            <Section title="Fog">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400 uppercase">Enabled</label>
                  <button 
                    onClick={() => updateEnvironment({ fogEnabled: !environment.fogEnabled })}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${environment.fogEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                  >
                    {environment.fogEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {environment.fogEnabled && (
                  <>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                        value={environment.fogColor}
                        onChange={(e) => updateEnvironment({ fogColor: e.target.value })}
                      />
                      <span className="text-xs text-gray-400">Fog Color</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase">Near</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
                          value={environment.fogNear}
                          onChange={(e) => updateEnvironment({ fogNear: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase">Far</label>
                        <input 
                          type="number" 
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
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
                  <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                    <span>Exposure</span>
                    <span>{environment.exposure.toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="3" step="0.1"
                    className="w-full accent-blue-500"
                    value={environment.exposure}
                    onChange={(e) => updateEnvironment({ exposure: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">Tone Mapping</label>
                  <select 
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs"
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
        )}
      </div>

      {/* Texture Picker Modal */}
      {showTexturePicker?.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-100">Select Texture</h3>
              <button 
                onClick={() => setShowTexturePicker(null)}
                className="text-gray-500 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-3 gap-3">
              {/* Upload Option */}
              <label className="aspect-square bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-gray-750 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">📤</span>
                <span className="text-[10px] text-gray-500 mt-1 font-bold uppercase">Upload</span>
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
                  className="aspect-square bg-gray-950 rounded-lg border border-gray-800 overflow-hidden hover:border-blue-500 transition-all"
                >
                  <img 
                    src={asset.url} 
                    alt={asset.metadata.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Material Preset Browser Modal */}
      {showMaterialPresetBrowser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-100">Material Presets</h3>
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-32 focus:border-blue-500 outline-none"
                />
                <button 
                  onClick={() => setShowMaterialPresetBrowser(false)}
                  className="text-gray-500 hover:text-white"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredMaterialPresets.map(preset => (
                <div 
                  key={preset.id}
                  className="group relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all"
                >
                  <div 
                    className="aspect-square w-full cursor-pointer"
                    onClick={() => handleApplyMaterialPreset(preset)}
                    style={{ backgroundColor: preset.color }}
                  >
                    {preset.mapUrl && (
                      <img 
                        src={preset.mapUrl} 
                        alt={preset.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="p-2 flex justify-between items-center bg-gray-900/50">
                    <span className="text-[10px] font-bold text-gray-300 truncate">{preset.name}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this preset?')) deleteMaterialPreset(preset.id);
                      }}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
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
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-100">Environment Presets</h3>
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={envSearchQuery}
                  onChange={(e) => setEnvSearchQuery(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs w-32 focus:border-blue-500 outline-none"
                />
                <button 
                  onClick={() => setShowEnvPresetBrowser(false)}
                  className="text-gray-500 hover:text-white"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredEnvPresets.map(preset => (
                <div 
                  key={preset.id}
                  className="group relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all"
                >
                  <div 
                    className="aspect-video w-full cursor-pointer bg-gray-950 flex items-center justify-center"
                    onClick={() => handleApplyEnvPreset(preset)}
                  >
                    <div className="w-full h-full flex flex-col" style={{ background: `linear-gradient(to bottom, ${preset.hemisphereColor}, ${preset.backgroundColor})` }}>
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-2xl">☀️</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 flex justify-between items-center bg-gray-900/50">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-gray-300 truncate">{preset.name}</span>
                      <span className="text-[8px] text-gray-500 uppercase">{preset.category}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this preset?')) deleteEnvPreset(preset.id);
                      }}
                      className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
