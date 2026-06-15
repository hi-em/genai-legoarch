// The ▶ Pack ritual, played in place at the reveal: the set's own bricks rain
// into an open carton, the box folds shut and tips up (PackingScene), then a
// 3D instruction booklet slides in and leans against the finished box. One
// cinematic, then `onDone` hands off to the explore actions.
//
// This Canvas is TRANSIENT — it mounts only while packing and unmounts the
// moment we move to explore, so frameloop="always" here costs nothing at idle
// (the idle-GPU contract is the SHELF's job, not this short cutscene). The
// whole thing is severable: a reduced-motion / no-WebGL / error path is handled
// by the caller (HeroFlow short-circuits to explore) and by a hard failsafe.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkipForward } from "lucide-react";
import {
  PackingScene, useFrontTexture, usePackingRain,
  easeOut, clamp01, FLOOR_Y, T_END, T_HOLD,
} from "./PackingScene.jsx";

// The reveal seal plays slower than 1× so the fold reads and the cover art lands
// as its own beat (PackingScene stretches its whole timeline by this factor).
const PLAYBACK = 0.7;
const BOOKLET_DUR = 0.65;   // booklet slide, real seconds (unscaled)
import { BOX } from "../lib/boxTexture.js";
import { playSnap } from "../lib/sound.js";

// The booklet: a thin stapled book that slides in from the right and leans
// against the packed box. Its cover reuses the box-front art (same texture,
// no extra paint) so it reads as "the instructions for THIS set".
function Booklet({ frontTex, reduced, onSettled }) {
  const ref = useRef();
  const t0 = useRef(null);
  const fired = useRef(false);

  const cover = useMemo(
    () => new THREE.MeshStandardMaterial({ map: frontTex || null, color: frontTex ? "#ffffff" : "#efe9da", roughness: 0.6 }),
    [frontTex]
  );
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: "#efe9da", roughness: 0.88 }), []);
  useEffect(() => () => { cover.dispose(); paper.dispose(); }, [cover, paper]);

  const W = BOX.BW * 0.52, H = BOX.BH * 0.64, D = 0.1;
  const REST_X = BOX.BW * 0.5 + W * 0.32;
  const FROM_X = BOX.BW * 2.0;
  const REST_Y = FLOOR_Y + H / 2 + 0.02;
  const DUR = 0.65;

  useFrame((state) => {
    if (t0.current == null) t0.current = state.clock.elapsedTime;
    const t = reduced ? 1e3 : state.clock.elapsedTime - t0.current;
    const p = easeOut(clamp01(t / DUR));
    const g = ref.current;
    if (g) {
      g.position.x = THREE.MathUtils.lerp(FROM_X, REST_X, p);
      g.position.y = REST_Y;
      g.position.z = BOX.BD * 0.25;
      g.rotation.z = -0.14 * p;                 // lean against the box
      g.rotation.y = (1 - p) * 0.6;             // square up to camera as it lands
    }
    if (p >= 1 && !fired.current) { fired.current = true; playSnap(); onSettled?.(); }
  });

  // boxGeometry faces [+x,-x,+y,-y,+z(cover),-z]
  return (
    <group ref={ref} position={[FROM_X, REST_Y, BOX.BD * 0.25]}>
      <mesh material={[paper, paper, paper, paper, cover, paper]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
      </mesh>
    </group>
  );
}

export default function PackRitual({ imageUrl, setCopy, brickModel, reduced = false, onDone }) {
  const [phase, setPhase] = useState("pack");   // pack -> booklet
  const pieces = brickModel?.stability?.nBricks;
  const frontTex = useFrontTexture(imageUrl, setCopy, pieces);
  const { rain, geosReady } = usePackingRain(brickModel);

  // Fire onDone exactly once, whatever path gets us there (settle, skip, failsafe).
  const doneRef = useRef(false);
  const finish = () => { if (!doneRef.current) { doneRef.current = true; onDone?.(); } };

  // Hard failsafe: never strand the user in the cutscene if a beat stalls.
  // Derived from the (slowed) pack timeline so it always clears a clean run.
  useEffect(() => {
    const packMs = ((T_END + T_HOLD) / PLAYBACK + BOOKLET_DUR + 2.0) * 1000;
    const ms = reduced ? 0 : packMs;
    const id = setTimeout(finish, ms);
    return () => clearTimeout(id);
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-xl bg-gradient-to-b from-white to-stone-200">
      <Canvas
        shadows
        camera={{ position: [1.7, 2.3, 5.6], fov: 35 }}
        style={{ height: 420 }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 5]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-5, 2, -2]} intensity={0.4} />
        {(geosReady || rain.length === 0) && (
          <PackingScene
            frontTex={frontTex}
            rain={rain}
            reduced={reduced}
            replayKey={0}
            direction="pack"
            playbackScale={PLAYBACK}
            onDone={() => setPhase("booklet")}
          />
        )}
        {phase === "booklet" && (
          <Booklet frontTex={frontTex} reduced={reduced} onSettled={finish} />
        )}
      </Canvas>

      <button
        onClick={finish}
        className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/65"
      >
        <SkipForward size={13} /> Skip
      </button>
    </div>
  );
}
