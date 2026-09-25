import React, { Suspense } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

function ElephantModel() {
  const model = useLoader(FBXLoader, "/models/Elephant.fbx");

  return (
    <primitive
      object={model}
      scale={0.01}
      position={[0, -1.5, 0]}
    />
  );
}

export default function Elephant3D() {
  return (
    <Canvas
      camera={{
        position: [0, 1.5, 1],
        
      }}
    >
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
      />

      <Suspense fallback={null}>
        <ElephantModel />
        <Environment preset="studio" />
      </Suspense>

      <OrbitControls />
    </Canvas>
  );
}