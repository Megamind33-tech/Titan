import React, { useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: any[];
  onExport: (selectedIds: string[], options: ExportOptions) => void;
}

export interface ExportOptions {
  format: 'original' | 'glb' | 'obj';
  includeTextures: boolean;
  includeMaterials: boolean;
}

export default function ExportModal({ isOpen, onClose, models, onExport }: ExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(models.map(m => m.id));
  const [format, setFormat] = useState<'original' | 'glb' | 'obj'>('original');
  const [includeTextures, setIncludeTextures] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);

  if (!isOpen) return null;

  const handleToggleModel = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(modelId => modelId !== id) : [...prev, id]
    );
  };

  const handleExportClick = () => {
    onExport(selectedIds, { format, includeTextures, includeMaterials });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151619] border border-white/10 rounded p-6 w-96 max-w-full shadow-2xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-bold uppercase font-mono tracking-[0.2em] text-white/80">EXPORT_OPTIONS</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-[10px] font-mono">CLOSE_X</button>
        </div>
        
        <div className="space-y-3">
          <h3 className="hardware-label">SELECT_MODELS_TO_EXPORT</h3>
          <div className="max-h-40 overflow-y-auto bg-black/40 p-2 rounded border border-white/5 no-scrollbar">
            {models.length === 0 ? (
              <p className="text-[9px] text-white/20 uppercase font-mono tracking-widest italic text-center py-4">NO_MODELS_IN_SCENE</p>
            ) : (
              models.map(model => (
                <label key={model.id} className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer group transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(model.id)}
                    onChange={() => handleToggleModel(model.id)}
                    className="w-3 h-3 rounded bg-black/60 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
                  />
                  <span className="text-[10px] font-mono text-white/40 group-hover:text-white/70 truncate uppercase tracking-tight">{model.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="hardware-label">EXPORT_FORMAT</h3>
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as any)}
            className="w-full hardware-input py-2"
          >
            <option value="original">ORIGINAL_FILES (ZIP)</option>
            <option value="glb">GLB (BINARY_GLTF)</option>
            <option value="obj">OBJ (WAVEFRONT)</option>
          </select>
        </div>

        <div className="space-y-3">
          <h3 className="hardware-label">ASSET_OPTIONS</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={includeMaterials}
                onChange={(e) => setIncludeMaterials(e.target.checked)}
                className="w-3 h-3 rounded bg-black/60 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
              />
              <span className="text-[10px] font-mono text-white/40 group-hover:text-white/70 uppercase tracking-tight">INCLUDE_MATERIALS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={includeTextures}
                onChange={(e) => setIncludeTextures(e.target.checked)}
                disabled={!includeMaterials || format === 'obj'}
                className="w-3 h-3 rounded bg-black/60 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50 disabled:opacity-20"
              />
              <span className="text-[10px] font-mono text-white/40 group-hover:text-white/70 uppercase tracking-tight disabled:opacity-20">INCLUDE_TEXTURES</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button 
            onClick={onClose}
            className="hardware-button px-4 py-2"
          >
            CANCEL
          </button>
          <button 
            onClick={handleExportClick}
            disabled={selectedIds.length === 0}
            className="hardware-button px-4 py-2 bg-white/10 text-white border-white/20 disabled:opacity-20 disabled:cursor-not-allowed"
          >
            GENERATE_EXPORT
          </button>
        </div>
      </div>
    </div>
  );
}
