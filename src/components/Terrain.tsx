import React, { useMemo } from 'react';
import { TerrainData } from '../types/terrain';

interface TerrainProps {
  terrain: TerrainData;
}

const Terrain: React.FC<TerrainProps> = ({ terrain }) => {
  const geometry = useMemo(() => {
    // Basic plane geometry based on terrain size
    // In a real implementation, this would be a custom BufferGeometry
    // based on the heightMap.
    return [terrain.size, terrain.size, terrain.resolution, terrain.resolution];
  }, [terrain]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={geometry as [number, number, number, number]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

export default Terrain;
