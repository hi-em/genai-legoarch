// The "spine slider" reveal viewer: ONE 3D scene, one camera — a draggable
// vertical divider wipes between the raw TRELLIS mesh (left) and the solved
// LEGO build (right) via two complementary clipping planes recomputed from the
// live camera every frame, so the divider stays glued to the screen while the
// model auto-rotates. Falls back to the plain BrickViewer if the GLB is
// missing or fails to load.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import { GripVertical, Maximize2, Download } from "lucide-react";
import { BrickInstances, Baseplate, modelOffset, worldHeight } from "./bricks3d.jsx";
import BrickViewer from "./BrickViewer.jsx";
import CaptureBridge from "./CaptureBridge.jsx";
import { useDataUrlGLB } from "./useDataUrlGLB.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import { VIEWER_BG } from "../lib/tokens.js";
import { Lightbox } from "../components/ui/index.js";
import { downloadDataUrl } from "../hero/trophies/downloadImage.js";
import { cn } from "../lib/cn.js";

// Per-frame: turn the divider's screen-x fraction into a world-space plane
// through the camera. Mutates the SAME two THREE.Plane objects the materials
// reference — no material rebuilds, no React re-renders.
function ClipRig({ dividerRef, planeRight, planeLeft }) {
  const { camera } = useThree();
  const tmp = useMemo(
    () => ({
      a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
      ab: new THREE.Vector3(), ac: new THREE.Vector3(), n: new THREE.Vector3(),
      fwd: new THREE.Vector3(), right: new THREE.Vector3(),
    }),
    []
  );
  useFrame(() => {
    const { a, b, c, ab, ac, n, fwd, right } = tmp;
    const ndcX = dividerRef.current * 2 - 1;
    // three points spanning the locus that projects to screen-x = divider
    a.set(ndcX, 0, -1).unproject(camera);
    b.set(ndcX, 0, 1).unproject(camera);
    c.set(ndcX, 1, -1).unproject(camera);
    n.copy(ab.subVectors(b, a)).cross(ac.subVectors(c, a)).normalize();
    // orient the normal toward screen-right so planeRight KEEPS the right side
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    if (n.dot(right) < 0) n.negate();
    planeRight.setFromNormalAndCoplanarPoint(n, a);
    planeLeft.copy(planeRight).negate();   // exact complement, no allocation
  });
  return null;
}

// The raw TRELLIS mesh, clipped to the LEFT of the spine and aligned to the
// brick model's box: uniform-scale to match height, bottoms + centers aligned.
function RawMeshHalf({ scene, brickModel, plane }) {
  const ready = useMemo(() => {
    if (!scene) return null;
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          m.clippingPlanes = [plane];
          m.side = THREE.DoubleSide;   // clipped openings read as a shell, not a void
        }
        o.castShadow = false;          // 40k textured faces casting shadows = perf risk
      }
    });
    // ---- align to the brick model's world box ----
    const [nx, ny, nz] = brickModel.grid;
    const targetH = worldHeight(nz);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.y <= 0) return null;
    // height-match beats max-dim-match: the voxelizer normalised on its own axis
    const s = targetH / size.y;
    const group = new THREE.Group();
    group.add(scene);
    scene.position.set(-center.x, -box.min.y, -center.z);  // bottom-center at origin
    group.scale.setScalar(s);
    // brick model world: X/Z centred by modelOffset, bottom face at -targetH/2
    group.position.set(0, -targetH / 2, 0);
    return group;
  }, [scene, brickModel, plane]);

  if (!ready) return null;
  return <primitive object={ready} />;
}

// DOM overlay: the spine line + a two-stud grip, draggable + keyboard-operable.
function SpineHandle({ dividerRef, onFirstDrag }) {
  const [pos, setPos] = useState(dividerRef.current);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const hostRef = useRef(null);

  const move = (clientX) => {
    const rect = hostRef.current?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const f = Math.min(0.92, Math.max(0.08, (clientX - rect.left) / rect.width));
    dividerRef.current = f;
    setPos(f);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    setDragging(true);
    if (!touched) { setTouched(true); onFirstDrag?.(); }
  };

  const nudge = (d) => {
    const f = Math.min(0.92, Math.max(0.08, dividerRef.current + d));
    dividerRef.current = f;
    setPos(f);
    if (!touched) setTouched(true);
  };

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-y-0"
      style={{ left: `${pos * 100}%` }}
    >
      {/* the spine */}
      <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/80 shadow-[0_0_6px_rgba(0,0,0,.35)]" />
      {/* the grip: a 1x2 plate with two studs — "grab the studs" */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare original 3D mesh and LEGO build"
        aria-valuemin={8}
        aria-valuemax={92}
        aria-valuenow={Math.round(pos * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => dragging && move(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") nudge(-0.02);
          else if (e.key === "ArrowRight") nudge(0.02);
          else if (e.key === "Home") nudge(-1);
          else if (e.key === "End") nudge(1);
        }}
        className={cn(
          "pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
          "flex h-14 w-7 flex-col items-center justify-center gap-1 rounded-full bg-white shadow-pop",
          "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-brand-blue",
          dragging && "scale-110"
        )}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-stone-300 shadow-inner" />
        <GripVertical size={11} className="text-stone-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-stone-300 shadow-inner" />
      </div>
      {/* corner labels fade out once the user has the idea */}
      <div
        className={cn(
          "absolute -left-2 top-3 -translate-x-full transition-opacity duration-700",
          touched ? "opacity-0" : "opacity-100"
        )}
      >
        <span className="rounded-full bg-black/45 px-2 py-0.5 text-nano font-semibold text-white backdrop-blur-sm">
          TRELLIS mesh
        </span>
      </div>
      <div
        className={cn(
          "absolute left-2 top-3 transition-opacity duration-700",
          touched ? "opacity-0" : "opacity-100"
        )}
      >
        <span className="rounded-full bg-black/45 px-2 py-0.5 text-nano font-semibold text-white backdrop-blur-sm">
          LEGO bricks
        </span>
      </div>
    </div>
  );
}

export default function SpineCompareViewer({
  glbUrl, brickModel, height = 420,
  expandable = false, title = "Mesh ↔ build", filename = "compare.png", onCaptureReady,
}) {
  const reduced = useReducedMotion();
  const { scene, error } = useDataUrlGLB(glbUrl);
  const [spin, setSpin] = useState(!reduced);
  const dividerRef = useRef(0.35);
  const snapped = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const fullCap = useRef(null);

  // mutated in place by ClipRig each frame; shared by every clipped material
  const planeRight = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);
  const planeLeft = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);

  // on-mount nudge so the wipe explains itself (reduced motion: static)
  useEffect(() => {
    if (reduced || !scene) return;
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1000);
      dividerRef.current = 0.02 + (0.35 - 0.02) * (1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, reduced]);

  // any failure -> the plain viewer, no UI difference beyond the handle (still
  // expandable + exportable so the build can be inspected/saved)
  if (!glbUrl || error) return <BrickViewer brickModel={brickModel} height={height} expandable={expandable} title="LEGO build" filename={filename} />;
  if (!brickModel) return <div style={{ height, background: VIEWER_BG }} className="rounded-lg" />;

  const [nx, ny, nz] = brickModel.grid;
  const span = Math.max(nx, ny, worldHeight(nz));
  const offset = modelOffset(brickModel.grid);

  return (
    <div style={{ height, background: VIEWER_BG }} className="relative overflow-hidden rounded-lg">
      <Canvas
        shadows
        gl={{ localClippingEnabled: true, preserveDrawingBuffer: true }}   // clipping + PNG capture
        camera={{ position: [span * 1.5, span * 1.25, span * 1.7], fov: 40 }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[12, 20, 9]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-8, 6, -6]} intensity={0.35} />
        <ClipRig dividerRef={dividerRef} planeRight={planeRight} planeLeft={planeLeft} />
        {/* left of the spine: the raw generated mesh */}
        {scene && <RawMeshHalf scene={scene} brickModel={brickModel} plane={planeLeft} />}
        {/* right of the spine: the solved LEGO build */}
        <group position={offset}>
          <BrickInstances bricks={brickModel.bricks} clippingPlanes={[planeRight]} />
          <Baseplate nx={nx} ny={ny} />   {/* unclipped — shared ground under both */}
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
        <CaptureBridge onReady={onCaptureReady} />
      </Canvas>
      <SpineHandle
        dividerRef={dividerRef}
        onFirstDrag={() => {
          if (!snapped.current) { snapped.current = true; playSnap(); }
        }}
      />

      {expandable && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Expand ${title} to full screen`}
          className="absolute bottom-2 right-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/70"
        >
          <Maximize2 size={13} /> Expand
        </button>
      )}

      {expandable && (
        <Lightbox open={expanded} onClose={() => setExpanded(false)} label={`${title} — full screen`}>
          <div className="overflow-hidden rounded-xl shadow-pop">
            {expanded && (
              <SpineCompareViewer
                glbUrl={glbUrl}
                brickModel={brickModel}
                height={Math.min(680, Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 0.7))}
                onCaptureReady={(fn) => (fullCap.current = fn)}
              />
            )}
          </div>
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => { const u = fullCap.current?.(); if (u) downloadDataUrl(filename, u); }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand-red px-4 font-display text-sm font-bold text-white hover:brightness-110"
            >
              <Download size={15} /> Save PNG
            </button>
          </div>
          <p className="mt-2 text-center text-micro text-white/70">Drag the spine to wipe · drag to orbit</p>
        </Lightbox>
      )}
    </div>
  );
}
