import { ImportedSwim26Node } from '../Swim26ManifestImporter';
import { BabylonLikeColor3, BabylonLikePBRMaterial, RuntimeDiagnostic } from './types';

const hexToColor3 = (value: string): BabylonLikeColor3 | null => {
  const cleaned = value.replace('#', '');
  if (![3, 6].includes(cleaned.length)) return null;
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => `${c}${c}`).join('')
    : cleaned;
  const parsed = Number.parseInt(full, 16);
  if (Number.isNaN(parsed)) return null;
  return {
    r: ((parsed >> 16) & 255) / 255,
    g: ((parsed >> 8) & 255) / 255,
    b: (parsed & 255) / 255,
  };
};

export const buildRuntimeMaterialFromTitanHints = (node: ImportedSwim26Node): {
  material?: BabylonLikePBRMaterial;
  diagnostics: RuntimeDiagnostic[];
} => {
  const diagnostics: RuntimeDiagnostic[] = [];
  if (!node) {
    return { diagnostics };
  }
  const hints = node.material;
  if (!hints) {
    return { diagnostics };
  }

  const material: BabylonLikePBRMaterial = {
    name: `${node.name || node.id}-imported-material`,
  };

  if (hints.color) {
    const parsed = hexToColor3(hints.color);
    if (parsed) {
      material.albedoColor = parsed;
    } else {
      diagnostics.push({
        severity: 'warning',
        code: 'MATERIAL_COLOR_INVALID',
        message: `Material color "${hints.color}" is invalid and was ignored.`,
        context: { nodeId: node.id },
      });
    }
  }

  if (typeof hints.texture === 'string' && hints.texture.length > 0) {
    material.albedoTextureUrl = hints.texture;
  }
  if (typeof hints.opacity === 'number') {
    material.alpha = Math.max(0, Math.min(1, hints.opacity));
  }
  if (typeof hints.roughness === 'number') {
    material.roughness = Math.max(0, Math.min(1, hints.roughness));
  }
  if (typeof hints.metalness === 'number') {
    material.metallic = Math.max(0, Math.min(1, hints.metalness));
  }
  if (typeof hints.emissiveColor === 'string') {
    const emissive = hexToColor3(hints.emissiveColor);
    if (emissive) {
      material.emissiveColor = emissive;
    } else {
      diagnostics.push({
        severity: 'warning',
        code: 'MATERIAL_EMISSIVE_INVALID',
        message: `Emissive color "${hints.emissiveColor}" is invalid and was ignored.`,
        context: { nodeId: node.id },
      });
    }
  }

  if (hints.presetId) {
    diagnostics.push({
      severity: 'warning',
      code: 'MATERIAL_PRESET_APPROXIMATED',
      message: `Material preset "${hints.presetId}" is treated as metadata only in runtime material policy.`,
      context: { nodeId: node.id, presetId: hints.presetId },
    });
  }
  if (
    hints.opacity !== undefined ||
    hints.roughness !== undefined ||
    hints.metalness !== undefined ||
    hints.emissiveColor !== undefined
  ) {
    diagnostics.push({
      severity: 'warning',
      code: 'MATERIAL_POLICY_APPROXIMATION',
      message: 'Advanced Titan material hints are approximated to runtime PBR defaults, not full shader parity.',
      context: { nodeId: node.id },
    });
  }

  return { material, diagnostics };
};
