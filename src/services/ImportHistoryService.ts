/**
 * Import History Service
 *
 * Tracks GitHub URLs that users have imported from.
 * Provides suggestions and history for quick re-imports.
 *
 * Storage: localStorage
 * Max items: 10
 */

const STORAGE_KEY = 'titan-github-import-history';
const MAX_HISTORY = 10;

export interface ImportHistoryEntry {
  url: string;
  owner: string;
  repo: string;
  displayName: string;
  importedAt: string;
  importCount: number;
}

/**
 * Get all import history entries
 */
export const getImportHistory = (): ImportHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const entries = JSON.parse(stored) as ImportHistoryEntry[];
    // Sort by import date, newest first
    return entries.sort((a, b) =>
      new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    );
  } catch (error) {
    console.error('[ImportHistory] Error reading history:', error);
    return [];
  }
};

/**
 * Add or update an import history entry
 */
export const addToImportHistory = (
  owner: string,
  repo: string,
  displayName?: string
): ImportHistoryEntry => {
  try {
    const history = getImportHistory();
    const url = `${owner}/${repo}`;

    // Check if entry already exists
    const existingIndex = history.findIndex(h => h.url === url);

    if (existingIndex >= 0) {
      // Update existing entry
      const existing = history[existingIndex];
      existing.importedAt = new Date().toISOString();
      existing.importCount = (existing.importCount || 0) + 1;
      history[existingIndex] = existing;
    } else {
      // Add new entry
      const entry: ImportHistoryEntry = {
        url,
        owner,
        repo,
        displayName: displayName || `${owner}/${repo}`,
        importedAt: new Date().toISOString(),
        importCount: 1,
      };
      history.push(entry);
    }

    // Keep only the most recent MAX_HISTORY entries
    const trimmed = history.slice(0, MAX_HISTORY);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    return trimmed[0]; // Return the updated/new entry
  } catch (error) {
    console.error('[ImportHistory] Error adding to history:', error);
    return {
      url: `${owner}/${repo}`,
      owner,
      repo,
      displayName: displayName || `${owner}/${repo}`,
      importedAt: new Date().toISOString(),
      importCount: 1,
    };
  }
};

/**
 * Get recent import URLs for suggestions
 */
export const getRecentImportUrls = (limit: number = 5): string[] => {
  return getImportHistory()
    .slice(0, limit)
    .map(entry => entry.url);
};

/**
 * Get formatted history for display
 */
export const getFormattedHistory = (): Array<{
  url: string;
  label: string;
  lastImported: string;
  timesImported: number;
}> => {
  return getImportHistory().map(entry => ({
    url: entry.url,
    label: entry.displayName,
    lastImported: formatTimeAgo(new Date(entry.importedAt)),
    timesImported: entry.importCount,
  }));
};

/**
 * Clear all import history
 */
export const clearImportHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[ImportHistory] Error clearing history:', error);
  }
};

/**
 * Remove a specific entry from history
 */
export const removeFromHistory = (url: string): void => {
  try {
    const history = getImportHistory();
    const filtered = history.filter(h => h.url !== url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[ImportHistory] Error removing from history:', error);
  }
};

/**
 * Helper: Format timestamp as relative time
 */
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};
