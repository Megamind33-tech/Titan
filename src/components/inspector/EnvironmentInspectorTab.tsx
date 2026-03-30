import React from 'react';
import { Search } from 'lucide-react';
import { EnvironmentPreset } from '../../types/environment';
import { InspectorSection } from './InspectorSection';

interface Props {
  environment: EnvironmentPreset;
  updateEnvironment: (updates: Partial<EnvironmentPreset>) => void;
  handleSaveEnvAsPreset: () => void;
  openPresetBrowser: () => void;
}

export function EnvironmentInspectorTab({ environment, updateEnvironment, handleSaveEnvAsPreset, openPresetBrowser }: Props) {
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-3">
        <div className="flex gap-2">
          <button onClick={openPresetBrowser} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2">
            <span>🌍</span> Browse Presets
          </button>
          <button onClick={handleSaveEnvAsPreset} className="bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-700 transition-colors" title="Save as Preset">💾</button>
        </div>
        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-center">Current: {environment.name}</div>
      </div>

      <InspectorSection title="Ambient & Hemisphere" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase">Ambient Light</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent" value={environment.ambientColor} onChange={(e) => updateEnvironment({ ambientColor: e.target.value })} />
              <input type="range" min="0" max="2" step="0.01" className="flex-1 accent-blue-500" value={environment.ambientIntensity} onChange={(e) => updateEnvironment({ ambientIntensity: parseFloat(e.target.value) })} />
              <span className="text-[10px] font-mono w-8 text-right text-blue-400">{environment.ambientIntensity.toFixed(1)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Hemisphere Light</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-gray-950 p-1 rounded border border-gray-800"><input type="color" className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" value={environment.hemisphereColor} onChange={(e) => updateEnvironment({ hemisphereColor: e.target.value })} /><span className="text-[9px] text-gray-500 uppercase font-bold">Sky</span></div>
              <div className="flex items-center gap-2 bg-gray-950 p-1 rounded border border-gray-800"><input type="color" className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0" value={environment.hemisphereGroundColor} onChange={(e) => updateEnvironment({ hemisphereGroundColor: e.target.value })} /><span className="text-[9px] text-gray-500 uppercase font-bold">Ground</span></div>
            </div>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="2" step="0.01" className="flex-1 accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer" value={environment.hemisphereIntensity} onChange={(e) => updateEnvironment({ hemisphereIntensity: parseFloat(e.target.value) })} />
              <span className="text-[10px] font-mono w-8 text-right text-blue-400">{environment.hemisphereIntensity.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Directional Light" defaultOpen>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 uppercase">Shadows</label>
            <button onClick={() => updateEnvironment({ castShadows: !environment.castShadows })} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-colors ${environment.castShadows ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{environment.castShadows ? 'Enabled' : 'Disabled'}</button>
          </div>
          <div className="flex items-center gap-3">
            <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent" value={environment.directionalColor} onChange={(e) => updateEnvironment({ directionalColor: e.target.value })} />
            <input type="range" min="0" max="5" step="0.1" className="flex-1 accent-blue-500" value={environment.directionalIntensity} onChange={(e) => updateEnvironment({ directionalIntensity: parseFloat(e.target.value) })} />
            <span className="text-xs w-8 text-right">{environment.directionalIntensity.toFixed(1)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['X', 'Y', 'Z'].map((axis, i) => (
              <input key={axis} type="number" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-center text-xs" value={environment.directionalPosition[i]} onChange={(e) => {
                const newPos = [...environment.directionalPosition] as [number, number, number];
                newPos[i] = parseFloat(e.target.value);
                updateEnvironment({ directionalPosition: newPos });
              }} />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Sky & Background">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="hardware-label">Type</label>
            <div className="flex gap-2">
              <button onClick={openPresetBrowser} className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors">Browse</button>
              <button onClick={handleSaveEnvAsPreset} className="text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-widest transition-colors">Save</button>
            </div>
          </div>
          <select className="hardware-input w-full" value={environment.backgroundType} onChange={(e) => updateEnvironment({ backgroundType: e.target.value as any })}>
            <option value="color">Solid Color</option>
            <option value="preset">Environment Preset</option>
            <option value="skybox">Skybox</option>
          </select>
          {environment.backgroundType === 'color' ? (
            <div className="flex items-center gap-3">
              <input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10" value={environment.backgroundColor} onChange={(e) => updateEnvironment({ backgroundColor: e.target.value })} />
              <span className="hardware-label">Background Color</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <select className="hardware-input flex-1" value={environment.environmentPreset} onChange={(e) => updateEnvironment({ environmentPreset: e.target.value as any })}>
                <option value="studio">Studio</option><option value="apartment">Apartment</option><option value="city">City</option><option value="forest">Forest</option><option value="dawn">Dawn</option><option value="night">Night</option><option value="warehouse">Warehouse</option><option value="sunset">Sunset</option><option value="park">Park</option><option value="lobby">Lobby</option>
              </select>
              <button onClick={openPresetBrowser} className="hardware-button" title="Browse Presets"><Search className="w-3 h-3" /></button>
            </div>
          )}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest"><span>Env Intensity</span><span className="text-white/80">{environment.environmentIntensity.toFixed(1)}</span></div>
            <input type="range" min="0" max="2" step="0.1" className="w-full accent-blue-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" value={environment.environmentIntensity} onChange={(e) => updateEnvironment({ environmentIntensity: parseFloat(e.target.value) })} />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Fog">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="hardware-label">Enabled</label>
            <button onClick={() => updateEnvironment({ fogEnabled: !environment.fogEnabled })} className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${environment.fogEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-accent' : 'bg-white/5 text-white/20 border border-white/5'}`}>{environment.fogEnabled ? 'ACTIVE' : 'INACTIVE'}</button>
          </div>
          {environment.fogEnabled && (
            <>
              <div className="flex items-center gap-3"><input type="color" className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/10" value={environment.fogColor} onChange={(e) => updateEnvironment({ fogColor: e.target.value })} /><span className="hardware-label">Fog Color</span></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="hardware-label">Near</label><input type="number" className="hardware-input w-full" value={environment.fogNear} onChange={(e) => updateEnvironment({ fogNear: parseFloat(e.target.value) })} /></div>
                <div className="space-y-1"><label className="hardware-label">Far</label><input type="number" className="hardware-input w-full" value={environment.fogFar} onChange={(e) => updateEnvironment({ fogFar: parseFloat(e.target.value) })} /></div>
              </div>
            </>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="Post-Processing">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="hardware-label">SSAO (Ambient Occlusion)</label>
            <button 
              onClick={() => updateEnvironment({ ssaoEnabled: !environment.ssaoEnabled })} 
              className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${environment.ssaoEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-accent' : 'bg-white/5 text-white/20 border border-white/5'}`}
            >
              {environment.ssaoEnabled ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="hardware-label">Soft Shadows</label>
            <button 
              onClick={() => updateEnvironment({ softShadowsEnabled: !environment.softShadowsEnabled })} 
              className={`px-3 py-1 rounded text-[8px] font-mono uppercase tracking-widest transition-all ${environment.softShadowsEnabled ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 glow-accent' : 'bg-white/5 text-white/20 border border-white/5'}`}
            >
              {environment.softShadowsEnabled ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest"><span>Exposure</span><span className="text-white/80">{environment.exposure.toFixed(1)}</span></div>
            <input type="range" min="0" max="3" step="0.1" className="w-full accent-blue-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" value={environment.exposure} onChange={(e) => updateEnvironment({ exposure: parseFloat(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <label className="hardware-label">Tone Mapping</label>
            <select className="hardware-input w-full" value={environment.toneMapping} onChange={(e) => updateEnvironment({ toneMapping: e.target.value as any })}>
              <option value="None">None</option><option value="Linear">Linear</option><option value="Reinhard">Reinhard</option><option value="Cineon">Cineon</option><option value="ACESFilmic">ACES Filmic</option>
            </select>
          </div>
        </div>
      </InspectorSection>
    </div>
  );
}
