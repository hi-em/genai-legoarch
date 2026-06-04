import { useMemo, useState } from "react";
import { generateBuilding } from "../lib/voxel.js";
import { legolize } from "../lib/legolize.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { useBuild } from "../state/store.js";
import { SlidersHorizontal, Palette, Combine, Ruler } from "lucide-react";
import { Button, Input, Slider, Eyebrow } from "../components/ui/index.js";

const seedOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function Toy({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-elevated p-3.5">
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink [&_svg]:h-[17px] [&_svg]:w-[17px] [&_svg]:text-brand-blue">
        <Icon /> {title}
      </label>
      {children}
    </div>
  );
}

export default function Playground({ active = true }) {
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
    <div className="flex h-full flex-col">
      <div className="nodrag nowheel flex-1 overflow-y-auto p-6 lg:p-7">
        <Eyebrow label="Playground" icon={SlidersHorizontal} />
        <h2 className="text-h2 font-display font-extrabold">Playground</h2>
        <p className="mt-1.5 text-muted">Free play — restyle, recolor, and mash buildings together. (All real, runs in-browser.)</p>

        <div className="mt-4">
          <BrickViewer brickModel={brickModel} studs height={340} active={active} />
        </div>

        <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          <Toy icon={SlidersHorizontal} title="Restyle — morph the massing">
            <Slider value={[styleSeed]} min={0} max={9} step={1} onValueChange={(v) => setStyleSeed(v[0])} />
            <small className="text-muted">variant {styleSeed}</small>
          </Toy>

          <Toy icon={Palette} title="Recolor — reshuffle the palette">
            <Button variant="secondary" onClick={() => setColorSeed((c) => c + 1)}>Shuffle colors</Button>
          </Toy>

          <Toy icon={Combine} title="Mashup — blend two landmarks">
            <Input value={promptA} onChange={(e) => setPromptA(e.target.value)} />
            <Input value={promptB} onChange={(e) => setPromptB(e.target.value)} />
            <Button variant="primary" onClick={() => setMashed((m) => !m)}>{mashed ? "Unmash" : "Mash them!"}</Button>
          </Toy>

          <Toy icon={Ruler} title="Detail axo — sectional axonometric">
            <small className="text-muted">planned: crop a region &amp; render an exploded section (needs ComfyUI)</small>
          </Toy>
        </div>
      </div>
    </div>
  );
}
