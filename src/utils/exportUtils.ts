import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { ModelData } from '../App';
import { SceneSettings, CameraSettings } from './storageUtils';
import { Layer } from '../types/layers';
import {
  preflightValidation,
  validateExportManifest,
  StrictExportAssetManifest,
  StrictSceneExportManifest,
  StrictMaterialProperties,
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
  cameraSettings?: CameraSettings;
  layers?: Layer[];
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
        metadata: {},
        parent: model.parentId || null,
        version: 2,
      });
    }

    // Identify export-sensitive models
    const exportSensitiveModelIds = modelsToExport
      .filter(m => (m.behaviorTags || []).includes('Export-Sensitive'))
      .map(m => m.id);

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
