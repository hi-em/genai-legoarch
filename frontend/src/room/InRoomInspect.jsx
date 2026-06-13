// The in-room options surface, anchored above the focused box as a drei <Html>
// (pointer-lock is unmounted in every focus mode, so the cursor is free). It is
// the 3D replacement for the old BoxHub modal's job: open the booklet / pieces
// & prices, take the set home (.stl/.ldr/.csv/photo), and either send a staged
// box to the shelf or close an opened wall set.
import { useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { BookOpen, Receipt, Download, Star, X } from "lucide-react";
import { toast } from "../components/ui/index.js";
import { downloadDataUrl } from "../hero/trophies/downloadImage.js";
import { toLdraw, download, partsToCsv } from "../lib/ldraw.js";
import { downloadMeshStl } from "../viewer/loadGlbScene.js";
import { useRoomStage } from "./useRoomStage.js";

export default function InRoomInspect({ item, bm, origin, anchor, onShelve, onClose }) {
  const openInspect = useRoomStage((s) => s.openInspect);
  const mode = useRoomStage((s) => s.mode);
  const { gl, scene, camera } = useThree();
  const [stlBusy, setStlBusy] = useState(false);

  const safe = (item.setCopy?.set_name || item.title || "set").replace(/[^\w]+/g, "_");
  const meshUrl = item.glbName ? `/api/mesh/${item.glbName}` : null;

  async function onStl() {
    if (!meshUrl) { toast.info("3D file isn't available", "Forge this set again to export its mesh."); return; }
    setStlBusy(true);
    try { await downloadMeshStl(meshUrl, `${safe}.stl`); toast.success("3D model saved", "Printable .stl in your downloads."); }
    catch { toast.error("Couldn't export the 3D file", "The mesh may have expired on the server."); }
    finally { setStlBusy(false); }
  }
  const onLdraw = () => { download(`${safe}.ldr`, toLdraw(bm)); toast.success("LEGO file saved", "Opens in BrickLink Studio."); };
  const onCsv = () => { download(`${safe}_parts.csv`, partsToCsv(bm.parts)); toast.success("Parts list saved", "CSV in your downloads."); };
  const onPhoto = () => {
    try {
      gl.render(scene, camera);
      downloadDataUrl(`${safe}_box.png`, gl.domElement.toDataURL("image/png"));
      toast.success("Photo saved", "A shot of your set in the room.");
    } catch { toast.error("Couldn't grab a photo", "Try again from a clearer angle."); }
  };

  // staged-idle: the packed box waits; prompt the click that opens the options
  if (mode === "staged-idle") {
    return (
      <Html position={anchor} center distanceFactor={9} zIndexRange={[24, 0]}>
        <button onClick={() => openInspect(null)}
          className="whitespace-nowrap rounded-full bg-brand-red px-4 py-1.5 text-sm font-semibold text-white shadow-pop hover:brightness-110">
          Open the box
        </button>
      </Html>
    );
  }

  const chip = "inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95 disabled:opacity-50";

  return (
    <Html position={anchor} center distanceFactor={9} zIndexRange={[24, 0]}>
      <div className="w-[300px] rounded-xl bg-elevated p-3 text-ink shadow-pop">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-black">{item.setCopy?.set_name || item.title || "Your set"}</p>
          <button onClick={onClose} aria-label="Close" className="grid h-6 w-6 place-items-center rounded-full bg-sunken text-muted hover:text-ink"><X size={13} /></button>
        </div>
        <p className="mt-0.5 text-nano uppercase tracking-widest text-muted">Open the box</p>
        <div className="mt-1.5 grid grid-cols-1 gap-1.5">
          <button onClick={() => openInspect("booklet")} className="flex items-center gap-2 rounded-lg bg-sunken px-2.5 py-2 text-left hover:brightness-95">
            <BookOpen size={16} /> <span className="text-sm font-semibold">Inspect the booklet</span>
          </button>
          <button onClick={() => openInspect("priced")} className="flex items-center gap-2 rounded-lg bg-sunken px-2.5 py-2 text-left hover:brightness-95">
            <Receipt size={16} /> <span className="text-sm font-semibold">Review pieces & prices</span>
          </button>
        </div>
        <p className="mt-2 text-nano uppercase tracking-widest text-muted">Take it home</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button onClick={onStl} disabled={stlBusy} className={chip}><Download size={12} /> {stlBusy ? "Exporting…" : ".stl"}</button>
          <button onClick={onLdraw} className={chip}><Download size={12} /> .ldr</button>
          <button onClick={onCsv} className={chip}><Download size={12} /> .csv</button>
          <button onClick={onPhoto} className={chip}><Download size={12} /> photo</button>
        </div>
        <div className="mt-3">
          {origin === "staging" ? (
            <button onClick={onShelve} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-brand-red px-3 py-2 text-sm font-bold text-white hover:brightness-110">
              <Star size={14} /> Add to shelf
            </button>
          ) : (
            <button onClick={onClose} className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-ink px-3 py-2 text-sm font-bold text-white hover:brightness-110">
              Back to the room
            </button>
          )}
        </div>
      </div>
    </Html>
  );
}
