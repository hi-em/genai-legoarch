import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Box, FileText, Receipt, Share2, Download, Sparkles } from "lucide-react";
import { useCollection, useView } from "../state/store.js";
import { totalParts, totalColors, normalizeAdapted, courseCount } from "../lib/brickModel.js";
import { toLdraw, download, partsToCsv } from "../lib/ldraw.js";
import { generateBooklet } from "../lib/booklet.js";
import { Button, StatTile, toast } from "../components/ui/index.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import ShelfWall from "../shelf/ShelfWall.jsx";
import TrophyShell from "./trophies/TrophyShell.jsx";
import TheBox from "./trophies/TheBox.jsx";
import ShareCard from "./trophies/ShareCard.jsx";
import PricedSet from "./trophies/PricedSet.jsx";

function Header({ children }) {
  const show = useView((s) => s.show);
  return (
    <header className="z-10 flex w-full items-center justify-between px-5 py-4">
      <button onClick={() => show("hero")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-dark hover:text-brand-yellow">
        <ArrowLeft size={16} /> Forge
      </button>
      <div className="font-display text-base font-extrabold tracking-tight text-on-dark">
        l<span className="text-brand-yellow">E</span>go<span className="text-brand-red">a</span>r<span className="text-brand-blue">C</span>h
      </div>
      <div className="min-w-[56px] text-right text-[11px] text-on-dark-muted">{children}</div>
    </header>
  );
}

function SetDetail({ set, onBack }) {
  const [trophy, setTrophy] = useState(null);
  const bm = normalizeAdapted(set.brickModel);  // pre-plate saved sets upgrade in place
  const copy = set.setCopy || {};
  const img = set.renderThumb || null;

  function exportLdraw() {
    download(`${(copy.set_name || "set").replace(/[^\w]+/g, "_")}.ldr`, toLdraw(bm));
    toast.success("LDraw saved", "Opens in BrickLink Studio.");
  }

  return (
    <div className="mx-auto w-full max-w-[920px] px-5 pb-16">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-on-dark-muted hover:text-on-dark">
        <ArrowLeft size={15} /> All sets
      </button>
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
        <BrickViewer brickModel={bm} height={420} />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
            lEgoarCh · {copy.series || "Architecture"}{copy.set_number ? ` · ${copy.set_number}` : ""}
          </p>
          <h2 className="mt-1 font-display text-3xl font-black leading-tight text-on-dark">{copy.set_name || set.title}</h2>
          {copy.box_blurb && <p className="mt-1.5 text-sm text-on-dark-muted">{copy.box_blurb}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatTile value={totalParts(bm)} label="pieces" />
            <StatTile value={`${bm.grid[0]}×${bm.grid[1]}×${courseCount(bm)}`} label="studs × studs × courses" />
            <StatTile value={totalColors(bm)} label="colors" />
            <StatTile value={bm.stability.connected ? "Stable" : "Check"} label={`${Math.round(bm.stability.supportRatio * 100)}% supported`} variant={bm.stability.connected ? "ok" : "warn"} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              [Box, "The Box", () => setTrophy("box")],
              [FileText, "Instructions", () => { toast.info("Building your manual…", "Rendering pages."); setTimeout(() => generateBooklet(bm, copy), 30); }],
              [Receipt, "Priced set", () => setTrophy("priced")],
              [Share2, "Share card", () => setTrophy("share")],
              [Download, "LDraw", exportLdraw],
              [Download, "Parts CSV", () => download(`${(copy.set_name || "set").replace(/[^\w]+/g, "_")}_parts.csv`, partsToCsv(bm.parts))],
            ].map(([Icon, label, onClick]) => (
              <button key={label} onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95">
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TrophyShell open={!!trophy} onClose={() => setTrophy(null)} title={{ box: "The Box", share: "Share card", priced: "Priced set" }[trophy] || ""}>
        {trophy === "box" && <TheBox imageUrl={img} brickModel={bm} setCopy={copy} />}
        {trophy === "share" && <ShareCard imageUrl={img} brickModel={bm} setCopy={copy} />}
        {trophy === "priced" && <PricedSet brickModel={bm} setCopy={copy} />}
      </TrophyShell>
    </div>
  );
}

// shelf | grid — persisted so the choice survives reloads; shelf is the default.
const VIEW_KEY = "lEgoarCh.collectionView";
const loadViewMode = () => {
  try { return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "shelf"; } catch { return "shelf"; }
};

function ViewToggle({ mode, onPick }) {
  return (
    <div className="mx-auto mb-4 flex w-fit items-center gap-1 rounded-pill border border-border-dark bg-black/25 p-1">
      {[["shelf", "Shelf"], ["grid", "Grid"]].map(([m, label]) => (
        <button
          key={m}
          onClick={() => onPick(m)}
          className={
            "rounded-pill px-3.5 py-1 text-xs font-semibold transition-colors " +
            (mode === m ? "bg-elevated text-ink shadow-plate-flat" : "text-on-dark-muted hover:text-on-dark")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Collection() {
  const items = useCollection((s) => s.items);
  const remove = useCollection((s) => s.remove);
  const show = useView((s) => s.show);
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState(loadViewMode);

  function pickView(m) {
    setViewMode(m);
    try { localStorage.setItem(VIEW_KEY, m); } catch {}
  }

  const current = selected && items.find((i) => i.id === selected);

  return (
    <div className="felt flex min-h-full w-full flex-col">
      <Header>{items.length} {items.length === 1 ? "set" : "sets"}</Header>

      {current ? (
        <SetDetail set={current} onBack={() => setSelected(null)} />
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-20 text-center">
          <h2 className="font-display text-2xl font-black text-on-dark">Your shelf is empty</h2>
          <p className="max-w-[360px] text-on-dark-muted">Forge a building into a buildable set and add it here — your collection survives reloads.</p>
          <Button variant="primary" onClick={() => show("hero")}><Sparkles size={15} /> Forge a set</Button>
        </div>
      ) : viewMode === "shelf" ? (
        <div className="flex w-full flex-1 flex-col px-5 pb-8">
          <ViewToggle mode={viewMode} onPick={pickView} />
          <div className="mx-auto h-[calc(100dvh-200px)] min-h-[420px] w-full max-w-[1200px]">
            <ShelfWall items={items} onSelect={(it) => setSelected(it.id)} />
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col px-5 pb-16">
          <ViewToggle mode={viewMode} onPick={pickView} />
          <div className="mx-auto grid w-full max-w-[1000px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="group relative cursor-pointer overflow-hidden rounded-xl bg-elevated shadow-plate-flat"
              onClick={() => setSelected(it.id)}
            >
              <div className="aspect-square bg-[linear-gradient(#eef3f7,#d7dee5)]">
                {it.thumb && <img src={it.thumb} alt={it.title} className="h-full w-full object-contain" />}
              </div>
              <div className="p-2.5">
                <p className="truncate font-display text-sm font-bold text-ink">{it.title}</p>
                <p className="text-[11px] text-muted">{(it.nBricks || 0).toLocaleString()} pcs{it.setNumber ? ` · ${it.setNumber}` : ""}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(it.id); }}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-brand-red"
                aria-label="Delete set"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
