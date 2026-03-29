import * as THREE from 'three';
// @ts-ignore - GLTFLoader types may not be available in all setups
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export interface AssetAnalysis {
  boundingBox: { min: [number, number, number], max: [number, number, number] };
  dimensions: { width: number, height: number, depth: number };
  center: [number, number, number];
  materials: string[];
  meshes: string[];
  nodes: string[];
}

export async function analyzeAsset(url: string | File): Promise<AssetAnalysis> {
  const loader = new GLTFLoader();
  
  let loadUrl = '';
  if (typeof url === 'string') {
    loadUrl = url;
  } else {
    loadUrl = URL.createObjectURL(url);
  }

  return new Promise((resolve, reject) => {
    loader.load(
      loadUrl,
      (gltf: { scene: THREE.Group }) => {
        const scene = gltf.scene;
        const box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const materials = new Set<string>();
        const meshes: string[] = [];
        const nodes: string[] = [];

        scene.traverse((child) => {
          nodes.push(child.name || 'unnamed');
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            meshes.push(mesh.name || 'unnamed_mesh');
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => materials.add(m.name || 'unnamed_material'));
              } else {
                materials.add(mesh.material.name || 'unnamed_material');
              }
            }
          }
        });

        if (typeof url !== 'string') {
          URL.revokeObjectURL(loadUrl);
        }

        resolve({
          boundingBox: {
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z]
          },
          dimensions: {
            width: size.x,
            height: size.y,
            depth: size.z
          },
          center: [center.x, center.y, center.z],
          materials: Array.from(materials),
          meshes,
          nodes
        });
      },
      undefined,
      (error: ErrorEvent) => {
        if (typeof url !== 'string') {
          URL.revokeObjectURL(loadUrl);
        }
        reject(error);
      }
    );
  });
}
