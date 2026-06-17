// The "expand the box art" inspector — a tabbed, full-screen look at the set's
// four faces, each its own artifact:
//   • Box     — the sealed FULL-BLACK 3D carton, printed front + back, orbitable
//   • Render  — the raw FLUX image of the building, alone
//   • Mesh    — the TRELLIS 3D mesh (reuses MeshViewer; skipped if no glbName)
//   • Booklet — a closed 3D instruction booklet (cover = the box art)
// Only the active tab mounts its WebGL canvas, so there's one live context at a
// time. Box + booklet share the painted cover/back textures (boxTexture.js).
// "Save PNG" grabs the active view: a screenshot of the live canvas (box / mesh
// / booklet) or the render image itself.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Box, Image as ImageIcon, Boxes, BookOpen, Download } from "lucide-react";
import { Lightbox } from "../../components/ui/index.js";
import { ClosedCarton } from "../../transition/PackingScene.jsx";
import { BOX, buildFrontTexture, buildBackTexture } from "../../lib/boxTexture.js";
import { setPrice } from "../../lib/pricing.js";
import MeshViewer from "../../viewer/MeshViewer.jsx";
import { downloadDataUrl } from "./downloadImage.js";

const VIEW_H = 520;                 // px height of the view stage (matches Lightbox width ~860)
const COVER_RED = "#b1271b";        // LEGO-manual cover/spine red

// --- the sealed black carton, orbitable (front + back printed) -------------
function CartonScene({ front, back }) {
  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [2.6, 1.7, 4.6], fov: 35 }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, 4, -4]} intensity={0.4} />
      <group position={[0, 0.1, 0]}>
        <ClosedCarton frontTex={front} backTex={back} />
      </group>
      <ContactShadows position={[0, -BOX.BH / 2, 0]} opacity={0.4} scale={10} blur={2.4} far={12} />
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.9} minDistance={3} maxDistance={11} />
    </Canvas>
  );
}

// --- a closed instruction booklet (cover art on the front board) -----------
function BookletScene({ tex }) {
  const w = 2.1, h = 1.52, d = 0.22, ct = 0.028;     // landscape board ~ box aspect, thin
  const front = useMemo(
    () => new THREE.MeshStandardMaterial({ map: tex || null, color: tex ? "#ffffff" : COVER_RED, roughness: 0.42 }),
    [tex]
  );
  const cover = useMemo(() => new THREE.MeshStandardMaterial({ color: COVER_RED, roughness: 0.5 }), []);
  const pages = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.95 }), []);
  useEffect(() => () => { front.dispose(); cover.dispose(); pages.dispose(); }, [front, cover, pages]);
  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [1.7, 1.15, 3.2], fov: 35 }}>
      <ambientLight intensity={0.78} />
      <directionalLight position={[5, 9, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 4, -3]} intensity={0.32} />
      <group rotation={[0, -0.18, 0]}>
        {/* page block — slightly smaller than the boards so white edges show */}
        <mesh material={pages} castShadow receiveShadow><boxGeometry args={[w * 0.95, h * 0.95, d - 2 * ct]} /></mesh>
        {/* front board: art keyed to the +z face */}
        <mesh position={[0, 0, d / 2 - ct / 2]} material={[cover, cover, cover, cover, front, cover]} castShadow>
          <boxGeometry args={[w, h, ct]} />
        </mesh>
        {/* back board + spine */}
        <mesh position={[0, 0, -d / 2 + ct / 2]} material={cover} castShadow><boxGeometry args={[w, h, ct]} /></mesh>
        <mesh position={[-w / 2 + ct / 2, 0, 0]} material={cover} castShadow><boxGeometry args={[ct, h, d]} /></mesh>
      </group>
      <ContactShadows position={[0, -h / 2 - 0.04, 0]} opacity={0.38} scale={8} blur={2.4} far={10} />
      <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.9} minDistance={2.4} maxDistance={9} />
    </Canvas>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 font-display text-sm font-bold transition " +
        (active
          ? "bg-ink text-white shadow-plate-flat"
          : "bg-sunken text-muted hover:text-ink hover:brightness-95")
      }
    >
      <Icon size={14} /> {label}
    </button>
  );
}

export default function SetInspector({ open, onClose, imageUrl, setCopy, brickModel, glbName }) {
  const pieces = brickModel?.stability?.nBricks ?? brickModel?.bricks?.length;
  const price = useMemo(() => setPrice(brickModel), [brickModel]); // box back panel = priced-set total
  const meshUrl = glbName ? `/api/mesh/${glbName}` : null;
  const [tab, setTab] = useState("box");
  const [tex, setTex] = useState({ front: null, back: null });
  const stageRef = useRef(null);

  // re-anchor to the box every time the inspector (re)opens
  useEffect(() => { if (open) setTab("box"); }, [open]);

  // paint the shared front + back textures once per open; dispose on close
  useEffect(() => {
    if (!open) return;
    let alive = true; let f = null; let b = null;
    Promise.all([
      buildFrontTexture({ imageUrl, setCopy, pieces, width: 1280 }),
      buildBackTexture({ imageUrl, setCopy, pieces, price, width: 1280 }),
    ]).then(([ft, bt]) => {
      if (alive) { f = ft; b = bt; setTex({ front: ft, back: bt }); }
      else { ft.dispose?.(); bt.dispose?.(); }
    });
    return () => { alive = false; f?.dispose?.(); b?.dispose?.(); setTex({ front: null, back: null }); };
  }, [open, imageUrl, setCopy, pieces, price]);

  const tabs = [
    { id: "box", label: "Box", icon: Box },
    imageUrl && { id: "render", label: "Render", icon: ImageIcon },
    meshUrl && { id: "mesh", label: "Mesh", icon: Boxes },
    { id: "booklet", label: "Booklet", icon: BookOpen },
  ].filter(Boolean);

  const name = setCopy?.set_name || "Your set";
  const safe = (setCopy?.set_name || "set").replace(/[^a-z0-9]+/gi, "_").toLowerCase().replace(/^_|_$/g, "") || "set";

  // grab the active view as a PNG — the live canvas for 3D tabs, the file itself
  // for the render tab. Every canvas mounts with preserveDrawingBuffer, so a
  // direct toDataURL on the one canvas in the stage reads its current frame.
  const saveView = () => {
    if (tab === "render") { if (imageUrl) downloadDataUrl(`${safe}-render.png`, imageUrl); return; }
    const cv = stageRef.current?.querySelector("canvas");
    if (!cv) return;
    try { downloadDataUrl(`${safe}-${tab}.png`, cv.toDataURL("image/png")); } catch { /* tainted */ }
  };

  return (
    <Lightbox open={open} onClose={onClose} label={`${name} — inspect`}>
      <div className="rounded-2xl bg-elevated p-3 shadow-pop sm:p-4">
        <div role="tablist" aria-label="Set views" className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <TabButton key={t.id} active={tab === t.id} icon={t.icon} label={t.label} onClick={() => setTab(t.id)} />
          ))}
        </div>

        <div ref={stageRef} className="relative overflow-hidden rounded-xl bg-[#0c0d10]" style={{ height: VIEW_H }}>
          {tab === "render" ? (
            <div className="grid h-full place-items-center p-3">
              {imageUrl ? (
                <img src={imageUrl} alt={`${name} — generated render`} className="max-h-full max-w-full rounded-lg object-contain" />
              ) : (
                <p className="text-sm text-on-dark-muted">No render saved for this set.</p>
              )}
            </div>
          ) : tab === "mesh" ? (
            <MeshViewer glbUrl={meshUrl} height={VIEW_H} />
          ) : tab === "box" ? (
            <CartonScene front={tex.front} back={tex.back} />
          ) : (
            <BookletScene tex={tex.front} />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-micro text-muted">
            {tab === "render"
              ? "The raw FLUX image of the building."
              : tab === "mesh"
                ? "The TRELLIS 3D mesh — drag to orbit."
                : tab === "box"
                  ? "Full black box, printed front and back — drag to orbit."
                  : "Drag to orbit · scroll to zoom."}
          </p>
          <button
            onClick={saveView}
            disabled={tab === "render" && !imageUrl}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-red px-4 font-display text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            <Download size={15} /> Save PNG
          </button>
        </div>
      </div>
    </Lightbox>
  );
}
