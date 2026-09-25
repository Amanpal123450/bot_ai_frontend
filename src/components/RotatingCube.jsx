import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Cube() {
  const cubeRef = useRef();

  useFrame(() => {
    cubeRef.current.rotation.x += 0.03;
    cubeRef.current.rotation.y += 0.03;
  });

  return (
    <mesh ref={cubeRef}>
      <boxGeometry args={[2, 2, 2]} />

      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

export default function RotatingCube() {
  return (
    <Canvas
      camera={{
        position: [0, 0, 5],
        fov: 50,
      }}
    >
      <ambientLight intensity={1} />

      <directionalLight
        position={[5, 5, 5]}
        intensity={2}
      />

      <Cube />

      <OrbitControls />
    </Canvas>
  );
}