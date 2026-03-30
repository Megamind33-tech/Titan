import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { getGroundPlaneIntersection } from '../../hooks/useGroundPlanePlacement';

interface SceneDropHandlerProps {
  onDropAsset: (asset: any, position: [number, number, number]) => void;
  onDragOver?: (asset: any | null, position: [number, number, number] | null) => void;
}

export function SceneDropHandler({ onDropAsset, onDragOver }: SceneDropHandlerProps) {
  const { camera, raycaster, gl } = useThree();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      
      if (onDragOver) {
        const assetData = e.dataTransfer?.getData('application/json');
        if (!assetData) {
          onDragOver(null, null);
          return;
        }
        try {
          const asset = JSON.parse(assetData);
          const hit = getGroundPlaneIntersection(e, gl.domElement, camera, raycaster);
          onDragOver(asset, hit);
        } catch (err) {
          onDragOver(null, null);
        }
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();

      const assetData = e.dataTransfer?.getData('application/json');
      if (!assetData) return;

      try {
        const asset = JSON.parse(assetData);
        const hit = getGroundPlaneIntersection(e, gl.domElement, camera, raycaster);
        if (!hit) return;
        onDropAsset(asset, hit);
      } catch (err) {
        console.error('Failed to parse dropped asset', err);
      }
    };

    const canvas = gl.domElement;
    canvas.addEventListener('dragover', handleDragOver);
    canvas.addEventListener('drop', handleDrop);

    return () => {
      canvas.removeEventListener('dragover', handleDragOver);
      canvas.removeEventListener('drop', handleDrop);
    };
  }, [camera, raycaster, gl, onDropAsset]);

  return null;
}
