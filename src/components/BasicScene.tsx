import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei';

interface BasicSceneProps {
  /** Optional URL to a GLB model to render */
  modelUrl?: string; 
}

/**
 * A simple component to load and render a GLB model.
 * useGLTF automatically caches and optimizes the loaded assets.
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

/**
 * A basic 3D scene optimized for rendering GLB/OBJ files.
 * Includes a grid helper, default camera, lighting, and orbit controls.
 */
export default function BasicScene({ modelUrl }: BasicSceneProps) {
  return (
    <div className="w-full h-full min-h-[400px] bg-[#151619] rounded-lg overflow-hidden border border-white/10">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }} shadows>
        {/* Default Lighting Setup */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        />
        {/* Environment map for realistic PBR reflections */}
        <Environment preset="city" />

        {/* Grid Helper representing the floor */}
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#666666" 
          cellColor="#222222" 
          position={[0, -0.01, 0]} 
        />

        {/* Camera Controls */}
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />

        {/* Model Rendering with Suspense for loading states */}
        <Suspense fallback={null}>
          {modelUrl ? (
            <Model url={modelUrl} />
          ) : (
            /* Default placeholder box if no model is provided */
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.8} />
            </mesh>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
