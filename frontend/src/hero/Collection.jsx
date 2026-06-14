import { ArrowLeft, Sparkles } from "lucide-react";
import { useCollection, useView } from "../state/store.js";
import { Button } from "../components/ui/index.js";
import ShelfGate from "../shelf/ShelfGate.jsx";
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

// The collection page: a bright 3D orbit shelf of saved sets (ShelfGate), with
// an accessible list fallback/toggle and the shared explore modal living inside
// the gate. Opening a set happens IN the shelf layer now — no separate detail
// page. Header + empty-state are all that remain here.
export default function Collection() {
  const items = useCollection((s) => s.items);
  const remove = useCollection((s) => s.remove);
  const show = useView((s) => s.show);

  return (
    <div className="felt flex min-h-full w-full flex-col">
      <Header>{items.length} {items.length === 1 ? "set" : "sets"}</Header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pb-20 text-center">
          <h2 className="font-display text-2xl font-black text-on-dark">Your shelf is empty</h2>
          <p className="max-w-[360px] text-on-dark-muted">Turn a building into a buildable set and add it here — your collection survives reloads.</p>
          <Button variant="primary" onClick={() => show("hero")}><Sparkles size={15} /> Visualize a set</Button>
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col px-5 pb-8">
          <div className="mx-auto h-[calc(100dvh-150px)] min-h-[460px] w-full max-w-[1400px]">
            <ShelfGate items={items} onRemove={remove} />
          </div>
        </div>
      )}
    </div>
  );
}
