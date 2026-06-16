// The set-detail showcase — shown at the reveal (after the pack ritual) AND on
// shelf-open. The BUILD is the hero: the legolized model, big and orbitable
// (your set never re-folds here — the carton fold is the one-time PackRitual at
// the reveal). The retail box rides alongside as a small COVER-ART thumbnail
// (its packaging) that expands to a lightbox you can download from — so it reads
// as "this is the product" without stealing space from the build, and without a
// second WebGL canvas or a sealed-box-vs-built contradiction. The build viewer
// is itself expandable + PNG-exportable, like the render and the mesh.
import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import BrickViewer from "../../viewer/BrickViewer.jsx";
import SetInspector from "./SetInspector.jsx";
import { buildFrontDataUrl } from "../../lib/boxTexture.js";

export default function SetShowcase({ imageUrl, setCopy, brickModel, glbName }) {
  const pieces = brickModel?.stability?.nBricks ?? brickModel?.bricks?.length;
  const [coverUrl, setCoverUrl] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    // paint the cover bigger than its thumbnail so the expanded view stays crisp
    buildFrontDataUrl({ imageUrl, setCopy, pieces, width: 1100 }).then((u) => {
      if (alive) setCoverUrl(u);
    });
    return () => { alive = false; };
  }, [imageUrl, setCopy, pieces]);

  const safe = (setCopy?.set_name || "set").replace(/[^\w]+/g, "_");

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
        {/* the build — the thing you actually made (expand + save a PNG) */}
        <div>
          <BrickViewer brickModel={brickModel} height={380} expandable title="LEGO build" filename={`${safe}_build.png`} />
          <p className="mt-1.5 text-center text-micro text-muted">Drag to rotate · expand to inspect &amp; save a PNG.</p>
        </div>

        {/* the box — its packaging, as a small expandable cover thumbnail */}
        <div className="flex flex-col items-center gap-1.5 sm:pt-1">
          <p className="text-nano font-bold uppercase tracking-widest text-muted">Box art</p>
          <button
            onClick={() => coverUrl && setExpanded(true)}
            disabled={!coverUrl}
            title="Expand the box art"
            className="group relative w-36 overflow-hidden rounded-lg shadow-plate-flat ring-1 ring-black/10 transition hover:brightness-95 disabled:opacity-50"
          >
            {coverUrl ? (
              <img src={coverUrl} alt={`${setCopy?.set_name || "Your set"} retail box`} className="block w-full" />
            ) : (
              <div className="aspect-[3.6/2.6] w-full animate-pulse bg-sunken" />
            )}
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
              <Maximize2 size={10} /> Expand
            </span>
          </button>
          <span className="text-micro text-muted">Tap to inspect: box · render · mesh · booklet</span>
        </div>
      </div>

      {/* multi-view inspector — box 3D / render / mesh / closed booklet 3D */}
      <SetInspector
        open={expanded}
        onClose={() => setExpanded(false)}
        imageUrl={imageUrl}
        setCopy={setCopy}
        brickModel={brickModel}
        glbName={glbName}
      />
    </>
  );
}
