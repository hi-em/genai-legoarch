// The carton packing/opening ritual as a reusable R3F scene graph (no Canvas).
// Extracted from hero/trophies/BoxArt.jsx so the SAME animation drives three
// moments: the boxed-set trophy (pack, looping), the "seal it onto the shelf"
// transition (pack, one-shot), and "open a set from the room" (open, one-shot).
// `direction="pack"` is the original timeline verbatim; `direction="open"` tips
// a sealed box back down and lets its flaps fall open to reveal the bricks
// resting inside. `onDone` fires once when either timeline settles.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { partGeometryOf, loadPartGeometry } from "../viewer/partGeometry.js";
import { playSnap } from "../lib/sound.js";
import { BOX, buildFrontTexture } from "../lib/boxTexture.js";

// ---------------------------------------------------------------------------
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
// a little cardboard spring at the end of each fold
export const easeBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

// Falling bricks share one material per colour across every run (a few dozen
// at most) — the same module-singleton trick the carton uses for kraft/black,
// so a replay/remount never rebuilds 34 MeshStandardMaterials.
const brickMatCache = new Map();
function brickMaterialFor(hex) {
  const key = hex || "#c91a09";
  let m = brickMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: key, roughness: 0.5 });
    brickMatCache.set(key, m);
  }
  return m;
}

export const PANEL_T = 0.024;          // cardboard thickness
export const FLOOR_Y = -1.45;          // studio floor (world)
export const FLAP_SHORT = BOX.BH * 0.3;    // flaps on the x walls, fold first
export const FLAP_LONG = BOX.BH * 0.5;     // flaps on the z walls, meet in the middle

// Kraft cardboard, shared so the sealed shelf box and the animated carton use
// the EXACT same material + colour.
const CARTON_KRAFT = new THREE.MeshStandardMaterial({ color: "#b08a5e", roughness: 0.95 });

/** The carton in its SEALED state — a static, upright kraft box with the printed
 *  front panel on +z, built from the same BOX proportions + panel thickness +
 *  kraft material as the animated PackingScene carton, so the box resting on the
 *  shelf is the same construction as the one the ritual folds shut. No refs / no
 *  useFrame (cheap; safe to instance across a shelf of boxes). */
export function ClosedCarton({ frontTex }) {
  const art = useMemo(
    () => new THREE.MeshStandardMaterial({ map: frontTex || null, color: frontTex ? "#ffffff" : "#b08a5e", roughness: 0.5 }),
    [frontTex]
  );
  useEffect(() => () => art.dispose(), [art]);
  const W = BOX.BW, H = BOX.BH, D = BOX.BD, T = PANEL_T;
  return (
    <group>
      {/* printed front panel (the carton's floor panel) — art on the +z face */}
      <mesh position={[0, 0, D / 2 - T / 2]} material={[CARTON_KRAFT, CARTON_KRAFT, CARTON_KRAFT, CARTON_KRAFT, art, CARTON_KRAFT]} castShadow receiveShadow>
        <boxGeometry args={[W, H, T]} />
      </mesh>
      {/* the four folded-up walls (kraft) */}
      <mesh position={[0, H / 2 - T / 2, -T / 2]} material={CARTON_KRAFT} castShadow receiveShadow><boxGeometry args={[W, T, D - T]} /></mesh>
      <mesh position={[0, -H / 2 + T / 2, -T / 2]} material={CARTON_KRAFT} castShadow><boxGeometry args={[W, T, D - T]} /></mesh>
      <mesh position={[-W / 2 + T / 2, 0, -T / 2]} material={CARTON_KRAFT} castShadow><boxGeometry args={[T, H - 2 * T, D - T]} /></mesh>
      <mesh position={[W / 2 - T / 2, 0, -T / 2]} material={CARTON_KRAFT} castShadow><boxGeometry args={[T, H - 2 * T, D - T]} /></mesh>
      {/* the long closing flaps meeting at the back centre (as when sealed) */}
      <mesh position={[0, H / 4, -D / 2 + T / 2]} material={CARTON_KRAFT} castShadow><boxGeometry args={[W - 2 * T, H / 2 - T, T]} /></mesh>
      <mesh position={[0, -H / 4, -D / 2 + T / 2]} material={CARTON_KRAFT} castShadow><boxGeometry args={[W - 2 * T, H / 2 - T, T]} /></mesh>
    </group>
  );
}

// Pack timeline (seconds): die-cut -> walls -> rain -> flaps -> tip-up -> settle
export const T_WALLS = 0.5, T_WALLS_D = 0.55;     // each wall fold duration
export const T_RAIN = 1.5, T_RAIN_END = 3.1;
export const T_FLAP_S = 3.2, T_FLAP_L = 3.7;
export const T_FLIP = 4.5, T_FLIP_D = 1.1;
export const T_END = T_FLIP + T_FLIP_D + 0.9;     // packshot has settled ~6.5s
// After the box settles, hold on the finished packshot (box alone, gently
// swaying) before handing off — a beat to actually read the cover art. In
// timeline seconds; real-time hold = T_HOLD / playbackScale.
export const T_HOLD = 1.5;

// the z the carton settles to once tipped upright (matches the pack tip-up lerp)
const Z_SEALED = -BOX.BH / 2 + 0.55 * (BOX.BH + 0.1);

// Open timeline: tip a sealed box back down, then its flaps fall open.
const O_TIP = 0.15, O_TIP_D = 0.7;
const O_FLAP_L = 0.85, O_FLAP_S = 1.1, O_FLAP_D = 0.55;
export const O_END = 1.85;

// ---------------------------------------------------------------------------
export function useFrontTexture(imageUrl, setCopy, pieces) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    buildFrontTexture({ imageUrl, setCopy, pieces }).then((t) => {
      if (!alive) { t.dispose(); return; }
      made = t;
      setTex(t);
    });
    return () => { alive = false; made?.dispose(); };
  }, [imageUrl, setCopy, pieces]);
  return tex;
}

// Sample the SET'S OWN pieces for the rain: real parts, real colours, and load
// their LDraw geometry async (falls back to a generic brick box while loading).
export function usePackingRain(brickModel) {
  const rain = useMemo(() => {
    const src = brickModel?.bricks || [];
    const picks = [];
    const n = Math.min(34, src.length);
    for (let i = 0; i < n; i++) {
      const b = src[Math.floor((i * 9973) % src.length)];
      picks.push({
        part: b.part,
        hex: b.hex || "#c91a09",
        x: (Math.sin(i * 12.9898) * 0.5) * (BOX.BW - 0.7),
        z: (Math.sin(i * 78.233) * 0.5) * (BOX.BH - 0.7),
        fromY: 2.6 + (i % 7) * 0.3,
        toY: 0.12 + (i % 4) * 0.13,
        delay: i * 0.045,
        rx: Math.sin(i * 3.1) * 1.2,
        ry: Math.sin(i * 5.7) * 2,
        rz: Math.sin(i * 7.3) * 1.2,
        spin: Math.sin(i * 2.3) * 2,
        geo: null,
      });
    }
    return picks;
  }, [brickModel]);

  const [geosReady, setGeosReady] = useState(false);
  useEffect(() => {
    let alive = true;
    setGeosReady(false);
    Promise.all(rain.map((b) => loadPartGeometry(b.part))).then(() => {
      if (!alive) return;
      rain.forEach((b) => { b.geo = partGeometryOf(b.part) || null; });
      setGeosReady(true);
    });
    return () => { alive = false; };
  }, [rain]);

  return { rain, geosReady };
}

/** One side of the carton: wall hinged at the floor panel's edge, flap hinged
 *  at the wall's far edge. Data-driven so all four sides share it. */
function Side({ axis, sign, wallLen, flapDepth, mats, wallRef, flapRef }) {
  const along = axis === "z" ? [wallLen, PANEL_T, BOX.BD] : [BOX.BD, PANEL_T, wallLen];
  const flapSize = axis === "z" ? [wallLen, PANEL_T, flapDepth] : [flapDepth, PANEL_T, wallLen];
  const out = (v) => (axis === "z" ? [0, 0, sign * v] : [sign * v, 0, 0]);
  return (
    <group position={out(axis === "z" ? BOX.BH / 2 : BOX.BW / 2)} ref={wallRef}>
      <mesh position={out(BOX.BD / 2)} material={mats} castShadow receiveShadow>
        <boxGeometry args={along} />
      </mesh>
      <group position={out(BOX.BD)} ref={flapRef}>
        <mesh position={out(flapDepth / 2)} material={mats} castShadow>
          <boxGeometry args={flapSize} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
export function PackingScene({ frontTex, rain, reduced, replayKey, direction = "pack", onDone, showFloor = true, playbackScale = 1 }) {
  const t0 = useRef(null);
  const swayRef = useRef();
  const flipRef = useRef();
  const brickRefs = useRef([]);
  const wallRefs = [useRef(), useRef(), useRef(), useRef()]; // z+, z-, x+, x-
  const flapRefs = [useRef(), useRef(), useRef(), useRef()];
  const snaps = useRef(0);
  const fired = useRef(false);

  const kraft = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#b08a5e", roughness: 0.95 }),
    []
  );
  const black = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#101013", roughness: 0.6 }),
    []
  );
  const artMat = useMemo(
    () => (frontTex ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.5 }) : black),
    [frontTex, black]
  );
  // boxGeometry faces: [+x, -x, +y(inner/kraft), -y(outer/print), +z, -z]
  const wallMats = useMemo(() => [kraft, kraft, kraft, black, kraft, kraft], [kraft, black]);
  const floorMats = useMemo(() => [kraft, kraft, kraft, artMat, kraft, kraft], [kraft, artMat]);

  useEffect(() => { t0.current = null; snaps.current = 0; fired.current = false; }, [replayKey, direction]);

  const foldWall = (i, p) => {
    const g = wallRefs[i].current;
    if (!g) return;
    const a = (p * Math.PI) / 2;
    if (i === 0) g.rotation.x = -a;        // z+ wall
    if (i === 1) g.rotation.x = a;         // z- wall
    if (i === 2) g.rotation.z = a;         // x+ wall
    if (i === 3) g.rotation.z = -a;        // x- wall
  };
  const foldFlap = (i, p) => {
    const g = flapRefs[i].current;
    if (!g) return;
    const a = (p * Math.PI) / 2;
    if (i === 0) g.rotation.x = -a;
    if (i === 1) g.rotation.x = a;
    if (i === 2) g.rotation.z = a;
    if (i === 3) g.rotation.z = -a;
  };

  useFrame((state) => {
    if (t0.current == null) t0.current = state.clock.elapsedTime;
    // playbackScale < 1 stretches the whole timeline (slower, more readable).
    const t = reduced ? 1e3 : (state.clock.elapsedTime - t0.current) * playbackScale;

    // ----- OPEN: a sealed box tips down, flaps fall open, bricks rest inside -
    if (direction === "open") {
      for (let s = 0; s < 4; s++) foldWall(s, 1);     // walls stay upright
      brickRefs.current.forEach((m, i) => {
        if (!m) return;
        const b = rain[i];
        m.visible = true;
        m.position.set(b.x, b.toY, b.z);
        m.rotation.set(0, b.ry, 0);
      });
      const pTip = easeOut(clamp01((t - O_TIP) / O_TIP_D));
      if (flipRef.current) {
        flipRef.current.rotation.x = (-Math.PI / 2) * (1 - pTip);
        flipRef.current.position.z = THREE.MathUtils.lerp(Z_SEALED, -BOX.BH / 2, pTip);
      }
      const pL = clamp01((t - O_FLAP_L) / O_FLAP_D);
      [1, 0].forEach((side) => foldFlap(side, 1 - easeOut(pL) * 1.25));   // open past vertical
      const pS = clamp01((t - O_FLAP_S) / O_FLAP_D);
      [2, 3].forEach((side) => foldFlap(side, 1 - easeOut(pS) * 1.25));
      if (pTip >= 1 && snaps.current === 0) { snaps.current = 1; playSnap(); }
      if ((reduced || t >= O_END) && !fired.current) { fired.current = true; onDone?.(); }
      return;
    }

    // ----- PACK (default): the original boxed-set ritual --------------------
    // 1) walls fold up, one after another, with a cardboard spring
    const order = [1, 3, 2, 0]; // back, left, right, front(art-side last)
    order.forEach((side, k) => {
      const p = clamp01((t - (T_WALLS + k * 0.22)) / T_WALLS_D);
      foldWall(side, p >= 1 ? 1 : easeBack(p));
      if (p >= 1 && snaps.current === k) { snaps.current = k + 1; playSnap(); }
    });

    // 2) the set's bricks rain into the open carton
    brickRefs.current.forEach((m, i) => {
      if (!m) return;
      const b = rain[i];
      const p = clamp01((t - (T_RAIN + b.delay)) / 0.7);
      m.visible = !reduced && p > 0 && t < T_FLIP;
      const y = THREE.MathUtils.lerp(b.fromY, b.toY, easeIn(p));
      m.position.set(b.x, y, b.z);
      m.rotation.set(b.rx * (1 - p), b.ry + p * b.spin, b.rz * (1 - p));
    });

    // 3) flaps: short pair, then long pair meets in the middle
    [2, 3].forEach((side, k) => {
      const p = clamp01((t - (T_FLAP_S + k * 0.18)) / 0.45);
      foldFlap(side, p >= 1 ? 1 : easeBack(p));
    });
    [1, 0].forEach((side, k) => {
      const p = clamp01((t - (T_FLAP_L + k * 0.2)) / 0.5);
      foldFlap(side, p >= 1 ? 1 : easeBack(p));
      if (side === 0 && p >= 1 && snaps.current === 4) { snaps.current = 5; playSnap(); }
    });

    // 4) the tip-up: hinge at the BACK floor edge, art face swings to camera
    if (flipRef.current) {
      const p = easeOut(clamp01((t - T_FLIP) / T_FLIP_D));
      flipRef.current.rotation.x = (-Math.PI / 2) * p;
      flipRef.current.position.z = THREE.MathUtils.lerp(-BOX.BH / 2, BOX.BH / 2 + 0.1, p * 0.55);
      if (p >= 1 && snaps.current === 5) { snaps.current = 6; playSnap(); }
    }

    // 5) settled packshot sway
    if (swayRef.current) {
      const settled = clamp01((t - (T_FLIP + T_FLIP_D)) / 1);
      swayRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.14 * settled;
    }
    if ((reduced || t >= T_END + T_HOLD) && !fired.current) { fired.current = true; onDone?.(); }
  });

  return (
    <group ref={swayRef}>
      {/* hinge group: origin at the back floor edge of the lying carton */}
      <group ref={flipRef} position={[0, FLOOR_Y, -BOX.BH / 2]}>
        <group position={[0, PANEL_T / 2, BOX.BH / 2]}>
          {/* floor panel — its OUTER (down) face is the printed front art */}
          <mesh material={floorMats} receiveShadow castShadow>
            <boxGeometry args={[BOX.BW, PANEL_T, BOX.BH]} />
          </mesh>
          <Side axis="z" sign={1} wallLen={BOX.BW} flapDepth={FLAP_LONG} mats={wallMats} wallRef={wallRefs[0]} flapRef={flapRefs[0]} />
          <Side axis="z" sign={-1} wallLen={BOX.BW} flapDepth={FLAP_LONG} mats={wallMats} wallRef={wallRefs[1]} flapRef={flapRefs[1]} />
          <Side axis="x" sign={1} wallLen={BOX.BH} flapDepth={FLAP_SHORT} mats={wallMats} wallRef={wallRefs[2]} flapRef={flapRefs[2]} />
          <Side axis="x" sign={-1} wallLen={BOX.BH} flapDepth={FLAP_SHORT} mats={wallMats} wallRef={wallRefs[3]} flapRef={flapRefs[3]} />
          {/* the set's own bricks (rain in on pack, rest inside on open) */}
          {rain.map((b, i) => (
            <mesh
              key={`${replayKey}-${i}`}
              ref={(el) => (brickRefs.current[i] = el)}
              geometry={b.geo || undefined}
              material={brickMaterialFor(b.hex)}
              scale={0.22}
              castShadow
              visible={false}
            >
              {!b.geo && <boxGeometry args={[1, 1.2, 2]} />}
            </mesh>
          ))}
        </group>
      </group>
      {/* studio sweep (hidden when staged in the room — the room floor handles it) */}
      {showFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.22} />
        </mesh>
      )}
    </group>
  );
}
