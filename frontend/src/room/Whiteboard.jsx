// The collector's whiteboard on the back wall: what to legolize next (a
// wishlist you can add to, each note one click from seeding a fresh build),
// plus the running value of everything on display and a rough resale line.
// Rendered as a drei <Html> panel anchored to a physical board — interactive
// whenever the mouse is free (Esc out of look-mode, or in orbit/touch mode).
import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { useWishlist, useCollection, useBuild, useView } from "../state/store.js";
import { normalizeAdapted } from "../lib/brickModel.js";
import { estimateCost, resellEstimate, fmtUSD } from "../lib/pricing.js";

export default function Whiteboard({ dims }) {
  const wishlist = useWishlist((s) => s.items);
  const add = useWishlist((s) => s.add);
  const remove = useWishlist((s) => s.remove);
  const items = useCollection((s) => s.items);
  const [text, setText] = useState("");

  const { total, resell } = useMemo(() => {
    let t = 0;
    for (const it of items) {
      try { t += estimateCost(normalizeAdapted(it.brickModel).parts).total || 0; } catch { /* skip */ }
    }
    return { total: t, resell: resellEstimate(t) };
  }, [items]);

  const legolize = (prompt) => {
    useBuild.getState().reset();
    useBuild.getState().set({ prompt });
    useView.getState().show("hero");
  };
  const onAdd = (e) => {
    e.preventDefault();
    if (text.trim()) { add(text); setText(""); }
  };

  return (
    <group position={[0, 2.7, -dims.depth / 2 + 0.13]}>
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[8.9, 4.9, 0.12]} />
        <meshStandardMaterial color="#3b3128" roughness={0.8} />
      </mesh>
      <mesh>
        <planeGeometry args={[8.5, 4.5]} />
        <meshStandardMaterial color="#f4f5f2" roughness={0.85} />
      </mesh>
      <Html position={[0, 0, 0.07]} center distanceFactor={6.2} zIndexRange={[30, 0]}>
        <div style={{ width: 520 }} className="rounded-lg bg-[#f4f5f2] p-4 text-left text-ink">
          <div className="flex items-end justify-between border-b border-black/10 pb-2">
            <div>
              <p className="text-nano uppercase tracking-widest text-muted">The collector's board</p>
              <p className="font-display text-lg font-black text-ink">Next on the workbench</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-black text-ink">{fmtUSD(total)}</p>
              <p className="text-micro text-muted">shelf value · resell ≈ {fmtUSD(resell)}</p>
            </div>
          </div>

          <form onSubmit={onAdd} className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Name a building to legolize next…"
              className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-blue"
            />
            <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-ink px-2.5 py-1.5 text-sm font-semibold text-white hover:brightness-110">
              <Plus size={14} /> Add
            </button>
          </form>

          <div className="mt-3 grid max-h-[150px] grid-cols-1 gap-1.5 overflow-y-auto pr-1">
            {wishlist.length === 0 && (
              <p className="text-sm text-muted">Pin the next landmark you want as a set.</p>
            )}
            {wishlist.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-md bg-[#fff3c4] px-2.5 py-1.5 shadow-sm">
                <span className="truncate text-sm font-semibold text-ink">{w.text}</span>
                <span className="ml-2 flex shrink-0 gap-1">
                  <button
                    onClick={() => legolize(w.text)}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-micro font-semibold text-white hover:brightness-110"
                  >
                    <Sparkles size={11} /> Legolize
                  </button>
                  <button onClick={() => remove(w.id)} aria-label="Remove" className="grid h-5 w-5 place-items-center rounded-full text-muted hover:text-brand-red">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Html>
    </group>
  );
}
