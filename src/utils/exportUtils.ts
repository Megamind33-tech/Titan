import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { ModelData } from '../App';
import { SceneSettings, CameraSettings } from './storageUtils';
import { Layer } from '../types/layers';

export interface ExportAssetManifest {
  id: string;
  name: string;
  type: string;
  layerId?: string;
  visible: boolean;
  locked: boolean;
  file?: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
  material: {
    wireframe: boolean;
    lightIntensity: number;
    castShadow: boolean;
    receiveShadow: boolean;
    texture?: string | null;
    presetId?: string;
    presetName?: string;
    color?: string;
    opacity?: number;
    roughness?: number;
    metalness?: number;
    emissiveColor?: string;
  };
  metadata?: Record<string, any>;
  parent?: string | null;
  version: number;
}

export interface SceneExportManifest {
  version: string;
  exportDate: string;
  scene: {
    lighting: {
      ambient: number;
      hemisphere: { intensity: number; color: string; groundColor: string };
      directional: { intensity: number; position: [number, number, number] };
      shadowSoftness: number;
      presetId?: string;
      presetName?: string;
      environmentPreset?: string;
      exposure?: number;
      toneMapping?: string;
    };
    gridReceiveShadow: boolean;
    camera?: CameraSettings;
    layers?: Layer[];
  };
  assets: ExportAssetManifest[];
  exportSensitiveModels?: string[];
}

export interface ExportOptions {
  selectedIds: string[];
  format: 'original' | 'glb' | 'obj';
  includeTextures: boolean;
  includeMaterials: boolean;
  cameraSettings?: CameraSettings;
  layers?: Layer[];
}

export const exportScene = async (
  models: ModelData[],
  sceneSettings: SceneSettings,
  threeScene: THREE.Scene | null,
  options: ExportOptions
): Promise<void> => {
  const zip = new JSZip();

  const manifest: SceneExportManifest = {
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    scene: {
      lighting: {
        ambient: sceneSettings.environment.ambientIntensity,
        hemisphere: {
          intensity: sceneSettings.environment.hemisphereIntensity,
          color: sceneSettings.environment.hemisphereColor,
          groundColor: sceneSettings.environment.hemisphereGroundColor
        },
        directional: {
          intensity: sceneSettings.environment.directionalIntensity,
          position: sceneSettings.environment.directionalPosition
        },
        shadowSoftness: sceneSettings.shadowSoftness,
        presetId: sceneSettings.environment.id,
        presetName: sceneSettings.environment.name,
        environmentPreset: sceneSettings.environment.environmentPreset,
        exposure: sceneSettings.environment.exposure,
        toneMapping: sceneSettings.environment.toneMapping
      },
      gridReceiveShadow: sceneSettings.gridReceiveShadow,
      camera: options.cameraSettings,
      layers: options.layers
    },
    assets: [] as any[]
  };

  const modelsFolder = zip.folder("models");
  const texturesFolder = zip.folder("textures");

  const modelsToExport = models.filter(m => options.selectedIds.includes(m.id));

  const exportSensitiveModels = modelsToExport.filter(m => (m.behaviorTags || []).includes('Export-Sensitive'));
  if (exportSensitiveModels.length > 0) {
    console.warn(`Exporting ${exportSensitiveModels.length} export-sensitive models. Special handling may be required.`);
    manifest.exportSensitiveModels = exportSensitiveModels.map(m => m.id);
  }

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

    if (options.format === 'original') {
      // Save original model file
      if (model.file && modelsFolder) {
        const extension = model.file.name.split('.').pop();
        const filename = `${model.id}_${model.name}`;
        modelsFolder.file(filename, model.file);
        modelFilePath = `models/${filename}`;
      }
    } else if (threeScene && modelsFolder) {
      // Find the object in the Three.js scene
      let targetObject: THREE.Object3D | undefined;
      threeScene.traverse((child) => {
        if (child.userData && child.userData.id === model.id) {
          targetObject = child;
        }
      });

      if (targetObject) {
        // Clone to apply export-specific material/texture settings without affecting the live scene
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

    manifest.assets.push({
      id: model.id,
      name: model.name,
      type: model.type || 'model',
      layerId: model.layerId,
      visible: model.visible,
      locked: model.locked,
      file: modelFilePath,
      transform: {
        position: model.position,
        rotation: model.rotation,
        scale: model.scale
      },
      material: {
        wireframe: model.wireframe,
        lightIntensity: model.lightIntensity,
        castShadow: model.castShadow,
        receiveShadow: model.receiveShadow,
        texture: textureFilePath || null,
        ...(model.material ? {
          presetId: model.material.id,
          presetName: model.material.name,
          color: model.material.color,
          opacity: model.material.opacity,
          roughness: model.material.roughness,
          metalness: model.material.metalness,
          emissiveColor: model.material.emissiveColor
        } : {
          color: model.colorTint,
          opacity: model.opacity,
          roughness: model.roughness,
          metalness: model.metalness,
          emissiveColor: model.emissiveColor
        })
      },
      metadata: {},  // TODO: Extend ModelData with metadata field if needed
      parent: null,
      version: 1
    });
  }

  zip.file("scene-manifest.json", JSON.stringify(manifest, null, 2));

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "scene-export.zip");
};
