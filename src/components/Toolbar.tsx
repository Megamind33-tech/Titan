import React from 'react';

interface ToolbarProps {
  transformMode: 'translate' | 'rotate' | 'scale';
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (enabled: boolean) => void;
  groundSnap: boolean;
  onGroundSnapChange: (enabled: boolean) => void;
  translationSnap: number;
  onTranslationSnapChange: (val: number) => void;
  rotationSnap: number;
  onRotationSnapChange: (val: number) => void;
  scaleSnap: number;
  onScaleSnapChange: (val: number) => void;
}

export default function Toolbar({
  transformMode,
  onTransformModeChange,
  snapEnabled,
  onSnapEnabledChange,
  groundSnap,
  onGroundSnapChange,
  translationSnap,
  onTranslationSnapChange,
  rotationSnap,
  onRotationSnapChange,
  scaleSnap,
  onScaleSnapChange
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      <div className="bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-lg shadow-xl border border-gray-700 flex gap-1 pointer-events-auto">
        {(['translate', 'rotate', 'scale'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onTransformModeChange(mode)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              transformMode === mode 
                ? 'bg-blue-600 text-white shadow-inner' 
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
            title={`Switch to ${mode} mode`}
          >
            {mode === 'translate' && '⬌ Move'}
            {mode === 'rotate' && '↻ Rotate'}
            {mode === 'scale' && '⤢ Scale'}
          </button>
        ))}
      </div>
      
      <div className="bg-gray-900/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg border border-gray-700 flex gap-4 pointer-events-auto text-xs items-center">
        <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white transition-colors">
          <input 
            type="checkbox" 
            checked={snapEnabled} 
            onChange={(e) => onSnapEnabledChange(e.target.checked)}
            className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          Snap
        </label>

        {snapEnabled && (
          <>
            <div className="w-px h-4 bg-gray-700"></div>
            {transformMode === 'translate' && (
              <div className="flex items-center gap-1 text-gray-300">
                <span>Step:</span>
                <input 
                  type="number" 
                  value={translationSnap} 
                  onChange={(e) => onTranslationSnapChange(parseFloat(e.target.value) || 0.1)}
                  className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-center"
                  step="0.1"
                  min="0.1"
                />
              </div>
            )}
            {transformMode === 'rotate' && (
              <div className="flex items-center gap-1 text-gray-300">
                <span>Step (°):</span>
                <input 
                  type="number" 
                  value={Math.round(rotationSnap * (180 / Math.PI))} 
                  onChange={(e) => onRotationSnapChange((parseFloat(e.target.value) || 15) * (Math.PI / 180))}
                  className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-center"
                  step="5"
                  min="5"
                />
              </div>
            )}
            {transformMode === 'scale' && (
              <div className="flex items-center gap-1 text-gray-300">
                <span>Step:</span>
                <input 
                  type="number" 
                  value={scaleSnap} 
                  onChange={(e) => onScaleSnapChange(parseFloat(e.target.value) || 0.1)}
                  className="w-12 bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-center"
                  step="0.1"
                  min="0.1"
                />
              </div>
            )}
          </>
        )}

        <div className="w-px h-4 bg-gray-700"></div>
        <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white transition-colors">
          <input 
            type="checkbox" 
            checked={groundSnap} 
            onChange={(e) => onGroundSnapChange(e.target.checked)}
            className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          Surface Snap
        </label>
      </div>
    </div>
  );
}
