import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Upload, X, Box, FileText, Receipt, Share2, Star, RotateCcw } from "lucide-react";
import { generate, generate3D, getSetCopy } from "../api.js";
import { useBuild, useCollection, useView } from "../state/store.js";
import { adaptBrickModel, totalParts, totalColors } from "../lib/brickModel.js";
import { frontElevationThumb } from "../lib/thumb.js";
import { downscaleDataUrl } from "../lib/image.js";
import { playSnap, playPop } from "../lib/sound.js";
import { Button, Chip, Textarea, StudLoader, StatTile, toast } from "../components/ui/index.js";
import AssemblyViewer from "../viewer/AssemblyViewer.jsx";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { EXAMPLES } from "./examples.js";
import TrophyShell from "./trophies/TrophyShell.jsx";
import TheBox from "./trophies/TheBox.jsx";
import ShareCard from "./trophies/ShareCard.jsx";
import PricedSet from "./trophies/PricedSet.jsx";
import { generateBooklet } from "../lib/booklet.js";

// phases: "intro" | "rendering" | "assembling" | "reveal"
export default function HeroFlow() {
  const { prompt, imageUrl, brickModel, setCopy, set, reset } = useBuild();
  const addToShelf = useCollection((s) => s.add);
  const collectionCount = useCollection((s) => s.items.length);
  const showView = useView((s) => s.show);
  const [phase, setPhase] = useState("intro");
  const [text, setText] = useState(prompt || "");
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("");
  const [trophy, setTrophy] = useState(null); // "box" | "share" | "priced" | null
  const fileRef = useRef(null);

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function onForge() {
    if (!text.trim()) {
      toast.info("Name a building", "Type a landmark or pick an example first.");
      return;
    }
    playSnap();
    set({ prompt: text, imageUrl: null, glbUrl: null, brickModel: null });
    setPhase("rendering");
    try {
      setStatus("Photographing the set…");
      const r1 = await generate(text, photo);
      set({ imageUrl: r1.imageUrl });
      setStatus("Reconstructing in 3D and solving the brick layout…");
      const r2 = await generate3D(r1.imageUrl);
      if (!r2.brickModel) throw new Error(r2.voxelError || "No brick layout returned.");
      set({ glbUrl: r2.glbUrl, brickModel: r2.brickModel });
      // fetch the box copy in parallel with the assembly animation
      getSetCopy(text, r2.brickModel).then((c) => set({ setCopy: c })).catch(() => {});
      setPhase("assembling");
    } catch (e) {
      toast.error("Forge failed", String(e?.message || e));
      setPhase("intro");
    }
  }

  // DEV-only: verify the assembly/reveal visuals without a live ComfyUI, using a
  // REAL backend-generated sample (not a mock generator).
  async function onDemo() {
    const raw = (await import("../dev/sampleModel.json")).default;
    const bm = adaptBrickModel(raw);
    const sampleRender = (await import("../dev/sampleRender.png")).default;
    const subj = "Fondation Louis Vuitton, Frank Gehry";
    set({ prompt: subj, imageUrl: sampleRender, brickModel: bm });
    setText(subj);
    getSetCopy(subj, bm).then((c) => set({ setCopy: c })).catch(() => {});
    setPhase("assembling");
  }

  async function onAddToShelf() {
    if (!brickModel) return;
    playPop();
    const renderThumb = await downscaleDataUrl(imageUrl, 360, 0.72);
    addToShelf({
      id: String(Date.now()),
      title: setCopy?.set_name || (prompt || "Untitled set").split(",")[0],
      setNumber: setCopy?.set_number || "",
      thumb: frontElevationThumb(brickModel, 240),
      renderThumb,
      nBricks: brickModel.stability.nBricks,
      brickModel,
      setCopy,
      created_at: new Date().toISOString(),
    });
    toast.success("Added to your shelf", "Reopen it anytime from your Collection.");
  }

  function onForgeAnother() {
    reset();
    setPhoto(null);
    setStatus("");
    setPhase("intro");
  }

  return (
    <div className="felt relative flex min-h-full w-full flex-col items-center">
      {/* brand bar */}
      <header className="z-10 flex w-full items-center justify-between px-5 py-4">
        <div className="font-display text-lg font-extrabold tracking-tight text-on-dark">
          l<span className="text-brand-yellow">E</span>go<span className="text-brand-red">a</span>r<span className="text-brand-blue">C</span>h
        </div>
        <button
          onClick={() => showView("collection")}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-on-dark hover:bg-white/20"
        >
          <Star size={13} /> Collection{collectionCount ? ` (${collectionCount})` : ""}
        </button>
      </header>

      <main className="flex w-full flex-1 items-center justify-center px-5 pb-16">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.section
              key="intro"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-[640px] text-center"
            >
              <h1 className="font-display text-4xl font-black leading-tight text-on-dark sm:text-5xl">
                Name a building.<br />Get a buildable LEGO set.
              </h1>
              <p className="mx-auto mt-3 max-w-[460px] text-on-dark-muted">
                Type a landmark — we render it, reconstruct it in 3D, and solve the
                real brick layout you could actually build.
              </p>

              <div className="mx-auto mt-7 max-w-[520px] rounded-2xl bg-elevated p-4 shadow-pop">
                <Textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Fondation Louis Vuitton, Frank Gehry"
                  className="text-base"
                />
                <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <Chip key={ex.label} onClick={() => setText(ex.prompt)}>{ex.label}</Chip>
                  ))}
                </div>
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5">
                  <Button variant="primary" onClick={onForge}>
                    <Sparkles size={16} /> Forge the set
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} className="hidden" />
                  {photo ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted">
                      <img src={photo} alt="reference" className="h-9 w-9 rounded object-cover" />
                      photo attached
                      <Chip variant="removable" title="Remove" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
                        <X className="h-3.5 w-3.5" />
                      </Chip>
                    </span>
                  ) : (
                    <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                      <Upload size={15} /> Photo
                    </Button>
                  )}
                </div>
              </div>

              {import.meta.env.DEV && (
                <button onClick={onDemo} className="mt-5 text-xs text-on-dark-muted underline-offset-2 hover:underline">
                  ▶ Preview the assembly (dev sample)
                </button>
              )}
            </motion.section>
          )}

          {phase === "rendering" && (
            <motion.section
              key="rendering"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-[760px]"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="overflow-hidden rounded-xl bg-elevated shadow-pop">
                  {imageUrl ? (
                    <motion.img
                      src={imageUrl} alt="legoarch render"
                      initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }}
                      className="block aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center"><StudLoader /></div>
                  )}
                </div>
                <div className="flex flex-col items-start justify-center gap-3 px-2">
                  <StudLoader />
                  <h2 className="font-display text-xl font-extrabold text-on-dark">{text}</h2>
                  <p className="text-on-dark-muted">{status}</p>
                </div>
              </div>
            </motion.section>
          )}

          {phase === "assembling" && brickModel && (
            <motion.section
              key="assembling"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-[820px]"
            >
              <p className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-on-dark-muted">
                Snapping {brickModel.grid[2]} courses into place…
              </p>
              <AssemblyViewer brickModel={brickModel} height={520} onComplete={() => setPhase("reveal")} />
            </motion.section>
          )}

          {phase === "reveal" && brickModel && (
            <motion.section
              key="reveal"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-[860px]"
            >
              <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
                <BrickViewer brickModel={brickModel} height={420} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">
                    lEgoarCh · {setCopy?.series || "Architecture"}{setCopy?.set_number ? ` · ${setCopy.set_number}` : ""}
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-black leading-tight text-on-dark">
                    {setCopy?.set_name || (prompt || "Untitled").split(",")[0]}
                  </h2>
                  <p className="mt-1.5 text-sm text-on-dark-muted">
                    {setCopy?.box_blurb || "A buildable set, solved brick by brick."}
                  </p>
                  {setCopy?.designer_quote && (
                    <p className="mt-2 text-sm italic text-on-dark-muted">{setCopy.designer_quote}</p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <StatTile value={totalParts(brickModel)} label="pieces" />
                    <StatTile value={brickModel.grid.join("×")} label="studs (w×d×h)" />
                    <StatTile value={totalColors(brickModel)} label="colors" />
                    <StatTile
                      value={brickModel.stability.connected ? "Stable" : "Check"}
                      label={`${Math.round(brickModel.stability.supportRatio * 100)}% supported`}
                      variant={brickModel.stability.connected ? "ok" : "warn"}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onAddToShelf}><Star size={15} /> Add to shelf</Button>
                    <Button variant="secondary" onClick={onForgeAnother}><RotateCcw size={15} /> Forge another</Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      [Box, "The Box", () => setTrophy("box")],
                      [FileText, "Instructions", () => {
                        toast.info("Building your manual…", "Rendering step-by-step pages.");
                        setTimeout(() => generateBooklet(brickModel, setCopy), 30);
                      }],
                      [Receipt, "Priced set", () => setTrophy("priced")],
                      [Share2, "Share card", () => setTrophy("share")],
                    ].map(([Icon, label, onClick]) => (
                      <button
                        key={label}
                        onClick={onClick}
                        className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-ink shadow-plate-flat hover:brightness-95"
                      >
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <TrophyShell
        open={!!trophy}
        onClose={() => setTrophy(null)}
        title={{ box: "The Box", share: "Share card", priced: "Priced set" }[trophy] || ""}
      >
        {trophy === "box" && <TheBox imageUrl={imageUrl} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "share" && <ShareCard imageUrl={imageUrl} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "priced" && <PricedSet brickModel={brickModel} setCopy={setCopy} />}
      </TrophyShell>
    </div>
  );
}
