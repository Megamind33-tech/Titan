import { Swim26SceneManifest } from './Swim26ManifestService';
import { validateSwim26Manifest, Swim26ImportIssue } from './Swim26ManifestImportContract';
import { generateDeterministicId } from '../utils/idUtils';

export interface ImportedSwim26Node {
  id: string;  // Stable authored ID for round-trip (authoredId from manifest v1.1.0+, synthesized for v1.0.0)
  name: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  assetRef?: {
    type: 'url' | 'asset-id';
    value: string;
  };
  material?: {
    presetId?: string;
    color?: string;
    texture?: string;
    opacity?: number;
    roughness?: number;
    metalness?: number;
    emissiveColor?: string;
  };
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface ImportedSwim26Scene {
  nodes: ImportedSwim26Node[];
  environment: {
    presetId: string;
    intensity: number;
    backgroundColor: string;
  } | null;
  paths: Array<{
    id: string;
    type: string;
    points: [number, number, number][];
  }>;
  runtimeOwnership: {
    runtimeOwned: string[];
    unsupported: string[];
  };
}

export interface Swim26ManifestImportResult {
  ok: boolean;
  scene?: ImportedSwim26Scene;
  errors: Swim26ImportIssue[];
  warnings: Swim26ImportIssue[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(entry => typeof entry === 'string');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeAssetRef = (value: unknown): ImportedSwim26Node['assetRef'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const typed = value as { type?: string; value?: string };
  if ((typed.type === 'url' || typed.type === 'asset-id') && typeof typed.value === 'string' && typed.value.length > 0) {
    return { type: typed.type, value: typed.value };
  }
  return undefined;
};

const normalizeMaterial = (value: unknown): ImportedSwim26Node['material'] | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const typed = value as {
    presetId?: unknown;
    color?: unknown;
    texture?: unknown;
    opacity?: unknown;
    roughness?: unknown;
    metalness?: unknown;
    emissiveColor?: unknown;
  };
  return {
    presetId: typeof typed.presetId === 'string' ? typed.presetId : undefined,
    color: typeof typed.color === 'string' ? typed.color : undefined,
    texture: typeof typed.texture === 'string' ? typed.texture : undefined,
    opacity: typeof typed.opacity === 'number' && typed.opacity >= 0 && typed.opacity <= 1 ? typed.opacity : undefined,
    roughness: typeof typed.roughness === 'number' && typed.roughness >= 0 && typed.roughness <= 1 ? typed.roughness : undefined,
    metalness: typeof typed.metalness === 'number' && typed.metalness >= 0 && typed.metalness <= 1 ? typed.metalness : undefined,
    emissiveColor: typeof typed.emissiveColor === 'string' ? typed.emissiveColor : undefined,
  };
};

const parseManifest = (input: string | Swim26SceneManifest): unknown => {
  if (typeof input === 'string') {
    return JSON.parse(input);
  }
  return input;
};

export const importSwim26Manifest = (input: string | Swim26SceneManifest): Swim26ManifestImportResult => {
  let raw: unknown;
  try {
    raw = parseManifest(input);
  } catch {
    return {
      ok: false,
      errors: [{ path: 'manifest', message: 'Manifest is not valid JSON.', severity: 'error' }],
      warnings: [],
    };
  }

  const validation = validateSwim26Manifest(raw);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  const manifest = raw as Swim26SceneManifest;
  const warnings = [...validation.warnings];

  // Detect manifest version for round-trip support
  const isV110 = manifest.version === '1.1.0';
  if (!isV110) {
    warnings.push({
      path: 'version',
      message: 'Manifest v1.0.0 (no stable authoredId): Using synthetic IDs from object name+position. ' +
               'Round-trip will fail if objects are moved or properties changed. Use v1.1.0 for reliable round-trip.',
      severity: 'warning',
    });
  }

  // Process nodes with duplicate ID detection
  const nodesByAuthoredId = new Map<string, ImportedSwim26Node>();
  const processedNodes: ImportedSwim26Node[] = [];

  for (const obj of manifest.authoredContent.objects) {
    // Use authoredId from manifest (v1.1.0+) or synthesize deterministic ID for backward compat
    const nodeId = isV110 && (obj as any).authoredId
      ? (obj as any).authoredId
      : generateDeterministicId({ name: obj.name, position: obj.transform.position, assetRef: obj.assetRef });

    // Check for duplicate authoredId
    if (nodesByAuthoredId.has(nodeId)) {
      warnings.push({
        path: `authoredContent.objects[${processedNodes.length}]`,
        message: `Duplicate authoredId detected: "${nodeId}". Objects with same ID will conflict during sync. Ensure all objects have unique IDs.`,
        severity: 'warning',
      });
    }

    const node: ImportedSwim26Node = {
      id: nodeId,  // This is the stable round-trip ID
      name: obj.name || nodeId,
      transform: obj.transform,
      assetRef: normalizeAssetRef(obj.assetRef),
      material: normalizeMaterial(obj.material),
      tags: isStringArray(obj.tags) ? obj.tags : [],
      metadata: isPlainObject(obj.metadata) ? obj.metadata : {},
    };

    nodesByAuthoredId.set(nodeId, node);
    processedNodes.push(node);
  }

  const scene: ImportedSwim26Scene = {
    nodes: processedNodes,
    environment: manifest.authoredContent.environment
      ? {
          presetId: manifest.authoredContent.environment.presetId,
          intensity: manifest.authoredContent.environment.intensity,
          backgroundColor: manifest.authoredContent.environment.backgroundColor,
        }
      : null,
    paths: Array.isArray(manifest.authoredContent.paths)
      ? manifest.authoredContent.paths.filter(
          path => typeof path?.id === 'string' && typeof path?.type === 'string' &&
            Array.isArray(path?.points) &&
            path.points.every(point => Array.isArray(point) && point.length === 3 && point.every(n => typeof n === 'number' && Number.isFinite(n)))
        ).map(path => {
          // Use authoredId from path (v1.1.0+) or synthesize deterministic ID
          const pathId = isV110 && (path as any).authoredId
            ? (path as any).authoredId
            : generateDeterministicId({ name: (path as any).name || path.type, type: path.type, pointCount: path.points.length });

          return {
            id: pathId,  // This is the stable round-trip ID
            type: path.type,
            points: path.points,
          };
        })
      : [],
    runtimeOwnership: {
      runtimeOwned: isStringArray(manifest.runtimeOwned) ? manifest.runtimeOwned : [],
      unsupported: isStringArray(manifest.unsupported) ? manifest.unsupported : [],
    },
  };

  return {
    ok: true,
    scene,
    errors: [],
    warnings,
  };
};
