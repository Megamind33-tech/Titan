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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 text-white p-6 rounded-lg w-96 max-w-full shadow-xl">
        <h2 className="text-xl font-bold mb-4">Export Options</h2>
        
        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-gray-300">Select Models to Export</h3>
          <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
            {models.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No models in scene</p>
            ) : (
              models.map(model => (
                <label key={model.id} className="flex items-center gap-2 p-1 hover:bg-gray-800 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(model.id)}
                    onChange={() => handleToggleModel(model.id)}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span className="text-sm truncate">{model.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-gray-300">Export Format</h3>
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as any)}
            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm"
          >
            <option value="original">Original Files (ZIP)</option>
            <option value="glb">GLB (Binary GLTF)</option>
            <option value="obj">OBJ (Wavefront)</option>
          </select>
        </div>

        <div className="mb-6 space-y-2">
          <h3 className="font-semibold mb-2 text-gray-300">Asset Options</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={includeMaterials}
              onChange={(e) => setIncludeMaterials(e.target.checked)}
              className="rounded bg-gray-700 border-gray-600"
            />
            <span className="text-sm">Include Materials</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={includeTextures}
              onChange={(e) => setIncludeTextures(e.target.checked)}
              disabled={!includeMaterials || format === 'obj'}
              className="rounded bg-gray-700 border-gray-600 disabled:opacity-50"
            />
            <span className="text-sm">Include Textures</span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExportClick}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
