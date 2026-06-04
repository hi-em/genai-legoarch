import { useState, useRef } from "react";
import { generate } from "../api.js";
import { useBuild, useCanvas } from "../state/store.js";
import { playSnap } from "../lib/sound.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { Sparkles, Hammer, Box, Blocks, Upload, X } from "lucide-react";
import { Button, Chip, Textarea, Skeleton, Eyebrow, toast } from "../components/ui/index.js";

// Users describe the subject only — the `legoarch` trigger + the LEGO-set
// styling are added on the backend.
const EXAMPLES = [
  "Fondation Louis Vuitton, Frank Gehry",
  "KAPSARC Riyadh, Zaha Hadid",
  "Beijing Daxing Airport, radiating concourse",
  "brutalist concrete tower, stepped setbacks",
];

function MockRender() {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-sunken font-bold text-muted">
      <Hammer className="h-8 w-8 opacity-60" />
      <span className="text-ink">legoarch render</span>
      <small className="text-muted">connect ComfyUI to generate</small>
    </div>
  );
}

export default function Generate({ active = true }) {
  const { prompt, imageUrl, brickModel, busy, set } = useBuild();
  const focus = useCanvas((s) => s.focus);
  const next = useCanvas((s) => s.next);
  const [text, setText] = useState(prompt || "");
  const [photo, setPhoto] = useState(null);
  const fileRef = useRef(null);

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function onGenerate() {
    if (!text.trim()) {
      toast.info("Add a prompt", "Name a building or pick an example first.");
      return;
    }
    playSnap();
    set({ busy: true });
    try {
      const r = await generate(text, photo); // photo -> img2img, else txt2img
      set({ prompt: r.prompt, imageUrl: r.imageUrl, glbUrl: null, model: r.model, brickModel: r.brickModel, busy: false });
      toast.success("Build ready", r.imageUrl ? "AI render + 3D geometry generated." : "3D geometry generated.");
    } catch (e) {
      set({ busy: false });
      toast.error("Generation failed", String(e?.message || e));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="nodrag nowheel flex-1 overflow-y-auto p-6 lg:p-7">
        <Eyebrow step={1} label="Generate" />
        <h2 className="text-h2 font-display font-extrabold">Generate a brick building</h2>
        <p className="mt-1.5 text-muted">
          Name a building (or paste a famous one). The{" "}
          <code className="rounded-sm bg-sunken px-1.5 py-0.5 font-mono text-[.85em]">legoarch</code> model
          renders it as a set built of LEGO bricks, then we build real 3D geometry from it.{" "}
          <em>No need to type “legoarch” — it’s added for you.</em>
        </p>

        <Textarea
          className="mt-4"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Fondation Louis Vuitton, Frank Gehry"
        />

        <div className="mt-2.5 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Chip key={ex} onClick={() => setText(ex)}>
              {ex.split(",")[0]}
            </Chip>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button variant="primary" loading={busy} onClick={onGenerate}>
            {!busy && <Sparkles />}
            {busy ? "Building…" : "Generate"}
          </Button>

          <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          {photo ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <img src={photo} alt="reference" className="h-9 w-9 rounded object-cover" />
              photo attached (img2img)
              <Chip
                variant="removable"
                title="Remove photo"
                onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}
              >
                <X className="h-3.5 w-3.5" />
              </Chip>
            </span>
          ) : (
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Upload a photo
            </Button>
          )}
        </div>

        {(busy || brickModel) && (
          <div className="mt-6">
            <div className="flex flex-wrap gap-5">
              <div className="min-w-[240px] flex-1">
                <h3 className="mb-2 text-h3 font-display font-bold">AI render</h3>
                {busy ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="legoarch render" className="block w-full rounded-lg" />
                ) : (
                  <MockRender />
                )}
              </div>
              <div className="min-w-[280px] flex-[1.3]">
                <h3 className="mb-2 text-h3 font-display font-bold">Live 3D geometry</h3>
                {busy ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : (
                  <BrickViewer brickModel={brickModel} height={260} active={active} />
                )}
              </div>
            </div>

            {brickModel && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Button variant="primary" onClick={() => next()}>
                  <Box /> Continue → 3D · Print
                </Button>
                <Button variant="secondary" onClick={() => focus("studio")}>
                  <Blocks /> Skip to Brick Studio
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
