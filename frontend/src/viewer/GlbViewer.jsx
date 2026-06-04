import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Bounds, ContactShadows, useGLTF } from "@react-three/drei";

// Renders a GLB (data URL) from TRELLIS. Bounds auto-fits the camera so it works
// regardless of the mesh's export scale.
function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function GlbViewer({ url, height = 400 }) {
  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", background: "linear-gradient(#eef3f7,#d7dee5)" }}>
      <Canvas shadows camera={{ position: [2.4, 1.7, 2.4], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 4, -4]} intensity={0.35} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <Model url={url} />
            </Center>
          </Bounds>
          <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={10} blur={2.4} far={20} />
        </Suspense>
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} />
      </Canvas>
    </div>
  );
}
