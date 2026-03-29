import React from 'react';
import { Box, Layers, History, Download, Trash2, Plus, Globe, Settings, List, LayoutGrid, Shield } from 'lucide-react';
import { Layer } from '../types/layers';
import { ModelData } from '../App';
import { Prefab } from '../types/prefabs';
import { CollisionZone } from '../types/collision';
import SceneLayerPanel from './SceneLayerPanel';
import PrefabLibrary from './PrefabLibrary';
import PerformancePanel from './PerformancePanel';
import QualityPanel from './QualityPanel';
import PluginManagerPanel from './PluginManagerPanel';
import CollisionZonePanel from './CollisionZonePanel';
import { pluginManager } from '../services/PluginManager';
import { EditorCapabilityFlags } from '../types/projectAdapter';

interface SidebarProps {
  onLoadModel: (file: File, type?: 'model' | 'environment') => void;
  onClearScene: () => void;
  models: ModelData[];
  layers: Layer[];
  prefabs: Prefab[];
  selectedModelId: string | null;
  onSelectModel: (id: string | null) => void;
  onUpdateModel: (id: string, updates: Partial<ModelData>) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: (name: string) => void;
  onDeleteLayer: (id: string) => void;
  onSoloLayer: (id: string) => void;
  onUnhideAllLayers: () => void;
  isSoloActive: boolean;
  onPlacePrefab: (prefab: Prefab) => void;
  onCreatePrefabClick: () => void;
  onDeletePrefab: (id: string) => void;
  canCreatePrefab: boolean;
  selectionFilter: string[];
  onUpdateSelectionFilter: (filter: string[]) => void;
  tagFilter: string;
  onUpdateTagFilter: (tag: string) => void;
  onScaleChange: (id: string, scale: number) => void;
  gridReceiveShadow: boolean;
  onGridReceiveShadowChange: (receiveShadow: boolean) => void;
  shadowSoftness: number;
  onShadowSoftnessChange: (softness: number) => void;
  onExportClick: () => void;
  onHistoryClick: () => void;
  onAssetLibraryClick: () => void;
  pluginUIVersion?: number;
  // Collision zones
  collisionZones: CollisionZone[];
  onAddZone: (zone: CollisionZone) => void;
  onUpdateZone: (id: string, updates: Partial<CollisionZone>) => void;
  onDeleteZone: (id: string) => void;
  capabilities?: EditorCapabilityFlags;
}

export default function Sidebar({
  onLoadModel,
  onClearScene,
  models,
  layers,
  prefabs,
  selectedModelId,
  onSelectModel,
  onUpdateModel,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onSoloLayer,
  onUnhideAllLayers,
  isSoloActive,
  onPlacePrefab,
  onCreatePrefabClick,
  onDeletePrefab,
  canCreatePrefab,
  selectionFilter,
  onUpdateSelectionFilter,
  tagFilter,
  onUpdateTagFilter,
  onScaleChange,
  gridReceiveShadow,
  onGridReceiveShadowChange,
  shadowSoftness,
  onShadowSoftnessChange,
  onExportClick,
  onHistoryClick,
  onAssetLibraryClick,
  pluginUIVersion,
  collisionZones,
  onAddZone,
  onUpdateZone,
  onDeleteZone,
  capabilities,
}: SidebarProps) {
  const [activeTab, setActiveTab] = React.useState<'hierarchy' | 'layers' | 'prefabs' | 'zones' | 'settings' | 'plugins'>('layers');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const envInputRef = React.useRef<HTMLInputElement>(null);

  const activeZoneCount = collisionZones.filter(z => z.enabled).length;

  React.useEffect(() => {
    if (!(capabilities?.prefabs ?? true) && activeTab === 'prefabs') setActiveTab('layers');
    if (!(capabilities?.collisionZones ?? true) && activeTab === 'zones') setActiveTab('layers');
    if (!(capabilities?.pluginExtensions ?? true) && activeTab === 'plugins') setActiveTab('layers');
  }, [capabilities, activeTab]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onLoadModel(file);
  };

  return (
    <div className="h-full w-72 bg-[#151619] border-r border-white/5 pt-20 z-10 flex flex-col flex-shrink-0">
      <div className="px-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-white/50" />
          <h1 className="text-[11px] font-bold tracking-[0.2em] uppercase font-mono text-white/80">SCENE_EXPLORER</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/5 px-2 mb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'layers' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Layers</span>
        </button>
        {(capabilities?.prefabs ?? true) && <button
          onClick={() => setActiveTab('prefabs')}
          className={`flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'prefabs' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Prefabs</span>
        </button>}
        <button
          onClick={() => setActiveTab('hierarchy')}
          className={`flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'hierarchy' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Objects</span>
        </button>
        {/* Zones tab — badge shows active count */}
        {(capabilities?.collisionZones ?? true) && <button
          onClick={() => setActiveTab('zones')}
          className={`relative flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'zones' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Zones</span>
          {activeZoneCount > 0 && (
            <span className="absolute top-1 right-2 bg-blue-500 text-white text-[7px] font-mono rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
              {activeZoneCount > 9 ? '9+' : activeZoneCount}
            </span>
          )}
        </button>}
        {(capabilities?.pluginExtensions ?? true) && <button
          onClick={() => setActiveTab('plugins')}
          className={`flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'plugins' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Plugins</span>
        </button>}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[48px] py-2 flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'settings' ? 'text-blue-400 border-b border-blue-400' : 'text-white/20 hover:text-white/40'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="text-[7px] font-mono uppercase tracking-widest">Settings</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-4 space-y-6">
        {activeTab === 'layers' && (
          <div className="-mx-4 -mt-4 h-full">
            <SceneLayerPanel
              layers={layers}
              models={models}
              selectedModelId={selectedModelId}
              onUpdateLayer={onUpdateLayer}
              onAddLayer={onAddLayer}
              onDeleteLayer={onDeleteLayer}
              onSelectModel={onSelectModel}
              onUpdateModel={onUpdateModel}
              onSoloLayer={onSoloLayer}
              onUnhideAllLayers={onUnhideAllLayers}
              isSoloActive={isSoloActive}
              selectionFilter={selectionFilter}
              onUpdateSelectionFilter={onUpdateSelectionFilter}
              tagFilter={tagFilter}
              onUpdateTagFilter={onUpdateTagFilter}
            />
          </div>
        )}

        {(capabilities?.prefabs ?? true) && activeTab === 'prefabs' && (
          <div className="-mx-4 -mt-4 h-full">
            <PrefabLibrary
              prefabs={prefabs}
              onPlacePrefab={onPlacePrefab}
              onCreatePrefabFromSelection={onCreatePrefabClick}
              onDeletePrefab={onDeletePrefab}
              canCreatePrefab={canCreatePrefab}
            />
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <>
            <div className="space-y-2">
              <span className="hardware-label">IMPORT_ASSETS</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 rounded p-3 transition-all duration-200 flex flex-col items-center gap-2 group"
                >
                  <Plus className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                  <span className="text-[9px] uppercase font-mono tracking-widest text-white/30 group-hover:text-white/70">MODEL</span>
                </button>
                {(capabilities?.environmentControls ?? true) && <button
                  onClick={() => envInputRef.current?.click()}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 rounded p-3 transition-all duration-200 flex flex-col items-center gap-2 group"
                >
                  <Globe className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                  <span className="text-[9px] uppercase font-mono tracking-widest text-white/30 group-hover:text-white/70">ENV</span>
                </button>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="hardware-label">HIERARCHY</span>
                <span className="text-[8px] font-mono text-white/20 uppercase tracking-tighter">{models.length} ITEMS</span>
              </div>
              <div className="space-y-1">
                {models.length === 0 ? (
                  <div className="p-4 border border-dashed border-white/5 rounded text-center">
                    <span className="text-[9px] text-white/20 uppercase font-mono tracking-widest">EMPTY_SCENE</span>
                  </div>
                ) : (
                  models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => onSelectModel(model.id)}
                      className={`w-full text-left px-3 py-2 rounded border transition-all duration-200 flex items-center gap-3 group ${
                        selectedModelId === model.id
                          ? 'bg-white/10 border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                          : 'bg-black/20 border-transparent hover:border-white/10 text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Layers className={`w-3 h-3 transition-colors ${
                        selectedModelId === model.id ? 'text-white' : 'text-white/20 group-hover:text-white/40'
                      }`} />
                      <span className="text-[10px] font-mono truncate tracking-tight">
                        {model.name || `MODEL_${model.id.slice(-4).toUpperCase()}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Collision Zones tab */}
        {(capabilities?.collisionZones ?? true) && activeTab === 'zones' && (
          <div className="-mx-4 -mt-4 h-full">
            <CollisionZonePanel
              zones={collisionZones}
              onAddZone={onAddZone}
              onUpdateZone={onUpdateZone}
              onDeleteZone={onDeleteZone}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <span className="hardware-label">GLOBAL_SETTINGS</span>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">GRID_SHADOWS</span>
                  <input
                    type="checkbox"
                    checked={gridReceiveShadow}
                    onChange={e => onGridReceiveShadowChange(e.target.checked)}
                    className="w-3 h-3 rounded bg-black/40 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">SHADOW_SOFTNESS</span>
                    <span className="text-[9px] font-mono text-white/30">{shadowSoftness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={shadowSoftness}
                    onChange={e => onShadowSoftnessChange(parseFloat(e.target.value))}
                    className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-white/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/5">
              <button onClick={onHistoryClick} className="w-full hardware-button flex items-center gap-2 justify-center py-2">
                <History className="w-3 h-3" />
                <span>HISTORY</span>
              </button>
              <button onClick={onExportClick} className="w-full hardware-button flex items-center gap-2 justify-center py-2 border-white/10 bg-white/10 text-white">
                <Download className="w-3 h-3" />
                <span>EXPORT_SCENE</span>
              </button>
              <button onClick={onClearScene} className="w-full hardware-button flex items-center gap-2 justify-center py-2 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
                <span>CLEAR_SCENE</span>
              </button>
            </div>
          </div>
        )}

        {(capabilities?.pluginExtensions ?? true) && activeTab === 'plugins' && (
          <div className="-mx-4 -mt-4 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <PluginManagerPanel />
            </div>
            {pluginManager.getUIExtensions('panel').length > 0 && (
              <div className="border-t border-white/10 bg-[#1a1b1e] overflow-y-auto max-h-[50%]">
                {pluginManager.getUIExtensions('panel').map(ext => (
                  <div key={ext.id}>{ext.render()}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".glb,.gltf,.obj" className="hidden" />
      <input
        type="file" ref={envInputRef}
        onChange={e => { const f = e.target.files?.[0]; if (f) onLoadModel(f, 'environment'); }}
        accept=".glb,.gltf,.obj" className="hidden"
      />
    </div>
  );
}
