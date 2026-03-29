import React, { useEffect, useState } from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: any[];
  onExport: (selectedIds: string[], options: ExportOptions) => void;
  allowedFormats?: ExportOptions['format'][];
  recommendedFormat?: ExportOptions['format'];
  contextNote?: string;
}

export interface ExportOptions {
  format: 'original' | 'glb' | 'obj' | 'swim26-manifest';
  includeTextures: boolean;
  includeMaterials: boolean;
}

export default function ExportModal({ isOpen, onClose, models, onExport, allowedFormats, recommendedFormat, contextNote }: ExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(models.map(m => m.id));
  const exportFormats = allowedFormats ?? ['original', 'glb', 'obj'];
  const [format, setFormat] = useState<ExportOptions['format']>('original');
  const [includeTextures, setIncludeTextures] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const isSwimManifest = format === 'swim26-manifest';

  useEffect(() => {
    if (!isOpen) return;
    if (recommendedFormat && exportFormats.includes(recommendedFormat)) {
      setFormat(recommendedFormat);
    }
  }, [isOpen, recommendedFormat, exportFormats]);

  useEffect(() => {
    if (!exportFormats.includes(format)) {
      setFormat(exportFormats[0] ?? 'original');
    }
  }, [exportFormats, format]);

  useEffect(() => {
    if (isSwimManifest) {
      setIncludeMaterials(true);
      setIncludeTextures(false);
    }
  }, [isSwimManifest]);

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
      <div className="bg-[#151619] border border-white/10 rounded p-6 w-96 max-w-full shadow-2xl flex flex-col gap-6" data-testid="export-modal">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-bold uppercase font-mono tracking-[0.2em] text-white/80">EXPORT OPTIONS</h2>
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
          <div className="flex items-center justify-between">
            <h3 className="hardware-label">EXPORT_FORMAT</h3>
            {recommendedFormat && <span className="text-[9px] text-blue-300 font-mono uppercase" data-testid="recommended-export-format">Recommended: {recommendedFormat}</span>}
          </div>
          {contextNote && <p className="text-[10px] text-white/50">{contextNote}</p>}
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as any)}
            data-testid="export-format-select"
            className="w-full hardware-input py-2"
          >
            {exportFormats.includes('original') && <option value="original">ORIGINAL_FILES (ZIP)</option>}
            {exportFormats.includes('glb') && <option value="glb">GLB (BINARY_GLTF)</option>}
            {exportFormats.includes('obj') && <option value="obj">OBJ (WAVEFRONT)</option>}
            {exportFormats.includes('swim26-manifest') && <option value="swim26-manifest">SWIM26 MANIFEST (RUNTIME HANDOFF)</option>}
          </select>
          {isSwimManifest && (
            <p className="text-[10px] text-blue-200/80">
              SWIM26 manifest export includes runtime handoff metadata and authored scene payload.
            </p>
          )}
        </div>

        <div className="space-y-3" aria-disabled={isSwimManifest}>
          <h3 className="hardware-label">ASSET_OPTIONS</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={includeMaterials}
                onChange={(e) => setIncludeMaterials(e.target.checked)}
                disabled={isSwimManifest}
                className="w-3 h-3 rounded bg-black/60 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
              />
              <span className="text-[10px] font-mono text-white/40 group-hover:text-white/70 uppercase tracking-tight">INCLUDE_MATERIALS</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={includeTextures}
                onChange={(e) => setIncludeTextures(e.target.checked)}
                disabled={!includeMaterials || format === 'obj' || format === 'swim26-manifest'}
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
