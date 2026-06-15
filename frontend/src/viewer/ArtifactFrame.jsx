// Shared expand + PNG-export shell for the 3D artifact viewers (raw mesh, brick
// build). Inline it shows the scene with a hover "Expand" chip; expanded it
// reuses the accessible Lightbox to show a larger copy of the same scene plus a
// "Save PNG" button. The scene is supplied as a render-prop that receives a
// `registerCapture` callback — wire it to a <CaptureBridge> so Save grabs the
// live WebGL frame. Mirrors the box-art pattern in SetShowcase.
import { useRef, useState } from "react";
import { Maximize2, Download } from "lucide-react";
import Lightbox from "../components/ui/Lightbox.jsx";
import { downloadDataUrl } from "../hero/trophies/downloadImage.js";
import { VIEWER_BG } from "../lib/tokens.js";

export default function ArtifactFrame({ renderScene, title, filename, height = 380, hint }) {
  const [expanded, setExpanded] = useState(false);
  const cap = useRef(null); // capture fn for the (larger) expanded canvas

  const save = () => {
    const url = cap.current?.();
    if (url) downloadDataUrl(filename, url);
  };

  return (
    <>
      <div style={{ height, background: VIEWER_BG }} className="group relative overflow-hidden rounded-lg">
        {/* inline scene needs no capture — export happens from the expanded view */}
        {renderScene(null)}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Expand ${title} to full screen`}
          className="absolute bottom-2 right-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-semibold text-white opacity-0 backdrop-blur transition focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Maximize2 size={13} /> Expand
        </button>
      </div>

      <Lightbox open={expanded} onClose={() => setExpanded(false)} label={`${title} — full screen`}>
        <div
          style={{ height: "min(70vh, 720px)", background: VIEWER_BG }}
          className="relative overflow-hidden rounded-xl shadow-pop"
        >
          {expanded && renderScene((fn) => (cap.current = fn))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={save}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand-red px-4 font-display text-sm font-bold text-white hover:brightness-110"
          >
            <Download size={15} /> Save PNG
          </button>
        </div>
        {hint && <p className="mt-2 text-center text-micro text-white/70">{hint}</p>}
      </Lightbox>
    </>
  );
}
