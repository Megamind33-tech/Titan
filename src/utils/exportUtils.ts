import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { ModelData } from '../App';
import { SceneSettings, CameraSettings } from './storageUtils';
import { Layer } from '../types/layers';
import { Prefab } from '../types/prefabs';
import { Path } from '../types/paths';
import { CollisionZone } from '../types/collision';
import { TerrainData } from '../types/terrain';
import { CameraPreset, CameraPath } from '../types/camera';
import { QualitySettings } from '../types/quality';
import {
  preflightValidation,
  validateExportManifest,
  StrictExportAssetManifest,
  StrictSceneExportManifest,
  StrictMaterialProperties,
  StrictMaterialMaps,
  StrictMaterialUVTransform,
} from '../services/ExportManifestValidation';

/**
 * @deprecated Use StrictExportAssetManifest from ExportManifestValidation instead
 * Kept for backwards compatibility during migration
 */
export interface ExportAssetManifest extends StrictExportAssetManifest {
}

/**
 * @deprecated Use StrictSceneExportManifest from ExportManifestValidation instead
 * Kept for backwards compatibility during migration
 */
export interface SceneExportManifest extends StrictSceneExportManifest {
}

export interface ExportOptions {
  selectedIds: string[];
  format: 'original' | 'glb' | 'obj';
  includeTextures: boolean;
  includeMaterials: boolean;
  // Phase 2: Scene metadata
  cameraSettings?: CameraSettings;
  layers?: Layer[];
  // Phase 3: Extended content systems
  prefabs?: Prefab[];
  paths?: Path[];
  collisionZones?: CollisionZone[];
  terrain?: TerrainData;
  cameraPresets?: CameraPreset[];
  cameraPaths?: CameraPath[];
  qualitySettings?: QualitySettings;
}

/**
 * Export scene to ZIP file with strict manifest validation.
 *
 * VALIDATION FLOW:
 * 1. Preflight: Validates all selected models can be exported
 * 2. Build: Creates manifest structure with proper defaults
 * 3. Validate: Full manifest validation before export
 * 4. Export: Writes files and manifest to ZIP
 *
 * @throws If any validation fails, export is abandoned (no partial exports)
 */
export const exportScene = async (
  models: ModelData[],
  sceneSettings: SceneSettings,
  threeScene: THREE.Scene | null,
  options: ExportOptions
): Promise<void> => {
  try {
    // ─── PHASE 1: PREFLIGHT VALIDATION ───────────────────────────────────
    const modelsToExport = models.filter(m => options.selectedIds.includes(m.id));
    preflightValidation(modelsToExport);

    // ─── PHASE 2: BUILD MANIFEST ─────────────────────────────────────────
    const zip = new JSZip();
    const modelsFolder = zip.folder("models");
    const texturesFolder = zip.folder("textures");

    // Build assets array with proper material defaults
    const assets: StrictExportAssetManifest[] = [];

    for (const model of modelsToExport) {
      let modelFilePath = "";
      let textureFilePath = "";

      // Save texture file if included
      if (options.includeTextures && model.textureFile && texturesFolder) {
        const extension = model.textureFile.name.split('.').pop();
        const filename = `${model.id}_texture.${extension}`;
        texturesFolder.file(filename, model.textureFile);
        textureFilePath = `textures/${filename}`;
      }

      // Export geometry based on format
      if (options.format === 'original') {
        if (model.file && modelsFolder) {
          const extension = model.file.name.split('.').pop();
          const filename = `${model.id}_${model.name}`;
          modelsFolder.file(filename, model.file);
          modelFilePath = `models/${filename}`;
        }
      } else if (threeScene && modelsFolder) {
        let targetObject: THREE.Object3D | undefined;
        threeScene.traverse((child) => {
          if (child.userData && child.userData.id === model.id) {
            targetObject = child;
          }
        });

        if (targetObject) {
          const clone = targetObject.clone();
          clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (!options.includeMaterials) {
                if (Array.isArray(child.material)) {
                  child.material = child.material.map(() => new THREE.MeshBasicMaterial());
                } else {
                  child.material = new THREE.MeshBasicMaterial();
                }
              } else if (!options.includeTextures) {
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => { if (m.map) m.map = null; });
                } else {
                  if (child.material.map) child.material.map = null;
                }
              }
            }
          });

          if (options.format === 'glb') {
            const exporter = new GLTFExporter();
            const gltfData = await new Promise<any>((resolve, reject) => {
              exporter.parse(clone, resolve, reject, { binary: true });
            });
            const filename = `${model.id}_${model.name.split('.')[0]}.glb`;
            modelsFolder.file(filename, gltfData);
            modelFilePath = `models/${filename}`;
          } else if (options.format === 'obj') {
            const exporter = new OBJExporter();
            const objData = exporter.parse(clone);
            const filename = `${model.id}_${model.name.split('.')[0]}.obj`;
            modelsFolder.file(filename, objData);
            modelFilePath = `models/${filename}`;
          }
        }
      }

      // Build material properties with all required fields
      const material: StrictMaterialProperties = {
        wireframe: model.wireframe ?? false,
        lightIntensity: model.lightIntensity ?? 1,
        castShadow: model.castShadow ?? true,
        receiveShadow: model.receiveShadow ?? true,
        color: model.material?.color ?? model.colorTint ?? '#ffffff',
        opacity: model.material?.opacity ?? model.opacity ?? 1.0,
        roughness: model.material?.roughness ?? model.roughness ?? 0.5,
        metalness: model.material?.metalness ?? model.metalness ?? 0,
        emissiveColor: model.material?.emissiveColor ?? model.emissiveColor ?? '#000000',
        texture: textureFilePath || null,
        presetId: model.material?.id,
        presetName: model.material?.name,
      };

      // Phase 3: Build material texture maps (if available)
      const materialMaps: StrictMaterialMaps | undefined = (
        model.normalMapUrl || model.normalMapFile
      ) ? {
        normalMap: model.normalMapUrl || undefined,
      } : undefined;

      // Phase 3: Build UV transform (if available)
      const uvTransform = model.material ? {
        tiling: model.material.tiling || [1, 1],
        offset: model.material.offset || [0, 0],
        rotation: model.material.rotation || 0,
      } as StrictMaterialUVTransform : undefined;

      // Phase 3: Export behavior tags and classification
      const childrenOfModel = modelsToExport.filter(m => m.parentId === model.id);

      // Add asset to manifest
      assets.push({
        id: model.id,
        name: model.name,
        type: (model.type || 'model') as 'model' | 'environment' | 'light' | 'camera',
        layerId: model.layerId,
        visible: model.visible ?? true,
        locked: model.locked ?? false,
        file: modelFilePath || undefined,
        transform: {
          position: model.position,
          rotation: model.rotation,
          scale: model.scale,
        },
        material,
        materialMaps,
        uvTransform,
        behaviorTags: model.behaviorTags,
        classification: model.classification,
        metadata: {},
        parent: model.parentId || null,
        childrenIds: childrenOfModel.length > 0 ? childrenOfModel.map(m => m.id) : undefined,
        version: 2,
      });
    }

    // Identify export-sensitive models
    const exportSensitiveModelIds = modelsToExport
      .filter(m => (m.behaviorTags || []).includes('Export-Sensitive'))
      .map(m => m.id);

    // Phase 3: Build scene systems for export
    // Convert prefabs to export format if provided
    const exportPrefabs = options.prefabs?.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      modelIds: p.models.map(m => m.id),
      metadata: p.metadata,
    }));

    // Convert paths to export format if provided
    const exportPaths = options.paths?.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      closed: p.closed,
      width: p.width,
      points: p.points.map(pt => ({
        id: pt.id,
        position: pt.position,
      })),
      materialId: p.materialId,
    }));

    // Convert collision zones to export format if provided
    const exportZones = options.collisionZones?.map(z => ({
      id: z.id,
      name: z.name,
      type: z.type,
      enabled: z.enabled,
      position: z.position,
      rotation: z.rotation,
      scale: z.scale,
      shape: z.shape,
      allowedTags: z.allowedTags,
      blockedTags: z.blockedTags,
      color: z.color,
      exportToRuntime: z.exportToRuntime,
    }));

    // Export terrain if provided
    const exportTerrain = options.terrain;

    // Convert camera presets to export format if provided
    const exportCameraPresets = options.cameraPresets?.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      position: c.position,
      rotation: c.rotation,
      target: c.target,
      fov: c.fov,
      zoom: c.zoom,
      near: c.near,
      far: c.far,
    }));

    // Convert camera paths to export format if provided
    const exportCameraPaths = options.cameraPaths?.map(p => ({
      id: p.id,
      name: p.name,
      points: p.points,
      loop: p.loop,
      interpolation: p.interpolation,
    }));

    // Export quality settings if provided
    const exportQuality = options.qualitySettings;

    // Build complete manifest
    const manifest: StrictSceneExportManifest = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      scene: {
        lighting: {
          ambient: sceneSettings.environment.ambientIntensity,
          hemisphere: {
            intensity: sceneSettings.environment.hemisphereIntensity,
            color: sceneSettings.environment.hemisphereColor,
            groundColor: sceneSettings.environment.hemisphereGroundColor,
          },
          directional: {
            intensity: sceneSettings.environment.directionalIntensity,
            position: sceneSettings.environment.directionalPosition,
          },
          shadowSoftness: sceneSettings.shadowSoftness,
          presetId: sceneSettings.environment.id,
          presetName: sceneSettings.environment.name,
          environmentPreset: sceneSettings.environment.environmentPreset,
          exposure: sceneSettings.environment.exposure,
          toneMapping: sceneSettings.environment.toneMapping as 'None' | 'Linear' | 'Reinhard' | 'Cineon' | 'ACESFilmic',
        },
        gridReceiveShadow: sceneSettings.gridReceiveShadow,
        camera: options.cameraSettings,
        layers: options.layers,
      },
      assets,
      // Phase 3: Extended content systems
      prefabs: exportPrefabs,
      paths: exportPaths,
      collisionZones: exportZones,
      terrain: exportTerrain,
      cameraPresets: exportCameraPresets,
      cameraPaths: exportCameraPaths,
      qualitySettings: exportQuality,
      exportSensitiveModels: exportSensitiveModelIds.length > 0 ? exportSensitiveModelIds : undefined,
    };

    // ─── PHASE 3: VALIDATE MANIFEST ──────────────────────────────────────
    const validatedManifest = validateExportManifest(manifest);

    if (exportSensitiveModelIds.length > 0) {
      console.warn(
        `Exporting ${exportSensitiveModelIds.length} export-sensitive models. ` +
        `Special handling may be required by downstream consumer.`
      );
    }

    // ─── PHASE 4: WRITE TO ZIP ───────────────────────────────────────────
    zip.file("scene-manifest.json", JSON.stringify(validatedManifest, null, 2));
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "scene-export.zip");

  } catch (error) {
    // Export validation failed - abort completely, no partial export
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Export validation failed: ${message}`);
  }
};
