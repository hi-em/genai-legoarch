// The boxed set — a REAL 3D retail box, deterministic by construction.
// The front panel is a canvas texture we draw ourselves: the user's FLUX
// render as the hero art (the genAI beat) + letter-perfect typography (no
// model ever spells a word). The box is true geometry, so it always reads
// as a box — and it earns a ritual: the set's own bricks rain into the open
// box, the lid drops, the packshot settles. Drag to orbit. Download grabs
// the WebGL frame.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Download, RotateCcw } from "lucide-react";
import { downloadDataUrl } from "./downloadImage.js";
import { partGeometryOf, loadPartGeometry } from "../../viewer/partGeometry.js";
import { playSnap } from "../../lib/sound.js";
import { useReducedMotion } from "../../lib/useReducedMotion.js";

// box proportions (LEGO Architecture-ish landscape box, world units)
const BW = 3.6, BH = 2.6, BD = 0.78;
const LID_T = 0.14;

// ---------------------------------------------------------------------------
// Front-panel art: everything drawn by us on a canvas -> always correct.
function drawFrontPanel(ctx, W, H, img, setCopy, pieces) {
  // matte black + subtle blueprint motif
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(64, 180, 190, 0.10)";
  ctx.lineWidth = 1;
  const grid = W / 18;
  for (let x = 0; x <= W; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, H * 0.1); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = H * 0.1; y <= H; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // hero art — the user's render with its white studio background keyed to
  // transparent (same ~238 threshold the backend's exposure matcher treats
  // as background), so the model floats on the black box, LEGO
  // Architecture style — not a pasted photo rectangle
  if (img) {
    const off = document.createElement("canvas");
    off.width = img.width;
    off.height = img.height;
    const octx = off.getContext("2d");
    octx.drawImage(img, 0, 0);
    try {
      const data = octx.getImageData(0, 0, off.width, off.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const lo = Math.min(px[i], px[i + 1], px[i + 2]);
        if (lo > 238) px[i + 3] = 0;                       // pure studio white
        else if (lo > 218) px[i + 3] = Math.round(255 * (238 - lo) / 20); // soft edge
      }
      octx.putImageData(data, 0, 0);
    } catch {
      /* tainted canvas — draw unkeyed rather than fail */
    }
    const zone = { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.6 };
    const s = Math.min(zone.w / img.width, zone.h / img.height);
    const dw = img.width * s, dh = img.height * s;
    const dx = zone.x + (zone.w - dw) / 2, dy = zone.y + (zone.h - dh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(off, dx, dy, dw, dh);
    ctx.restore();
  }

  // logo chip, top-left
  const chipW = W * 0.18, chipH = H * 0.075, m = W * 0.045;
  ctx.fillStyle = "#c91a09";
  ctx.beginPath();
  ctx.roundRect(m, m, chipW, chipH, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${chipH * 0.52}px 'DM Sans', system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("lEgoarCh", m + chipW / 2, m + chipH / 2 + 1);

  // badges, top-right
  ctx.font = `800 ${H * 0.026}px 'DM Sans', system-ui, sans-serif`;
  ctx.textAlign = "right";
  const badge = (text, x) => {
    const w = ctx.measureText(text).width + H * 0.03;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(x - w, m, w, H * 0.05, 5);
    ctx.fill();
    ctx.fillStyle = "#16181c";
    ctx.fillText(text, x - H * 0.015, m + H * 0.027);
    return x - w - H * 0.015;
  };
  let bx = W - m;
  if (pieces) bx = badge(`${pieces.toLocaleString()} pcs`, bx);
  badge("18+", bx);

  // name band, bottom — the words, OUR words
  const bandY = H * 0.76;
  const grad = ctx.createLinearGradient(0, bandY - H * 0.06, 0, H);
  grad.addColorStop(0, "rgba(5,5,7,0)");
  grad.addColorStop(0.35, "rgba(5,5,7,0.96)");
  grad.addColorStop(1, "rgba(5,5,7,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY - H * 0.06, W, H - bandY + H * 0.06);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `700 ${H * 0.024}px 'DM Sans', system-ui, sans-serif`;
  ctx.fillText((setCopy?.series || "lEgoarCh · Architecture").toUpperCase(), m, bandY + H * 0.02);

  ctx.fillStyle = "#ffffff";
  let nameSize = H * 0.052;
  ctx.font = `900 ${nameSize}px 'DM Sans', system-ui, sans-serif`;
  const name = setCopy?.set_name || "Untitled set";
  while (ctx.measureText(name).width > W * 0.72 && nameSize > H * 0.03) {
    nameSize *= 0.94;
    ctx.font = `900 ${nameSize}px 'DM Sans', system-ui, sans-serif`;
  }
  ctx.fillText(name, m, bandY + H * 0.085);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${H * 0.042}px ui-monospace, monospace`;
  ctx.fillText(setCopy?.set_number || "", W - m, bandY + H * 0.085);
}

function useFrontTexture(imageUrl, setCopy, pieces) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let alive = true;
    const W = 1280, H = Math.round((1280 * BH) / BW);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const finish = (img) => {
      if (!alive) return;
      drawFrontPanel(ctx, W, H, img, setCopy, pieces);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      setTex(t);
    };
    if (imageUrl) {
      const img = new Image();
      img.onload = () => finish(img);
      img.onerror = () => finish(null);
      img.src = imageUrl;
    } else finish(null);
    return () => { alive = false; };
  }, [imageUrl, setCopy, pieces]);
  return tex;
}

// ---------------------------------------------------------------------------
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
// a little cardboard spring at the end of each fold
const easeBack = (t) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const PANEL_T = 0.024;          // cardboard thickness
const FLOOR_Y = -1.45;          // studio floor (world)
const FLAP_SHORT = BH * 0.3;    // flaps on the x walls, fold first
const FLAP_LONG = BH * 0.5;     // flaps on the z walls, meet in the middle

// Timeline (seconds): die-cut -> walls -> rain -> flaps -> tip-up -> settle
const T_WALLS = 0.5, T_WALLS_D = 0.55;     // each wall fold duration
const T_RAIN = 1.5, T_RAIN_END = 3.1;
const T_FLAP_S = 3.2, T_FLAP_L = 3.7;
const T_FLIP = 4.5, T_FLIP_D = 1.1;

/** One side of the carton: wall hinged at the floor panel's edge, flap
 *  hinged at the wall's far edge. Data-driven so all four sides share it. */
function Side({ axis, sign, wallLen, flapDepth, mats, wallRef, flapRef }) {
  // local frame before fold: wall lies flat, extending OUTWARD from hinge
  const along = axis === "z" ? [wallLen, PANEL_T, BD] : [BD, PANEL_T, wallLen];
  const flapSize = axis === "z" ? [wallLen, PANEL_T, flapDepth] : [flapDepth, PANEL_T, wallLen];
  const out = (v) => (axis === "z" ? [0, 0, sign * v] : [sign * v, 0, 0]);
  return (
    <group position={out(axis === "z" ? BH / 2 : BW / 2)} ref={wallRef}>
      <mesh position={out(BD / 2)} material={mats} castShadow receiveShadow>
        <boxGeometry args={along} />
      </mesh>
      <group position={out(BD)} ref={flapRef}>
        <mesh position={out(flapDepth / 2)} material={mats} castShadow>
          <boxGeometry args={flapSize} />
        </mesh>
      </group>
    </group>
  );
}

function PackingScene({ frontTex, rain, reduced, replayKey }) {
  const t0 = useRef(null);
  const swayRef = useRef();
  const flipRef = useRef();
  const brickRefs = useRef([]);
  const wallRefs = [useRef(), useRef(), useRef(), useRef()]; // z+, z-, x+, x-
  const flapRefs = [useRef(), useRef(), useRef(), useRef()];
  const snaps = useRef(0);

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
  const wallMats = useMemo(
    () => [kraft, kraft, kraft, black, kraft, kraft],
    [kraft, black]
  );
  const floorMats = useMemo(
    () => [kraft, kraft, kraft, artMat, kraft, kraft],
    [kraft, artMat]
  );

  useEffect(() => { t0.current = null; snaps.current = 0; }, [replayKey]);

  // wall fold: local rotation that lifts the outward extension to vertical
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
    const t = reduced ? 1e3 : state.clock.elapsedTime - t0.current;

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
      // keep the box centre-stage while it tips
      flipRef.current.position.z = THREE.MathUtils.lerp(-BH / 2, BH / 2 + 0.1, p * 0.55);
      if (p >= 1 && snaps.current === 5) { snaps.current = 6; playSnap(); }
    }

    // 5) settled packshot sway
    if (swayRef.current) {
      const settled = clamp01((t - (T_FLIP + T_FLIP_D)) / 1);
      swayRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.14 * settled;
    }
  });

  return (
    <group ref={swayRef}>
      {/* hinge group: origin at the back floor edge of the lying carton */}
      <group ref={flipRef} position={[0, FLOOR_Y, -BH / 2]}>
        <group position={[0, PANEL_T / 2, BH / 2]}>
          {/* floor panel — its OUTER (down) face is the printed front art */}
          <mesh material={floorMats} receiveShadow castShadow>
            <boxGeometry args={[BW, PANEL_T, BH]} />
          </mesh>
          <Side axis="z" sign={1} wallLen={BW} flapDepth={FLAP_LONG} mats={wallMats} wallRef={wallRefs[0]} flapRef={flapRefs[0]} />
          <Side axis="z" sign={-1} wallLen={BW} flapDepth={FLAP_LONG} mats={wallMats} wallRef={wallRefs[1]} flapRef={flapRefs[1]} />
          <Side axis="x" sign={1} wallLen={BH} flapDepth={FLAP_SHORT} mats={wallMats} wallRef={wallRefs[2]} flapRef={flapRefs[2]} />
          <Side axis="x" sign={-1} wallLen={BH} flapDepth={FLAP_SHORT} mats={wallMats} wallRef={wallRefs[3]} flapRef={flapRefs[3]} />
          {/* the set's own bricks, raining in */}
          {rain.map((b, i) => (
            <mesh
              key={`${replayKey}-${i}`}
              ref={(el) => (brickRefs.current[i] = el)}
              geometry={b.geo || undefined}
              scale={0.22}
              castShadow
              visible={false}
            >
              {!b.geo && <boxGeometry args={[1, 1.2, 2]} />}
              <meshStandardMaterial color={b.hex} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
      {/* studio sweep */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={0.22} />
      </mesh>
    </group>
  );
}

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
  const [geosReady, setGeosReady] = useState(false);
  const exportRef = useRef(null);
  const pieces = brickModel?.stability?.nBricks;
  const frontTex = useFrontTexture(imageUrl, setCopy, pieces);

  // sample the SET'S OWN pieces for the rain: real parts, real colours
  const rain = useMemo(() => {
    const src = brickModel?.bricks || [];
    const picks = [];
    const n = Math.min(34, src.length);
    for (let i = 0; i < n; i++) {
      const b = src[Math.floor((i * 9973) % src.length)];
      // local frame of the LYING carton: wide x (BW), deep z (BH), shallow y (BD)
      picks.push({
        part: b.part,
        hex: b.hex || "#c91a09",
        x: (Math.sin(i * 12.9898) * 0.5) * (BW - 0.7),
        z: (Math.sin(i * 78.233) * 0.5) * (BH - 0.7),
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

  useEffect(() => {
    let alive = true;
    Promise.all(rain.map((b) => loadPartGeometry(b.part))).then(() => {
      if (!alive) return;
      rain.forEach((b) => { b.geo = partGeometryOf(b.part) || null; });
      setGeosReady(true);
    });
    return () => { alive = false; };
  }, [rain]);

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
      <p className="text-[11px] text-muted">
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
