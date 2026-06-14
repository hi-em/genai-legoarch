// Decides how the collection is shown and degrades gracefully:
//   no WebGL / shelf crash  -> plain accessible list (same CollectionList)
//   otherwise               -> the bright 3D orbit shelf (ShelfScene)
// A visible "List view" toggle lets anyone drop to the grid on purpose. This
// layer also owns selection: clicking a set (in either view) opens the shared
// explore surface (BoxHub: booklet · pieces & prices · downloads), and removing
// a set is confirmed here so the 3D affordance, the list trash, and the sr-only
// button all funnel through one guard.
import { useMemo, useState } from "react";
import { List, Boxes } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { hasWebGL } from "../lib/webgl.js";
import { normalizeAdapted } from "../lib/brickModel.js";
import ShelfScene from "./ShelfScene.jsx";
import CollectionList from "../room/CollectionList.jsx";
import TrophyShell from "../hero/trophies/TrophyShell.jsx";
import BoxHub from "../hero/trophies/BoxHub.jsx";

export default function ShelfGate({ items, onRemove }) {
  const webgl = useMemo(hasWebGL, []);
  const [forceList, setForceList] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const selected = selectedId ? items.find((i) => i.id === selectedId) : null;
  const use3D = webgl && !forceList;

  // One confirm path for every remove affordance (3D trash, list trash, sr-only).
  const askRemove = (id) => {
    const it = items.find((i) => i.id === id);
    const ok = window.confirm(`Remove “${it?.title || "this set"}” from your shelf? This can’t be undone.`);
    if (!ok) return;
    onRemove(id);
    if (selectedId === id) setSelectedId(null); // closing the modal repaints the demand canvas
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      {webgl && (
        <div className="mb-2 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setForceList((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95"
          >
            {use3D ? <><List size={13} /> List view</> : <><Boxes size={13} /> Shelf view</>}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {use3D ? (
          <ErrorBoundary silent onError={() => setForceList(true)}>
            <ShelfScene items={items} onSelect={(it) => setSelectedId(it.id)} onRemove={askRemove} />
          </ErrorBoundary>
        ) : (
          <div className="h-full overflow-y-auto pb-4">
            <CollectionList items={items} onSelect={(it) => setSelectedId(it.id)} onRemove={askRemove} />
          </div>
        )}
      </div>

      <TrophyShell open={!!selected} onClose={() => setSelectedId(null)} title="Your boxed set">
        {selected && (
          <BoxHub
            imageUrl={selected.renderThumb || null}
            setCopy={selected.setCopy || { set_name: selected.title, set_number: selected.setNumber }}
            brickModel={normalizeAdapted(selected.brickModel)}
            glbName={selected.glbName}
          />
        )}
      </TrophyShell>
    </div>
  );
}
