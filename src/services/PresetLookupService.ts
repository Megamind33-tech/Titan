import { EnvironmentPreset } from '../types/environment';
import { MaterialPreset } from '../types/materials';

export type NamedPreset = {
  id: string;
  name: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

export function findPresetByIdOrName<T extends NamedPreset>(
  presets: T[],
  options: { id?: string; name?: string }
): T | null {
  const { id, name } = options;

  if (id) {
    const byId = presets.find(p => p.id === id);
    if (byId) return byId;
  }

  if (!name) return null;

  const normalizedName = normalize(name);

  const exact = presets.find(p => normalize(p.name) === normalizedName);
  if (exact) return exact;

  const safe = presets.find(p => normalize(p.name).includes(normalizedName));
  return safe ?? null;
}

export const findMaterialPreset = (
  presets: MaterialPreset[],
  options: { id?: string; name?: string }
): MaterialPreset | null => findPresetByIdOrName(presets, options);

export const findEnvironmentPreset = (
  presets: EnvironmentPreset[],
  options: { id?: string; name?: string }
): EnvironmentPreset | null => findPresetByIdOrName(presets, options);
