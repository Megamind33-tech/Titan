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
  const pendingAuthTokenRef = useRef<string | undefined>(undefined);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Import from GitHub</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Initial Input State */}
          {!confirmationMode && !result && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GitHub repository</label>
                <div className="relative">
                  <input
                    type="text"
                    value={repoInput}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Paste https://github.com/owner/repo or owner/repo"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />

                  {/* Suggestions Dropdown */}
                  {showSuggestions && importHistory.length > 0 && !repoInput && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2 border-b border-gray-200 text-xs font-semibold text-gray-600 bg-gray-50">
                        Recent Imports
                      </div>
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
                          className="w-full px-4 py-2 text-left text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium text-gray-800">{entry.label}</div>
                            <div className="text-gray-500 text-[10px]">Last: {entry.lastImported}</div>
                          </div>
                          <div className="text-gray-400 text-[10px]">×{entry.timesImported}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Public repositories import directly. If the repo is private, add a read-only token below.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch (optional)</label>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="main"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Folder path (optional)</label>
                  <input
                    type="text"
                    value={subpathInput}
                    onChange={(e) => setSubpathInput(e.target.value)}
                    placeholder="scenes/competition"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal access token (optional)
                </label>
                <input
                  type="password"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoComplete="off"
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Used only for this import attempt and never saved by Titan.
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-900">Couldn’t start import</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              )}

              {/* Progress */}
              {isLoading && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{getPhaseMessage(progress.phase, progress.message)}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.percentComplete}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrepareImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={!repoInput.trim() || isLoading}
                >
                  {!branchInput.trim() && !subpathInput.trim() && !hasAuthToken ? 'Import Project' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation State */}
          {confirmationMode && detectionPreview && !result && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Repository checked</p>
                <p className="text-sm text-blue-700 mt-1">
                  {detectionPreview.detection?.isSWIM26
                    ? 'This looks like a SWIM26 Babylon project and is ready to import.'
                    : 'This repo can be imported as a standard Titan scene.'}
                </p>
              </div>

              {/* Import Preview */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">What Titan imports</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✓ Project metadata plus supported manifest/config files</li>
                  <li>✓ Scene objects, asset references, environment, and camera/path data</li>
                  <li className="text-red-600">✗ Runtime/gameplay code (scripts, boot code, networking)</li>
                  <li className="text-red-600">✗ Source files outside Titan’s builder scope</li>
                </ul>
              </div>

              {/* Errors/Warnings */}
              {detectionPreview.errors && detectionPreview.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900 mb-2">Fix before import</p>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {detectionPreview.errors.map((err: string, idx: number) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {recentUrls.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Recent repository shortcuts</p>
                  <div className="flex flex-wrap gap-2">
                    {recentUrls.map((repo) => (
                      <button
                        key={repo}
                        onClick={() => setRepoInput(repo)}
                        className="px-2 py-1 text-[10px] rounded border border-gray-300 bg-gray-50 hover:bg-gray-100"
                      >
                        {repo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {detectionPreview.warnings && detectionPreview.warnings.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Heads up</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    {detectionPreview.warnings.map((warn: string, idx: number) => (
                      <li key={idx}>• {warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setConfirmationMode(false);
                    setDetectionPreview(null);
                    pendingAuthTokenRef.current = undefined;
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={detectionPreview.errors?.length > 0 || isLoading}
                >
                  {isLoading ? 'Importing...' : 'Import Project'}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-900">Import failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <p className="text-xs text-red-700 mt-2">
                    Next step: go back, update branch/path or paste a fresh read-only token, then retry.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-lg font-semibold text-green-900">✓ Import complete</p>
                <p className="text-sm text-green-700 mt-2">
                  Connected to {result.sourceRepo}
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Imported files</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {result.importedFiles.map((file) => (
                    <li key={file} className="flex items-center gap-2">
                      <span>•</span> {file}
                    </li>
                  ))}
                </ul>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-900 mb-2">Review after import</p>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {result.warnings.map((warn, idx) => (
                      <li key={idx}>• {warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleImportComplete}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Open Project
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
