import { useState } from "react";
import { ArrowLeft, Sparkles, PackageOpen } from "lucide-react";
import { useCollection, useView } from "../state/store.js";
import { totalParts, totalColors, normalizeAdapted, courseCount } from "../lib/brickModel.js";
import { Button, StatTile } from "../components/ui/index.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import RoomGate from "../room/RoomGate.jsx";
import TrophyShell from "./trophies/TrophyShell.jsx";
import BoxHub from "./trophies/BoxHub.jsx";
import Wordmark from "../components/brand/Wordmark.jsx";
import LogoMark from "../components/brand/LogoMark.jsx";

function Header({ children }) {
  const show = useView((s) => s.show);
  return (
    <header className="z-10 flex w-full items-center justify-between px-5 py-4">
      <button onClick={() => show("hero")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-dark hover:text-brand-yellow">
        <ArrowLeft size={16} /> Builder
      </button>
      <span className="flex items-center gap-2">
        <LogoMark size={18} />
        <Wordmark className="text-base text-on-dark" />
      </span>
      <div className="min-w-[56px] text-right text-micro text-on-dark-muted">{children}</div>
    </header>
  );
}

function SetDetail({ set, onBack }) {
  const [open, setOpen] = useState(false);
  const bm = normalizeAdapted(set.brickModel);  // pre-plate saved sets upgrade in place
  const copy = set.setCopy || {};
  const img = set.renderThumb || null;

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
            <StatTile value={`${bm.grid[0]}×${bm.grid[1]}×${courseCount(bm)}`} label="studs × studs × layers" />
            <StatTile value={totalColors(bm)} label="colors" />
            <StatTile value={bm.stability.connected ? "Stable" : "Wobbly"} label={`${Math.round(bm.stability.supportRatio * 100)}% supported`} variant={bm.stability.connected ? "ok" : "warn"} />
          </div>

          <div className="mt-5">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-elevated px-4 py-2.5 font-display text-sm font-bold text-ink shadow-plate-flat hover:brightness-95"
            >
              <PackageOpen size={16} /> Open your boxed set
              <span className="text-micro font-normal text-muted">booklet · pieces & prices · downloads</span>
            </button>
          </div>
        </div>
      </div>

      <TrophyShell open={open} onClose={() => setOpen(false)} title="Your boxed set">
        {open && <BoxHub imageUrl={img} setCopy={copy} brickModel={bm} glbName={set.glbName} />}
      </TrophyShell>
    </div>
  );
}

export default function Collection() {
  const items = useCollection((s) => s.items);
  const remove = useCollection((s) => s.remove);
  const show = useView((s) => s.show);
  const [selected, setSelected] = useState(null);

  const current = selected && items.find((i) => i.id === selected);

  return (
    <div className="felt flex min-h-full w-full flex-col">
      <Header>{items.length} {items.length === 1 ? "set" : "sets"}</Header>

      {current ? (
        <SetDetail set={current} onBack={() => setSelected(null)} />
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-20 text-center">
          <h2 className="font-display text-2xl font-black text-on-dark">Your collector's room is empty</h2>
          <p className="max-w-[360px] text-on-dark-muted">Turn a building into a buildable set and add it here — your collection survives reloads.</p>
          <Button variant="primary" onClick={() => show("hero")}><Sparkles size={15} /> Visualize a set</Button>
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col px-5 pb-8">
          <div className="mx-auto h-[calc(100dvh-150px)] min-h-[460px] w-full max-w-[1400px]">
            <RoomGate items={items} onOpenSet={(it) => setSelected(it.id)} onRemove={remove} />
          </div>
        </div>
      )}
    </div>
  );
}
