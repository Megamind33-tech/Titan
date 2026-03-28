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
      <div className="bg-[#151619]/90 backdrop-blur-md p-1 rounded border border-white/10 flex gap-1 pointer-events-auto shadow-2xl">
        {(['translate', 'rotate', 'scale'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => onTransformModeChange(mode)}
            className={`px-3 py-1.5 rounded transition-all duration-200 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 ${
              transformMode === mode 
                ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                : 'text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent'
            }`}
            title={`Switch to ${mode} mode`}
          >
            {mode === 'translate' && 'MOVE'}
            {mode === 'rotate' && 'ROTATE'}
            {mode === 'scale' && 'SCALE'}
          </button>
        ))}
      </div>
      
      <div className="bg-[#151619]/90 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 flex gap-4 pointer-events-auto text-[9px] font-mono uppercase tracking-tighter items-center shadow-xl">
        <label className="flex items-center gap-1.5 cursor-pointer text-white/50 hover:text-white transition-colors">
          <input 
            type="checkbox" 
            checked={snapEnabled} 
            onChange={(e) => onSnapEnabledChange(e.target.checked)}
            className="w-3 h-3 rounded bg-black/40 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
          />
          SNAP
        </label>

        {snapEnabled && (
          <>
            <div className="w-px h-3 bg-white/10"></div>
            {transformMode === 'translate' && (
              <div className="flex items-center gap-1 text-white/50">
                <span>STEP:</span>
                <input 
                  type="number" 
                  value={translationSnap} 
                  onChange={(e) => onTranslationSnapChange(parseFloat(e.target.value) || 0.1)}
                  className="hardware-input w-10 text-center py-0"
                  step="0.1"
                  min="0.1"
                />
              </div>
            )}
            {transformMode === 'rotate' && (
              <div className="flex items-center gap-1 text-white/50">
                <span>STEP(°):</span>
                <input 
                  type="number" 
                  value={Math.round(rotationSnap * (180 / Math.PI))} 
                  onChange={(e) => onRotationSnapChange((parseFloat(e.target.value) || 15) * (Math.PI / 180))}
                  className="hardware-input w-10 text-center py-0"
                  step="5"
                  min="5"
                />
              </div>
            )}
            {transformMode === 'scale' && (
              <div className="flex items-center gap-1 text-white/50">
                <span>STEP:</span>
                <input 
                  type="number" 
                  value={scaleSnap} 
                  onChange={(e) => onScaleSnapChange(parseFloat(e.target.value) || 0.1)}
                  className="hardware-input w-10 text-center py-0"
                  step="0.1"
                  min="0.1"
                />
              </div>
            )}
          </>
        )}

        <div className="w-px h-3 bg-white/10"></div>
        <label className="flex items-center gap-1.5 cursor-pointer text-white/50 hover:text-white transition-colors">
          <input 
            type="checkbox" 
            checked={groundSnap} 
            onChange={(e) => onGroundSnapChange(e.target.checked)}
            className="w-3 h-3 rounded bg-black/40 border-white/10 text-white/70 focus:ring-0 focus:ring-offset-0 accent-white/50"
          />
          SURFACE_SNAP
        </label>
      </div>
    </div>
  );
}
