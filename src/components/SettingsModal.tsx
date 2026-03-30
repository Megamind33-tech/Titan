import React from 'react';
import { X } from 'lucide-react';
import QualityPanel from './QualityPanel';
import { QualitySettings } from '../types/quality';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: string;
  onProfileChange: (id: string) => void;
  customSettings: QualitySettings;
  onUpdateCustomSettings: (settings: QualitySettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  activeProfileId,
  onProfileChange,
  customSettings,
  onUpdateCustomSettings
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#151619] border border-white/10 rounded-lg shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <QualityPanel 
            activeProfileId={activeProfileId}
            onProfileChange={onProfileChange}
            customSettings={customSettings}
            onUpdateCustomSettings={onUpdateCustomSettings}
          />
        </div>
        
        <div className="p-4 border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
