import React, { useMemo } from 'react';
import { CameraPath } from '../../types/camera';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

interface CameraPathVisualizerProps {
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
}

const CameraPathVisualizer: React.FC<CameraPathVisualizerProps> = ({ cameraPaths, activeCameraPathId }) => {
  const activePath = useMemo(() => cameraPaths.find(p => p.id === activeCameraPathId), [cameraPaths, activeCameraPathId]);

  const curve = useMemo(() => {
    if (!activePath || activePath.points.length < 2) return null;
    const points = activePath.points.map(p => new THREE.Vector3(...p.position));
    return new THREE.CatmullRomCurve3(points, activePath.loop);
  }, [activePath]);

  const linePoints = useMemo(() => {
    if (!curve) return [];
    return curve.getPoints(50);
  }, [curve]);

  if (!activePath) return null;

  return (
    <group>
      {curve && <Line points={linePoints} color="#3b82f6" lineWidth={2} dashed dashSize={0.5} gapSize={0.2} />}
      {activePath.points.map((point, idx) => (
        <group key={point.id || idx}>
          <Sphere
            position={new THREE.Vector3(...point.position)}
            args={[0.2, 16, 16]}
          >
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
          </Sphere>
          {/* Line pointing to target */}
          <Line 
            points={[
              new THREE.Vector3(...point.position),
              new THREE.Vector3(...point.target)
            ]} 
            color="#ef4444" 
            lineWidth={1} 
            transparent 
            opacity={0.5} 
          />
          <Sphere
            position={new THREE.Vector3(...point.target)}
            args={[0.1, 8, 8]}
          >
            <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
          </Sphere>
        </group>
      ))}
    </group>
  );
};

export default CameraPathVisualizer;
