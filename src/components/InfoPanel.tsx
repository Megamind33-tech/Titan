import React from 'react';
interface InfoPanelProps {
  model: { 
    id: string; 
    name: string; 
    scale: [number, number, number]; 
    dimensions?: { width: number; height: number; depth: number }; 
    wireframe?: boolean; 
    lightIntensity?: number;
    castShadow?: boolean;
    receiveShadow?: boolean;
    textureUrl?: string;
  };
  onWireframeChange: (id: string, wireframe: boolean) => void;
  onLightIntensityChange: (id: string, intensity: number) => void;
  onCastShadowChange: (id: string, castShadow: boolean) => void;
  onReceiveShadowChange: (id: string, receiveShadow: boolean) => void;
  onTextureChange: (id: string, textureUrl: string, textureFile?: File) => void;
  onReset: (id: string) => void;
  onFocus: (id: string) => void;
}

export default function InfoPanel({ model, onWireframeChange, onLightIntensityChange, onCastShadowChange, onReceiveShadowChange, onTextureChange, onReset, onFocus }: InfoPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTextureFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onTextureChange(model.id, url, file);
    }
  };

  return (
    <div className="w-64 bg-gray-900 text-white p-4 pt-16 z-10 border-l border-gray-700 overflow-y-auto h-full flex-shrink-0">
      <h2 className="text-lg font-bold mb-4">Model Info</h2>
      <div className="flex flex-col gap-4 text-sm">
        <p><span className="font-semibold">Name:</span> {model.name}</p>
        <p><span className="font-semibold">Scale:</span> {model.scale[0].toFixed(2)}</p>
        {model.dimensions && (
          <>
            <p><span className="font-semibold">Width:</span> {model.dimensions.width.toFixed(2)}</p>
            <p><span className="font-semibold">Height:</span> {model.dimensions.height.toFixed(2)}</p>
            <p><span className="font-semibold">Depth:</span> {model.dimensions.depth.toFixed(2)}</p>
          </>
        )}
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={!!model.wireframe} 
            onChange={(e) => onWireframeChange(model.id, e.target.checked)} 
          />
          <span>Wireframe</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={!!model.castShadow} 
            onChange={(e) => onCastShadowChange(model.id, e.target.checked)} 
          />
          <span>Cast Shadow</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={!!model.receiveShadow} 
            onChange={(e) => onReceiveShadowChange(model.id, e.target.checked)} 
          />
          <span>Receive Shadow</span>
        </div>
        <div className="flex flex-col gap-1">
          <span>Light Intensity: {model.lightIntensity?.toFixed(1)}</span>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.1" 
            value={model.lightIntensity || 0} 
            onChange={(e) => onLightIntensityChange(model.id, parseFloat(e.target.value))} 
          />
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Replace Texture
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleTextureFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={() => onFocus(model.id)}
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
          >
            Focus Camera
          </button>
          <button 
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
            onClick={() => onReset(model.id)}
          >
            Reset Model
          </button>
        </div>
      </div>
    </div>
  );
}
