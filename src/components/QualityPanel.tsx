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
        <div className="space-y-2 text-xs">
          <p className="text-white/50 font-bold">Manual Overrides</p>
          {/* Add controls for settings here */}
          <p className="text-white/30">Manual settings would go here.</p>
        </div>
      )}
    </div>
  );
};

export default QualityPanel;
