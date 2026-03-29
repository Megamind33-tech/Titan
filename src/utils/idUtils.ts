/**
 * Round-Trip Stable ID Utilities
 *
 * Provides UUID v4 generation for author-stable object IDs.
 * These IDs persist across Titan save/load cycles and enable
 * SWIM26 runtime to match and update objects on re-import.
 */

/**
 * Generate a random UUID v4 string.
 * Uses crypto.randomUUID if available (modern browsers);
 * falls back to a simple pseudo-random implementation.
 *
 * @returns A UUID v4 string (36 characters, e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export const generateAuthoredId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Generate a deterministic UUID v5-like ID for an object based on its properties.
 * Useful for generating IDs that are stable across re-creation of visually identical objects.
 *
 * This is a simple hash-based approach, not true UUID v5.
 * Use only if you need deterministic IDs; prefer generateAuthoredId() for new objects.
 *
 * @param input - Object properties to hash (e.g., name, position)
 * @returns A pseudo-deterministic UUID-like string
 */
export const generateDeterministicId = (input: Record<string, any>): string => {
  const str = JSON.stringify(input);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash to UUID-like string
  const hashStr = Math.abs(hash).toString(16).padStart(32, '0');
  return [
    hashStr.substring(0, 8),
    hashStr.substring(8, 12),
    '4' + hashStr.substring(13, 16),
    ((parseInt(hashStr.substring(16, 18), 16) & 0x3) | 0x8).toString(16) + hashStr.substring(18, 20),
    hashStr.substring(20, 32),
  ].join('-');
};
