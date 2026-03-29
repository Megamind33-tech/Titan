import { ModelData } from '../App';
import { EnvironmentPreset } from '../types/environment';
import { Path } from '../types/paths';

export interface Swim26SceneManifest {
  version: '1.0.0';
  runtime: 'babylon';
  projectType: 'swim26-babylon';
  authoredBy: 'titan';
  authoredContent: {
    objects: Array<{
      id: string;
      name: string;
      assetRef?: {
        type: 'url' | 'asset-id';
        value: string;
      };
      transform: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
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
    }>;
    environment: {
      presetId: string;
      intensity: number;
      backgroundColor: string;
    };
    paths: Array<{
      id: string;
      type: string;
      points: [number, number, number][];
    }>;
  };
  runtimeOwned: string[];
  unsupported: string[];
}

export const buildSwim26Manifest = (input: {
  models: ModelData[];
  environment: EnvironmentPreset;
  paths: Path[];
}): Swim26SceneManifest => {
  return {
    version: '1.0.0',
    runtime: 'babylon',
    projectType: 'swim26-babylon',
    authoredBy: 'titan',
    authoredContent: {
      objects: input.models.map(model => ({
        id: model.id,
        name: model.name,
        assetRef: model.assetId
          ? { type: 'asset-id', value: model.assetId }
          : model.url
            ? { type: 'url', value: model.url }
            : undefined,
        transform: {
          position: model.position,
          rotation: model.rotation,
          scale: model.scale,
        },
        material: {
          presetId: model.material?.id,
          color: model.material?.color ?? model.colorTint,
          texture: model.textureUrl,
          opacity: model.material?.opacity,
          roughness: model.material?.roughness,
          metalness: model.material?.metalness,
          emissiveColor: model.material?.emissiveColor,
        },
        tags: model.behaviorTags ?? [],
        metadata: (model as any).metadata ?? {},
      })),
      environment: {
        presetId: input.environment.id,
        intensity: input.environment.ambientIntensity ?? 1,
        backgroundColor: input.environment.backgroundColor,
      },
      paths: input.paths.map(path => ({
        id: path.id,
        type: path.type,
        points: path.points.map(point => point.position),
      })),
    },
    runtimeOwned: [
      'SWIM26 gameplay simulation and scoring logic',
      'Babylon runtime bootstrapping',
      'Network/session orchestration',
    ],
    unsupported: [
      'Runtime gameplay script authoring',
      'Live runtime behavior debugging',
    ],
  };
};
