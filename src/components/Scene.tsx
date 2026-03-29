import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Grid } from '@react-three/drei';
import { Suspense, useMemo, useState } from 'react';
import * as THREE from 'three';
import LoadingScreen from './LoadingScreen';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import ErrorBoundary from './ErrorBoundary';
import { ModelData } from '../App';
import { EnvironmentPreset } from '../types/environment';
import { CameraPreset, CameraPath } from '../types/camera';
import { Layer } from '../types/layers';
import { TerrainData } from '../types/terrain';
import { Path } from '../types/paths';
import Terrain from './Terrain';
import PathEditor from './PathEditor';
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
  onSceneReady?: (scene: THREE.Scene) => void;
  activeCameraPresetId: string | null;
  cameraPresets: CameraPreset[];
  activeCameraPathId: string | null;
  cameraPaths: CameraPath[];
  layers: Layer[];
  selectionFilter: string[];
  placementPrefabId: string | null;
  onPlacePrefabAtPosition: (position: [number, number, number]) => void;
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
  layers,
  selectionFilter,
  placementPrefabId,
  onPlacePrefabAtPosition,
  terrain,
  paths
}: SceneProps) {
  const [isTransforming, setIsTransforming] = useState(false);
  const [useCustomGizmo, setUseCustomGizmo] = useState(false);
  const cameraConfig = useMemo(() => ({ position: [50, 50, 50] as [number, number, number], fov: 45, near: 0.1, far: 2000 }), []);
  const glConfig = useMemo(() => ({
    antialias: true,
    preserveDrawingBuffer: true,
    toneMapping: environment.toneMapping === 'None' ? THREE.NoToneMapping :
      environment.toneMapping === 'Linear' ? THREE.LinearToneMapping :
        environment.toneMapping === 'Reinhard' ? THREE.ReinhardToneMapping :
          environment.toneMapping === 'Cineon' ? THREE.CineonToneMapping :
            THREE.ACESFilmicToneMapping,
    toneMappingExposure: environment.exposure,
  }), [environment.exposure, environment.toneMapping]);

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
        camera={cameraConfig}
        gl={glConfig}
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

          <ambientLight intensity={environment.ambientIntensity} color={environment.ambientColor} />
          <hemisphereLight intensity={environment.hemisphereIntensity} color={environment.hemisphereColor} groundColor={environment.hemisphereGroundColor} />
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

          <Environment preset={environment.environmentPreset} background={environment.backgroundType === 'preset'} blur={0} />
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
                <SceneModel
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
            <Bloom luminanceThreshold={1.0} mipmapBlur intensity={0.5} radius={0.4} />
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
          <meshStandardMaterial color="#2a2b2e" depthWrite />
        </mesh>
        <SceneCameraController
          selectedModelId={selectedModelId}
          models={models}
          focusTrigger={focusTrigger}
          isDragging={isTransforming}
          activeCameraPresetId={activeCameraPresetId}
          cameraPresets={cameraPresets}
          activeCameraPathId={activeCameraPathId}
          cameraPaths={cameraPaths}
        />
        <PrefabPlacementHandler
          placementPrefabId={placementPrefabId}
          onPlacePrefabAtPosition={onPlacePrefabAtPosition}
        />
        <SceneDropHandler onDropAsset={onDropAsset} />
      </Canvas>
    </div>
  );
}
