import React, { useState } from 'react';
import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Plus, 
  Edit2, 
  Check, 
  X,
  MoreVertical,
  MousePointer2,
  Box,
  Globe,
  Settings,
  Tag
} from 'lucide-react';
import { Layer } from '../types/layers';
import { ModelData } from '../App';

interface SceneLayerPanelProps {
  layers: Layer[];
  models: ModelData[];
  selectedModelId: string | null;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: (name: string) => void;
  onDeleteLayer: (id: string) => void;
  onSelectModel: (id: string | null) => void;
  onUpdateModel: (id: string, updates: Partial<ModelData>) => void;
  onSoloLayer: (id: string) => void;
  onUnhideAllLayers: () => void;
  isSoloActive: boolean;
  selectionFilter: string[];
  onUpdateSelectionFilter: (filter: string[]) => void;
  tagFilter: string;
  onUpdateTagFilter: (tag: string) => void;
}

export default function SceneLayerPanel({
  layers,
  models,
  selectedModelId,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onSelectModel,
  onUpdateModel,
  onSoloLayer,
  onUnhideAllLayers,
  isSoloActive,
  selectionFilter,
  onUpdateSelectionFilter,
  tagFilter,
  onUpdateTagFilter
}: SceneLayerPanelProps) {
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set(['env']));
  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editLayerName, setEditLayerName] = useState('');

  const toggleLayerExpanded = (id: string) => {
    const next = new Set(expandedLayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedLayers(next);
  };

  const handleAddLayer = () => {
    if (newLayerName.trim()) {
      onAddLayer(newLayerName.trim());
      setNewLayerName('');
      setIsAddingLayer(false);
    }
  };

  const startEditingLayer = (layer: Layer) => {
    setEditingLayerId(layer.id);
    setEditLayerName(layer.name);
  };

  const saveLayerName = () => {
    if (editingLayerId && editLayerName.trim()) {
      onUpdateLayer(editingLayerId, { name: editLayerName.trim() });
      setEditingLayerId(null);
    }
  };

  const getModelsInLayer = (layerId: string) => {
    return models.filter(m => {
      const inLayer = m.layerId === layerId || (!m.layerId && layerId === 'env');
      if (!inLayer) return false;
      if (tagFilter && (!m.behaviorTags || !m.behaviorTags.includes(tagFilter))) return false;
      return true;
    });
  };

  const toggleFilter = (type: string) => {
    if (selectionFilter.includes(type)) {
      onUpdateSelectionFilter(selectionFilter.filter(t => t !== type));
    } else {
      onUpdateSelectionFilter([...selectionFilter, type]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1b1e] border-l border-white/10 w-64">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-white/80">Scene Layers</h2>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onUnhideAllLayers}
            className="p-1 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white"
            title="Unhide All"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setIsAddingLayer(true)}
            className="p-1 hover:bg-white/5 rounded transition-colors text-blue-400 hover:text-blue-300"
            title="Add Layer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selection Filter */}
      <div className="p-3 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <MousePointer2 className="w-3 h-3 text-blue-400" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">Selection Filter</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: 'model', label: 'MOD', icon: Box, title: 'Models' },
            { id: 'light', label: 'LIT', icon: Plus, title: 'Lights' },
            { id: 'camera', label: 'CAM', icon: Eye, title: 'Cameras' },
            { id: 'environment', label: 'ENV', icon: Globe, title: 'Environment' },
            { id: 'helper', label: 'HLP', icon: Settings, title: 'Helpers' }
          ].map((filter) => {
            const isActive = selectionFilter.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`flex flex-col items-center gap-1 py-1.5 rounded border transition-all ${
                  isActive 
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' 
                    : 'bg-white/5 border-white/5 text-white/20 hover:bg-white/10'
                }`}
                title={`Toggle ${filter.title} selection`}
              >
                <span className="text-[8px] font-mono font-bold">{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag Filter */}
      <div className="p-3 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Tag className="w-3 h-3 text-purple-400" />
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">Tag Filter</span>
        </div>
        <select 
          className="w-full bg-black/60 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-white outline-none focus:border-purple-500/50 transition-colors"
          value={tagFilter}
          onChange={(e) => onUpdateTagFilter(e.target.value)}
        >
          <option value="">All Tags</option>
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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {isAddingLayer && (
          <div className="p-2 bg-white/5 rounded border border-blue-500/30 mb-2">
            <input 
              autoFocus
              type="text"
              className="hardware-input w-full py-1 px-2 text-[10px] mb-2"
              placeholder="Layer Name..."
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLayer()}
            />
            <div className="flex justify-end gap-1">
              <button onClick={() => setIsAddingLayer(false)} className="p-1 text-white/40 hover:text-white"><X className="w-3 h-3" /></button>
              <button onClick={handleAddLayer} className="p-1 text-blue-400 hover:text-blue-300"><Check className="w-3 h-3" /></button>
            </div>
          </div>
        )}

        {layers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(layer => {
          const layerModels = getModelsInLayer(layer.id);
          const isExpanded = expandedLayers.has(layer.id);

          return (
            <div key={layer.id} className="space-y-0.5">
              <div 
                className={`group flex items-center gap-1 p-1.5 rounded transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/5'}`}
              >
                <button 
                  onClick={() => toggleLayerExpanded(layer.id)}
                  className="p-0.5 text-white/20 hover:text-white/60 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {editingLayerId === layer.id ? (
                  <input 
                    autoFocus
                    className="bg-transparent border-b border-blue-500 text-[10px] font-mono text-white outline-none flex-1 py-0"
                    value={editLayerName}
                    onChange={(e) => setEditLayerName(e.target.value)}
                    onBlur={saveLayerName}
                    onKeyDown={(e) => e.key === 'Enter' && saveLayerName()}
                  />
                ) : (
                  <span 
                    className={`text-[10px] font-mono uppercase tracking-tight flex-1 truncate ${layer.visible ? 'text-white/80' : 'text-white/20'}`}
                    onDoubleClick={() => layer.isCustom && startEditingLayer(layer)}
                  >
                    {layer.name}
                    <span className="ml-2 text-[8px] opacity-30">({layerModels.length})</span>
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onSoloLayer(layer.id)}
                    className={`p-1 text-[8px] font-mono transition-colors uppercase ${
                      isSoloActive && layer.visible 
                        ? 'text-blue-400 font-bold' 
                        : 'text-white/20 hover:text-blue-400'
                    }`}
                    title={isSoloActive && layer.visible ? 'Un-solo Layer' : 'Solo Layer'}
                  >
                    S
                  </button>
                  <button 
                    onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                    className={`p-1 transition-colors ${layer.visible ? 'text-white/40 hover:text-white' : 'text-red-500/60 hover:text-red-500'}`}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button 
                    onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                    className={`p-1 transition-colors ${layer.locked ? 'text-orange-500/60 hover:text-orange-500' : 'text-white/40 hover:text-white'}`}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                  >
                    {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  {layer.isCustom && (
                    <button 
                      onClick={() => onDeleteLayer(layer.id)}
                      className="p-1 text-white/20 hover:text-red-400 transition-colors"
                      title="Delete Layer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="ml-4 pl-2 border-l border-white/5 space-y-0.5 pb-1">
                  {layerModels.length === 0 ? (
                    <div className="py-1 px-2 text-[8px] font-mono text-white/10 uppercase italic">Empty</div>
                  ) : (
                    layerModels.map(model => (
                      <div 
                        key={model.id}
                        className={`group flex items-center gap-2 p-1 rounded transition-colors cursor-pointer ${selectedModelId === model.id ? 'bg-blue-500/20' : 'hover:bg-white/5'}`}
                        onClick={() => onSelectModel(model.id)}
                      >
                        <MousePointer2 className={`w-2.5 h-2.5 ${selectedModelId === model.id ? 'text-blue-400' : 'text-white/20'}`} />
                        <span className={`text-[9px] font-mono truncate flex-1 ${model.visible !== false ? 'text-white/60' : 'text-white/20'} ${selectedModelId === model.id ? 'text-white' : ''}`}>
                          {model.name}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateModel(model.id, { visible: model.visible === false });
                            }}
                            className={`p-0.5 transition-colors ${model.visible !== false ? 'text-white/20 hover:text-white' : 'text-red-500/40 hover:text-red-500'}`}
                          >
                            {model.visible !== false ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateModel(model.id, { locked: !model.locked });
                            }}
                            className={`p-0.5 transition-colors ${model.locked ? 'text-orange-500/40 hover:text-orange-500' : 'text-white/20 hover:text-white'}`}
                          >
                            {model.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-black/20 border-t border-white/10">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Quick Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button 
              onClick={onUnhideAllLayers}
              className="hardware-btn py-1 text-[8px] bg-blue-500/20 text-blue-400 border-blue-500/30"
            >
              Unhide All
            </button>
            <button 
              onClick={() => onUpdateSelectionFilter(['model', 'light', 'camera', 'environment', 'helper'])}
              className="hardware-btn py-1 text-[8px] opacity-50"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
