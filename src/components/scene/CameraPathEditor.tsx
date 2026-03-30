import React, { useMemo, useState } from 'react';
import { CameraPath } from '../../types/camera';
import { Sphere, Line, TransformControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraPathEditorProps {
  cameraPaths: CameraPath[];
  activeCameraPathId: string | null;
  onUpdateCameraPaths: (val: CameraPath[] | ((prev: CameraPath[]) => CameraPath[])) => void;
  onDraggingChanged: (isDragging: boolean) => void;
}

const CameraPathEditor: React.FC<CameraPathEditorProps> = ({ cameraPaths, activeCameraPathId, onUpdateCameraPaths, onDraggingChanged }) => {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

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

  const handlePointMove = (pointId: string, newPosition: [number, number, number]) => {
    onUpdateCameraPaths(prev => prev.map(path => {
      if (path.id !== activePath.id) return path;
      return {
        ...path,
        points: path.points.map(p => p.id === pointId ? { ...p, position: newPosition } : p)
      };
    }));
  };

  const handleTargetMove = (pointId: string, newTarget: [number, number, number]) => {
    onUpdateCameraPaths(prev => prev.map(path => {
      if (path.id !== activePath.id) return path;
      return {
        ...path,
        points: path.points.map(p => p.id === pointId ? { ...p, target: newTarget } : p)
      };
    }));
  };

  const handleTangentMove = (pointId: string, newTangent: [number, number, number]) => {
    onUpdateCameraPaths(prev => prev.map(path => {
      if (path.id !== activePath.id) return path;
      return {
        ...path,
        points: path.points.map(p => p.id === pointId ? { ...p, tangent: newTangent } : p)
      };
    }));
  };

  return (
    <group>
      {curve && <Line points={linePoints} color="#3b82f6" lineWidth={2} dashed dashSize={0.5} gapSize={0.2} />}
      {activePath.points.map((point, idx) => {
        const isPointSelected = selectedPointId === point.id;
        const isTargetSelected = selectedTargetId === point.id;

        return (
          <group key={point.id || idx}>
            {isPointSelected ? (
              <TransformControls
                mode="translate"
                onMouseDown={() => onDraggingChanged(true)}
                onMouseUp={(e: any) => {
                  onDraggingChanged(false);
                  if (e?.target?.object) {
                    const pos = e.target.object.position;
                    handlePointMove(point.id, [pos.x, pos.y, pos.z]);
                  }
                }}
              >
                <Sphere
                  position={new THREE.Vector3(...point.position)}
                  args={[0.2, 16, 16]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPointId(point.id);
                    setSelectedTargetId(null);
                  }}
                >
                  <meshBasicMaterial color="#60a5fa" transparent opacity={0.8} />
                </Sphere>
              </TransformControls>
            ) : (
              <Sphere
                position={new THREE.Vector3(...point.position)}
                args={[0.2, 16, 16]}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPointId(point.id);
                  setSelectedTargetId(null);
                }}
              >
                <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} />
              </Sphere>
            )}

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

            {isTargetSelected ? (
              <TransformControls
                mode="translate"
                onMouseDown={() => onDraggingChanged(true)}
                onMouseUp={(e: any) => {
                  onDraggingChanged(false);
                  if (e?.target?.object) {
                    const pos = e.target.object.position;
                    handleTargetMove(point.id, [pos.x, pos.y, pos.z]);
                  }
                }}
              >
                <Sphere
                  position={new THREE.Vector3(...point.target)}
                  args={[0.15, 16, 16]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTargetId(point.id);
                    setSelectedPointId(null);
                  }}
                >
                  <meshBasicMaterial color="#f87171" transparent opacity={0.8} />
                </Sphere>
              </TransformControls>
            ) : (
              <Sphere
                position={new THREE.Vector3(...point.target)}
                args={[0.15, 16, 16]}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTargetId(point.id);
                  setSelectedPointId(null);
                }}
              >
                <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
              </Sphere>
            )}

            {/* Tangent handle */}
            <TransformControls
              mode="translate"
              onMouseDown={() => onDraggingChanged(true)}
              onMouseUp={(e: any) => {
                onDraggingChanged(false);
                if (e?.target?.object) {
                  const pos = e.target.object.position;
                  const tangent = pos.clone().sub(new THREE.Vector3(...point.position));
                  handleTangentMove(point.id, [tangent.x, tangent.y, tangent.z]);
                }
              }}
            >
              <Sphere
                position={new THREE.Vector3(...point.position).add(new THREE.Vector3(...(point.tangent || [0, 0, 0])))}
                args={[0.1, 16, 16]}
              >
                <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
              </Sphere>
            </TransformControls>
          </group>
        );
      })}
    </group>
  );
};

export default CameraPathEditor;
