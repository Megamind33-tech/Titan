/**
 * GitHub Import Modal Component
 *
 * Provides UI for importing SWIM26 projects from GitHub.
 * Handles: URL input, repo detection, progress, results, error handling
 *
 * Usage:
 * <GitHubImportModal isOpen={true} onImportComplete={handleSession} onClose={close} />
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGitHubImport, getPhaseMessage } from '../hooks/useGitHubImport';
import { ProjectSession } from '../types/projectSession';
import { getFormattedHistory, getRecentImportUrls } from '../services/ImportHistoryService';
import { parseGitHubReference } from '../services/GitHubConnector';
import { ImportPreparationResult } from '../services/GitHubRepoImporter';
import { LoadedSceneData } from '../services/Swim26ManifestLoader';

interface GitHubImportModalProps {
  isOpen: boolean;
  initialRepoInput?: string;
  onImportComplete?: (importData: ProjectSession, sceneData?: LoadedSceneData) => void;
  onClose?: () => void;
}

export const GitHubImportModal: React.FC<GitHubImportModalProps> = ({
  isOpen,
  initialRepoInput,
  onImportComplete,
  onClose,
}) => {
  const [repoInput, setRepoInput] = useState(initialRepoInput || '');
  const [branchInput, setBranchInput] = useState('');
  const [subpathInput, setSubpathInput] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [detectionPreview, setDetectionPreview] = useState<ImportPreparationResult | null>(null);
  const [confirmationMode, setConfirmationMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const pendingAuthTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedAuthToken = authToken.trim();
  const hasAuthToken = normalizedAuthToken.length > 0;

  const {
    progress,
    result,
    error,
    isLoading,
    importRepository,
    prepareImport,
    clear,
  } = useGitHubImport();

  const importHistory = useMemo(() => getFormattedHistory(), [isOpen]);
  const recentUrls = useMemo(() => getRecentImportUrls(5), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setRepoInput(initialRepoInput || '');
    const parsed = initialRepoInput ? parseGitHubReference(initialRepoInput) : null;
    setBranchInput(parsed?.branch || '');
    setSubpathInput(parsed?.subpath || '');
  }, [initialRepoInput, isOpen]);

  const buildReferenceInput = (): string => {
    const trimmedRepo = repoInput.trim();
    const parsed = parseGitHubReference(trimmedRepo);
    if (!parsed) return trimmedRepo;
    if (!branchInput.trim() && !subpathInput.trim()) {
      return `${parsed.owner}/${parsed.repo}`;
    }

    const branch = branchInput.trim() || parsed.branch || 'main';
    const normalizedSubpath = subpathInput.trim().replace(/^\/+|\/+$/g, '');
    return normalizedSubpath
      ? `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}/${normalizedSubpath}`
      : `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoInput(e.target.value);
    setConfirmationMode(false);
    setDetectionPreview(null);
  };

  const handlePrepareImport = async () => {
    if (!repoInput.trim()) return;

    const referenceInput = buildReferenceInput();
    const shouldSkipConfirmation = !branchInput.trim() && !subpathInput.trim() && !hasAuthToken;

    if (shouldSkipConfirmation) {
      pendingAuthTokenRef.current = undefined;
      await importRepository(referenceInput);
      return;
    }

    pendingAuthTokenRef.current = hasAuthToken ? normalizedAuthToken : undefined;
    const preparation = await prepareImport(referenceInput, pendingAuthTokenRef.current);
    if (preparation) {
      setDetectionPreview(preparation);
      setConfirmationMode(true);
    }
    setAuthToken('');
  };

  const handleConfirmImport = async () => {
    const importToken = hasAuthToken ? normalizedAuthToken : pendingAuthTokenRef.current;
    await importRepository(
      buildReferenceInput(),
      detectionPreview?.guidance?.options?.[0]?.profileId,
      importToken
    );
    setAuthToken('');
  };

  const handleClose = () => {
    clear();
    setRepoInput(initialRepoInput || '');
    setBranchInput('');
    setSubpathInput('');
    setAuthToken('');
    pendingAuthTokenRef.current = undefined;
    setConfirmationMode(false);
    setDetectionPreview(null);
    onClose?.();
  };

  const handleImportComplete = () => {
    if (result?.session) {
      onImportComplete?.(result.session, result.sceneData);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#151619] rounded-xl border border-white/10 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-4 flex justify-between items-center bg-black/20">
          <div className="flex flex-col">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-white/90">Import Project</h2>
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest mt-0.5">GitHub Connector v2.0</span>
          </div>
          <button
            onClick={handleClose}
            className="text-white/30 hover:text-white transition-colors p-1"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {/* Initial Input State */}
          {!confirmationMode && !result && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50">Repository Reference</label>
                <div className="relative">
                  <input
                    type="text"
                    value={repoInput}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="OWNER/REPO OR GITHUB URL"
                    className="hardware-input w-full"
                    disabled={isLoading}
                  />

                  {/* Suggestions Dropdown */}
                  {showSuggestions && importHistory.length > 0 && !repoInput && (
                    <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-2 bg-[#1a1b1e] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/5 text-[9px] font-mono uppercase tracking-widest text-white/30 bg-black/20">
                        Recent History
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {importHistory.slice(0, 5).map((entry, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setRepoInput(entry.url);
                              const parsed = parseGitHubReference(entry.url);
                              setBranchInput(parsed?.branch || '');
                              setSubpathInput(parsed?.subpath || '');
                              setShowSuggestions(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-b-0 flex justify-between items-center transition-colors group"
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="text-[11px] font-mono text-white/80 group-hover:text-white">{entry.label}</div>
                              <div className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">Last: {entry.lastImported}</div>
                            </div>
                            <div className="text-[9px] font-mono text-white/20">×{entry.timesImported}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider leading-relaxed">
                  Public repositories import directly. For private access, provide a scoped token below.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50">Branch</label>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="MAIN"
                    className="hardware-input w-full"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50">Subpath</label>
                  <input
                    type="text"
                    value={subpathInput}
                    onChange={(e) => setSubpathInput(e.target.value)}
                    placeholder="ROOT"
                    className="hardware-input w-full"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50">
                  Access Token (Optional)
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="GHP_..."
                  className="hardware-input w-full"
                  autoComplete="off"
                  disabled={isLoading}
                />
                <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
                  Tokens are used only for this session and are never persisted.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-400">Import Error</p>
                  </div>
                  <p className="text-[11px] font-mono text-red-300/80 leading-relaxed">{error}</p>
                </div>
              )}

              {/* Progress */}
              {isLoading && (
                <div className="space-y-3 p-4 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-white/70">
                      {getPhaseMessage(progress.phase, progress.message)}
                    </p>
                    <span className="text-[10px] font-mono text-white/40">{progress.percentComplete}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-white h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                      style={{ width: `${progress.percentComplete}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrepareImport}
                  className="px-8 py-2.5 bg-white text-black text-[10px] font-mono font-bold uppercase tracking-[0.2em] rounded hover:bg-white/90 disabled:opacity-20 transition-all shadow-xl"
                  disabled={!repoInput.trim() || isLoading}
                >
                  {!branchInput.trim() && !subpathInput.trim() && !hasAuthToken ? 'Initialize' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation State */}
          {confirmationMode && detectionPreview && !result && (
            <div className="space-y-6">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/90">Repository Verified</p>
                </div>
                <p className="text-[11px] font-mono text-white/50 leading-relaxed">
                  {detectionPreview.detection?.isSWIM26
                    ? 'SWIM26 MANIFEST DETECTED. READY FOR ENGINE INITIALIZATION.'
                    : 'GENERIC REPOSITORY DETECTED. IMPORTING AS RAW ASSETS.'}
                </p>
              </div>

              {/* Import Preview */}
              <div className="border border-white/5 rounded-lg p-5 bg-black/20">
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-4">Import Scope</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  <div className="flex items-start gap-3">
                    <div className="text-green-500 mt-0.5">✓</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">Metadata</span>
                      <span className="text-[9px] font-mono text-white/30 uppercase">Manifests & Configs</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-green-500 mt-0.5">✓</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">Assets</span>
                      <span className="text-[9px] font-mono text-white/30 uppercase">Models & Textures</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 opacity-40">
                    <div className="text-red-500 mt-0.5">✗</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">Scripts</span>
                      <span className="text-[9px] font-mono text-white/30 uppercase">Runtime Logic</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 opacity-40">
                    <div className="text-red-500 mt-0.5">✗</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">Source</span>
                      <span className="text-[9px] font-mono text-white/30 uppercase">External Dependencies</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors/Warnings */}
              {detectionPreview.errors && detectionPreview.errors.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-3">Critical Issues</p>
                  <ul className="space-y-2">
                    {detectionPreview.errors.map((err: string, idx: number) => (
                      <li key={idx} className="text-[11px] font-mono text-red-300/70 flex gap-2">
                        <span className="text-red-500">•</span> {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {detectionPreview.warnings && detectionPreview.warnings.length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400 mb-3">System Warnings</p>
                  <ul className="space-y-2">
                    {detectionPreview.warnings.map((warn: string, idx: number) => (
                      <li key={idx} className="text-[11px] font-mono text-yellow-300/70 flex gap-2">
                        <span className="text-yellow-500">•</span> {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => {
                    setConfirmationMode(false);
                    setDetectionPreview(null);
                    pendingAuthTokenRef.current = undefined;
                  }}
                  className="px-6 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-8 py-2.5 bg-white text-black text-[10px] font-mono font-bold uppercase tracking-[0.2em] rounded hover:bg-white/90 disabled:opacity-20 transition-all shadow-xl"
                  disabled={detectionPreview.errors?.length > 0 || isLoading}
                >
                  {isLoading ? 'Processing...' : 'Execute Import'}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">Execution Failed</p>
                  <p className="text-[11px] font-mono text-red-300/80">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-6">
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <div className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div>
                </div>
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-green-400 mb-2">Import Successful</p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                  Source: {result.sourceRepo}
                </p>
              </div>

              <div className="border border-white/5 rounded-lg p-5 bg-black/20">
                <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-4">Imported Manifest</p>
                <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2">
                  <ul className="space-y-2">
                    {result.importedFiles.map((file) => (
                      <li key={file} className="text-[10px] font-mono text-white/60 flex items-center gap-3">
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        {file}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400 mb-3">Post-Import Notes</p>
                  <ul className="space-y-2">
                    {result.warnings.map((warn, idx) => (
                      <li key={idx} className="text-[11px] font-mono text-yellow-300/70 flex gap-2">
                        <span className="text-yellow-500">•</span> {warn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center pt-4 border-t border-white/5">
                <button
                  onClick={handleImportComplete}
                  className="w-full sm:w-auto px-12 py-3 bg-green-500 text-black text-[10px] font-mono font-bold uppercase tracking-[0.3em] rounded hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                >
                  Launch Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
