// The instruction booklet — built to read like a real LEGO manual: a light,
// landscape TWO-PAGE spread you flip through, scaled to fit the viewport (no
// scroll), with a jump-to-step rail. It's a collectible artifact: a cover with
// the finished-model hero + set number + age/piece badges + a "Collector Series"
// ribbon, a "designed by [persona]" credit page, numbered step pages with a
// per-step parts call-out, and a back cover with a barcode + faux price.
//
// Reuses the SHARED page model (bookletPages) and the SHARED iso renderer
// (isoStepThumb via useStepThumbs, pre-rendered once + cached) so every page is
// pixel-identical to the downloadable PDF and flips are instant.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button, toast } from "../components/ui/index.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import { cn } from "../lib/cn.js";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import LogoMark from "../components/brand/LogoMark.jsx";
import Wordmark from "../components/brand/Wordmark.jsx";
import { setPrice } from "../lib/pricing.js";
import { buildBookletPages } from "./bookletPages.js";
import { useStepThumbs } from "./useStepThumbs.js";

const THUMB_PX = 520;
const PAGE_W = 470;          // one page (px, design units — scaled to fit)
const PAGE_H = 376;
const RAIL_H = 76;
const BOOK_W = PAGE_W * 2;   // an open spread

// deterministic faux set number / barcode seed from the set name
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < (s || "").length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// ---- scale the fixed-size book to fit whatever box we're dropped into -------
function useFitScale(ref) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const cr = e.contentRect;
      setBox({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const single = box.w > 0 && box.w < 560;            // too narrow for a spread
  const contentW = single ? PAGE_W : BOOK_W;
  // fit the spread (contentW × PAGE_H) into the measured book area; the rail
  // lives OUTSIDE this scaled block so it stays readable and doesn't drive width
  const scale = box.w
    ? Math.min(box.w / contentW, box.h / PAGE_H, 1.15)
    : 1;
  return { scale, single, contentW, ready: box.w > 0 };
}

// =================================================================== pieces ==

function Badge({ children, tone = "light" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 font-display text-[12px] font-extrabold leading-none",
      tone === "dark" ? "bg-ink text-white" : "bg-white/90 text-ink ring-1 ring-black/10"
    )}>
      {children}
    </span>
  );
}

function Ribbon({ children }) {
  return (
    <span className="inline-block -rotate-2 rounded-sm bg-brand-red px-2.5 py-1 font-display text-[11px] font-black uppercase tracking-wider text-white shadow-pop">
      {children}
    </span>
  );
}

function StepBubble({ n }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-yellow font-display text-lg font-black text-ink shadow-[0_2px_0_rgba(0,0,0,.18)]">
      {n}
    </span>
  );
}

// CSS-only faux barcode (deterministic from the seed)
function Barcode({ seed }) {
  const bars = useMemo(() => {
    let s = seed || 1;
    const out = [];
    for (let i = 0; i < 42; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; out.push(1 + (s % 4)); }
    return out;
  }, [seed]);
  return (
    <div className="flex h-9 items-end gap-[2px]">
      {bars.map((w, i) => (
        <span key={i} style={{ width: w, height: i % 7 === 0 ? "100%" : "85%" }} className="bg-ink" />
      ))}
    </div>
  );
}

function Signature({ name }) {
  return (
    <div className="leading-none">
      <span className="font-display text-2xl italic text-ink" style={{ fontWeight: 600, transform: "skewX(-8deg)", display: "inline-block" }}>
        {name}
      </span>
      <svg viewBox="0 0 160 14" className="mt-0.5 h-3 w-40 text-brand-red" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M2 8 C 28 2, 44 12, 70 6 S 120 2, 158 7" />
      </svg>
    </div>
  );
}

// The iso render slot — pre-rendered dataURL into an <img>; skeleton until ready.
function StepImg({ src, alt }) {
  if (!src) return <div className="aspect-square w-full max-w-[15rem] animate-pulse rounded-lg bg-[#e7eef5]" aria-label="Rendering this step…" />;
  return <img src={src} alt={alt} className="block aspect-square w-full max-w-[15rem] object-contain" draggable={false} />;
}

// ================================================================= pages =====
// Each renderer fills one PAGE_W × PAGE_H face.

function CoverPage({ cover, heroSrc, setNumber }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-2 py-1 shadow-sm">
          <LogoMark size={16} />
          <Wordmark className="text-sm text-white" />
        </span>
        <span className="font-mono text-[12px] font-bold text-ink/70">{setNumber}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        {heroSrc
          ? <img src={heroSrc} alt={cover.name} className="max-h-full max-w-full object-contain" draggable={false} />
          : <div className="h-32 w-32 animate-pulse rounded-xl bg-white/60" />}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Ribbon>Collector Series</Ribbon>
          <Badge>18+</Badge>
          <Badge>{cover.nBricks.toLocaleString()} pcs</Badge>
        </div>
        <h2 className="font-display text-2xl font-black leading-tight text-ink">{cover.name}</h2>
        <p className="font-display text-[11px] font-bold uppercase tracking-widest text-brand-blue">
          lEgoarCh · Architecture
        </p>
      </div>
    </div>
  );
}

function CreditPage({ cover, designer }) {
  return (
    <div className="flex h-full w-full flex-col bg-white p-5">
      <p className="font-display text-[11px] font-extrabold uppercase tracking-widest text-brand-red">Building instructions</p>
      <p className="mt-1 text-sm leading-snug text-muted">Build it course by course — each step highlights the bricks you add.</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[[cover.nBricks.toLocaleString(), "pieces"], [`${cover.grid[0]}×${cover.grid[1]}`, "studs"], [cover.nCourses, "steps"]].map(([v, l]) => (
          <div key={l} className="rounded-lg bg-[#f1f6fb] p-2 text-center">
            <div className="font-display text-lg font-black text-ink">{v}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-auto rounded-xl bg-[#f7fafd] p-3 ring-1 ring-black/5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Designed by</p>
        {cover.quote
          ? <p className="mt-1 font-display text-sm italic leading-snug text-ink-soft">“{cover.quote}”</p>
          : <p className="mt-1 font-display text-sm italic leading-snug text-ink-soft">One prompt, solved brick by brick.</p>}
        <div className="mt-2"><Signature name={designer} /></div>
      </div>
    </div>
  );
}

function StepPage({ n, total, step, src }) {
  return (
    <div className="flex h-full w-full flex-col bg-white p-4">
      <div className="flex items-center gap-2.5">
        <StepBubble n={n} />
        <span className="font-display text-sm font-bold text-muted">Step {n} of {total}</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <StepImg src={src} alt={`Build after step ${n}`} />
      </div>
      <div className="rounded-lg bg-[#f1f6fb] px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand-blue">+{step.total} pcs</span>
          {step.parts.slice(0, 7).map((p, i) => (
            <span key={`${p.part}-${i}`} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/15" style={{ background: p.hex }} />
              <span className="text-[11px] font-semibold text-ink">{p.qty}×</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackCoverPage({ cover, setNumber, price, finishedSrc }) {
  return (
    <div className="flex h-full w-full flex-col bg-white p-5">
      <div className="flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5">
          <LogoMark size={16} />
          <Wordmark className="text-sm text-ink" />
        </span>
        <span className="font-display text-lg font-black text-ink">{price}</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {finishedSrc && <img src={finishedSrc} alt="" className="max-h-[60%] max-w-[60%] object-contain opacity-90" draggable={false} />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex gap-1.5"><Badge tone="dark">18+</Badge><Badge tone="dark">{cover.nBricks.toLocaleString()} pcs</Badge></div>
          <p className="max-w-[16rem] text-[10px] leading-snug text-muted">
            lEgoarCh · MaCAD Generative AI. A buildable set generated from a prompt. LEGO® is a trademark of the LEGO Group.
          </p>
        </div>
        <div className="text-right">
          <Barcode seed={hashString(setNumber)} />
          <p className="mt-0.5 font-mono text-[10px] text-ink/70">{setNumber}</p>
        </div>
      </div>
    </div>
  );
}

function BlankPage() {
  return <div className="h-full w-full bg-[#f3f6fa]" />;
}

// Render a page descriptor into a face.
function Face({ page, ctx }) {
  if (!page) return <BlankPage />;
  if (page.type === "cover") return <CoverPage cover={ctx.cover} heroSrc={ctx.heroSrc} setNumber={ctx.setNumber} />;
  if (page.type === "credit") return <CreditPage cover={ctx.cover} designer={ctx.designer} />;
  if (page.type === "back") return <BackCoverPage cover={ctx.cover} setNumber={ctx.setNumber} price={ctx.price} finishedSrc={ctx.heroSrc || ctx.getThumb(ctx.lastCourse)} />;
  if (page.type === "step") return <StepPage n={page.n} total={ctx.stepCount} step={page.step} src={ctx.getThumb(page.step.course)} />;
  return <BlankPage />;
}

// A bordered page card at the fixed design size.
function PageCard({ page, ctx, side }) {
  return (
    <div
      style={{ width: PAGE_W, height: PAGE_H }}
      className={cn(
        "overflow-hidden bg-white ring-1 ring-black/10",
        side === "left" ? "rounded-l-xl shadow-[inset_-10px_0_18px_-12px_rgba(0,0,0,.25)]"
          : side === "right" ? "rounded-r-xl shadow-[inset_10px_0_18px_-12px_rgba(0,0,0,.25)]"
            : "rounded-xl"
      )}
    >
      <Face page={page} ctx={ctx} />
    </div>
  );
}

// =============================================================== component ===

export default function BookletView({ brickModel, setCopy = {}, imageUrl = null }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef(null);
  const { scale, single, contentW } = useFitScale(wrapRef);

  // Fit the whole booklet so its scroll container never grows a vertical
  // scrollbar (the book-area below flexes to fill whatever's left). Two-pass:
  // size to the viewport bottom, then trim by any residual overflow the
  // container still reports — self-correcting for the explore card's and the
  // modal's differing padding/footers, in any viewport. (Reusable pattern for
  // any "must fit, no scroll" view.)
  const rootRef = useRef(null);
  const [availH, setAvailH] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const h = Math.max(320, Math.floor(window.innerHeight - top - 16));
      setAvailH(h);
      requestAnimationFrame(() => {
        const scroller = rootRef.current?.closest(".overflow-y-auto");
        if (!scroller) return;
        const over = scroller.scrollHeight - scroller.clientHeight;
        if (over > 0) setAvailH(Math.max(300, h - over - 6));
      });
    };
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", measure); };
  }, []);

  const { cover, steps } = useMemo(() => buildBookletPages(brickModel, setCopy), [brickModel, setCopy]);

  // flat page list: cover, credit, steps…, back cover
  const pages = useMemo(() => {
    const list = [{ type: "cover" }, { type: "credit" }];
    steps.forEach((s, i) => list.push({ type: "step", step: s, n: i + 1 }));
    list.push({ type: "back" });
    return list;
  }, [steps]);

  const perView = single ? 1 : 2;
  const viewCount = Math.ceil(pages.length / perView);
  const [view, setView] = useState(0);
  const [turn, setTurn] = useState(null); // { dir, from, phase } (spread mode only)

  // PDF export: snapshot the REAL rendered spreads (always 2-up, independent of
  // the on-screen single/spread mode) so the PDF is pixel-identical to the app.
  const [exporting, setExporting] = useState(false);
  const exportRefs = useRef([]);
  const exportSpreads = useMemo(() => {
    const out = [];
    for (let i = 0; i < pages.length; i += 2) out.push([pages[i], pages[i + 1] || null]);
    return out;
  }, [pages]);

  const setNumber = cover.number || `#${(hashString(cover.name) % 9000 + 1000)}`;
  const designer = "lEgoarCh Studio"; // the studio signature — never the set title
  // same canonical build-cost as the box back panel + the Pieces & Prices table
  const price = `$${Math.round(setPrice(brickModel)).toLocaleString()}`;
  const lastCourse = Math.max(0, cover.nCourses - 1);

  // pre-render all step thumbs once; priority near the visible page
  const firstStepCourse = useMemo(() => {
    const p = pages[view * perView];
    return p?.type === "step" ? p.step.course : lastCourse;
  }, [pages, view, perView, lastCourse]);
  const getThumb = useStepThumbs(brickModel, firstStepCourse, 3, THUMB_PX);

  const heroSrc = imageUrl || getThumb(lastCourse);
  const ctx = { cover, heroSrc, setNumber, designer, price, getThumb, lastCourse, stepCount: steps.length };

  const pageAt = (i) => (i >= 0 && i < pages.length ? pages[i] : null);
  const clampView = useCallback((v) => Math.max(0, Math.min(viewCount - 1, v)), [viewCount]);

  // start the flip phase: "start" for one frame, then "end" → CSS animates
  useLayoutEffect(() => {
    if (!turn || turn.phase !== "start") return;
    const id = requestAnimationFrame(() => setTurn((t) => (t && t.phase === "start" ? { ...t, phase: "end" } : t)));
    return () => cancelAnimationFrame(id);
  }, [turn]);

  const finishTurn = useCallback((to) => { setView(to); setTurn(null); }, []);

  const go = useCallback((dir) => {
    if (turn) return;
    const to = clampView(view + dir);
    if (to === view) return;
    playSnap();
    if (reduced || single) { setView(to); return; }   // single-page / reduced = instant
    setTurn({ dir, from: view, phase: "start" });
  }, [turn, view, clampView, reduced, single]);

  const jumpTo = useCallback((pageIdx) => {
    const v = clampView(Math.floor(pageIdx / perView));
    if (v === view || turn) { setView(v); return; }
    playSnap();
    setView(v);
  }, [perView, view, turn, clampView]);

  // safety net if transitionend is missed
  useEffect(() => {
    if (!turn || turn.phase !== "end") return;
    const t = setTimeout(() => finishTurn(turn.from + turn.dir), 700);
    return () => clearTimeout(t);
  }, [turn, finishTurn]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };

  const onDownload = () => {
    if (exporting) return;
    toast.info("Building your manual…", "Rendering pages — a few seconds.");
    setExporting(true);
  };

  // Snapshot the REAL rendered spreads (html-to-image @2×) into a landscape PDF
  // sized to the exact spread ratio — pixel-identical to the on-screen booklet
  // (same design, fonts, ratio) and sharp. The web-font CSS warnings html-to-image
  // logs are non-fatal: it falls back to the already-loaded DM Sans, which renders.
  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    (async () => {
      try {
        // let the hidden spreads lay out + the cached dataURL images decode
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise((r) => setTimeout(r, 150));
        const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [BOOK_W, PAGE_H], compress: true });
        for (let i = 0; i < exportSpreads.length; i++) {
          const node = exportRefs.current[i];
          if (!node) continue;
          const png = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", width: BOOK_W, height: PAGE_H, cacheBust: true });
          if (cancelled) return;
          if (i > 0) doc.addPage([BOOK_W, PAGE_H], "landscape");
          doc.addImage(png, "PNG", 0, 0, BOOK_W, PAGE_H);
        }
        if (cancelled) return;
        doc.save(`${(cover.name || "set").replace(/[^\w]+/g, "_")}_instructions.pdf`);
        toast.success("Manual saved", "The PDF is in your downloads.");
      } catch {
        if (!cancelled) toast.error("Couldn't build the PDF", "Try again, or browse the on-screen booklet.");
      } finally {
        if (!cancelled) setExporting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exporting, exportSpreads, cover.name]);

  // current spread pages (base layer)
  const L = pageAt(view * perView);
  const R = perView === 2 ? pageAt(view * perView + 1) : null;

  // leaf faces during a spread turn
  let baseLeft = L, baseRight = R, leafFront = null, leafBack = null, leafSide = null;
  if (turn) {
    const f = turn.from;
    if (turn.dir === 1) {
      baseLeft = pageAt(f * 2);
      baseRight = pageAt((f + 1) * 2 + 1);
      leafFront = pageAt(f * 2 + 1);
      leafBack = pageAt(f * 2 + 2);
      leafSide = "right";
    } else {
      baseLeft = pageAt((f - 1) * 2);
      baseRight = pageAt(f * 2 + 1);
      leafFront = pageAt(f * 2);
      leafBack = pageAt(f * 2 - 1);
      leafSide = "left";
    }
  }

  const counterLabel = (() => {
    const p = L;
    if (!p) return "";
    if (p.type === "cover") return "Cover";
    if (p.type === "back") return "Back cover";
    if (p.type === "step") return `Step ${p.n} of ${steps.length}`;
    return "Instructions";
  })();

  return (
    <div ref={rootRef} className="flex w-full flex-col gap-stud-2 overflow-hidden" style={availH ? { height: availH } : undefined}>
      {/* header */}
      <div className="flex items-center justify-between gap-stud-2">
        <div className="min-w-0">
          <p className="text-nano font-extrabold uppercase tracking-widest text-brand-red">lEgoarCh · building instructions</p>
          <p className="truncate font-display text-h3 font-extrabold text-ink">{cover.name}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onDownload} disabled={exporting} aria-label="Download the instructions as a PDF">
          <Download /> {exporting ? "Rendering…" : "Download PDF"}
        </Button>
      </div>

      {/* the book — fixed design size, scaled to fit this box (no scroll). The
          outer wrapper is sized to the SCALED dimensions (transform doesn't
          change layout size), so the spread can't overflow / clip on the right. */}
      <div
        ref={wrapRef}
        role="group"
        aria-roledescription="instruction booklet"
        aria-label={`${cover.name} — ${counterLabel}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
      >
        <div style={{ width: contentW * scale, height: PAGE_H * scale }}>
          <div
            className="relative"
            style={{ width: contentW, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left", perspective: 1600 }}
          >
            {single ? (
              <div key={view} className={cn("h-full w-full", !reduced && "animate-in fade-in duration-moderate")}>
                <PageCard page={L} ctx={ctx} side="single" />
              </div>
            ) : (
              <>
                <div className="absolute left-0 top-0"><PageCard page={baseLeft} ctx={ctx} side="left" /></div>
                <div className="absolute right-0 top-0"><PageCard page={baseRight} ctx={ctx} side="right" /></div>

                {/* turning leaf */}
                {turn && (
                  <div
                    className="absolute top-0 transition-transform duration-flip ease-standard [transform-style:preserve-3d]"
                    style={{
                      left: leafSide === "right" ? PAGE_W : 0,
                      width: PAGE_W,
                      height: PAGE_H,
                      transformOrigin: leafSide === "right" ? "left center" : "right center",
                      transform:
                        turn.phase === "end"
                          ? (leafSide === "right" ? "rotateY(-180deg)" : "rotateY(180deg)")
                          : "rotateY(0deg)",
                    }}
                    onTransitionEnd={(e) => { if (e.propertyName === "transform") finishTurn(turn.from + turn.dir); }}
                  >
                    <div className="absolute inset-0 [backface-visibility:hidden]">
                      <PageCard page={leafFront} ctx={ctx} side={leafSide} />
                    </div>
                    <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: "rotateY(180deg)" }}>
                      <PageCard page={leafBack} ctx={ctx} side={leafSide === "right" ? "left" : "right"} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* jump-to-step rail — outside the scaled book, natural size, scrollable */}
      <div style={{ height: RAIL_H }} className="flex items-center gap-1.5 overflow-x-auto rounded-lg bg-[#eef3f8] px-2 py-1.5">
        {pages.map((p, i) => {
          const here = Math.floor(i / perView) === view;
          const thumb = p.type === "step" ? getThumb(p.step.course) : null;
          return (
            <button
              key={i}
              onClick={() => jumpTo(i)}
              title={p.type === "step" ? `Step ${p.n}` : p.type === "cover" ? "Cover" : p.type === "credit" ? "Designer" : "Back cover"}
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-white text-[10px] font-bold text-muted ring-1 transition",
                here ? "ring-2 ring-brand-red" : "ring-black/10 hover:ring-brand-blue/50"
              )}
            >
              {thumb ? <img src={thumb} alt="" className="h-full w-full object-contain" />
                : p.type === "cover" ? <span className="text-brand-red">COVER</span>
                  : p.type === "credit" ? "✎" : "END"}
            </button>
          );
        })}
      </div>

      {/* controls */}
      <div className="flex items-center justify-center gap-stud-2">
        <Button variant="nav" size="md" onClick={() => go(-1)} disabled={view === 0 || !!turn} aria-label="Previous page">
          <ChevronLeft /> Prev
        </Button>
        <p className="min-w-28 text-center font-display text-sm font-bold text-muted" aria-live="polite">{counterLabel}</p>
        <Button variant="nav" size="md" onClick={() => go(1)} disabled={view >= viewCount - 1 || !!turn} aria-label="Next page">
          Next <ChevronRight />
        </Button>
      </div>

      {/* off-screen full-size spreads, snapshotted into the PDF on export */}
      {exporting && (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          {exportSpreads.map((sp, i) => (
            <div
              key={i}
              ref={(el) => (exportRefs.current[i] = el)}
              style={{ width: BOOK_W, height: PAGE_H, display: "flex", background: "#fff" }}
            >
              <PageCard page={sp[0]} ctx={ctx} side="left" />
              <PageCard page={sp[1]} ctx={ctx} side="right" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
