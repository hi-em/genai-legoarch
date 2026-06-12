import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Upload, X, Box, FileText, Receipt, Share2, Star, RotateCcw, Volume2, VolumeX, Copy, SlidersHorizontal } from "lucide-react";
import { generate, generateMesh, legolizeMesh, getSetCopy } from "../api.js";
import { useBuild, useCollection, useView, useUI } from "../state/store.js";
import { adaptBrickModel, totalParts, totalColors, courseCount } from "../lib/brickModel.js";
import { frontElevationThumb } from "../lib/thumb.js";
import { downscaleDataUrl } from "../lib/image.js";
import { playSnap, playPop } from "../lib/sound.js";
import { Button, Chip, Textarea, StudLoader, StatTile, toast } from "../components/ui/index.js";
import AssemblyViewer from "../viewer/AssemblyViewer.jsx";
import BrickViewer from "../viewer/BrickViewer.jsx";
import MeshViewer from "../viewer/MeshViewer.jsx";
import SpineCompareViewer from "../viewer/SpineCompareViewer.jsx";
import { EXAMPLES } from "./examples.js";
import TinkerPanel from "./TinkerPanel.jsx";
import LoadingTheater from "./LoadingTheater.jsx";
import { paramsFor, summarizeRun } from "./tinkerParams.js";
import TrophyShell from "./trophies/TrophyShell.jsx";
import TheBox from "./trophies/TheBox.jsx";
import BoxArt from "./trophies/BoxArt.jsx";
import ShareCard from "./trophies/ShareCard.jsx";
import PricedSet from "./trophies/PricedSet.jsx";
import { generateBooklet } from "../lib/booklet.js";

// Staged pipeline with a user stop after every expensive step:
//   intro -> rendering -> render (image stop: shape dials, re-render)
//         -> meshing  -> mesh   (mesh stop: brick dials, re-mesh; CPU-cheap re-legolize)
//         -> legolizing -> assembling -> reveal
export default function HeroFlow() {
  const { prompt, imageUrl, glbUrl, glbName, brickModel, setCopy, params, seed, runRecord, set, reset } = useBuild();
  const addToShelf = useCollection((s) => s.add);
  const collectionCount = useCollection((s) => s.items.length);
  const showView = useView((s) => s.show);
  const muted = useUI((s) => s.muted);
  const toggleMute = useUI((s) => s.toggleMute);
  // Resume at the furthest completed stop if the store already has results —
  // a dev-server HMR remount (or a crash) shouldn't throw away a finished
  // render or a 5-minute mesh.
  const [phase, setPhase] = useState(() => {
    const s = useBuild.getState();
    if (s.brickModel) return "reveal";
    if (s.glbUrl) return "mesh";
    if (s.imageUrl) return "render";
    return "intro";
  });
  const [text, setText] = useState(prompt || "");
  const [photo, setPhoto] = useState(null);
  const [trophy, setTrophy] = useState(null); // "box" | "share" | "priced" | null
  const fileRef = useRef(null);

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  // ---- stage 1: prompt -> FLUX render --------------------------------------
  async function onForge({ rerender = false } = {}) {
    if (!text.trim()) {
      toast.info("Name a building", "Type a landmark or pick an example first.");
      return;
    }
    playSnap();
    set({ prompt: text, imageUrl: null, glbUrl: null, brickModel: null, runRecord: null });
    setPhase("rendering");
    const startedAt = Date.now();
    try {
      // a re-render with a pinned seed would reproduce the same image — only
      // honour the pin on the first render or when the user changed dials
      const useSeed = rerender && seed == null ? null : seed;
      const r1 = await generate(text, photo, { seed: useSeed, ...paramsFor("render", params) });
      set({
        imageUrl: r1.imageUrl,
        // reproducibility record grows stage by stage (faculty: prompt, seed,
        // model, params per shown output)
        runRecord: {
          prompt: text,
          enhancedPrompt: r1.params?.prompt || text,
          photoAttached: !!photo,
          seed: r1.params?.seed ?? seed,
          params: { ...params },
          resolved: { image: r1.params },
          imageMs: Date.now() - startedAt,
          startedAt,
        },
      });
      setPhase("render");
    } catch (e) {
      toast.error("Render failed", String(e?.message || e));
      setPhase("intro");
    }
  }

  // ---- stage 2: render -> TRELLIS mesh --------------------------------------
  async function onReconstruct() {
    playSnap();
    setPhase("meshing");
    const t0 = Date.now();
    try {
      const rec = runRecord || {};
      const r = await generateMesh(imageUrl, {
        seed: seed ?? rec.seed,                 // tie the mesh to the image's seed
        ...paramsFor("shape", params),
      });
      set({
        glbUrl: r.glbUrl,
        glbName: r.glbName,
        brickModel: null,                       // a new mesh invalidates old bricks
        runRecord: {
          ...rec,
          params: { ...params },
          resolved: { ...rec.resolved, mesh: r.params },
          meshMs: Date.now() - t0,
        },
      });
      setPhase("mesh");
    } catch (e) {
      toast.error("3D reconstruction failed", String(e?.message || e));
      setPhase("render");
    }
  }

  // ---- stage 3: mesh -> voxels -> bricks (CPU, seconds — retry freely) ------
  async function onLegolize() {
    playSnap();
    setPhase("legolizing");
    const t0 = Date.now();
    try {
      const rec = runRecord || {};
      const {
        randomness, seam_weight, voxel_target,
        fill_mode, shell_thickness, slopes, palette,
      } = paramsFor("bricks", params);
      // the render feeds colour exposure matching — only send real data URLs
      // (the dev sample's imageUrl is a static asset path)
      const renderForColors = imageUrl?.startsWith("data:") ? imageUrl : null;
      const r = await legolizeMesh(glbName, renderForColors, {
        seed: seed ?? rec.seed,
        voxel_target,
        fill_mode,
        shell_thickness,
        legolize_options: { randomness, seam_weight, slopes, palette },
      });
      if (!r.brickModel) throw new Error("No brick layout returned.");
      set({
        brickModel: r.brickModel,
        runRecord: {
          ...rec,
          params: { ...params },
          resolved: { ...rec.resolved, bricks: r.params },
          bricksMs: Date.now() - t0,
        },
      });
      getSetCopy(text, r.brickModel).then((c) => set({ setCopy: c })).catch(() => {});
      setPhase("assembling");
    } catch (e) {
      toast.error("Legolize failed", String(e?.message || e));
      setPhase("mesh");
    }
  }

  // DEV-only: verify the assembly/reveal visuals without a live ComfyUI, using a
  // REAL backend-generated sample (not a mock generator).
  async function onDemo() {
    const raw = (await import("../dev/sampleModel.json")).default;
    const bm = adaptBrickModel(raw);
    const sampleRender = (await import("../dev/sampleRender.png")).default;
    const subj = "Brutalist concrete tower with stepped setbacks";
    set({ prompt: subj, imageUrl: sampleRender, brickModel: bm });
    setText(subj);
    getSetCopy(subj, bm).then((c) => set({ setCopy: c })).catch(() => {});
    setPhase("assembling");
  }

  async function onAddToShelf() {
    if (!brickModel) return;
    playPop();
    const renderThumb = await downscaleDataUrl(imageUrl, 360, 0.72);
    const dropped = addToShelf({
      id: String(Date.now()),
      title: setCopy?.set_name || (prompt || "Untitled set").split(",")[0],
      setNumber: setCopy?.set_number || "",
      thumb: frontElevationThumb(brickModel, 240),
      renderThumb,
      nBricks: brickModel.stability.nBricks,
      brickModel,
      setCopy,
      prompt,
      runRecord,         // tiny JSON — full reproducibility for every saved set
      created_at: new Date().toISOString(),
    });
    if (dropped > 0) {
      toast.info(
        "Added — shelf was full",
        `${dropped} oldest set${dropped > 1 ? "s" : ""} made room (browser storage limit).`
      );
    } else {
      toast.success("Added to your shelf", "Reopen it anytime from your Collection.");
    }
  }

  function onForgeAnother() {
    reset();             // keeps params + seed — tuned dials survive
    setPhoto(null);
    setPhase("intro");
  }

  return (
    <div className="felt relative flex min-h-full w-full flex-col items-center">
      {/* brand bar */}
      <header className="z-10 flex w-full items-center justify-between px-5 py-4">
        <div className="font-display text-lg font-extrabold tracking-tight text-on-dark">
          l<span className="text-brand-yellow">E</span>go<span className="text-brand-red">a</span>r<span className="text-brand-blue">C</span>h
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-on-dark hover:bg-white/20"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            onClick={() => showView("collection")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-on-dark hover:bg-white/20"
          >
            <Star size={13} /> Collection{collectionCount ? ` (${collectionCount})` : ""}
          </button>
        </div>
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
                <TinkerPanel groups={["render"]} />
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

          {["rendering", "meshing", "legolizing"].includes(phase) && (
            <motion.section
              key="waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-[880px]"
            >
              <div className="grid gap-6 sm:grid-cols-2">
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
                <div className="flex flex-col justify-center">
                  <h2 className="mb-4 truncate font-display text-lg font-extrabold text-on-dark" title={text}>
                    {(text || "").split(",")[0]}
                  </h2>
                  <LoadingTheater
                    stage={{ rendering: "image", meshing: "mesh", legolizing: "bricks" }[phase]}
                    prompt={text}
                    params={params}
                  />
                </div>
              </div>
            </motion.section>
          )}

          {/* ---- stop 1: the render — judge it, tune the 3D dials, go ---- */}
          {phase === "render" && imageUrl && (
            <motion.section
              key="render-stop"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-[880px]"
            >
              <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
                <div className="overflow-hidden rounded-xl bg-elevated shadow-pop">
                  <img src={imageUrl} alt="legoarch render" className="block aspect-square w-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">step 2 of 3 · the set photo</p>
                  <h2 className="mt-1 font-display text-2xl font-black leading-tight text-on-dark">
                    Happy with the render?
                  </h2>
                  <p className="mt-1 text-sm text-on-dark-muted">
                    Next, TRELLIS rebuilds it in 3D (~2–3 min). Tune how faithfully it
                    should follow the photo — or roll another render first.
                  </p>
                  <div className="mt-3">
                    <TinkerPanel inline groups={["shape"]} presets={false} seedRow={false} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onReconstruct}>
                      <Box size={15} /> Reconstruct in 3D
                    </Button>
                    <Button variant="secondary" onClick={() => onForge({ rerender: true })}>
                      <RotateCcw size={15} /> Re-render
                    </Button>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* ---- stop 2: the raw mesh — orbit it, tune the bricks, legolize ---- */}
          {phase === "mesh" && glbUrl && (
            <motion.section
              key="mesh-stop"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="w-full max-w-[880px]"
            >
              <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
                <MeshViewer glbUrl={glbUrl} height={400} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">step 3 of 3 · the 3D model</p>
                  <h2 className="mt-1 font-display text-2xl font-black leading-tight text-on-dark">
                    Now, let's make it buildable.
                  </h2>
                  <p className="mt-1 text-sm text-on-dark-muted">
                    This is the raw generated mesh. Legolizing takes seconds and no AI —
                    so experiment with the brick settings as much as you like.
                  </p>
                  <div className="mt-3">
                    <TinkerPanel inline groups={["bricks"]} presets={false} seedRow={false} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onLegolize}>
                      <Sparkles size={15} /> Legolize
                    </Button>
                    <Button variant="secondary" onClick={onReconstruct}>
                      <RotateCcw size={15} /> Re-generate 3D
                    </Button>
                  </div>
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
                Snapping {courseCount(brickModel)} courses into place…
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
                {glbUrl ? (
                  <SpineCompareViewer glbUrl={glbUrl} brickModel={brickModel} height={420} />
                ) : (
                  <BrickViewer brickModel={brickModel} height={420} />
                )}
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
                    <StatTile
                      value={`${brickModel.grid[0]}×${brickModel.grid[1]}×${courseCount(brickModel)}`}
                      label="studs × studs × courses"
                    />
                    <StatTile value={totalColors(brickModel)} label="colors" />
                    <StatTile
                      value={brickModel.stability.connected ? "Stable" : "Check"}
                      label={`${Math.round(brickModel.stability.supportRatio * 100)}% supported`}
                      variant={brickModel.stability.connected ? "ok" : "warn"}
                    />
                  </div>

                  {runRecord && (
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(JSON.stringify(runRecord, null, 2));
                        toast.success("Recipe copied", "Prompt, seed and every dial — paste it anywhere.");
                      }}
                      title="Copy the full run record (prompt, seed, all parameters)"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-on-dark-muted hover:bg-white/20"
                    >
                      <Copy size={11} />
                      {summarizeRun(runRecord) || "copy run recipe"}
                    </button>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onAddToShelf}><Star size={15} /> Add to shelf</Button>
                    {glbUrl && (
                      <Button variant="secondary" onClick={() => setPhase("mesh")} title="Back to the brick settings — re-legolizing takes seconds">
                        <SlidersHorizontal size={15} /> Tune bricks
                      </Button>
                    )}
                    <Button variant="secondary" onClick={onForgeAnother}><RotateCcw size={15} /> Forge another</Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      [Box, "The Box", () => setTrophy("box")],
                      [Sparkles, "Boxed set", () => setTrophy("boxart")],
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
        title={{ box: "The Box", boxart: "The boxed set", share: "Share card", priced: "Priced set" }[trophy] || ""}
      >
        {trophy === "box" && <TheBox imageUrl={imageUrl} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "boxart" && <BoxArt imageUrl={imageUrl} setCopy={setCopy} brickModel={brickModel} />}
        {trophy === "share" && <ShareCard imageUrl={imageUrl} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "priced" && <PricedSet brickModel={brickModel} setCopy={setCopy} />}
      </TrophyShell>
    </div>
  );
}
