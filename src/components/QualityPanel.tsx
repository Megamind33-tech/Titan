import React, { useMemo } from 'react';
import { DeviceProfile, QualitySettings } from '../types/quality';
import { DEFAULT_PROFILES } from '../constants/qualityProfiles';

interface QualityPanelProps {
  activeProfileId: string;
  onProfileChange: (id: string) => void;
  customSettings: QualitySettings;
  onUpdateCustomSettings: (settings: QualitySettings) => void;
}

const QualityPanel: React.FC<QualityPanelProps> = ({ 
  activeProfileId, 
  onProfileChange, 
  customSettings, 
  onUpdateCustomSettings 
}) => {
  return (
    <div className="p-4 bg-[#151619] text-white border-t border-white/10">
      <h2 className="text-sm font-bold uppercase tracking-widest mb-4">Quality Profile</h2>
      <select 
        value={activeProfileId}
        onChange={(e) => onProfileChange(e.target.value)}
        className="w-full bg-[#202124] text-white p-2 rounded mb-4 text-xs"
      >
        {DEFAULT_PROFILES.map(profile => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
        ))}
        <option value="custom">Custom</option>
      </select>
      
      {activeProfileId === 'custom' && (
        <div className="space-y-4 text-xs">
          <p className="text-white/50 font-bold uppercase tracking-widest">Manual Overrides</p>
          
          <div className="flex items-center justify-between">
            <span>Texture Quality</span>
            <select 
              value={customSettings.textureQuality}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, textureQuality: e.target.value as any })}
              className="bg-[#202124] text-white p-1 rounded"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span>Shadow Quality</span>
            <select 
              value={customSettings.shadowQuality}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, shadowQuality: e.target.value as any })}
              className="bg-[#202124] text-white p-1 rounded"
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span>Reflection Quality</span>
            <select 
              value={customSettings.reflectionQuality}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, reflectionQuality: e.target.value as any })}
              className="bg-[#202124] text-white p-1 rounded"
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span>Post Processing</span>
            <select 
              value={customSettings.postProcessingLevel}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, postProcessingLevel: e.target.value as any })}
              className="bg-[#202124] text-white p-1 rounded"
            >
              <option value="none">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Draw Distance</span>
              <span>{customSettings.drawDistance}m</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="500" 
              step="10"
              value={customSettings.drawDistance}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, drawDistance: parseInt(e.target.value) })}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span>Anti-Aliasing</span>
            <input 
              type="checkbox"
              checked={customSettings.antiAliasing}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, antiAliasing: e.target.checked })}
              className="w-4 h-4 rounded border-white/10 bg-[#202124] text-blue-600 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <span>Fog Enabled</span>
            <input 
              type="checkbox"
              checked={customSettings.fogEnabled}
              onChange={(e) => onUpdateCustomSettings({ ...customSettings, fogEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-white/10 bg-[#202124] text-blue-600 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityPanel;
