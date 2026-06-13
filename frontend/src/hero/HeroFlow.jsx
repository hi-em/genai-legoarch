import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Upload, X, Box, FileText, Receipt, Share2, Star, RotateCcw, Volume2, VolumeX, Copy, SlidersHorizontal } from "lucide-react";
import { generate, generateMesh, legolizeMesh, getSetCopy, latestMesh } from "../api.js";
import { useBuild, useCollection, useView, useUI, derivePhase, isShelfDupe } from "../state/store.js";
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
import LoadingStage from "./LoadingTheater.jsx";
import VisualizingCanvas from "./VisualizingCanvas.jsx";
import { MeshStudy } from "./StageSquare.jsx";
import SolverSprint from "./SolverSprint.jsx";
import CallSheet, { scoreCalls } from "./CallSheet.jsx";
import RecipeCard from "./RecipeCard.jsx";
import { paramsFor, summarizeRun } from "./tinkerParams.js";
import TrophyShell from "./trophies/TrophyShell.jsx";
import TheBox from "./trophies/TheBox.jsx";
import BoxArt from "./trophies/BoxArt.jsx";
import ShareCard from "./trophies/ShareCard.jsx";
import PricedSet from "./trophies/PricedSet.jsx";
import { generateBooklet } from "../lib/booklet.js";
import Wordmark from "../components/brand/Wordmark.jsx";
import LogoMark from "../components/brand/LogoMark.jsx";

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
  // Phase is a pure DERIVATION of the store — never component state. HMR
  // remounts, Collection round-trips and refreshes always land on whatever
  // the data supports; in-flight work keeps its waiting panel because
  // `inFlight` lives in the store too.
  const phase = useBuild(derivePhase);
  const inFlight = useBuild((s) => s.inFlight);
  const saved = useBuild((s) => s.saved);
  const tuning = useBuild((s) => s.tuning);
  const pendingJob = useBuild((s) => s.pendingJob);
  const calls = useBuild((s) => s.calls);
  const { startJob, finishJob, failJob, cancelJob, dismissPendingJob } = useBuild.getState();
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
    if (useBuild.getState().inFlight) return;   // synchronous double-click guard
    if (!text.trim()) {
      toast.info("Name a building", "Type a landmark or pick an example first.");
      return;
    }
    playSnap();
    // NOTE: no destructive pre-clear — the old render survives a failed
    // re-render; downstream artifacts are invalidated on SUCCESS instead.
    const { jobId, signal } = startJob("image", { prompt: text });
    set({ prompt: text });
    const startedAt = Date.now();
    try {
      // a re-render with a pinned seed would reproduce the same image — only
      // honour the pin on the first render or when the user changed dials
      const useSeed = rerender && seed == null ? null : seed;
      const r1 = await generate(text, photo, { signal, seed: useSeed, ...paramsFor("render", params) });
      finishJob(jobId, {
        imageUrl: r1.imageUrl,
        glbUrl: null, glbName: null, brickModel: null, setCopy: null,
        saved: false, tuning: false, assembling: false,
        calls: null,                // a new render restarts the call sheet
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
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (failJob(jobId)) {
        toast.error(
          e?.name === "TimeoutError" ? "Render timed out" : "Render didn't finish",
          "Your prompt and dials are safe — check the backend is running, then try again."
        );
      }
    }
  }

  // ---- stage 2: render -> TRELLIS mesh --------------------------------------
  async function onReconstruct() {
    if (useBuild.getState().inFlight) return;   // one 4-9 min GPU job at a time
    playSnap();
    // persist a small render thumb so the refresh-recovery banner has context
    const imageThumb = imageUrl?.startsWith("data:")
      ? await downscaleDataUrl(imageUrl, 360, 0.7)
      : null;
    const { jobId, signal } = startJob("mesh", { prompt: text, imageThumb });
    const t0 = Date.now();
    try {
      const rec = runRecord || {};
      const r = await generateMesh(imageUrl, {
        signal,
        seed: seed ?? rec.seed,                 // tie the mesh to the image's seed
        ...paramsFor("shape", params),
      });
      finishJob(jobId, {
        glbUrl: r.glbUrl,
        glbName: r.glbName,
        brickModel: null,                       // a new mesh invalidates old bricks
        setCopy: null,
        saved: false, tuning: false,
        runRecord: {
          ...rec,
          params: { ...params },
          resolved: { ...rec.resolved, mesh: r.params },
          meshMs: Date.now() - t0,
        },
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      // derivation keeps the old mesh stop alive when glbUrl still exists
      if (failJob(jobId)) {
        toast.error(
          e?.name === "TimeoutError" ? "3D timed out" : "3D didn't finish",
          "Your render is safe. Try again — or roll another render first."
        );
      }
    }
  }

  // ---- stage 3: mesh -> voxels -> bricks (CPU, seconds — retry freely) ------
  async function onLegolize() {
    if (useBuild.getState().inFlight) return;
    playSnap();
    const { jobId, signal } = startJob("bricks", { prompt: text, glbName });
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
        signal,
        seed: seed ?? rec.seed,
        voxel_target,
        fill_mode,
        shell_thickness,
        legolize_options: { randomness, seam_weight, slopes, palette },
      });
      if (!r.brickModel) throw new Error("No brick layout returned.");
      finishJob(jobId, {
        brickModel: r.brickModel,
        saved: false, tuning: false, assembling: true,
        setCopy: null,                          // stale persona copy never pairs with new bricks
        runRecord: {
          ...rec,
          params: { ...params },
          resolved: { ...rec.resolved, bricks: r.params },
          bricksMs: Date.now() - t0,
          // the mesh-wait call sheet rides along so saved sets keep it
          calls: useBuild.getState().calls,
        },
      });
      // fire-and-forget, but gated on jobId so a late reply can't write into
      // a newer build (or a reset one)
      getSetCopy(text, r.brickModel)
        .then((c) => { if (useBuild.getState().jobId === jobId) set({ setCopy: c }); })
        .catch(() => {});
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (e?.code === "mesh_not_found") {
        // the backend cleaned up the GLB — steer to re-materialize, don't loop
        if (failJob(jobId, { glbUrl: null, glbName: null })) {
          toast.error(
            "The 3D file expired on the server",
            "Re-materialize the 3D model, then legolize again."
          );
        }
        return;
      }
      if (failJob(jobId)) {
        toast.error(
          "Brick solve didn't finish",
          "Your 3D model is safe. Nudge a brick dial and try again — it only takes seconds."
        );
      }
    }
  }

  // DEV-only: verify the assembly/reveal visuals without a live ComfyUI, using a
  // REAL backend-generated sample (not a mock generator).
  async function onDemo() {
    const raw = (await import("../dev/sampleModel.json")).default;
    const bm = adaptBrickModel(raw);
    const sampleRender = (await import("../dev/sampleRender.png")).default;
    const subj = "Brutalist concrete tower with stepped setbacks";
    // calls cleared: the demo skips the mesh wait, so bets from a previous
    // real run must not produce a phantom scorecard at the reveal
    set({ prompt: subj, imageUrl: sampleRender, brickModel: bm, assembling: true, saved: false, calls: null });
    setText(subj);
    getSetCopy(subj, bm).then((c) => set({ setCopy: c })).catch(() => {});
  }

  async function onAddToShelf() {
    if (!brickModel || useBuild.getState().saved) return;
    const title = setCopy?.set_name || (prompt || "Untitled set").split(",")[0];
    if (isShelfDupe(useCollection.getState().items, title, brickModel.stability.nBricks)) {
      toast.info("Already on your shelf", "This exact set is on display in your Collection.");
      return;
    }
    set({ saved: true });        // synchronous: a double-click can't add twice
    playPop();
    const renderThumb = await downscaleDataUrl(imageUrl, 360, 0.72);
    const dropped = addToShelf({
      id: crypto.randomUUID(),
      title,
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
        "Added — oldest sets removed",
        `Your browser's storage is full: the ${dropped} oldest set${dropped > 1 ? "s were" : " was"} deleted to make room.`
      );
    } else {
      toast.success("Added to your shelf", "Reopen it anytime from your Collection.");
    }
  }

  function onForgeAnother() {
    const s = useBuild.getState();
    if (
      s.brickModel && !s.saved &&
      !window.confirm("This set isn't saved to your shelf — discard it and start another?")
    ) return;
    reset();             // keeps params + seed — tuned dials survive
    setPhoto(null);
    setText("");
  }

  // a render that isn't a data URL or bundled asset can't feed the trophies
  const trophyImage =
    imageUrl && (imageUrl.startsWith("data:") || imageUrl.startsWith("/")) ? imageUrl : null;

  async function onRecoverMesh() {
    try {
      const r = await latestMesh(pendingJob.startedAt);
      set({
        prompt: pendingJob.prompt || "",
        imageUrl: pendingJob.imageThumb || null,
        glbUrl: r.glbUrl,
        glbName: r.glbName,
        pendingJob: null,
      });
      dismissPendingJob();
      if (pendingJob.prompt) setText(pendingJob.prompt);
      toast.success("Recovered the 3D model", "Picked up where you left off.");
    } catch {
      toast.info("Nothing finished yet", "It may still be running — try again in a couple of minutes.");
    }
  }

  return (
    <div className="felt relative flex min-h-full w-full flex-col items-center">
      {/* refresh-recovery: a job outlived the page */}
      {pendingJob && !inFlight && (
        <div className="z-10 mt-3 w-full max-w-[640px] rounded-xl bg-elevated px-4 py-3 shadow-pop">
          <p className="text-sm font-semibold text-ink">
            A build was interrupted.{" "}
            <span className="font-normal text-muted">
              “{(pendingJob.prompt || "Your set").split(",")[0]}” was{" "}
              {{ image: "rendering its set photo", mesh: "being rebuilt in 3D", bricks: "being solved into bricks" }[pendingJob.stage]}{" "}
              when the page closed{pendingJob.stage === "mesh" ? " — the server may have finished it" : ""}.
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingJob.stage === "mesh" && (
              <Button variant="primary" onClick={onRecoverMesh}>Check for the 3D model</Button>
            )}
            {pendingJob.stage === "bricks" && pendingJob.glbName && (
              <Button
                variant="primary"
                onClick={() => {
                  set({
                    prompt: pendingJob.prompt || "",
                    glbUrl: `/api/mesh/${pendingJob.glbName}`,
                    glbName: pendingJob.glbName,
                    pendingJob: null,
                  });
                  dismissPendingJob();
                  if (pendingJob.prompt) setText(pendingJob.prompt);
                }}
              >
                Reopen the 3D model
              </Button>
            )}
            {pendingJob.stage === "image" && (
              <Button
                variant="primary"
                onClick={() => { setText(pendingJob.prompt || ""); dismissPendingJob(); }}
              >
                Start over with this prompt
              </Button>
            )}
            <Button variant="secondary" onClick={dismissPendingJob}>Dismiss</Button>
          </div>
        </div>
      )}

      {/* brand bar */}
      <header className="z-10 flex w-full items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2">
          <LogoMark size={22} />
          <Wordmark className="text-lg text-on-dark" />
        </span>
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
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-yellow">
                step 1 of 3 · visualize
              </p>
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
                  <Button variant="primary" onClick={onForge} disabled={!!inFlight}>
                    <Sparkles size={16} /> Visualize it
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

          {/* room 1 (your prompt at work) + room 2 (the collector's lounge) */}
          {["rendering", "meshing"].includes(phase) && (
            <motion.section
              key="waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-stage"
            >
              <LoadingStage
                stage={phase === "rendering" ? "image" : "mesh"}
                solo={phase === "rendering"}
                prompt={prompt || text}
                params={params}
                onStop={cancelJob}
                square={
                  inFlight === "image" ? (
                    // store prompt, not local state — survives HMR remounts mid-wait
                    <VisualizingCanvas prompt={prompt || text} />
                  ) : imageUrl ? (
                    <MeshStudy imageUrl={imageUrl} />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-muted">
                      <StudLoader />
                    </div>
                  )
                }
                aside={inFlight === "mesh" ? <CallSheet /> : null}
              />
            </motion.section>
          )}

          {/* room 3 is not a room — the deterministic solver sprints */}
          {phase === "legolizing" && (
            <motion.section
              key="legolizing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full max-w-stage"
            >
              <SolverSprint imageUrl={imageUrl} />
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
                <RecipeCard imageUrl={imageUrl} runRecord={runRecord} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">step 2 of 3 · materialize</p>
                  <h2 className="mt-1 font-display text-2xl font-black leading-tight text-on-dark">
                    Happy with the render?
                  </h2>
                  <p className="mt-1 text-sm text-on-dark-muted">
                    Next we materialize it: an image-to-3D model (TRELLIS) rebuilds the
                    sides the photo can't see — realistically 4–6 minutes. Tune how
                    faithfully it should follow the photo, or roll another render first.
                  </p>
                  <div className="mt-3">
                    <TinkerPanel inline groups={["shape"]} presets={false} seedRow={false} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onReconstruct} disabled={!!inFlight}>
                      <Box size={15} /> Materialize in 3D
                    </Button>
                    <Button variant="secondary" onClick={() => onForge({ rerender: true })} disabled={!!inFlight}>
                      <RotateCcw size={15} /> Re-visualize
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
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-yellow">step 3 of 3 · legolize</p>
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
                    <Button variant="primary" onClick={onLegolize} disabled={!!inFlight}>
                      <Sparkles size={15} /> Legolize
                    </Button>
                    <Button variant="secondary" onClick={onReconstruct} disabled={!!inFlight}>
                      <RotateCcw size={15} /> Re-materialize
                    </Button>
                    {tuning && brickModel && (
                      <Button variant="secondary" onClick={() => set({ tuning: false })} title="Back to the finished set">
                        Back to reveal
                      </Button>
                    )}
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
              <AssemblyViewer brickModel={brickModel} height={520} onComplete={() => set({ assembling: false })} />
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
                      label="studs × studs × layers"
                    />
                    <StatTile value={totalColors(brickModel)} label="colors" />
                    <StatTile
                      value={brickModel.stability.connected ? "Stable" : "Wobbly"}
                      label={`${Math.round(brickModel.stability.supportRatio * 100)}% supported`}
                      variant={brickModel.stability.connected ? "ok" : "warn"}
                    />
                  </div>

                  {/* the call sheet from the mesh wait, scored */}
                  {(() => {
                    const score = scoreCalls(calls ?? runRecord?.calls, brickModel);
                    if (!score) return null;
                    return (
                      <div className="mt-3 rounded-xl bg-white/5 px-3.5 py-2.5">
                        <p className="text-nano font-bold uppercase tracking-widest text-on-dark-muted">
                          call sheet ·{" "}
                          <span className={score.hits === score.total ? "text-brand-yellow" : undefined}>
                            you called {score.hits} of {score.total}
                          </span>
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {score.rows.map((r) => (
                            <p key={r.key} className="text-micro text-on-dark-muted">
                              <span className={r.hit ? "text-brand-yellow" : undefined}>
                                {r.hit ? "✓" : "✗"}
                              </span>{" "}
                              {r.label}: you called {r.picked} → {r.actual}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {runRecord && (
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(JSON.stringify(runRecord, null, 2));
                        toast.success("Recipe copied", "Prompt, seed and every dial — paste it anywhere.");
                      }}
                      title="Copy the full run record (prompt, seed, all parameters)"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-micro font-medium text-on-dark-muted hover:bg-white/20"
                    >
                      <Copy size={11} />
                      {summarizeRun(runRecord) || "copy run recipe"}
                    </button>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <Button variant="primary" onClick={onAddToShelf} disabled={saved}>
                      <Star size={15} /> {saved ? "On your shelf" : "Add to shelf"}
                    </Button>
                    {glbUrl && (
                      <Button variant="secondary" onClick={() => set({ tuning: true })} title="Back to the brick settings — re-legolizing takes seconds">
                        <SlidersHorizontal size={15} /> Tune bricks
                      </Button>
                    )}
                    <Button variant="secondary" onClick={onForgeAnother}><RotateCcw size={15} /> Visualize another</Button>
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
        {trophy === "box" && <TheBox imageUrl={trophyImage} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "boxart" && <BoxArt imageUrl={trophyImage} setCopy={setCopy} brickModel={brickModel} />}
        {trophy === "share" && <ShareCard imageUrl={trophyImage} brickModel={brickModel} setCopy={setCopy} />}
        {trophy === "priced" && <PricedSet brickModel={brickModel} setCopy={setCopy} />}
      </TrophyShell>
    </div>
  );
}
