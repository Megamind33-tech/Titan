import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, SoftShadows, Sky, MeshReflectorMaterial, useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import LoadingScreen from './LoadingScreen';
import { EffectComposer, Bloom, Vignette, ToneMapping, SSAO } from '@react-three/postprocessing';
import ErrorBoundary from './ErrorBoundary';
import { ModelData } from '../App';
import { EnvironmentPreset } from '../types/environment';
import { CameraPreset, CameraPath } from '../types/camera';
import { Layer } from '../types/layers';
import { TerrainData } from '../types/terrain';
import { Path } from '../types/paths';
import { QualitySettings } from '../types/quality';
import { DEFAULT_PROFILES } from '../constants/qualityProfiles';
import Terrain from './Terrain';
import PathEditor from './PathEditor';
import CameraPathEditor from './scene/CameraPathEditor';
import { SceneModel } from './scene/SceneModel';
import { SceneCameraController } from './scene/SceneCameraController';
import { PrefabPlacementHandler } from './scene/PrefabPlacementHandler';
import { SceneDropHandler } from './scene/SceneDropHandler';

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
  onSceneReady?: (scene: THREE.Scene, camera: THREE.Camera) => void;
  activeCameraPresetId: string | null;
  cameraPresets: CameraPreset[];
  activeCameraPathId: string | null;
  previewCameraPathId: string | null;
  cameraPaths: CameraPath[];
  onUpdateCameraPaths: (val: CameraPath[] | ((prev: CameraPath[]) => CameraPath[])) => void;
  layers: Layer[];
  selectionFilter: string[];
  placementPrefabId: string | null;
  onPlacePrefabAtPosition: (position: [number, number, number]) => void;
  onTransformModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  activeProfileId: string;
  customProfile: QualitySettings;
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
  previewCameraPathId,
  cameraPaths,
  onUpdateCameraPaths,
  layers,
  selectionFilter,
  placementPrefabId,
  onPlacePrefabAtPosition,
  onTransformModeChange,
  terrain,
  paths,
  activeProfileId,
  customProfile
}: SceneProps) {
  const [isTransforming, setIsTransforming] = useState(false);
  const [useCustomGizmo, setUseCustomGizmo] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<any | null>(null);
  const [previewPosition, setPreviewPosition] = useState<[number, number, number] | null>(null);
  const [previewRotation, setPreviewRotation] = useState<[number, number, number]>([0, 0, 0]);

  const quality = useMemo(() => {
    if (activeProfileId === 'custom') return customProfile;
    return DEFAULT_PROFILES.find(p => p.id === activeProfileId)?.settings || DEFAULT_PROFILES[2].settings;
  }, [activeProfileId, customProfile]);

  useEffect(() => {
    if (!previewAsset) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r') {
        setPreviewRotation(prev => [prev[0], prev[1] + Math.PI / 4, prev[2]]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewAsset]);

  const cameraConfig = useMemo(() => ({ 
    position: [50, 50, 50] as [number, number, number], 
    fov: 45, 
    near: 0.1, 
    far: quality.drawDistance 
  }), [quality.drawDistance]);

  const glConfig = useMemo(() => ({
    antialias: quality.antiAliasing,
    preserveDrawingBuffer: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: environment.exposure,
    powerPreference: "high-performance" as const,
  }), [environment.exposure, quality.antiAliasing]);

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
        shadows={quality.shadowQuality !== 'none'}
        camera={cameraConfig}
        gl={glConfig}
        dpr={quality.textureQuality === 'high' ? [1, 2] : [1, 1.5]}
        onCreated={({ scene, camera }) => {
          if (onSceneReady) onSceneReady(scene, camera);
        }}
      >
        {quality.shadowQuality === 'high' && environment.softShadowsEnabled && <SoftShadows size={shadowSoftness * 10} samples={16} focus={0} />}
        <Suspense fallback={<LoadingScreen />}>
          {quality.fogEnabled && environment.fogEnabled && (
            <fog
              attach="fog"
              args={[environment.fogColor, environment.fogNear, quality.drawDistance]}
            />
          )}

          <ambientLight intensity={environment.ambientIntensity} color={environment.ambientColor} />
          <hemisphereLight intensity={environment.hemisphereIntensity} color={environment.hemisphereColor} groundColor={environment.hemisphereGroundColor} />
          <directionalLight
            position={environment.directionalPosition}
            intensity={environment.directionalIntensity}
            color={environment.directionalColor}
            castShadow={quality.shadowQuality !== 'none' && environment.castShadows}
            shadow-mapSize={[
              quality.shadowQuality === 'high' ? 2048 : 1024,
              quality.shadowQuality === 'high' ? 2048 : 1024
            ]}
            shadow-camera-left={-100}
            shadow-camera-right={100}
            shadow-camera-top={100}
            shadow-camera-bottom={-100}
            shadow-camera-near={0.5}
            shadow-camera-far={quality.drawDistance}
            shadow-bias={environment.shadowBias}
            shadow-normalBias={environment.shadowNormalBias}
          />

          <Environment 
            preset={environment.environmentPreset} 
            background={environment.backgroundType === 'preset' || environment.backgroundType === 'skybox'} 
            blur={0} 
          />
          
          {environment.backgroundType === 'skybox' && (
            <Sky 
              distance={450000} 
              sunPosition={environment.directionalPosition} 
              inclination={0} 
              azimuth={0.25} 
            />
          )}

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

          <CameraPathEditor 
            cameraPaths={cameraPaths} 
            activeCameraPathId={activeCameraPathId} 
            onUpdateCameraPaths={onUpdateCameraPaths}
            onDraggingChanged={setIsTransforming}
          />

          {environment.backgroundType === 'color' && (
            <color attach="background" args={[environment.backgroundColor]} />
          )}

          {visibleModels.filter(m => !m.parentId).map((model) => {
            const layer = layers.find(l => l.id === (model.layerId || 'env'));
            const isLocked = model.locked || (layer ? layer.locked : false) || (model.behaviorTags || []).includes('Locked Layout Asset');

            const renderModel = (m: ModelData) => {
              const children = (m.childrenIds || []).map(cid => {
                const child = models.find(mod => mod.id === cid);
                return child ? renderModel(child) : null;
              });

              return (
                <ErrorBoundary key={m.id}>
                  <SceneModel
                    id={m.id}
                    name={m.name}
                    url={m.url}
                    position={m.position}
                    rotation={m.rotation}
                    scale={m.scale}
                    transformMode={transformMode}
                    snapEnabled={snapEnabled}
                    groundSnap={groundSnap}
                    translationSnap={translationSnap}
                    rotationSnap={rotationSnap}
                    scaleSnap={scaleSnap}
                    wireframe={m.wireframe}
                    lightIntensity={m.lightIntensity}
                    castShadow={m.castShadow}
                    receiveShadow={m.receiveShadow}
                    textureUrl={m.textureUrl}
                    normalMapUrl={m.normalMapUrl}
                    colorTint={m.colorTint}
                    opacity={m.opacity}
                    roughness={m.roughness}
                    metalness={m.metalness}
                    emissiveColor={m.emissiveColor}
                    material={m.material}
                    materialRemap={m.materialRemap}
                    visible={m.visible}
                    behaviorTags={m.behaviorTags}
                    locked={isLocked || m.locked}
                    type={m.type}
                    selectionFilter={selectionFilter}
                    isSelected={selectedModelId === m.id}
                    useCustomGizmo={useCustomGizmo}
                    onDimensionsChange={onModelDimensionsChange}
                    onPositionChange={onModelPositionChange}
                    onRotationChange={onModelRotationChange}
                    onScaleChange={onModelScaleChange}
                    onTransformEnd={onTransformEnd}
                    onSelect={onSelect}
                    onDraggingChanged={setIsTransforming}
                    onTransformModeChange={onTransformModeChange}
                  >
                    {children}
                  </SceneModel>
                </ErrorBoundary>
              );
            };

            return renderModel(model);
          })}

          <Grid
            infiniteGrid
            fadeDistance={100}
            sectionColor="#555555"
            cellColor="#333333"
            receiveShadow={gridReceiveShadow}
          />
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.05, 0]}
            receiveShadow={gridReceiveShadow}
            onPointerDown={(e: any) => {
              if (e.target === e.object) {
                onSelect(null);
              }
            }}
          >
            <planeGeometry args={[1000, 1000]} />
            {quality.reflectionQuality !== 'none' ? (
              <MeshReflectorMaterial
                blur={[300, 100]}
                resolution={quality.reflectionQuality === 'high' ? 1024 : 512}
                mixBlur={1}
                mixStrength={80}
                roughness={1}
                depthScale={1.2}
                minDepthThreshold={0.4}
                maxDepthThreshold={1.4}
                color="#2a2b2e"
                metalness={0.5}
                mirror={0.5}
              />
            ) : (
              <meshStandardMaterial color="#2a2b2e" roughness={1} metalness={0.5} />
            )}
          </mesh>
          
          {quality.postProcessingLevel !== 'none' && (
            <EffectComposer enableNormalPass={true} multisampling={quality.antiAliasing ? 8 : 0}>
              <>
                {environment.ssaoEnabled && quality.postProcessingLevel === 'high' && (
                  <SSAO 
                    intensity={1.5}
                    radius={0.4}
                    luminanceInfluence={0.5}
                  />
                )}
              </>
              {quality.postProcessingLevel !== 'low' && (
                <Bloom 
                  luminanceThreshold={1.0} 
                  mipmapBlur 
                  intensity={0.8} 
                  radius={0.4} 
                />
              )}
              <ToneMapping 
                mode={
                  environment.toneMapping === 'None' ? undefined :
                  environment.toneMapping === 'Linear' ? 1 : // Linear
                  environment.toneMapping === 'Reinhard' ? 2 : // Reinhard
                  environment.toneMapping === 'Cineon' ? 3 : // Cineon
                  4 // ACESFilmic
                }
              />
              <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          )}

          <SceneCameraController
            selectedModelId={selectedModelId}
            models={models}
            focusTrigger={focusTrigger}
            isDragging={isTransforming}
            activeCameraPresetId={activeCameraPresetId}
            cameraPresets={cameraPresets}
            activeCameraPathId={activeCameraPathId}
            previewCameraPathId={previewCameraPathId}
            cameraPaths={cameraPaths}
          />
          <PrefabPlacementHandler
            placementPrefabId={placementPrefabId}
            onPlacePrefabAtPosition={onPlacePrefabAtPosition}
          />
          <SceneDropHandler 
            onDropAsset={(asset, pos) => {
              onDropAsset(asset, pos);
              setPreviewAsset(null);
              setPreviewPosition(null);
            }} 
            onDragOver={(asset, pos) => {
              setPreviewAsset(asset);
              setPreviewPosition(pos);
              setPreviewRotation([0, 0, 0]);
            }}
          />
          {previewAsset && previewPosition && (
            <PreviewModel asset={previewAsset} position={previewPosition} rotation={previewRotation} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}

function PreviewModel({ asset, position, rotation }: { asset: any, position: [number, number, number], rotation: [number, number, number] }) {
  const gltf = useGLTF(asset.url) as any;
  const scene = gltf.scene;
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clonedScene} position={position} rotation={rotation} />;
}
