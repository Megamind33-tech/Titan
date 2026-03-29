import { PivotControls, TransformControls, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MaterialPreset } from '../../types/materials';

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
}

export function SceneModel({ id, name, url, position, rotation, scale, transformMode, snapEnabled, groundSnap, translationSnap, rotationSnap, scaleSnap, wireframe, lightIntensity, castShadow, receiveShadow, textureUrl, normalMapUrl, colorTint, opacity, roughness, metalness, emissiveColor, material, visible, locked, type, selectionFilter, isSelected, useCustomGizmo, onDimensionsChange, onPositionChange, onRotationChange, onScaleChange, onTransformEnd, onSelect, onDraggingChanged }: SceneModelProps) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  const prevDimensions = useRef<{ width: number; height: number; depth: number } | null>(null);

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
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = !!castShadow;
        child.receiveShadow = !!receiveShadow;

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
  }, [clonedScene, wireframe, lightIntensity, castShadow, receiveShadow, loadedTexture, loadedNormalMap, loadedRoughnessMap, loadedMetalnessMap, loadedEmissiveMap, loadedAlphaMap, colorTint, opacity, roughness, metalness, emissiveColor, isSelected, material]);

  useLayoutEffect(() => {
    if (!groupRef.current) return;

    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
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
  }, [clonedScene, id, scale]);

  useFrame((state) => {
    if (name.toLowerCase().includes('water')) {
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

  const getSnapValue = useCallback((snapType: 'translate' | 'rotate' | 'scale', value: number) => {
    if (!snapEnabled) return value;
    const snap = snapType === 'translate' ? translationSnap : snapType === 'rotate' ? rotationSnap : scaleSnap;
    if (!snap) return value;
    return Math.round(value / snap) * snap;
  }, [snapEnabled, translationSnap, rotationSnap, scaleSnap]);

  const content = (
    <primitive
      ref={groupRef}
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible !== false}
      userData={{ id }}
      onPointerDown={handlePointerDown}
    />
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
            transformMode === 'translate' || transformMode === 'scale',
            transformMode === 'translate' || transformMode === 'scale'
          ]}
          disableRotations={transformMode !== 'rotate'}
          disableScaling={transformMode !== 'scale'}
          disableAxes={transformMode === 'rotate'}
          onDragStart={() => onDraggingChanged(true)}
          onDragEnd={() => {
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
              const snappedY = groundSnap ? Math.max(0, getSnapValue('translate', newPosition.y)) : getSnapValue('translate', newPosition.y);
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
        size={1.5}
        translationSnap={snapEnabled ? translationSnap : null}
        rotationSnap={snapEnabled ? rotationSnap : null}
        scaleSnap={snapEnabled ? scaleSnap : null}
        onMouseDown={() => onDraggingChanged(true)}
        onMouseUp={() => {
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

              if (groundSnap && y < 0) y = 0;

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
