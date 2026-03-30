import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CameraPath, CameraPreset } from '../../types/camera';

interface SceneCameraControllerProps {
  selectedModelId: string | null;
  models: Array<{ id: string; position: [number, number, number] }>;
  focusTrigger: number;
  isDragging: boolean;
  activeCameraPresetId: string | null;
  cameraPresets: CameraPreset[];
  activeCameraPathId: string | null;
  previewCameraPathId: string | null;
  cameraPaths: CameraPath[];
}

export function SceneCameraController({
  selectedModelId,
  models,
  focusTrigger,
  isDragging,
  activeCameraPresetId,
  cameraPresets,
  activeCameraPathId,
  previewCameraPathId,
  cameraPaths,
}: SceneCameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const focusTarget = useRef(new THREE.Vector3());

  const pathState = useRef({
    currentPointIndex: 0,
    elapsedTime: 0,
    isPaused: false,
    pauseStartTime: 0
  });

  const activePreset = useMemo(() =>
    cameraPresets.find(p => p.id === activeCameraPresetId),
  [activeCameraPresetId, cameraPresets]);

  const activePath = useMemo(() =>
    cameraPaths.find(p => p.id === previewCameraPathId),
  [previewCameraPathId, cameraPaths]);

  const lastPresetId = useRef<string | null>(null);

  useEffect(() => {
    if (activeCameraPresetId && activeCameraPresetId !== lastPresetId.current && activePreset && !activePath) {
      camera.position.set(...activePreset.position);
      if (controlsRef.current) {
        controlsRef.current.target.set(...activePreset.target);
      }
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = activePreset.fov;
        camera.near = activePreset.near;
        camera.far = activePreset.far;
        camera.updateProjectionMatrix();
      }
      lastPresetId.current = activeCameraPresetId;
    }
  }, [activeCameraPresetId, activePreset, activePath, camera]);

  useEffect(() => {
    if (selectedModelId && !activePath && focusTrigger > 0) {
      const model = models.find(m => m.id === selectedModelId);
      if (model) {
        focusTarget.current.set(model.position[0], model.position[1], model.position[2]);
        setIsFocusing(true);
      }
    }
  }, [focusTrigger]); // ONLY run when focusTrigger changes!

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // Always update controls if damping is enabled
    controlsRef.current.update();

    if (activePath && activePath.points.length > 1) {
      const { points, interpolation, loop } = activePath;
      const { currentPointIndex, isPaused, pauseStartTime } = pathState.current;

      const nextPointIndex = (currentPointIndex + 1) % points.length;
      const currentPoint = points[currentPointIndex];
      const nextPoint = points[nextPointIndex];

      if (isPaused) {
        if (state.clock.getElapsedTime() - pauseStartTime >= (currentPoint.pause || 0)) {
          pathState.current.isPaused = false;
          pathState.current.elapsedTime = 0;
        }
      } else {
        pathState.current.elapsedTime += delta;
        const progress = Math.min(pathState.current.elapsedTime / nextPoint.duration, 1);

        const startPos = new THREE.Vector3(...currentPoint.position);
        const endPos = new THREE.Vector3(...nextPoint.position);
        const startTarget = new THREE.Vector3(...currentPoint.target);
        const endTarget = new THREE.Vector3(...nextPoint.target);

        const t = interpolation === 'smooth' ? THREE.MathUtils.smoothstep(progress, 0, 1) : progress;

        camera.position.lerpVectors(startPos, endPos, t);
        controlsRef.current.target.lerpVectors(startTarget, endTarget, t);

        if (progress >= 1) {
          if (nextPointIndex !== 0 || loop) {
            pathState.current.currentPointIndex = nextPointIndex;
            if (nextPoint.pause) {
              pathState.current.isPaused = true;
              pathState.current.pauseStartTime = state.clock.getElapsedTime();
            } else {
              pathState.current.elapsedTime = 0;
            }
          }
        }
      }
    } else if (isFocusing) {
      controlsRef.current.target.lerp(focusTarget.current, delta * 10); // Increased focus speed
      if (controlsRef.current.target.distanceTo(focusTarget.current) < 0.01) {
        setIsFocusing(false);
      }
    }

    if (!activePath) {
      // Soft ground constraint instead of hard set
      if (camera.position.y < 0.1) camera.position.y = 0.1;
      if (controlsRef.current.target.y < 0) controlsRef.current.target.y = 0;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isDragging && !activePath}
      enableDamping={true}
      dampingFactor={0.1} // Increased damping for more responsiveness
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      panSpeed={0.8}
      enablePan={!activePreset?.indoorRestrictions}
      enableZoom
      enableRotate
      minPolarAngle={activePreset?.orbitLimits?.minPolar ?? 0}
      maxPolarAngle={activePreset?.orbitLimits?.maxPolar ?? Math.PI / 2 - 0.01}
      minDistance={activePreset?.orbitLimits?.minDistance ?? 0.1}
      maxDistance={activePreset?.orbitLimits?.maxDistance ?? 1000}
      minAzimuthAngle={activePreset?.orbitLimits?.minAzimuth ?? -Infinity}
      maxAzimuthAngle={activePreset?.orbitLimits?.maxAzimuth ?? Infinity}
      onStart={() => {
        // Cancel focusing if user starts manual interaction
        if (isFocusing) setIsFocusing(false);
      }}
    />
  );
}
