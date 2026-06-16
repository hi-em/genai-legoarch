// The box is the hub. One surface, used identically at the reveal and in the
// collector's room: the 3D boxed set you can photograph, that you OPEN for
// what's inside (the flip-book booklet, the pieces & prices), and that you can
// TAKE HOME as a 3D file (.stl / .ldr) or parts list (.csv). Collapses what used
// to be five scattered, duplicated trophies into one object.
import { useState } from "react";
import { ArrowLeft, BookOpen, Receipt, Download } from "lucide-react";
import { toast } from "../../components/ui/index.js";
import ErrorBoundary from "../../components/ErrorBoundary.jsx";
import SetShowcase from "./SetShowcase.jsx";
import PricedSet from "./PricedSet.jsx";
import BookletView from "../../booklet/BookletView.jsx";
import { toLdraw, download, partsToCsv } from "../../lib/ldraw.js";
import { downloadMeshStl } from "../../viewer/loadGlbScene.js";

function BackBar({ onBack, children }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to the box
      </button>
      {children}
    </div>
  );
}

function OpenCard({ icon: Icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl bg-elevated p-3 text-left shadow-plate-flat hover:brightness-95"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink">
        <Icon size={18} />
      </span>
      <span>
        <span className="block font-display text-sm font-bold text-ink">{title}</span>
        <span className="block text-micro text-muted">{sub}</span>
      </span>
    </button>
  );
}

export default function BoxHub({ imageUrl, setCopy, brickModel, glbName }) {
  const [panel, setPanel] = useState("box");
  const [stlBusy, setStlBusy] = useState(false);
  const safe = (setCopy?.set_name || "set").replace(/[^\w]+/g, "_");
  const meshUrl = glbName ? `/api/mesh/${glbName}` : null;

  async function onStl() {
    if (!meshUrl) {
      toast.info("3D file isn't available", "Re-open this set from a fresh build to export its mesh.");
      return;
    }
    setStlBusy(true);
    try {
      await downloadMeshStl(meshUrl, `${safe}.stl`);
      toast.success("3D model saved", "Printable .stl is in your downloads.");
    } catch {
      toast.error("Couldn't export the 3D file", "The mesh may have expired on the server.");
    } finally {
      setStlBusy(false);
    }
  }
  function onLdraw() {
    download(`${safe}.ldr`, toLdraw(brickModel));
    toast.success("LEGO file saved", "Opens in BrickLink Studio.");
  }
  function onCsv() {
    download(`${safe}_parts.csv`, partsToCsv(brickModel.parts));
    toast.success("Parts list saved", "CSV is in your downloads.");
  }

  if (panel === "booklet")
    return (
      <BackBar onBack={() => setPanel("box")}>
        <ErrorBoundary silent>
          <BookletView brickModel={brickModel} setCopy={setCopy} imageUrl={imageUrl} />
        </ErrorBoundary>
      </BackBar>
    );
  if (panel === "priced")
    return (
      <BackBar onBack={() => setPanel("box")}>
        <ErrorBoundary silent>
          <PricedSet brickModel={brickModel} setCopy={setCopy} />
        </ErrorBoundary>
      </BackBar>
    );

  return (
    <div>
      <SetShowcase imageUrl={imageUrl} setCopy={setCopy} brickModel={brickModel} glbName={glbName} />

      <p className="mt-5 text-nano uppercase tracking-widest text-muted">Open the box</p>
      <div className="mt-1.5 grid gap-2.5 sm:grid-cols-2">
        <OpenCard icon={BookOpen} title="Instruction booklet" sub="Flip the pages · download the PDF" onClick={() => setPanel("booklet")} />
        <OpenCard icon={Receipt} title="Pieces & prices" sub="Filter the parts · live BrickLink price" onClick={() => setPanel("priced")} />
      </div>

      <p className="mt-4 text-nano uppercase tracking-widest text-muted">Take it home</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button onClick={onStl} disabled={stlBusy}
          className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95 disabled:opacity-50">
          <Download size={13} /> {stlBusy ? "Exporting…" : "3D print · .stl"}
        </button>
        <button onClick={onLdraw}
          className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95">
          <Download size={13} /> LEGO file · .ldr
        </button>
        <button onClick={onCsv}
          className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95">
          <Download size={13} /> Parts · .csv
        </button>
      </div>
      <p className="mt-1.5 text-micro text-muted-faint">
        Tap the box art to inspect the set — sealed box, the render, the 3D mesh and a closed booklet. The .stl is the AI mesh; the .ldr is the buildable LEGO file.
      </p>
    </div>
  );
}
