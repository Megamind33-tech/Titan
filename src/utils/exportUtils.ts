import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

export const exportScene = async (
  models: any[], 
  sceneSettings: any, 
  threeScene: THREE.Scene | null,
  options: { selectedIds: string[], format: 'original' | 'glb' | 'obj' | 'swim26-manifest', includeTextures: boolean, includeMaterials: boolean, cameraSettings?: any, layers?: any[] }
) => {
  const zip = new JSZip();
  
  const manifest: any = {
    version: "1.0.0",
    exportDate: new Date().toISOString(),
    scene: {
      lighting: {
        ambient: 0.3,
        hemisphere: { intensity: 0.6, color: "#ffffff", groundColor: "#2a2b2e" },
        directional: { intensity: 1.5, position: [50, 50, 25] },
        shadowSoftness: sceneSettings.shadowSoftness
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
    } else if (options.format === 'swim26-manifest') {
      // No binary export for manifest-only format
      modelFilePath = model.file ? `models/${model.id}_${model.name}` : "";
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
        texture: textureFilePath || null
      },
      metadata: model.metadata || {},
      parentId: model.parentId || null,
      childrenIds: model.childrenIds || [],
      version: 1
    });
  }

  zip.file("scene-manifest.json", JSON.stringify(manifest, null, 2));

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "scene-export.zip");
};
