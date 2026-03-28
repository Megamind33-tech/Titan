import React from 'react';
import { exportScene } from '../utils/exportUtils';

interface SidebarProps {
  onLoadModel: (file: File, type?: 'model' | 'environment') => void;
  onClearScene: () => void;
  models: any[];
  selectedModelId: string | null;
  onSelectModel: (id: string) => void;
  onScaleChange: (id: string, scale: number) => void;
  gridReceiveShadow: boolean;
  onGridReceiveShadowChange: (receiveShadow: boolean) => void;
  shadowSoftness: number;
  onShadowSoftnessChange: (softness: number) => void;
  onExportClick: () => void;
  onHistoryClick: () => void;
  onAssetLibraryClick: () => void;
}

export default function Sidebar({ onLoadModel, onClearScene, models, selectedModelId, onSelectModel, onScaleChange, gridReceiveShadow, onGridReceiveShadowChange, shadowSoftness, onShadowSoftnessChange, onExportClick, onHistoryClick, onAssetLibraryClick }: SidebarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const envInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoadModel(file);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  return (
    <div className="h-full w-48 bg-gray-900 text-white p-4 pt-16 z-10 flex flex-col gap-4 overflow-y-auto flex-shrink-0">
      <h1 className="text-lg font-bold">3D Viewer</h1>
      <button
        onClick={onAssetLibraryClick}
        className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
      >
        <span>📦</span> Asset Library
      </button>
      <div className="border-t border-gray-700 my-2"></div>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
      >
        Load 3D Model
      </button>
      <button
        onClick={() => envInputRef.current?.click()}
        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
      >
        Load Environment
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".glb,.gltf,.obj"
        className="hidden"
      />
      <input
        type="file"
        ref={envInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onLoadModel(file, 'environment');
        }}
        accept=".glb,.gltf,.obj"
        className="hidden"
      />
      
      {models.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Models</h2>
          {models.map(model => (
            <button 
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              className={`text-left p-2 rounded ${selectedModelId === model.id ? 'bg-blue-800' : 'bg-gray-800'}`}
            >
              Model {model.id.slice(-4)}
            </button>
          ))}
        </div>
      )}

      {selectedModel && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Scale:</label>
            <input 
              type="number" 
              min="0.01" 
              step="0.1" 
              value={selectedModel.scale[0]}
              onChange={(e) => onScaleChange(selectedModel.id, parseFloat(e.target.value) || 1)}
              className="w-20 bg-gray-800 text-white p-1 rounded text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4 border-t border-gray-700 pt-4">
        <h2 className="text-sm font-semibold">Scene Settings</h2>
        <div className="flex items-center gap-2 text-sm">
          <input 
            type="checkbox" 
            checked={gridReceiveShadow} 
            onChange={(e) => onGridReceiveShadowChange(e.target.checked)} 
          />
          <span>Grid Shadow</span>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span>Shadow Softness: {shadowSoftness.toFixed(1)}</span>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            value={shadowSoftness} 
            onChange={(e) => onShadowSoftnessChange(parseFloat(e.target.value))} 
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={onHistoryClick}
          className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <span>🕒</span> Version History
        </button>
        <button
          onClick={onExportClick}
          className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <span>📦</span> Export Scene
        </button>

        <button
          onClick={onClearScene}
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <span>🗑️</span> Clear Scene
        </button>
      </div>
    </div>
  );
}
