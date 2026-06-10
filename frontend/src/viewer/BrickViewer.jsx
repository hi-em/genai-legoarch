import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { BrickInstances, Baseplate, modelOffset } from "./bricks3d.jsx";
import { frontElevationThumb } from "../lib/thumb.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { VIEWER_BG } from "../lib/tokens.js";

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

export default function BrickViewer({
  brickModel,
  studs = true,
  monochrome = false,
  stand = true,
  height = 380,
  active = true,
}) {
  const reduced = useReducedMotion();
  const [spin, setSpin] = useState(!reduced);

  if (!active) return <Poster brickModel={brickModel} height={height} monochrome={monochrome} />;
  if (!brickModel) return <div style={{ height, background: VIEWER_BG }} className="rounded-lg" />;

  const [nx, , nz] = brickModel.grid;
  const span = Math.max(...brickModel.grid);
  const offset = modelOffset(brickModel.grid);

  return (
    <div style={{ height, background: VIEWER_BG }} className="overflow-hidden rounded-lg">
      <Canvas shadows camera={{ position: [span * 1.5, span * 1.25, span * 1.7], fov: 40 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[12, 20, 9]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-8, 6, -6]} intensity={0.35} />
        <group position={offset}>
          <BrickInstances bricks={brickModel.bricks} studs={studs} monochrome={monochrome} />
          {stand && <Baseplate nx={brickModel.grid[0]} ny={brickModel.grid[1]} />}
        </group>
        <ContactShadows position={[0, -nz / 2 - 0.4, 0]} opacity={0.4} scale={span * 4} blur={2.2} far={24} />
        <OrbitControls
          enablePan={false}
          autoRotate={spin}
          autoRotateSpeed={0.8}
          onStart={() => setSpin(false)}
          minDistance={4}
          maxDistance={span * 5}
        />
      </Canvas>
    </div>
  );
}
