import { useThree } from '@react-three/fiber';
import { useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { getGroundPlaneIntersection } from '../../hooks/useGroundPlanePlacement';

interface PrefabPlacementHandlerProps {
  placementPrefabId: string | null;
  onPlacePrefabAtPosition: (position: [number, number, number]) => void;
}

export function PrefabPlacementHandler({
  placementPrefabId,
  onPlacePrefabAtPosition
}: PrefabPlacementHandlerProps) {
  const { camera, raycaster, gl } = useThree();

  const handleClick = useCallback((e: MouseEvent) => {
    if (!placementPrefabId) return;
    const hit = getGroundPlaneIntersection(e, gl.domElement, camera, raycaster);
    if (hit) onPlacePrefabAtPosition(hit);
  }, [camera, raycaster, gl, placementPrefabId, onPlacePrefabAtPosition]);

  useEffect(() => {
    if (placementPrefabId) {
      gl.domElement.addEventListener('click', handleClick);
      gl.domElement.style.cursor = 'crosshair';
      return () => {
        gl.domElement.removeEventListener('click', handleClick);
        gl.domElement.style.cursor = 'auto';
      };
    }
  }, [placementPrefabId, handleClick, gl]);

  return null;
}
