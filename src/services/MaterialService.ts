/**
 * MaterialService - Handles material application and management
 * Provides a stateless interface for applying materials to models
 */

import { MaterialPreset } from '../types/materials';
import { ModelData } from '../App';

export class MaterialService {
  /**
   * Apply a material preset to a model.
   * Returns the updated model with the material applied.
   */
  static applyMaterial(
    model: ModelData,
    preset: MaterialPreset
  ): ModelData {
    return {
      ...model,
      material: preset,
      colorTint: preset.color,
      opacity: preset.opacity,
      roughness: preset.roughness,
      metalness: preset.metalness,
      emissiveColor: preset.emissiveColor,
      normalMapUrl: preset.normalMapUrl,
      wireframe: preset.wireframe,
      // Store the material preset ID for reference
      behaviorTags: [
        ...(model.behaviorTags || []).filter(t => !t.startsWith('material:')),
        `material:${preset.id}`
      ]
    };
  }

  /**
   * Get material from a model if it has one applied
   */
  static getMaterial(model: ModelData): MaterialPreset | null {
    return model.material ?? null;
  }

  /**
   * Extract material preset ID from model tags
   */
  static getMaterialIdFromTags(model: ModelData): string | null {
    const materialTag = (model.behaviorTags || []).find(t => t.startsWith('material:'));
    if (!materialTag) return null;
    return materialTag.replace('material:', '');
  }

  /**
   * Check if a material is already applied to a model
   */
  static hasMaterial(model: ModelData, materialId: string): boolean {
    return (model.behaviorTags || []).includes(`material:${materialId}`);
  }

  /**
   * Remove material from a model
   */
  static removeMaterial(model: ModelData): ModelData {
    return {
      ...model,
      material: undefined,
      behaviorTags: (model.behaviorTags || []).filter(t => !t.startsWith('material:'))
    };
  }

  /**
   * Create a new material preset with validation
   */
  static validateMaterial(preset: Partial<MaterialPreset>): string | null {
    if (!preset.id) return 'Material ID is required';
    if (!preset.name) return 'Material name is required';
    if (preset.roughness !== undefined && (preset.roughness < 0 || preset.roughness > 1)) {
      return 'Roughness must be between 0 and 1';
    }
    if (preset.metalness !== undefined && (preset.metalness < 0 || preset.metalness > 1)) {
      return 'Metalness must be between 0 and 1';
    }
    if (preset.opacity !== undefined && (preset.opacity < 0 || preset.opacity > 1)) {
      return 'Opacity must be between 0 and 1';
    }
    return null;
  }
}
