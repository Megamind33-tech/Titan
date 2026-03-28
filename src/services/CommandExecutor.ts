/**
 * CommandExecutor - Handles execution of AI commands with proper type safety.
 *
 * This service manages all AI command execution, replacing the monolithic
 * handleExecuteAICommand in App.tsx. Each command type has a dedicated handler.
 */

import { ModelData } from '../App';
import { Layer } from '../types/layers';
import { Prefab } from '../types/prefabs';
import { EnvironmentPreset, DEFAULT_ENVIRONMENT } from '../types/environment';
import { CameraPreset, CameraPath } from '../types/camera';
import { AICommand, AICommandPayload } from './AICommandService';
import { CollisionZone, validatePlacementAgainstZones } from '../types/collision';

export interface CommandExecutorContext {
  models: ModelData[];
  selectedModelId: string | null;
  layers: Layer[];
  environment: EnvironmentPreset;
  cameraPresets: CameraPreset[];
  activeCameraPresetId: string | null;
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
  prefabs: Prefab[];
  collisionZones: CollisionZone[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  affectedModelIds?: string[];
  affectedLayerIds?: string[];
  requiredUIActions?: Array<{ action: string; payload?: any }>;
}

export interface CommandExecutorCallbacks {
  onModelsChange: (models: ModelData[]) => void;
  onLayersChange: (layers: Layer[]) => void;
  onEnvironmentChange: (env: EnvironmentPreset) => void;
  onCameraPresetsChange: (presets: CameraPreset[]) => void;
  onActiveCameraPresetChange: (id: string | null) => void;
  onCameraPathsChange: (paths: CameraPath[]) => void;
  onActiveCameraPathChange: (id: string | null) => void;
  onCollisionZonesChange: (zones: CollisionZone[]) => void;
  onOpenAssetBrowser: (mode: 'place' | 'replace', assetName?: string) => void;
  onOpenExportModal: () => void;
  onSelectModel: (id: string | null) => void;
  onTagFilterChange: (tag: string) => void;
}

export class CommandExecutor {
  constructor(
    private context: CommandExecutorContext,
    private callbacks: CommandExecutorCallbacks
  ) {}

  /**
   * Execute an AI command with proper error handling and context updates.
   */
  async execute(command: AICommand): Promise<CommandResult> {
    try {
      switch (command.type) {
        case 'place_asset':
          return this.handlePlaceAsset(command.payload);
        case 'update_transform':
          return this.handleUpdateTransform(command.payload);
        case 'replace_asset':
          return this.handleReplaceAsset(command.payload);
        case 'apply_material':
          return this.handleApplyMaterial(command.payload);
        case 'swap_texture':
          return this.handleSwapTexture(command.payload);
        case 'update_lighting':
          return this.handleUpdateLighting(command.payload);
        case 'update_camera':
          return this.handleUpdateCamera(command.payload);
        case 'place_along_path':
          return this.handlePlaceAlongPath(command.payload);
        case 'organize_layers':
          return this.handleOrganizeLayers(command.payload);
        case 'lock_hide':
          return this.handleLockHide(command.payload);
        case 'filter_by_tag':
          return this.handleFilterByTag(command.payload);
        case 'update_tags':
          return this.handleUpdateTags(command.payload);
        case 'explain':
          return this.handleExplain(command.payload);
        case 'suggest_optimization':
          return this.handleSuggestOptimization(command.payload);
        case 'prepare_export':
          return this.handlePrepareExport(command.payload);
        case 'validate_placement':
          return this.handleValidatePlacement(command.payload);
        case 'highlight_invalid_placements':
          return this.handleHighlightInvalidPlacements(command.payload);
        case 'place_in_zone':
          return this.handlePlaceInZone(command.payload);
        case 'list_zones':
          return this.handleListZones(command.payload);
        case 'create_zone':
          return this.handleCreateZone(command.payload);
        case 'unknown':
          return { success: false, message: `Unknown command: ${command.payload.reason || 'unspecified'}` };
        default:
          return { success: false, message: `Unhandled command type: ${(command as any).type}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Command execution failed: ${message}` };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command Handlers
  // ─────────────────────────────────────────────────────────────────────────

  private handlePlaceAsset(payload: any): CommandResult {
    const { assetName } = payload;
    if (!assetName) {
      return { success: false, message: 'Asset name is required' };
    }
    // Trigger asset browser to find and place the asset
    this.callbacks.onOpenAssetBrowser('place', assetName);
    return {
      success: true,
      message: `Opening asset browser to place "${assetName}"`,
      requiredUIActions: [{ action: 'focus_asset_browser' }]
    };
  }

  private handleUpdateTransform(payload: any): CommandResult {
    const { targetId, position, rotation, scale } = payload;
    if (!targetId) {
      return { success: false, message: 'Target model ID is required' };
    }

    const model = this.context.models.find(m => m.id === targetId);
    if (!model) {
      return { success: false, message: `Model ${targetId} not found` };
    }

    const updated = { ...model };
    if (position) updated.position = position;
    if (rotation) updated.rotation = rotation;
    if (scale) updated.scale = scale;

    const newModels = this.context.models.map(m => m.id === targetId ? updated : m);
    this.callbacks.onModelsChange(newModels);

    return {
      success: true,
      message: `Updated transform for "${model.name}"`,
      affectedModelIds: [targetId]
    };
  }

  private handleReplaceAsset(payload: any): CommandResult {
    const { targetId } = payload;
    if (!targetId) {
      return { success: false, message: 'Target model ID is required' };
    }

    const model = this.context.models.find(m => m.id === targetId);
    if (!model) {
      return { success: false, message: `Model ${targetId} not found` };
    }

    this.callbacks.onSelectModel(targetId);
    this.callbacks.onOpenAssetBrowser('replace');

    return {
      success: true,
      message: `Opened replacement browser for "${model.name}"`,
      affectedModelIds: [targetId],
      requiredUIActions: [{ action: 'focus_asset_browser' }]
    };
  }

  private handleApplyMaterial(payload: any): CommandResult {
    const { targetId, materialName } = payload;
    if (!targetId || !materialName) {
      return { success: false, message: 'Target ID and material name are required' };
    }

    const model = this.context.models.find(m => m.id === targetId);
    if (!model) {
      return { success: false, message: `Model ${targetId} not found` };
    }

    // TODO: Implement material application once material library is wired
    // For now, this is a placeholder
    return {
      success: false,
      message: `Material application not yet implemented (requested: "${materialName}" on "${model.name}")`
    };
  }

  private handleSwapTexture(payload: any): CommandResult {
    const { targetId, textureUrl } = payload;
    if (!targetId || !textureUrl) {
      return { success: false, message: 'Target ID and texture URL are required' };
    }

    const model = this.context.models.find(m => m.id === targetId);
    if (!model) {
      return { success: false, message: `Model ${targetId} not found` };
    }

    const updated = { ...model, textureUrl };
    const newModels = this.context.models.map(m => m.id === targetId ? updated : m);
    this.callbacks.onModelsChange(newModels);

    return {
      success: true,
      message: `Updated texture for "${model.name}"`,
      affectedModelIds: [targetId]
    };
  }

  private handleUpdateLighting(payload: any): CommandResult {
    const { presetName } = payload;
    if (!presetName) {
      return { success: false, message: 'Preset name is required' };
    }

    // TODO: Create a lighting preset system and map preset names to environments
    // For now, this is a placeholder
    return {
      success: false,
      message: `Lighting preset system not yet implemented (requested: "${presetName}")`
    };
  }

  private handleUpdateCamera(payload: any): CommandResult {
    const { presetName } = payload;
    if (!presetName) {
      return { success: false, message: 'Preset name is required' };
    }

    const preset = this.context.cameraPresets.find(p =>
      p.name.toLowerCase().includes(presetName.toLowerCase())
    );

    if (!preset) {
      return {
        success: false,
        message: `Camera preset "${presetName}" not found. Available: ${this.context.cameraPresets.map(p => p.name).join(', ')}`
      };
    }

    this.callbacks.onActiveCameraPresetChange(preset.id);
    return {
      success: true,
      message: `Switched to camera preset "${preset.name}"`,
      requiredUIActions: [{ action: 'apply_camera_preset', payload: { presetId: preset.id } }]
    };
  }

  private handlePlaceAlongPath(payload: any): CommandResult {
    const { assetName, pathId, count } = payload;
    if (!assetName || !pathId || !count) {
      return { success: false, message: 'Asset name, path ID, and count are required' };
    }

    const path = this.context.models.find(m => m.id === pathId);
    if (!path) {
      return {
        success: false,
        message: `Path with ID ${pathId} not found`
      };
    }

    // TODO: Implement path-based placement algorithm
    return {
      success: false,
      message: `Path-based placement not yet implemented (requested: ${count} "${assetName}" along path)`
    };
  }

  private handleOrganizeLayers(payload: any): CommandResult {
    const { targetIds, layerName } = payload;
    if (!targetIds || !Array.isArray(targetIds) || !layerName) {
      return { success: false, message: 'Target IDs and layer name are required' };
    }

    let layer = this.context.layers.find(l => l.name.toLowerCase() === layerName.toLowerCase());

    if (!layer) {
      // Create new layer
      layer = {
        id: `layer-${Date.now()}`,
        name: layerName,
        visible: true,
        locked: false,
        isCustom: true,
        order: this.context.layers.length,
        color: '#888888'
      };
      this.callbacks.onLayersChange([...this.context.layers, layer]);
    }

    // Move models to layer
    const newModels = this.context.models.map(m =>
      targetIds.includes(m.id) ? { ...m, layerId: layer!.id } : m
    );
    this.callbacks.onModelsChange(newModels);

    return {
      success: true,
      message: `Moved ${targetIds.length} model(s) to layer "${layerName}"`,
      affectedModelIds: targetIds,
      affectedLayerIds: [layer.id]
    };
  }

  private handleLockHide(payload: any): CommandResult {
    const { targetIds, action } = payload;
    if (!targetIds || !Array.isArray(targetIds) || !action) {
      return { success: false, message: 'Target IDs and action are required' };
    }

    if (!['lock', 'unlock', 'hide', 'show'].includes(action)) {
      return { success: false, message: `Invalid action: ${action}` };
    }

    const newModels = this.context.models.map(m => {
      if (targetIds.includes(m.id)) {
        if (action === 'lock') return { ...m, locked: true };
        if (action === 'unlock') return { ...m, locked: false };
        if (action === 'hide') return { ...m, visible: false };
        if (action === 'show') return { ...m, visible: true };
      }
      return m;
    });

    this.callbacks.onModelsChange(newModels);

    return {
      success: true,
      message: `Applied action "${action}" to ${targetIds.length} model(s)`,
      affectedModelIds: targetIds
    };
  }

  private handleFilterByTag(payload: any): CommandResult {
    const { tag } = payload;
    if (!tag) {
      return { success: false, message: 'Tag is required' };
    }

    this.callbacks.onTagFilterChange(tag);

    return {
      success: true,
      message: `Filtering scene by tag "${tag}"`,
      requiredUIActions: [{ action: 'apply_tag_filter', payload: { tag } }]
    };
  }

  private handleUpdateTags(payload: any): CommandResult {
    const { targetIds, tags, action } = payload;
    if (!targetIds || !Array.isArray(targetIds) || !tags || !Array.isArray(tags) || !action) {
      return { success: false, message: 'Target IDs, tags, and action are required' };
    }

    if (!['add', 'remove'].includes(action)) {
      return { success: false, message: `Invalid action: ${action}` };
    }

    const newModels = this.context.models.map(m => {
      if (targetIds.includes(m.id)) {
        let currentTags = m.behaviorTags || [];
        if (action === 'add') {
          currentTags = [...new Set([...currentTags, ...tags])];
        } else {
          currentTags = currentTags.filter(t => !tags.includes(t));
        }
        return { ...m, behaviorTags: currentTags };
      }
      return m;
    });

    this.callbacks.onModelsChange(newModels);

    return {
      success: true,
      message: `${action === 'add' ? 'Added' : 'Removed'} tags on ${targetIds.length} model(s)`,
      affectedModelIds: targetIds
    };
  }

  private handleExplain(payload: any): CommandResult {
    const { topic } = payload;
    if (!topic) {
      return { success: false, message: 'Topic is required' };
    }

    // This is handled by the AI service returning the explanation in the message
    return {
      success: true,
      message: `Explanation provided by AI (topic: "${topic}")`
    };
  }

  private handleSuggestOptimization(payload: any): CommandResult {
    const { targetId } = payload;

    // This is handled by the AI service returning suggestions in the message
    if (targetId) {
      const model = this.context.models.find(m => m.id === targetId);
      if (!model) {
        return { success: false, message: `Model ${targetId} not found` };
      }
    }

    return {
      success: true,
      message: `Optimization suggestions provided by AI`
    };
  }

  private handlePrepareExport(payload: any): CommandResult {
    this.callbacks.onOpenExportModal();

    return {
      success: true,
      message: 'Opened export dialog',
      requiredUIActions: [{ action: 'focus_export_modal' }]
    };
  }

  private handleValidatePlacement(payload: any): CommandResult {
    const { targetId } = payload;
    if (!targetId) {
      return { success: false, message: 'Target model ID is required' };
    }

    if (this.context.collisionZones.length === 0) {
      return {
        success: true,
        message: 'No collision zones defined. Placement is valid by default.'
      };
    }

    const model = this.context.models.find(m => m.id === targetId);
    if (!model) {
      return { success: false, message: `Model ${targetId} not found` };
    }

    const validation = validatePlacementAgainstZones(model, this.context.collisionZones);

    return {
      success: validation.isValid,
      message: validation.isValid
        ? `"${model.name}" placement is valid`
        : `"${model.name}" placement violates: ${validation.violations.join(', ')}`,
      affectedModelIds: [targetId]
    };
  }

  private handleHighlightInvalidPlacements(payload: any): CommandResult {
    if (this.context.collisionZones.length === 0) {
      return {
        success: true,
        message: 'No collision zones defined. No invalid placements to highlight.'
      };
    }

    const invalidModels: string[] = [];
    this.context.models.forEach(model => {
      const validation = validatePlacementAgainstZones(model, this.context.collisionZones);
      if (!validation.isValid) {
        invalidModels.push(model.id);
      }
    });

    if (invalidModels.length === 0) {
      return {
        success: true,
        message: 'All placements are valid.'
      };
    }

    // In a real app, this would select the invalid models for visual feedback
    return {
      success: true,
      message: `Found ${invalidModels.length} invalid placement(s)`,
      affectedModelIds: invalidModels,
      requiredUIActions: [{ action: 'highlight_models', payload: { modelIds: invalidModels } }]
    };
  }

  private handlePlaceInZone(payload: any): CommandResult {
    const { targetIds, zoneName } = payload;
    if (!targetIds || !Array.isArray(targetIds) || !zoneName) {
      return { success: false, message: 'Target IDs and zone name are required' };
    }

    const zone = this.context.collisionZones.find(z => z.name.toLowerCase() === zoneName.toLowerCase());
    if (!zone) {
      return {
        success: false,
        message: `Zone "${zoneName}" not found. Available zones: ${this.context.collisionZones.map(z => z.name).join(', ')}`
      };
    }

    // This is more of a user guidance command - the system will attempt to move objects
    // but the actual placement validation happens in the scene
    return {
      success: true,
      message: `Attempting to place ${targetIds.length} model(s) in zone "${zoneName}"`,
      affectedModelIds: targetIds,
      requiredUIActions: [{ action: 'attempt_zone_placement', payload: { targetIds, zoneId: zone.id } }]
    };
  }

  private handleListZones(payload: any): CommandResult {
    if (this.context.collisionZones.length === 0) {
      return {
        success: true,
        message: 'No collision zones defined in the scene.'
      };
    }

    const zoneDescriptions = this.context.collisionZones
      .map(z => `- ${z.name} (${z.type})${z.enabled ? '' : ' [disabled]'}`)
      .join('\n');

    return {
      success: true,
      message: `Collision zones in scene:\n${zoneDescriptions}`
    };
  }

  private handleCreateZone(payload: any): CommandResult {
    const { name, type } = payload;
    if (!name || !type) {
      return { success: false, message: 'Zone name and type are required' };
    }

    // This is handled by the CollisionZonePanel component
    // We're just acknowledging the request here
    return {
      success: true,
      message: `Zone creation requested: ${name} (${type})`,
      requiredUIActions: [{ action: 'focus_collision_zones', payload: { newZoneName: name, newZoneType: type } }]
    };
  }
}
