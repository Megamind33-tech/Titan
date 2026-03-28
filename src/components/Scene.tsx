import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Suspense, useLayoutEffect, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import LoadingScreen from './LoadingScreen';
import { useGLTF, TransformControls, PivotControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import ErrorBoundary from './ErrorBoundary';
import { ModelData } from '../App';
import { MaterialPreset } from '../types/materials';
import { EnvironmentPreset } from '../types/environment';
import { CameraPreset, CameraPath, CameraPathPoint } from '../types/camera';
import { Layer } from '../types/layers';
import { TerrainData } from '../types/terrain';
import { Path } from '../types/paths';
import Terrain from './Terrain';
import PathEditor from './PathEditor';

interface SceneProps {
  models: ModelData[];
  terrain: TerrainData;
  paths: Path[];
  selectedModelId: string | null;
  focusTrigger: number;
  transformMode: 'translate' | 'rotate' | 'scale';
  snapEnabled: boolean;
  groundSnap: boolean;
  translationSnap: number;
  rotationSnap: number;
  scaleSnap: number;
  onModelDimensionsChange: (id: string, dimensions: { width: number; height: number; depth: number }) => void;
  onModelPositionChange: (id: string, position: [number, number, number]) => void;
  onModelRotationChange: (id: string, rotation: [number, number, number]) => void;
  onModelScaleChange: (id: string, scale: [number, number, number]) => void;
  onTransformEnd: () => void;
  onSelect: (id: string | null) => void;
  onDropAsset: (asset: any, position: [number, number, number]) => void;
  gridReceiveShadow: boolean;
  shadowSoftness: number;
  tagFilter?: string;
  environment: EnvironmentPreset;
  onSceneReady?: (scene: THREE.Scene) => void;
  activeCameraPresetId: string | null;
  cameraPresets: CameraPreset[];
  activeCameraPathId: string | null;
  cameraPaths: CameraPath[];
  onCameraChange: (updates: Partial<CameraPreset>) => void;
  layers: Layer[];
  selectionFilter: string[];
  placementPrefabId: string | null;
  onPlacePrefabAtPosition: (position: [number, number, number]) => void;
}

function PrefabPlacementHandler({ 
  placementPrefabId, 
  onPlacePrefabAtPosition 
}: { 
  placementPrefabId: string | null, 
  onPlacePrefabAtPosition: (position: [number, number, number]) => void 
}) {
  const { camera, raycaster, gl } = useThree();

  const handleClick = useCallback((e: MouseEvent) => {
    if (!placementPrefabId) return;

    const rect = gl.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
      onPlacePrefabAtPosition([intersectionPoint.x, intersectionPoint.y, intersectionPoint.z]);
    }
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

function CameraController({ 
  selectedModelId, 
  models, 
  focusTrigger, 
  isDragging,
  activeCameraPresetId,
  cameraPresets,
  activeCameraPathId,
  cameraPaths,
  onCameraChange
}: { 
  selectedModelId: string | null, 
  models: any[], 
  focusTrigger: number, 
  isDragging: boolean,
  activeCameraPresetId: string | null,
  cameraPresets: CameraPreset[],
  activeCameraPathId: string | null,
  cameraPaths: CameraPath[],
  onCameraChange: (updates: Partial<CameraPreset>) => void
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const focusTarget = useRef(new THREE.Vector3());
  
  // Path animation state
  const pathState = useRef({
    currentPointIndex: 0,
    elapsedTime: 0,
    isPaused: false,
    pauseStartTime: 0
  });

  const activePreset = useMemo(() => 
    cameraPresets.find(p => p.id === activeCameraPresetId), 
    [activeCameraPresetId, cameraPresets]
  );

  const activePath = useMemo(() => 
    cameraPaths.find(p => p.id === activeCameraPathId), 
    [activeCameraPathId, cameraPaths]
  );

  // Apply preset settings
  useEffect(() => {
    if (activePreset && !activePath) {
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
    }
  }, [activeCameraPresetId, activePath]);

  useEffect(() => {
    if (selectedModelId && !activePath) {
      const model = models.find(m => m.id === selectedModelId);
      if (model) {
        focusTarget.current.set(model.position[0], model.position[1], model.position[2]);
        setIsFocusing(true);
      }
    }
  }, [selectedModelId, focusTrigger, activePath]);

  useFrame((state, delta) => {
    if (controlsRef.current) {
      // Handle Path Animation
      if (activePath && activePath.points.length > 1) {
        const { points, interpolation, loop } = activePath;
        const { currentPointIndex, elapsedTime, isPaused, pauseStartTime } = pathState.current;

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

          // Interpolate position and target
          const startPos = new THREE.Vector3(...currentPoint.position);
          const endPos = new THREE.Vector3(...nextPoint.position);
          const startTarget = new THREE.Vector3(...currentPoint.target);
          const endTarget = new THREE.Vector3(...nextPoint.target);

          const t = interpolation === 'smooth' ? THREE.MathUtils.smoothstep(progress, 0, 1) : progress;

          camera.position.lerpVectors(startPos, endPos, t);
          controlsRef.current.target.lerpVectors(startTarget, endTarget, t);

          if (progress >= 1) {
            if (nextPointIndex === 0 && !loop) {
              // End of path
            } else {
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
        controlsRef.current.target.lerp(focusTarget.current, delta * 5);
        if (controlsRef.current.target.distanceTo(focusTarget.current) < 0.01) {
          setIsFocusing(false);
        }
      }

      // Sync camera changes back to preset if it's the active one
      if (!activePath && activePreset) {
        // We could debounced sync here if needed, but for now let's just allow manual editing
      }

      // Enforce ground collision if not in a path
      if (!activePath) {
        if (camera.position.y < 0.1) {
          camera.position.y = 0.1;
        }
        if (controlsRef.current.target.y < 0) {
          controlsRef.current.target.y = 0;
        }
      }
      
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault 
      enabled={!isDragging && !activePath}
      enablePan={!activePreset?.indoorRestrictions} 
      enableZoom={true} 
      enableRotate={true} 
      minPolarAngle={activePreset?.orbitLimits?.minPolar ?? 0}
      maxPolarAngle={activePreset?.orbitLimits?.maxPolar ?? Math.PI / 2 - 0.01}
      minDistance={activePreset?.orbitLimits?.minDistance ?? 0.1}
      maxDistance={activePreset?.orbitLimits?.maxDistance ?? 1000}
      minAzimuthAngle={activePreset?.orbitLimits?.minAzimuth ?? -Infinity}
      maxAzimuthAngle={activePreset?.orbitLimits?.maxAzimuth ?? Infinity}
    />
  );
}

function DropHandler({ onDropAsset }: { onDropAsset: (asset: any, position: [number, number, number]) => void }) {
  const { camera, raycaster, gl } = useThree();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();

      const assetData = e.dataTransfer?.getData('application/json');
      if (!assetData) return;

      try {
        const asset = JSON.parse(assetData);
        
        // Calculate mouse position in NDC
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const mouse = new THREE.Vector2(x, y);
        raycaster.setFromCamera(mouse, camera);
        
        // Intersect with ground plane (y=0)
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

        onDropAsset(asset, [intersectionPoint.x, intersectionPoint.y, intersectionPoint.z]);
      } catch (err) {
        console.error("Failed to parse dropped asset", err);
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

export default function Scene({ 
  models, 
  selectedModelId, 
  focusTrigger, 
  transformMode, 
  snapEnabled, 
  groundSnap, 
  translationSnap, 
  rotationSnap, 
  scaleSnap, 
  onModelDimensionsChange, 
  onModelPositionChange, 
  onModelRotationChange, 
  onModelScaleChange, 
  onTransformEnd, 
  onSelect, 
  onDropAsset, 
  gridReceiveShadow, 
  shadowSoftness, 
  tagFilter,
  environment, 
  onSceneReady,
  activeCameraPresetId,
  cameraPresets,
  activeCameraPathId,
  cameraPaths,
  onCameraChange,
  layers,
  selectionFilter,
  placementPrefabId,
  onPlacePrefabAtPosition,
  terrain,
  paths
}: SceneProps) {
  const [isTransforming, setIsTransforming] = useState(false);
  const [useCustomGizmo, setUseCustomGizmo] = useState(false);

  const visibleModels = useMemo(() => {
    return models.filter(model => {
      const layer = layers.find(l => l.id === (model.layerId || 'env'));
      const isVisible = layer ? layer.visible : true;
      if (!isVisible) return false;
      if (tagFilter && (!model.behaviorTags || !model.behaviorTags.includes(tagFilter))) return false;
      return true;
    });
  }, [models, layers, tagFilter]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        <button
          onClick={() => setUseCustomGizmo(!useCustomGizmo)}
          className="bg-gray-900/80 backdrop-blur text-white p-2 px-4 rounded-md shadow-lg border border-gray-700 hover:bg-gray-800 flex items-center gap-2 transition-colors text-sm"
        >
          {useCustomGizmo ? '🛠️ Standard Gizmo' : '✨ Custom Gizmo'}
        </button>
      </div>
      <Canvas 
        shadows 
        camera={{ position: [50, 50, 50], fov: 45, near: 0.1, far: 2000 }}
        gl={{ 
          antialias: true, 
          preserveDrawingBuffer: true,
          toneMapping: environment.toneMapping === 'None' ? THREE.NoToneMapping : 
                       environment.toneMapping === 'Linear' ? THREE.LinearToneMapping :
                       environment.toneMapping === 'Reinhard' ? THREE.ReinhardToneMapping :
                       environment.toneMapping === 'Cineon' ? THREE.CineonToneMapping :
                       THREE.ACESFilmicToneMapping,
          toneMappingExposure: environment.exposure
        }}
        onCreated={({ scene }) => {
          if (onSceneReady) onSceneReady(scene);
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          {environment.fogEnabled && (
            <fog 
              attach="fog" 
              args={[environment.fogColor, environment.fogNear, environment.fogFar]} 
            />
          )}
          
          <ambientLight 
            intensity={environment.ambientIntensity} 
            color={environment.ambientColor} 
          />
          <hemisphereLight 
            intensity={environment.hemisphereIntensity} 
            color={environment.hemisphereColor} 
            groundColor={environment.hemisphereGroundColor} 
          />
          <directionalLight 
            position={environment.directionalPosition} 
            intensity={environment.directionalIntensity} 
            color={environment.directionalColor}
            castShadow={environment.castShadows}
            shadow-mapSize={[environment.shadowMapSize, environment.shadowMapSize]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
            shadow-camera-near={0.5}
            shadow-camera-far={500}
            shadow-bias={environment.shadowBias}
            shadow-normalBias={environment.shadowNormalBias}
          />
          
          <Environment 
            preset={environment.environmentPreset} 
            background={environment.backgroundType === 'preset'} 
            blur={0}
          />
          {terrain && <Terrain terrain={terrain} />}
          {(paths || []).map(path => (
            <PathEditor 
              key={path.id} 
              path={path} 
              onUpdatePath={() => {}} 
              selectedPointId={null} 
              onSelectPoint={() => {}} 
            />
          ))}

          {environment.backgroundType === 'color' && (
            <color attach="background" args={[environment.backgroundColor]} />
          )}

          {visibleModels.map((model) => {
            const layer = layers.find(l => l.id === (model.layerId || 'env'));
            const isLocked = model.locked || (layer ? layer.locked : false) || (model.behaviorTags || []).includes('Locked Layout Asset');

            return (
              <ErrorBoundary key={model.id}>
                <Model 
                  id={model.id}
                  name={model.name}
                  url={model.url} 
                  position={model.position} 
                  rotation={model.rotation}
                  scale={model.scale} 
                  transformMode={transformMode} 
                  snapEnabled={snapEnabled}
                  groundSnap={groundSnap}
                  translationSnap={translationSnap}
                  rotationSnap={rotationSnap}
                  scaleSnap={scaleSnap}
                  wireframe={model.wireframe}
                  lightIntensity={model.lightIntensity}
                  castShadow={model.castShadow}
                  receiveShadow={model.receiveShadow}
                  textureUrl={model.textureUrl}
                  normalMapUrl={model.normalMapUrl}
                  colorTint={model.colorTint}
                  opacity={model.opacity}
                  roughness={model.roughness}
                  metalness={model.metalness}
                  emissiveColor={model.emissiveColor}
                  material={model.material}
                  materialRemap={model.materialRemap}
                  visible={model.visible}
                  locked={isLocked}
                  type={model.type}
                  selectionFilter={selectionFilter}
                  isSelected={selectedModelId === model.id}
                  useCustomGizmo={useCustomGizmo}
                  onDimensionsChange={onModelDimensionsChange}
                  onPositionChange={onModelPositionChange}
                  onRotationChange={onModelRotationChange}
                  onScaleChange={onModelScaleChange}
                  onTransformEnd={onTransformEnd}
                  onSelect={onSelect}
                  onDraggingChanged={setIsTransforming}
                />
              </ErrorBoundary>
            );
          })}

          <ContactShadows 
            opacity={0.4} 
            scale={50} 
            blur={2.4} 
            far={10} 
            resolution={256} 
            color="#000000" 
          />

          <EffectComposer enableNormalPass={false}>
            <Bloom 
              luminanceThreshold={1.0} 
              mipmapBlur 
              intensity={0.5} 
              radius={0.4} 
            />
            <ToneMapping />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Suspense>
        <Grid 
          infiniteGrid 
          fadeDistance={100}
          sectionColor="#555555"
          cellColor="#333333"
          receiveShadow={gridReceiveShadow}
        />
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -0.01, 0]} 
          receiveShadow={gridReceiveShadow}
          onPointerDown={(e: any) => {
            if (e.target === e.object) {
              onSelect(null);
            }
          }}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshStandardMaterial color="#2a2b2e" depthWrite={true} />
        </mesh>
        <CameraController 
          selectedModelId={selectedModelId} 
          models={models} 
          focusTrigger={focusTrigger} 
          isDragging={isTransforming} 
          activeCameraPresetId={activeCameraPresetId}
          cameraPresets={cameraPresets}
          activeCameraPathId={activeCameraPathId}
          cameraPaths={cameraPaths}
          onCameraChange={onCameraChange}
        />
        <PrefabPlacementHandler 
          placementPrefabId={placementPrefabId}
          onPlacePrefabAtPosition={onPlacePrefabAtPosition}
        />
        <DropHandler onDropAsset={onDropAsset} />
      </Canvas>
    </div>
  );
}

function Model({ id, name, url, position, rotation, scale, transformMode, snapEnabled, groundSnap, translationSnap, rotationSnap, scaleSnap, wireframe, lightIntensity, castShadow, receiveShadow, textureUrl, normalMapUrl, colorTint, opacity, roughness, metalness, emissiveColor, material, materialRemap, visible, locked, type, selectionFilter, isSelected, useCustomGizmo, onDimensionsChange, onPositionChange, onRotationChange, onScaleChange, onTransformEnd, onSelect, onDraggingChanged }: { id: string; name: string; url: string; position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; transformMode: 'translate' | 'rotate' | 'scale'; snapEnabled?: boolean; groundSnap?: boolean; translationSnap?: number; rotationSnap?: number; scaleSnap?: number; wireframe?: boolean; lightIntensity?: number; castShadow?: boolean; receiveShadow?: boolean; textureUrl?: string; normalMapUrl?: string; colorTint?: string; opacity?: number; roughness?: number; metalness?: number; emissiveColor?: string; material?: MaterialPreset; materialRemap?: { [oldMat: string]: string }; visible?: boolean; locked?: boolean; type?: 'model' | 'environment' | 'light' | 'camera'; selectionFilter: string[]; isSelected: boolean; useCustomGizmo?: boolean; onDimensionsChange: (id: string, dimensions: { width: number; height: number; depth: number }) => void; onPositionChange: (id: string, position: [number, number, number]) => void; onRotationChange: (id: string, rotation: [number, number, number]) => void; onScaleChange: (id: string, scale: [number, number, number]) => void; onTransformEnd: () => void; onSelect: (id: string) => void; onDraggingChanged: (isDragging: boolean) => void; }) {
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

    const loadTex = (url: string | undefined, setter: (t: THREE.Texture | null) => void, isSRGB = false) => {
      if (url) {
        textureLoader.load(url, (tex) => {
          if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
          applyTextureSettings(tex, tiling, offset, rotation);
          setter(tex);
        });
      } else {
        setter(null);
      }
    };

    // Legacy support
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
            // Fallback to legacy props
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
    
    // Reset local transform to calculate true bounding box
    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.set(1, 1, 1);
    clonedScene.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // Normalize scale so the largest dimension is 1 unit
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const normalizationScale = 1 / maxDim;
      clonedScene.scale.set(normalizationScale, normalizationScale, normalizationScale);
    }
    
    // Re-calculate box after normalization to center correctly
    const normalizedBox = new THREE.Box3().setFromObject(clonedScene);
    
    // Shift the scene up so its lowest point is at local Y=0
    if (Math.abs(normalizedBox.min.y) > 0.001) {
      clonedScene.position.y = -normalizedBox.min.y;
    }

    // Calculate final dimensions for the inspector
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

  const getSnapValue = useCallback((type: 'translate' | 'rotate' | 'scale', value: number) => {
    if (!snapEnabled) return value;
    const snap = type === 'translate' ? translationSnap : type === 'rotate' ? rotationSnap : scaleSnap;
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
          fixed={true}
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
            const position = new THREE.Vector3();
            const rotation = new THREE.Quaternion();
            const scale = new THREE.Vector3();
            l.decompose(position, rotation, scale);

            const euler = new THREE.Euler().setFromQuaternion(rotation);

            if (transformMode === 'translate') {
              const snappedX = getSnapValue('translate', position.x);
              const snappedY = groundSnap ? Math.max(0, getSnapValue('translate', position.y)) : getSnapValue('translate', position.y);
              const snappedZ = getSnapValue('translate', position.z);
              onPositionChange(id, [snappedX, snappedY, snappedZ]);
            } else if (transformMode === 'rotate') {
              onRotationChange(id, [
                getSnapValue('rotate', euler.x),
                getSnapValue('rotate', euler.y),
                getSnapValue('rotate', euler.z)
              ]);
            } else if (transformMode === 'scale') {
              onScaleChange(id, [
                getSnapValue('scale', scale.x),
                getSnapValue('scale', scale.y),
                getSnapValue('scale', scale.z)
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
