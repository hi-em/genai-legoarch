import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { BrickInstances, Baseplate, modelOffset, worldHeight } from "./bricks3d.jsx";
import { frontElevationThumb } from "../lib/thumb.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { VIEWER_BG } from "../lib/tokens.js";
import CaptureBridge from "./CaptureBridge.jsx";
import ArtifactFrame from "./ArtifactFrame.jsx";

// Lightweight static poster shown when the viewer is NOT active — frees the
// WebGL context and keeps the model crisp.
function Poster({ brickModel, height, monochrome }) {
  const src = useMemo(
    () => (brickModel ? frontElevationThumb(brickModel, 360) : null),
    [brickModel]
  );
  return (
    <div style={{ height, background: VIEWER_BG }} className="grid place-items-center overflow-hidden rounded-lg">
      {src && (
        <img
          src={src}
          alt="brick model preview"
          className={"max-h-[88%] max-w-[88%] object-contain " + (monochrome ? "grayscale" : "")}
        />
      )}
    </div>
  );
}

// The live brick scene — reused inline and (larger) inside the expand lightbox.
function BrickScene({ brickModel, studs, monochrome, stand, registerCapture }) {
  const reduced = useReducedMotion();
  const [spin, setSpin] = useState(!reduced);
  const [nx, ny, nz] = brickModel.grid;            // nz is in PLATE layers
  const span = Math.max(nx, ny, worldHeight(nz));  // world-space extent for framing
  const offset = modelOffset(brickModel.grid);

  return (
    // preserveDrawingBuffer lets CaptureBridge read the frame for PNG export
    <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [span * 1.5, span * 1.25, span * 1.7], fov: 40 }}>
      <ambientLight intensity={0.65} />
      <directionalLight position={[12, 20, 9]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} />
      <group position={offset}>
        <BrickInstances bricks={brickModel.bricks} studs={studs} monochrome={monochrome} />
        {stand && <Baseplate nx={nx} ny={ny} />}
      </group>
      <ContactShadows position={[0, -worldHeight(nz) / 2 - 0.4, 0]} opacity={0.4} scale={span * 4} blur={2.2} far={24} />
      <OrbitControls
        enablePan={false}
        autoRotate={spin}
        autoRotateSpeed={0.8}
        onStart={() => setSpin(false)}
        minDistance={4}
        maxDistance={span * 5}
      />
      <CaptureBridge onReady={registerCapture} />
    </Canvas>
  );
}

export default function BrickViewer({
  brickModel,
  studs = true,
  monochrome = false,
  stand = true,
  height = 380,
  active = true,
  expandable = false,
  title = "LEGO build",
  filename = "build.png",
}) {
  if (!active) return <Poster brickModel={brickModel} height={height} monochrome={monochrome} />;
  if (!brickModel) return <div style={{ height, background: VIEWER_BG }} className="rounded-lg" />;

  if (!expandable) {
    return (
      <div style={{ height, background: VIEWER_BG }} className="overflow-hidden rounded-lg">
        <BrickScene brickModel={brickModel} studs={studs} monochrome={monochrome} stand={stand} />
      </div>
    );
  }
  return (
    <ArtifactFrame
      height={height}
      title={title}
      filename={filename}
      hint="Drag to orbit · scroll to zoom"
      renderScene={(register) => (
        <BrickScene brickModel={brickModel} studs={studs} monochrome={monochrome} stand={stand} registerCapture={register} />
      )}
    />
  );
}
