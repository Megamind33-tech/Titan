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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Version History & Save</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 border-b border-gray-700 bg-gray-900/50">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Save Current State</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter a note for this version (e.g., 'Added trees')"
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={!newNote.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors font-medium"
            >
              Save Version
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Previous Versions</h3>
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No saved versions yet.</div>
          ) : (
            <div className="space-y-3">
              {history.map((version) => (
                <div key={version.versionId} className="bg-gray-700 rounded-lg p-4 border border-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{version.note}</span>
                      <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                        v{version.versionId.slice(-6)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {new Date(version.timestamp).toLocaleString()}
                    </div>
                    {version.changesSummary && (
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-400">+{version.changesSummary.added} added</span>
                        <span className="text-red-400">-{version.changesSummary.removed} removed</span>
                        <span className="text-blue-400">~{version.changesSummary.edited} edited</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleLoad(version.versionId)}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    Restore
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
