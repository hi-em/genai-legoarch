// The boxed set — a REAL 3D retail box, deterministic by construction.
// The front panel is a canvas texture we draw ourselves: the user's FLUX
// render as the hero art (the genAI beat) + letter-perfect typography (no
// model ever spells a word). The box is true geometry, so it always reads
// as a box — and it earns a ritual: the set's own bricks rain into the open
// box, the lid drops, the packshot settles. Drag to orbit. Download grabs
// the WebGL frame. The packing ritual itself lives in transition/PackingScene
// so the same animation drives the shelf "seal it" / "open it" transitions.
import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Download, RotateCcw } from "lucide-react";
import { downloadDataUrl } from "./downloadImage.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";
import { PackingScene, useFrontTexture, usePackingRain } from "../../transition/PackingScene.jsx";

function Exporter({ apiRef }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    apiRef.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
  }, [gl, scene, camera, apiRef]);
  return null;
}

// ---------------------------------------------------------------------------
export default function BoxArt({ imageUrl, setCopy, brickModel }) {
  const reduced = useReducedMotion();
  const [replayKey, setReplayKey] = useState(0);
  const exportRef = useRef(null);
  const pieces = brickModel?.stability?.nBricks;
  const frontTex = useFrontTexture(imageUrl, setCopy, pieces);
  const { rain, geosReady } = usePackingRain(brickModel);

  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-xl bg-gradient-to-b from-stone-100 to-stone-200">
        <Canvas
          key={replayKey}
          shadows
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [1.7, 2.3, 5.4], fov: 35 }}
          style={{ height: 400 }}
        >
          <ambientLight intensity={0.85} />
          <directionalLight position={[4, 6, 5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-5, 2, -2]} intensity={0.35} />
          {(geosReady || rain.length === 0) && (
            <PackingScene frontTex={frontTex} rain={rain} reduced={reduced} replayKey={replayKey} />
          )}
          <OrbitControls enablePan={false} minDistance={3} maxDistance={9} target={[0, -0.45, 0]} />
          <Exporter apiRef={exportRef} />
        </Canvas>
      </div>
      <p className="text-micro text-muted">
        The art is your render; the box, the type and the numbers are drawn by us — nothing to misspell. Drag to orbit.
      </p>
      <div className="flex justify-center gap-2">
        <button
          onClick={() => {
            const url = exportRef.current?.();
            if (url) downloadDataUrl(`${(setCopy?.set_name || "set").replace(/\W+/g, "_")}_box.png`, url);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Download size={13} /> Download packshot
        </button>
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-sm font-semibold"
        >
          <RotateCcw size={13} /> Replay packing
        </button>
      </div>
    </div>
  );
}
