import React, { useMemo } from 'react';
import { Path } from '../types/paths';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

interface PathEditorProps {
  path: Path;
  onUpdatePath: (path: Path) => void;
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
}

const PathEditor: React.FC<PathEditorProps> = ({ path, onUpdatePath, selectedPointId, onSelectPoint }) => {
  const points = useMemo(() => path.points.map(p => new THREE.Vector3(...p.position)), [path.points]);
  
  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.CatmullRomCurve3(points, path.closed);
  }, [points, path.closed]);

  const linePoints = useMemo(() => {
    if (!curve) return [];
    return curve.getPoints(50);
  }, [curve]);

  return (
    <group>
      {curve && <Line points={linePoints} color="yellow" lineWidth={2} />}
      {path.points.map((point) => (
        <Sphere
          key={point.id}
          position={new THREE.Vector3(...point.position)}
          args={[0.2, 16, 16]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPoint(point.id);
          }}
        >
          <meshBasicMaterial color={selectedPointId === point.id ? 'red' : 'blue'} />
        </Sphere>
      ))}
    </group>
  );
};

export default PathEditor;
