import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Bounds, ContactShadows, useGLTF } from "@react-three/drei";
import { Box } from "lucide-react";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { VIEWER_BG } from "../lib/tokens.js";

// Renders a GLB (data URL) from TRELLIS. Bounds auto-fits the camera so it works
// regardless of the mesh's export scale.
function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function GlbViewer({ url, height = 400, active = true }) {
  const reduced = useReducedMotion();
  const [spin, setSpin] = useState(!reduced);

  if (!active) {
    return (
      <div
        style={{ height, background: VIEWER_BG }}
        className="grid place-items-center overflow-hidden rounded-lg text-muted"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Box className="h-4 w-4" /> 3D mesh
        </span>
      </div>
    );
  }

  return (
    <div style={{ height, background: VIEWER_BG }} className="overflow-hidden rounded-lg">
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
        <OrbitControls enablePan={false} autoRotate={spin} autoRotateSpeed={0.8} onStart={() => setSpin(false)} />
      </Canvas>
    </div>
  );
}
