import React, { useEffect, useMemo, useState } from 'react';
import { ProjectSelectionGuidance } from '../types/projectAdapter';

interface ProjectOnboardingModalProps {
  isOpen: boolean;
  guidance: ProjectSelectionGuidance;
  onCreateProject: (payload: { projectName: string; profileHint?: string }) => void;
  onOpenExisting: () => void;
  onImportFromGitHub: () => void;
}

export default function ProjectOnboardingModal({
  isOpen,
  guidance,
  onCreateProject,
  onOpenExisting,
  onImportFromGitHub,
}: ProjectOnboardingModalProps) {
  const [projectName, setProjectName] = useState('My Project');
  const defaultProfile = useMemo(() => guidance.options[0]?.profileId, [guidance.options]);
  const [profileHint, setProfileHint] = useState<string | undefined>(defaultProfile);

  useEffect(() => {
    setProfileHint(defaultProfile);
  }, [defaultProfile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="w-[560px] max-w-full bg-[#151619] border border-white/10 rounded-xl p-6 space-y-5" data-testid="project-onboarding-modal">
        <div>
          <h2 className="text-white font-mono text-sm tracking-widest uppercase">WELCOME TO TITAN</h2>
          <p className="text-white/60 text-xs mt-2">
            Choose your project path. If you are building SWIM26, start with the Babylon runtime option.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block text-white/60 text-[10px] font-mono uppercase tracking-widest">PROJECT NAME</label>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white text-sm"
            placeholder="My Project"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-white/60 text-[10px] font-mono uppercase tracking-widest">PROJECT TYPE</label>
          <div className="space-y-2">
            {guidance.options.map(option => (
              <button
                key={option.profileId}
                onClick={() => setProfileHint(option.profileId)}
                data-testid={`project-type-option-${option.profileId}`}
                className={`w-full text-left px-3 py-2 border rounded ${profileHint === option.profileId ? 'border-blue-400 bg-blue-500/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}
              >
                <div className="text-xs text-white/90 font-mono uppercase">{option.label}</div>
                <div className="text-[11px] text-white/50">{option.reason}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenExisting}
              className="text-xs text-white/60 hover:text-white border border-white/10 rounded px-3 py-2"
            >
              OPEN LAST PROJECT
            </button>
            <button
              onClick={onImportFromGitHub}
              className="text-xs text-blue-200 hover:text-white border border-blue-300/30 rounded px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20"
            >
              IMPORT FROM GITHUB
            </button>
          </div>
          <button
            onClick={() => onCreateProject({ projectName, profileHint })}
            data-testid="start-project-button"
            className="text-xs text-white bg-blue-500/30 hover:bg-blue-500/40 border border-blue-400/30 rounded px-4 py-2"
          >
            START PROJECT
          </button>
        </div>
      </div>
    </div>
  );
}
