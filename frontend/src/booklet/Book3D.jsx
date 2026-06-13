// A real 3D instruction booklet inside the room Canvas: an open book showing
// TWO pages at once (a spread), turned with a hinged leaf that sweeps about the
// spine. Cover spread = the box-front art (left) + the finished build (right);
// step spreads = two consecutive build steps. Reuses the SAME iso renders as
// the PDF (useStepThumbs/isoStepThumb) so print and screen match. Reduced
// motion swaps spreads with no leaf rotation. Materials are declarative so R3F
// updates maps in place (no per-frame allocation); the turn advances in a ref
// (no per-frame React state).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { buildBookletPages } from "./bookletPages.js";
import { useStepThumbs } from "./useStepThumbs.js";
import { usePageTextures } from "./usePageTextures.js";
import { useFrontTexture } from "../transition/PackingScene.jsx";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import { generateBooklet } from "../lib/booklet.js";

const PAGE_W = 1.0, PAGE_H = 1.32, GAP = 0.015, TURN_MS = 520;
const PAPER = "#efe9da";
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function Leaf({ leafRef, leaf }) {
  return (
    <group ref={leafRef}>
      <mesh position={[leaf.x, 0, 0.012]}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial map={leaf.front || null} color={leaf.front ? "#ffffff" : PAPER} roughness={0.9} />
      </mesh>
      <mesh position={[leaf.x, 0, 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial map={leaf.back || null} color={leaf.back ? "#ffffff" : PAPER} roughness={0.9} />
      </mesh>
    </group>
  );
}

export default function Book3D({ brickModel, setCopy, imageUrl, position = [0, 0, 0], rotation = [-0.4, 0, 0], onClose }) {
  const reduced = useReducedMotion();
  const { steps } = useMemo(() => buildBookletPages(brickModel, setCopy), [brickModel, setCopy]);

  const pages = useMemo(() => {
    const last = steps.length ? steps[steps.length - 1].course : 0;
    const arr = [{ kind: "cover" }, { kind: "iso", course: last }];
    steps.forEach((s) => arr.push({ kind: "iso", course: s.course }));
    if (arr.length % 2 !== 0) arr.push({ kind: "blank" });
    return arr;
  }, [steps]);
  const spreadCount = pages.length / 2;

  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState(null); // { dir } | null
  const leafRef = useRef();
  const tRef = useRef(0);
  const safeTimer = useRef(null);

  const ri = spread * 2 + 1;
  const rightCourse = pages[Math.min(pages.length - 1, ri)]?.course ?? 0;
  const getThumb = useStepThumbs(brickModel, rightCourse, 3, 520);
  const coverTex = useFrontTexture(imageUrl || null, setCopy || null, brickModel?.stability?.nBricks);

  const dataUrlFor = useCallback((i) => {
    const p = pages[i];
    return p && p.kind === "iso" ? getThumb(p.course) : null;
  }, [pages, getThumb]);
  const texFor = usePageTextures(dataUrlFor, pages.length, spread, 1);
  const pageTex = (i) => (pages[i]?.kind === "cover" ? coverTex : texFor(i));

  const commit = useCallback((to) => {
    setSpread(to);
    setTurn(null);
    if (leafRef.current) leafRef.current.rotation.y = 0;
    if (safeTimer.current) { clearTimeout(safeTimer.current); safeTimer.current = null; }
  }, []);

  const go = useCallback((dir) => {
    const to = spread + dir;
    if (turn || to < 0 || to >= spreadCount) return;
    playSnap();
    if (reduced) { setSpread(to); return; }
    tRef.current = 0;
    setTurn({ dir });
    safeTimer.current = setTimeout(() => commit(to), TURN_MS + 140); // frozen-rAF safety
  }, [spread, turn, spreadCount, reduced, commit]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "ArrowRight") go(1);
      else if (e.code === "ArrowLeft") go(-1);
      else if (e.code === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  useEffect(() => () => { if (safeTimer.current) clearTimeout(safeTimer.current); }, []);

  useFrame((_, dt) => {
    if (!turn || !leafRef.current) return;
    tRef.current = Math.min(1, tRef.current + (dt * 1000) / TURN_MS);
    leafRef.current.rotation.y = -Math.PI * easeOut(tRef.current) * turn.dir;
    if (tRef.current >= 1) commit(spread + turn.dir);
  });

  const li = spread * 2;
  const leaf = turn
    ? turn.dir > 0
      ? { x: +(PAGE_W / 2 + GAP), front: pageTex(ri), back: pageTex((spread + 1) * 2) }
      : { x: -(PAGE_W / 2 + GAP), front: pageTex(li), back: pageTex((spread - 1) * 2 + 1) }
    : null;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[PAGE_W * 2 + GAP * 4, PAGE_H + 0.1, 0.06]} />
        <meshStandardMaterial color="#2a241c" roughness={0.8} />
      </mesh>
      <mesh position={[-(PAGE_W / 2 + GAP), 0, 0.001]}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial map={pageTex(li) || null} color={pageTex(li) ? "#ffffff" : PAPER} roughness={0.9} />
      </mesh>
      <mesh position={[+(PAGE_W / 2 + GAP), 0, 0.001]}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
        <meshStandardMaterial map={pageTex(ri) || null} color={pageTex(ri) ? "#ffffff" : PAPER} roughness={0.9} />
      </mesh>

      {leaf && <Leaf leafRef={leafRef} leaf={leaf} />}

      <mesh position={[+(PAGE_W / 2 + GAP), 0, 0.02]} onClick={(e) => { e.stopPropagation(); go(1); }} visible={false}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
      </mesh>
      <mesh position={[-(PAGE_W / 2 + GAP), 0, 0.02]} onClick={(e) => { e.stopPropagation(); go(-1); }} visible={false}>
        <planeGeometry args={[PAGE_W, PAGE_H]} />
      </mesh>

      <Html position={[0, -(PAGE_H / 2) - 0.18, 0.05]} center distanceFactor={9} zIndexRange={[26, 0]}>
        <div className="flex items-center gap-2 rounded-full bg-ink/90 px-2 py-1 text-white shadow-pop">
          <button onClick={() => go(-1)} disabled={spread === 0} aria-label="Previous pages" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="min-w-[80px] text-center text-xs font-semibold" aria-live="polite">
            {spread === 0 ? "Cover" : `Steps ${spread * 2 - 1}–${Math.min(steps.length, spread * 2)} of ${steps.length}`}
          </span>
          <button onClick={() => go(1)} disabled={spread >= spreadCount - 1} aria-label="Next pages" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40"><ChevronRight size={16} /></button>
          <button onClick={() => generateBooklet(brickModel, setCopy)} className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25"><Download size={12} /> PDF</button>
          <button onClick={onClose} aria-label="Close booklet" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"><X size={15} /></button>
        </div>
      </Html>
    </group>
  );
}
