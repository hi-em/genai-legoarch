import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button, toast } from "../../components/ui/index.js";
import { totalParts, courseCount } from "../../lib/brickModel.js";
import { exportNodePng } from "./downloadImage.js";
import Wordmark from "../../components/brand/Wordmark.jsx";

// The iconic black LEGO-Architecture box, recomposed for lEgoarCh.
export default function TheBox({ imageUrl, brickModel, setCopy }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const name = setCopy?.set_name || "Untitled Set";
  const number = setCopy?.set_number || "";
  const pieces = totalParts(brickModel);
  const h = courseCount(brickModel);             // grid z is plate layers
  const cmW = ((brickModel?.grid?.[0] || 0) * 8) / 10;
  const cmD = ((brickModel?.grid?.[1] || 0) * 8) / 10;

  async function onDownload() {
    setBusy(true);
    try {
      await exportNodePng(ref.current, `${name.replace(/[^\w]+/g, "_")}_box.png`);
      toast.success("Box art saved", "Dropped a PNG in your downloads.");
    } catch (e) {
      toast.error("Export failed", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={ref}
        style={{ width: 420, height: 520, background: "#0e0f0e" }}
        className="relative overflow-hidden rounded-xl"
      >
        {/* top wordmark + series tab */}
        <div className="flex items-center justify-between px-5 pt-4">
          <Wordmark className="text-base text-white" />
          <span className="rounded bg-white/10 px-2 py-0.5 text-nano font-bold uppercase tracking-widest text-white/80">
            {setCopy?.series || "Architecture"}
          </span>
        </div>

        {/* hero render on a soft platform */}
        <div
          className="mx-4 mt-3 flex h-[300px] items-center justify-center rounded-lg"
          style={{ background: "radial-gradient(120% 90% at 50% 25%, #2a2c2a 0%, #141514 70%)" }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} crossOrigin="anonymous" className="max-h-[94%] max-w-[94%] object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,.6)]" />
          ) : (
            <span className="text-sm text-white/40">render</span>
          )}
        </div>

        {/* bottom band */}
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <div className="mb-1 h-[3px] w-full" style={{ background: "linear-gradient(90deg,#c91a09,#f6c700,#1e5aa8)" }} />
          <h3 className="font-display text-2xl font-black leading-none text-white">{name}</h3>
          <div className="mt-1 flex items-center justify-between text-micro text-white/70">
            <span>{pieces.toLocaleString()} pieces · {h} bricks tall</span>
            <span>{number ? `Set ${number}` : ""}</span>
          </div>
          <div className="mt-0.5 text-nano text-white/45">
            Built footprint ≈ {cmW.toFixed(0)} × {cmD.toFixed(0)} cm
          </div>
        </div>
      </div>

      <Button variant="primary" onClick={onDownload} loading={busy}>
        <Download size={15} /> Download box art
      </Button>
    </div>
  );
}
