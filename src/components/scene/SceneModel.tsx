import { PivotControls, TransformControls, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MaterialPreset } from '../../types/materials';
import { useGesture } from '@use-gesture/react';
import { useThree } from '@react-three/fiber';

const FALLBACK_GLTF = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb';

export interface SceneModelProps {
  id: string;
  name: string;
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  transformMode: 'translate' | 'rotate' | 'scale';
  snapEnabled?: boolean;
  groundSnap?: boolean;
  translationSnap?: number;
  rotationSnap?: number;
  scaleSnap?: number;
  wireframe?: boolean;
  lightIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureUrl?: string;
  normalMapUrl?: string;
  colorTint?: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissiveColor?: string;
  material?: MaterialPreset;
  materialRemap?: { [oldMat: string]: string };
  visible?: boolean;
  locked?: boolean;
  behaviorTags?: string[];
  type?: 'model' | 'environment' | 'light' | 'camera';
  selectionFilter: string[];
  isSelected: boolean;
  useCustomGizmo?: boolean;
  onDimensionsChange: (id: string, dimensions: { width: number; height: number; depth: number }) => void;
  onPositionChange: (id: string, position: [number, number, number]) => void;
  onRotationChange: (id: string, rotation: [number, number, number]) => void;
  onScaleChange: (id: string, scale: [number, number, number]) => void;
  onTransformEnd: () => void;
  onSelect: (id: string) => void;
  onDraggingChanged: (isDragging: boolean) => void;
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  children?: React.ReactNode;
}

export function SceneModel({ id, name, url, position, rotation, scale, transformMode, snapEnabled, groundSnap, translationSnap, rotationSnap, scaleSnap, wireframe, lightIntensity, castShadow, receiveShadow, textureUrl, normalMapUrl, colorTint, opacity, roughness, metalness, emissiveColor, material, visible, locked, behaviorTags = [], type, selectionFilter, isSelected, useCustomGizmo, onDimensionsChange, onPositionChange, onRotationChange, onScaleChange, onTransformEnd, onSelect, onDraggingChanged, onTransformModeChange, children }: SceneModelProps) {
  const { scene } = useGLTF(url || FALLBACK_GLTF);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  const prevDimensions = useRef<{ width: number; height: number; depth: number } | null>(null);

  const { camera, size, raycaster } = useThree();
  const [dragPlane] = useState(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragPlaneOffset = useRef(new THREE.Vector3());

  const getSnapValue = useCallback((snapType: 'translate' | 'rotate' | 'scale', value: number) => {
    if (!snapEnabled) return value;
    const snap = snapType === 'translate' ? translationSnap : snapType === 'rotate' ? rotationSnap : scaleSnap;
    if (!snap) return value;
    return Math.round(value / snap) * snap;
  }, [snapEnabled, translationSnap, rotationSnap, scaleSnap]);

  const bind = useGesture({
    onDragStart: ({ event }) => {
      if (locked || !isSelected) return;
      const e = event as unknown as any; // R3F event
      if (transformMode === 'translate') {
        setIsDragging(true);
        onDraggingChanged(true);
        e.stopPropagation();

        if (e.ray) {
          const pt = new THREE.Vector3();
          e.ray.intersectPlane(dragPlane, pt);
          dragPlaneOffset.current.copy(new THREE.Vector3(...position)).sub(pt);
        }
      }
    },
    onDrag: ({ pinching, dragging, event }) => {
      if (pinching || !isSelected || locked) return;
      const e = event as unknown as any;

      if (transformMode === 'translate' && isDragging) {
        e.stopPropagation();
        if (e.ray) {
          const pt = new THREE.Vector3();
          if (e.ray.intersectPlane(dragPlane, pt)) {
            const finalPos = pt.add(dragPlaneOffset.current);
            const snappedX = getSnapValue('translate', finalPos.x);
            let snappedY = (groundSnap || behaviorTags.includes('Grounded')) ? Math.max(0, getSnapValue('translate', finalPos.y)) : getSnapValue('translate', finalPos.y);
            const snappedZ = getSnapValue('translate', finalPos.z);
            onPositionChange(id, [snappedX, snappedY, snappedZ]);
          }
        }
        return;
      }
      
      if (transformMode !== 'translate' && transformMode !== 'scale' && transformMode !== 'rotate') onTransformModeChange('translate');
    },
    onDragEnd: () => {
      if (isDragging) {
        setIsDragging(false);
        onDraggingChanged(false);
        onTransformEnd();
      }
    },
    onPinch: ({ pinching, dragging, offset: [d, a], memo }) => {
      if (dragging || !isSelected || locked) return;
      
      if (!memo) {
        memo = { d: d, a: a };
      }
      
      const deltaD = Math.abs(d - memo.d);
      const deltaA = Math.abs(a - memo.a);
      
      if (deltaD > deltaA) {
        if (transformMode !== 'scale') onTransformModeChange('scale');
      } else {
        if (transformMode !== 'rotate') onTransformModeChange('rotate');
      }
      
      return memo;
    }
  }, { drag: { filterTaps: true } });

  const handlePointerDown = (e: any) => {
    if (locked) return;
    if (!selectionFilter.includes(type || 'model')) return;
    e.stopPropagation();
    onSelect(id);
  };

  useEffect(() => {
    onDimensionsChangeRef.current = onDimensionsChange;
  }, [onDimensionsChange]);

  const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(null);
  const [loadedNormalMap, setLoadedNormalMap] = useState<THREE.Texture | null>(null);
  const [loadedRoughnessMap, setLoadedRoughnessMap] = useState<THREE.Texture | null>(null);
  const [loadedMetalnessMap, setLoadedMetalnessMap] = useState<THREE.Texture | null>(null);
  const [loadedEmissiveMap, setLoadedEmissiveMap] = useState<THREE.Texture | null>(null);
  const [loadedAlphaMap, setLoadedAlphaMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();

    const applyTextureSettings = (tex: THREE.Texture, tiling: [number, number], offset: [number, number], rotation: number) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(tiling[0], tiling[1]);
      tex.offset.set(offset[0], offset[1]);
      tex.rotation = rotation;
    };

    const tiling = material?.tiling || [1, 1];
    const offset = material?.offset || [0, 0];
    const rotation = material?.rotation || 0;

    const loadTex = (inputUrl: string | undefined, setter: (t: THREE.Texture | null) => void, isSRGB = false) => {
      if (inputUrl) {
        textureLoader.load(inputUrl, (tex) => {
          if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
          applyTextureSettings(tex, tiling, offset, rotation);
          setter(tex);
        });
      } else {
        setter(null);
      }
    };

    if (!material) {
      loadTex(textureUrl, setLoadedTexture, true);
      loadTex(normalMapUrl, setLoadedNormalMap);
    } else {
      loadTex(material.mapUrl, setLoadedTexture, true);
      loadTex(material.normalMapUrl, setLoadedNormalMap);
      loadTex(material.roughnessMapUrl, setLoadedRoughnessMap);
      loadTex(material.metalnessMapUrl, setLoadedMetalnessMap);
      loadTex(material.emissiveMapUrl, setLoadedEmissiveMap);
      loadTex(material.alphaMapUrl, setLoadedAlphaMap);
    }
  }, [textureUrl, normalMapUrl, material]);

  useEffect(() => {
    const castShadowEffective = behaviorTags.includes('Decorative') ? false : castShadow;
    const receiveShadowEffective = behaviorTags.includes('Decorative') ? false : receiveShadow;

    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = !!castShadowEffective;
        child.receiveShadow = !!receiveShadowEffective;

        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.wireframe = !!wireframe;

          if (material) {
            mat.color.set(material.color);
            mat.opacity = material.opacity;
            mat.transparent = material.transparent;
            mat.roughness = material.roughness;
            mat.metalness = material.metalness;
            mat.emissive.set(material.emissiveColor);
            mat.emissiveIntensity = material.emissiveIntensity + (isSelected ? 0.5 : 0);

            mat.map = loadedTexture;
            mat.normalMap = loadedNormalMap;
            mat.roughnessMap = loadedRoughnessMap;
            mat.metalnessMap = loadedMetalnessMap;
            mat.emissiveMap = loadedEmissiveMap;
            mat.alphaMap = loadedAlphaMap;

            mat.side = material.side === 'double' ? THREE.DoubleSide : material.side === 'back' ? THREE.BackSide : THREE.FrontSide;
          } else {
            if (colorTint) mat.color.set(colorTint);
            if (opacity !== undefined) {
              mat.transparent = opacity < 1;
              mat.opacity = opacity;
            }
            if (roughness !== undefined) mat.roughness = roughness;
            if (metalness !== undefined) mat.metalness = metalness;
            if (emissiveColor) {
              mat.emissive.set(emissiveColor);
            } else {
              mat.emissive.set(isSelected ? 0x4ade80 : 0x000000);
            }
            mat.emissiveIntensity = isSelected ? 0.5 : (lightIntensity || 0);

            mat.map = loadedTexture;
            mat.normalMap = loadedNormalMap;
          }

          mat.needsUpdate = true;
        }
      }
    });
  }, [clonedScene, wireframe, lightIntensity, castShadow, receiveShadow, loadedTexture, loadedNormalMap, loadedRoughnessMap, loadedMetalnessMap, loadedEmissiveMap, loadedAlphaMap, colorTint, opacity, roughness, metalness, emissiveColor, isSelected, material, behaviorTags]);

  useLayoutEffect(() => {
    if (!groupRef.current || isDragging) return;

    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const isEnvironment = type === 'environment' || behaviorTags.includes('Environment') || behaviorTags.includes('Structural');
    
    if (maxDim > 0 && !isEnvironment) {
      const normalizationScale = 1 / maxDim;
      clonedScene.scale.set(normalizationScale, normalizationScale, normalizationScale);
    }

    const normalizedBox = new THREE.Box3().setFromObject(clonedScene);
    if (Math.abs(normalizedBox.min.y) > 0.001) {
      clonedScene.position.y = -normalizedBox.min.y;
    }

    const finalSize = new THREE.Vector3();
    normalizedBox.getSize(finalSize);

    const newDimensions = {
      width: finalSize.x * scale[0],
      height: finalSize.y * scale[1],
      depth: finalSize.z * scale[2]
    };

    if (!prevDimensions.current ||
      Math.abs(prevDimensions.current.width - newDimensions.width) > 0.001 ||
      Math.abs(prevDimensions.current.height - newDimensions.height) > 0.001 ||
      Math.abs(prevDimensions.current.depth - newDimensions.depth) > 0.001) {
      prevDimensions.current = newDimensions;
      onDimensionsChangeRef.current(id, newDimensions);
    }
  }, [clonedScene, id, scale, isDragging]);

  useFrame((state) => {
    if (name.toLowerCase().includes('water') || behaviorTags.includes('Water-Related')) {
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (child.material.map) {
            child.material.map.offset.x = state.clock.getElapsedTime() * 0.05;
            child.material.map.offset.y = state.clock.getElapsedTime() * 0.05;
          }
        }
      });
    }
  });

  // getSnapValue was moved up

  const content = (
    <primitive
      {...bind()}
      ref={groupRef}
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible !== false}
      userData={{ id }}
      onPointerDown={(e: any) => {
        if (bind().onPointerDown) bind().onPointerDown(e);
        handlePointerDown(e);
      }}
    >
      {children}
    </primitive>
  );

  if (isSelected && !locked) {
    if (useCustomGizmo) {
      return (
        <PivotControls
          anchor={[0, 0, 0]}
          depthTest={false}
          fixed
          scale={100}
          activeAxes={[
            transformMode === 'translate' || transformMode === 'scale',
            (transformMode === 'translate' && !behaviorTags.includes('Grounded')) || transformMode === 'scale',
            transformMode === 'translate' || transformMode === 'scale'
          ]}
          disableRotations={transformMode !== 'rotate'}
          disableScaling={transformMode !== 'scale'}
          disableAxes={transformMode === 'rotate'}
          onDragStart={() => {
            setIsDragging(true);
            onDraggingChanged(true);
          }}
          onDragEnd={() => {
            setIsDragging(false);
            onDraggingChanged(false);
            onTransformEnd();
          }}
          onDrag={(l) => {
            const newPosition = new THREE.Vector3();
            const newRotation = new THREE.Quaternion();
            const newScale = new THREE.Vector3();
            l.decompose(newPosition, newRotation, newScale);

            const euler = new THREE.Euler().setFromQuaternion(newRotation);

            if (transformMode === 'translate') {
              const snappedX = getSnapValue('translate', newPosition.x);
              let snappedY = (groundSnap || behaviorTags.includes('Grounded')) ? Math.max(0, getSnapValue('translate', newPosition.y)) : getSnapValue('translate', newPosition.y);
              
              // Force Y to 0 if Grounded and not dragging? 
              // Actually, Grounded usually means it should stay on the ground.
              if (behaviorTags.includes('Grounded') && !isDragging) {
                snappedY = 0;
              }

              const snappedZ = getSnapValue('translate', newPosition.z);
              onPositionChange(id, [snappedX, snappedY, snappedZ]);
            } else if (transformMode === 'rotate') {
              onRotationChange(id, [
                getSnapValue('rotate', euler.x),
                getSnapValue('rotate', euler.y),
                getSnapValue('rotate', euler.z)
              ]);
            } else if (transformMode === 'scale') {
              onScaleChange(id, [
                getSnapValue('scale', newScale.x),
                getSnapValue('scale', newScale.y),
                getSnapValue('scale', newScale.z)
              ]);
            }
          }}
        >
          {content}
        </PivotControls>
      );
    }

    return (
      <TransformControls
        mode={transformMode}
        size={0.8}
        translationSnap={snapEnabled ? translationSnap : null}
        rotationSnap={snapEnabled ? rotationSnap : null}
        scaleSnap={snapEnabled ? scaleSnap : null}
        showY={!(transformMode === 'translate' && behaviorTags.includes('Grounded'))}
        onMouseDown={() => {
          setIsDragging(true);
          onDraggingChanged(true);
        }}
        onMouseUp={() => {
          setIsDragging(false);
          onDraggingChanged(false);
          onTransformEnd();
        }}
        onObjectChange={(e) => {
          if (!e) return;
          const target = e.target as any;
          if (target.object) {
            if (transformMode === 'translate') {
              const x = getSnapValue('translate', target.object.position.x);
              let y = getSnapValue('translate', target.object.position.y);
              const z = getSnapValue('translate', target.object.position.z);

              if ((groundSnap || behaviorTags.includes('Grounded')) && y < 0) y = 0;
              if (behaviorTags.includes('Grounded') && !isDragging) y = 0;

              target.object.position.set(x, y, z);
              onPositionChange(id, [x, y, z]);
            } else if (transformMode === 'rotate') {
              const rx = getSnapValue('rotate', target.object.rotation.x);
              const ry = getSnapValue('rotate', target.object.rotation.y);
              const rz = getSnapValue('rotate', target.object.rotation.z);

              target.object.rotation.set(rx, ry, rz);
              onRotationChange(id, [rx, ry, rz]);
            } else if (transformMode === 'scale') {
              const sx = getSnapValue('scale', target.object.scale.x);
              const sy = getSnapValue('scale', target.object.scale.y);
              const sz = getSnapValue('scale', target.object.scale.z);

              target.object.scale.set(sx, sy, sz);
              onScaleChange(id, [sx, sy, sz]);
            }
          }
        }}
      >
        {content}
      </TransformControls>
    );
  }

  return content;
}
