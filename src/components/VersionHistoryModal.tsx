import React, { useEffect, useState } from 'react';
import { getVersionHistory, SceneState } from '../utils/storageUtils';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadVersion: (versionId: string) => void;
  onSaveNewVersion: (note: string) => void;
}

export default function VersionHistoryModal({ isOpen, onClose, onLoadVersion, onSaveNewVersion }: VersionHistoryModalProps) {
  const [history, setHistory] = useState<SceneState[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getVersionHistory();
      // Sort newest first
      setHistory(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newNote.trim()) return;
    await onSaveNewVersion(newNote);
    setNewNote('');
    loadHistory();
  };

  const handleLoad = (versionId: string) => {
    if (window.confirm('Are you sure you want to load this version? Any unsaved changes will be lost.')) {
      onLoadVersion(versionId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151619] border border-white/10 rounded shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-[12px] font-bold uppercase font-mono tracking-[0.2em] text-white/80">VERSION_HISTORY_&_SAVE</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-[10px] font-mono">CLOSE_X</button>
        </div>

        <div className="p-6 border-b border-white/5 bg-black/20 space-y-4">
          <h3 className="hardware-label">SAVE_CURRENT_STATE</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="ENTER_VERSION_NOTE..."
              className="flex-1 hardware-input py-2"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={!newNote.trim()}
              className="hardware-button px-6 py-2 bg-white/10 text-white border-white/20 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              SAVE_VERSION
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
          <h3 className="hardware-label mb-4">PREVIOUS_VERSIONS</h3>
          {isLoading ? (
            <div className="text-center text-white/20 py-12 font-mono text-[10px] uppercase tracking-widest animate-pulse">LOADING_HISTORY...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-white/20 py-12 font-mono text-[10px] uppercase tracking-widest">NO_SAVED_VERSIONS_FOUND</div>
          ) : (
            <div className="space-y-3">
              {history.map((version) => (
                <div key={version.versionId} className="bg-black/20 rounded p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-white/10 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-[11px] text-white/80 uppercase tracking-tight">{version.note}</span>
                      <span className="text-[8px] font-mono bg-white/5 text-white/30 px-2 py-0.5 rounded border border-white/5">
                        ID_{version.versionId.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-white/20 mb-2 uppercase tracking-tighter">
                      {new Date(version.timestamp).toLocaleString().toUpperCase()}
                    </div>
                    {version.changesSummary && (
                      <div className="flex gap-4 text-[8px] font-mono uppercase tracking-widest">
                        <span className="text-white/40">ADD: <span className="text-white/70">{version.changesSummary.added}</span></span>
                        <span className="text-white/40">REM: <span className="text-white/70">{version.changesSummary.removed}</span></span>
                        <span className="text-white/40">MOD: <span className="text-white/70">{version.changesSummary.edited}</span></span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLoad(version.versionId)}
                    className="hardware-button px-4 py-2 opacity-60 group-hover:opacity-100"
                  >
                    RESTORE_STATE
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
