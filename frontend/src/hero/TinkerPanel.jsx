// Stage-scoped generation controls. The staged flow shows each parameter
// group exactly when it matters: render dials in the intro, shape dials at
// the image stop, brick dials at the mesh stop — so no single panel ever
// carries all eight sliders.
//
//   <TinkerPanel groups={["render"]} />                  collapsible, intro
//   <TinkerPanel inline groups={["shape"]} presets={false} seedRow={false} />
//
// One-line slider rows + a single shared caption that explains whichever
// dial you're hovering or dragging.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronDown, RotateCcw, Dices } from "lucide-react";
import { useBuild } from "../state/store.js";
import { PARAMS, PRESETS, activePreset, tweakCount } from "./tinkerParams.js";
import { Slider } from "../components/ui/index.js";
import { DUR, EASE } from "../lib/motion.js";
import { playSnap } from "../lib/sound.js";
import { cn } from "../lib/cn.js";

const GROUPS = [
  { id: "render", title: "Render", accent: "bg-brand-yellow" },
  { id: "shape", title: "3D shape", accent: "bg-brand-blue" },
  { id: "bricks", title: "Bricks", accent: "bg-brand-red" },
];

const DEFAULT_CAPTION = "Hover a dial to learn what it does.";

function fmt(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, "");
}

export default function TinkerPanel({
  groups = ["render", "shape", "bricks"],
  inline = false,
  presets = true,
  seedRow = true,
}) {
  const { params, setParams, resetParams, seed, set } = useBuild();
  const [open, setOpen] = useState(false);
  const visibleGroups = GROUPS.filter((g) => groups.includes(g.id));
  const [tab, setTab] = useState(visibleGroups[0].id);
  const [caption, setCaption] = useState(null);
  const tweaks = tweakCount(params);
  const preset = activePreset(params);
  const activeTab = groups.includes(tab) ? tab : visibleGroups[0].id;

  const rollSeed = () => set({ seed: Math.floor(Math.random() * 1_000_000) });

  const body = (
    <div className={cn("space-y-2.5 rounded-xl bg-sunken p-3", !inline && "mt-2.5")}>
      {/* outcome presets — what most tinkerers actually want */}
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              onClick={() => { setParams(pr.params); playSnap(); }}
              onPointerEnter={() => setCaption(pr.hint)}
              onPointerLeave={() => setCaption(null)}
              className={cn(
                "rounded-full border-2 px-2.5 py-0.5 text-micro font-bold transition",
                preset === pr.id
                  ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                  : "border-stone-300 bg-elevated text-ink-soft hover:border-stone-400"
              )}
            >
              {pr.label}
            </button>
          ))}
          {!preset && (
            <span className="self-center rounded-full bg-brand-yellow px-2 py-0.5 text-nano font-bold text-ink">
              Custom
            </span>
          )}
        </div>
      )}

      {/* group tabs (hidden when the stage scopes to a single group) */}
      {visibleGroups.length > 1 && (
        <div className="flex items-center gap-1 rounded-full bg-elevated p-0.5">
          {visibleGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => setTab(g.id)}
              className={cn(
                "flex-1 rounded-full px-2 py-1 text-micro font-bold transition",
                activeTab === g.id ? "bg-ink text-white shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {g.title}
            </button>
          ))}
        </div>
      )}

      {/* compact one-line rows for the active group: sliders + choice pills */}
      <div className="space-y-1.5">
        {PARAMS.filter((p) => p.group === activeTab).map((p) => (
          <div
            key={p.key}
            className="flex items-center gap-2.5"
            onPointerEnter={() => setCaption(p.blurb)}
            onPointerLeave={() => setCaption(null)}
          >
            <label className="w-[108px] shrink-0 truncate text-micro font-semibold text-ink" title={p.label}>
              {p.label}
            </label>
            {p.kind === "choice" ? (
              <div className="flex flex-1 items-center gap-1" role="radiogroup" aria-label={p.label}>
                {p.choices.map((c) => {
                  const current = params[p.key] ?? p.def;
                  const on = current === c.value;
                  return (
                    <button
                      key={String(c.value)}
                      role="radio"
                      aria-checked={on}
                      onClick={() => { setParams({ [p.key]: c.value }); playSnap(); }}
                      className={cn(
                        "rounded-full border-2 px-2.5 py-0.5 text-micro font-bold transition",
                        on
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue"
                          : "border-stone-300 bg-elevated text-ink-soft hover:border-stone-400"
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <Slider
                  className="flex-1"
                  value={params[p.key] ?? p.def}
                  onValueChange={(v) => setParams({ [p.key]: v })}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  accent={visibleGroups.find((g) => g.id === activeTab)?.accent}
                  aria-label={p.label}
                />
                <span
                  className={cn(
                    "w-12 shrink-0 rounded bg-elevated px-1 text-right font-mono text-micro",
                    (params[p.key] ?? p.def) !== p.def ? "font-bold text-brand-blue" : "text-ink-soft"
                  )}
                  title={(params[p.key] ?? p.def) !== p.def ? `default ${fmt(p.def)}` : undefined}
                >
                  {fmt(params[p.key] ?? p.def)}
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* shared caption — the education layer, one line tall */}
      <p className="min-h-[28px] text-micro leading-snug text-muted">
        {caption || DEFAULT_CAPTION}
      </p>

      {/* seed + reset, one row */}
      {seedRow && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-2">
          <div
            className="flex items-center gap-1.5"
            onPointerEnter={() => setCaption("Same seed + same dials = the exact same set, every time. That's reproducibility.")}
            onPointerLeave={() => setCaption(null)}
          >
            <span className="text-micro font-semibold text-ink">Seed</span>
            {seed == null ? (
              <span className="text-micro text-muted">random</span>
            ) : (
              <input
                type="number"
                value={seed}
                onChange={(e) => set({ seed: Number(e.target.value) || 0 })}
                className="w-24 rounded border border-stone-300 bg-elevated px-1.5 py-0.5 font-mono text-micro text-ink focus:border-brand-blue focus:outline-none"
                aria-label="Seed"
              />
            )}
            <button
              onClick={rollSeed}
              className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-micro font-semibold text-ink-soft shadow-plate-flat hover:brightness-95"
            >
              <Dices size={11} /> {seed == null ? "Pin" : "Re-roll"}
            </button>
            {seed != null && (
              <button onClick={() => set({ seed: null })} className="text-micro text-muted underline-offset-2 hover:underline">
                unpin
              </button>
            )}
          </div>
          <button
            onClick={() => { resetParams(); playSnap(); }}
            disabled={tweaks === 0 && seed == null}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold text-muted enabled:hover:bg-elevated enabled:hover:text-ink disabled:opacity-40"
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
      )}
    </div>
  );

  // stage stops embed the controls directly — no disclosure dance mid-flow
  if (inline) return <div className="text-left">{body}</div>;

  return (
    <div className="mt-3 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted hover:bg-sunken hover:text-ink"
      >
        <SlidersHorizontal size={13} />
        Tinker
        {tweaks > 0 && (
          <span className="rounded-full bg-brand-yellow px-1.5 py-px text-nano font-bold text-ink">
            {preset && preset !== "balanced" ? PRESETS.find((p) => p.id === preset)?.label : `${tweaks} tweak${tweaks > 1 ? "s" : ""}`}
          </span>
        )}
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.mod, ease: EASE.standard }}
            className="overflow-hidden"
          >
            {body}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
