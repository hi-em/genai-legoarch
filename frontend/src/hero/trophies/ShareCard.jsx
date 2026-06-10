import { useRef, useState } from "react";
import { Download, Copy } from "lucide-react";
import { Button, toast } from "../../components/ui/index.js";
import { totalParts, totalColors } from "../../lib/brickModel.js";
import { exportNodePng, copyNodePng } from "./downloadImage.js";

// A 2:1 social card (exports at 1200×630). Render + funny set name + stats.
export default function ShareCard({ imageUrl, brickModel, setCopy }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const name = setCopy?.set_name || "Untitled Set";
  const tagline = setCopy?.share_tagline || "Generated. Solved. Buildable.";
  const pieces = totalParts(brickModel);
  const support = Math.round((brickModel?.stability?.supportRatio ?? 1) * 100);

  async function onDownload() {
    setBusy(true);
    try {
      await exportNodePng(ref.current, `${name.replace(/[^\w]+/g, "_")}_card.png`);
      toast.success("Card saved", "1200×630 PNG in your downloads.");
    } catch (e) {
      toast.error("Export failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }
  async function onCopy() {
    try {
      await copyNodePng(ref.current);
      toast.success("Copied", "Card image on your clipboard.");
    } catch {
      toast.info("Couldn’t copy", "Your browser blocked clipboard image write — use Download.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={ref}
        style={{ width: 600, height: 315, background: "#20241f" }}
        className="felt relative grid grid-cols-[1.15fr_1fr] overflow-hidden rounded-xl"
      >
        <div className="grid place-items-center p-4" style={{ background: "linear-gradient(#eef3f7,#d7dee5)" }}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} crossOrigin="anonymous" className="max-h-[94%] max-w-[94%] object-contain" />
          ) : (
            <span className="text-sm text-ink/40">render</span>
          )}
        </div>
        <div className="flex flex-col justify-center p-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-yellow">
            l<span className="text-white">E</span>goarCh
          </span>
          <h3 className="mt-1 font-display text-[22px] font-black leading-tight text-on-dark">{name}</h3>
          <p className="mt-1 text-xs text-on-dark-muted">{tagline}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[`${pieces.toLocaleString()} pieces`, `${totalColors(brickModel)} colors`, `${support}% supported`].map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white">{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2.5">
        <Button variant="primary" onClick={onDownload} loading={busy}><Download size={15} /> Download</Button>
        <Button variant="secondary" onClick={onCopy}><Copy size={15} /> Copy image</Button>
      </div>
    </div>
  );
}
