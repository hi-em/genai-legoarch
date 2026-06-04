import { useMemo, useState } from "react";
import { generateBuilding } from "../lib/voxel.js";
import { legolize } from "../lib/legolize.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { useBuild } from "../state/store.js";
import { SlidersHorizontal, Palette, Combine, Ruler } from "lucide-react";

const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export default function Playground() {
  const basePrompt = useBuild((s) => s.prompt) || "legoarch museum";
  const [promptA, setPromptA] = useState(basePrompt);
  const [promptB, setPromptB] = useState("legoarch Eiffel Tower");
  const [mashed, setMashed] = useState(false);
  const [styleSeed, setStyleSeed] = useState(0);
  const [colorSeed, setColorSeed] = useState(1);

  const prompt = mashed ? `${promptA.split(",")[0]} × ${promptB.split(",")[0]}` : promptA;
  const brickModel = useMemo(() => {
    const model = generateBuilding(prompt, styleSeed);
    return legolize(model, seedOf(prompt) + colorSeed);
  }, [prompt, styleSeed, colorSeed]);

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">Playground</h2>
      <p className="bf-muted">Free play — restyle, recolor, and mash buildings together. (All real, runs in-browser.)</p>

      <BrickViewer brickModel={brickModel} studs height={360} />

      <div className="bf-toys">
        <div className="bf-toy">
          <label><SlidersHorizontal /> Restyle — morph the massing</label>
          <input type="range" min="0" max="9" value={styleSeed} onChange={(e) => setStyleSeed(+e.target.value)} />
          <small className="bf-muted">variant {styleSeed}</small>
        </div>
        <div className="bf-toy">
          <label><Palette /> Recolor — reshuffle the palette</label>
          <button className="bf-btn" onClick={() => setColorSeed((c) => c + 1)}>Shuffle colors</button>
        </div>
        <div className="bf-toy">
          <label><Combine /> Mashup — blend two landmarks</label>
          <input value={promptA} onChange={(e) => setPromptA(e.target.value)} />
          <input value={promptB} onChange={(e) => setPromptB(e.target.value)} />
          <button className="bf-btn bf-btn--primary" onClick={() => setMashed((m) => !m)}>{mashed ? "Unmash" : "Mash them!"}</button>
        </div>
        <div className="bf-toy">
          <label><Ruler /> Detail axo — sectional axonometric</label>
          <small className="bf-muted">planned: crop a region &amp; render an exploded section (needs ComfyUI)</small>
        </div>
      </div>
    </section>
  );
}
