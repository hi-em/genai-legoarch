import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { BrickInstances, Baseplate, modelOffset, worldHeight } from "./bricks3d.jsx";
import { VIEWER_BG } from "../lib/tokens.js";
import { courseOf, courseCount } from "../lib/brickModel.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap, playPop } from "../lib/sound.js";

const DROP = 7; // how high a course starts before it settles

// ease-out with a tiny overshoot — the "snap" feel of a brick clicking down
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function Assembly({ brickModel, reduced, skipRef, onDone }) {
  // Group pieces by COURSE (3 plate layers): real manuals add a full course per
  // step, and it keeps the ~5.5s pacing budget despite 3x more plate layers.
  const layers = useMemo(() => {
    const nCourses = courseCount(brickModel);
    const byCourse = Array.from({ length: nCourses }, () => []);
    for (const b of brickModel.bricks) byCourse[courseOf(b)].push(b);
    return byCourse;
  }, [brickModel]);
  const nz = layers.length;
  const offset = useMemo(() => modelOffset(brickModel.grid), [brickModel]);

  // pace the whole build into ~5.5s, clamped so courses read individually
  const LAYER_MS = Math.max(130, Math.min(420, Math.round(5500 / Math.max(1, nz))));
  const snapEvery = LAYER_MS < 90 ? Math.ceil(90 / LAYER_MS) : 1;

  const [revealed, setRevealed] = useState(0); // # of fully-settled courses
  const landingRef = useRef();
  const tAcc = useRef(0);
  const doneRef = useRef(false);

  // a snap as each new course starts to drop
  useEffect(() => {
    if (reduced || revealed >= nz) return;
    if (revealed % snapEvery === 0) playSnap();
  }, [revealed, nz, snapEvery, reduced]);

  const finishAll = useCallback(() => setRevealed(nz), [nz]);
  useEffect(() => { if (reduced) finishAll(); }, [reduced, finishAll]);

  useFrame((_, delta) => {
    if (skipRef?.current) { skipRef.current = false; finishAll(); return; }
    if (revealed >= nz) {
      if (!doneRef.current) {
        doneRef.current = true;
        if (!reduced) playPop();
        onDone?.();
      }
      return;
    }
    tAcc.current += delta * 1000;
    const p = Math.min(1, tAcc.current / LAYER_MS);
    if (landingRef.current) landingRef.current.position.y = DROP * (1 - easeOutBack(p));
    if (p >= 1) { tAcc.current = 0; setRevealed((r) => Math.min(nz, r + 1)); }
  });

  // Render each settled course as its OWN keyed component so growing the build
  // never re-instances the courses already placed (cheap even at 1000+ bricks).
  return (
    <group position={offset}>
      <Baseplate nx={brickModel.grid[0]} ny={brickModel.grid[1]} />
      {layers.slice(0, revealed).map((layer, z) => (
        <BrickInstances key={z} bricks={layer} />
      ))}
      {revealed < nz && (
        <group ref={landingRef}>
          <BrickInstances bricks={layers[revealed]} />
        </group>
      )}
    </group>
  );
}

export default function AssemblyViewer({ brickModel, onComplete, height = 460 }) {
  const reduced = useReducedMotion();
  const skipRef = useRef(false);
  if (!brickModel) return null;

  const [nx, ny, nz] = brickModel.grid;            // nz is in PLATE layers
  const span = Math.max(nx, ny, worldHeight(nz));

  return (
    <div style={{ height, background: VIEWER_BG }} className="relative overflow-hidden rounded-xl">
      <Canvas shadows camera={{ position: [span * 1.6, span * 1.3, span * 1.85], fov: 38 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[12, 22, 9]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-8, 6, -6]} intensity={0.35} />
        <Assembly brickModel={brickModel} reduced={reduced} skipRef={skipRef} onDone={onComplete} />
        <ContactShadows position={[0, -worldHeight(nz) / 2 - 0.4, 0]} opacity={0.35} scale={span * 4} blur={2.4} far={30} />
        <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.9} minDistance={4} maxDistance={span * 6} />
      </Canvas>
      <button
        onClick={() => (skipRef.current = true)}
        className="absolute bottom-3 right-3 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/55"
      >
        Skip ▸
      </button>
    </div>
  );
}
