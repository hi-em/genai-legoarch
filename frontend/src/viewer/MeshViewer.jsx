// Standalone viewer for the RAW TRELLIS mesh — the staged flow's "mesh stop":
// the user orbits the generated 3D before deciding how to legolize it.
// Same shell, camera grammar and lighting as BrickViewer so the handoff from
// mesh -> bricks feels like one continuous object. When `expandable`, it gains a
// fullscreen view + PNG export (ArtifactFrame) so the mesh is inspectable on its
// own, like the render and the box art.
import { useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { useDataUrlGLB } from "./useDataUrlGLB.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { StudLoader } from "../components/ui/index.js";
import { VIEWER_BG } from "../lib/tokens.js";
import CaptureBridge from "./CaptureBridge.jsx";
import ArtifactFrame from "./ArtifactFrame.jsx";

const TARGET_H = 14; // world height the mesh is normalised to (≈ a brick model)

function NormalizedMesh({ scene }) {
  const ready = useMemo(() => {
    if (!scene) return null;
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.side = THREE.DoubleSide;
        o.castShadow = false;
      }
    });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y <= 0) return null;
    const s = TARGET_H / size.y;
    const group = new THREE.Group();
    group.add(scene);
    scene.position.set(-center.x, -box.min.y, -center.z); // bottom-center at origin
    group.scale.setScalar(s);
    group.position.set(0, -TARGET_H / 2, 0);              // vertically centred
    return group;
  }, [scene]);

  if (!ready) return null;
  return <primitive object={ready} />;
}

// The actual scene — reused inline and (larger) inside the expand lightbox.
function MeshScene({ glbUrl, registerCapture }) {
  const reduced = useReducedMotion();
  const { scene, error } = useDataUrlGLB(glbUrl);
  const [spin, setSpin] = useState(!reduced);

  if (error) return null;
  return (
    <>
      {!scene && (
        <div className="absolute inset-0 grid place-items-center">
          <StudLoader />
        </div>
      )}
      {/* preserveDrawingBuffer lets CaptureBridge read the frame for PNG export */}
      <Canvas
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [TARGET_H * 1.5, TARGET_H * 1.25, TARGET_H * 1.7], fov: 40 }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[12, 20, 9]} intensity={1.4} />
        <directionalLight position={[-8, 6, -6]} intensity={0.35} />
        {scene && <NormalizedMesh scene={scene} />}
        <ContactShadows position={[0, -TARGET_H / 2 - 0.3, 0]} opacity={0.4} scale={TARGET_H * 4} blur={2.2} far={24} />
        <OrbitControls
          enablePan={false}
          autoRotate={spin}
          autoRotateSpeed={0.8}
          onStart={() => setSpin(false)}
          minDistance={4}
          maxDistance={TARGET_H * 5}
        />
        <CaptureBridge onReady={registerCapture} />
      </Canvas>
    </>
  );
}

export default function MeshViewer({ glbUrl, height = 380, expandable = false, title = "3D mesh", filename = "mesh.png" }) {
  if (!glbUrl) {
    return <div style={{ height, background: VIEWER_BG }} className="rounded-lg" />;
  }
  if (!expandable) {
    return (
      <div style={{ height, background: VIEWER_BG }} className="relative overflow-hidden rounded-lg">
        <MeshScene glbUrl={glbUrl} />
      </div>
    );
  }
  return (
    <ArtifactFrame
      height={height}
      title={title}
      filename={filename}
      hint="Drag to orbit · scroll to zoom"
      renderScene={(register) => <MeshScene glbUrl={glbUrl} registerCapture={register} />}
    />
  );
}
