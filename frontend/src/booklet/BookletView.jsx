// In-app 3D page-flip instruction booklet. Reuses the SHARED isometric step
// renderer (lib/isoThumb via useStepThumbs) so every page is pixel-identical to
// the printed PDF, and the SHARED page model (bookletPages) so the two never
// drift. The page-turn is a single CSS-3D leaf rotating over the static spread
// underneath — the exact recipe from hero/RecipeCard.jsx ([perspective:1200px],
// [transform-style:preserve-3d], [transform:rotateY(180deg)],
// [backface-visibility:hidden], duration-flip), with RecipeCard's reduced-motion
// opacity-crossfade branch. Designed to live inside a constrained modal: no fixed
// positioning, no full-page assumptions.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button, toast } from "../components/ui/index.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import { playSnap } from "../lib/sound.js";
import { cn } from "../lib/cn.js";
import { generateBooklet } from "../lib/booklet.js";
import { buildBookletPages } from "./bookletPages.js";
import { useStepThumbs } from "./useStepThumbs.js";

const THUMB_PX = 520;
const DRAG_THRESHOLD = 60; // px of horizontal travel to commit a turn

export default function BookletView({ brickModel, setCopy = {} }) {
  const reduced = useReducedMotion();
  const { cover, steps } = useMemo(
    () => buildBookletPages(brickModel, setCopy),
    [brickModel, setCopy]
  );

  // page 0 = cover; pages 1..steps.length = step pages (one course each)
  const pageCount = steps.length + 1;
  const [page, setPage] = useState(0);
  // an in-flight turn. `phase` is "start" for one frame (leaf flat / fully
  // folded) then flips to "end" — the change between the two is what the CSS
  // transition animates. dir: 1 = forward, -1 = backward. else null.
  const [turn, setTurn] = useState(null);
  const [drag, setDrag] = useState(null); // { startX, dx } during a pointer drag

  // the current course drives the lazy render window; cover (page 0) seeds course 0
  const currentCourse = page === 0 ? 0 : steps[page - 1].course;
  const getThumb = useStepThumbs(brickModel, currentCourse, 3, THUMB_PX);

  const finishTurn = useCallback((to) => {
    setPage(to);
    setTurn(null);
  }, []);

  // flip phase "start" -> "end" on the next frame so the CSS transition fires
  useLayoutEffect(() => {
    if (!turn || turn.phase !== "start") return;
    const id = requestAnimationFrame(() =>
      setTurn((t) => (t && t.phase === "start" ? { ...t, phase: "end" } : t))
    );
    return () => cancelAnimationFrame(id);
  }, [turn]);

  const go = useCallback(
    (dir) => {
      if (turn) return;
      const to = page + dir;
      if (to < 0 || to >= pageCount) return;
      playSnap();
      if (reduced) {
        // reduced motion: no rotation, just swap (CSS handles the crossfade)
        setPage(to);
        return;
      }
      setTurn({ dir, to, phase: "start" });
    },
    [turn, page, pageCount, reduced]
  );

  // keyboard: ArrowLeft / ArrowRight turn pages
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    },
    [go]
  );

  // optional drag-to-turn (pointer)
  const onPointerDown = (e) => {
    if (turn || reduced) return;
    setDrag({ startX: e.clientX, dx: 0 });
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    setDrag((d) => ({ ...d, dx: e.clientX - d.startX }));
  };
  const endDrag = () => {
    if (!drag) return;
    const { dx } = drag;
    setDrag(null);
    if (dx <= -DRAG_THRESHOLD) go(1);
    else if (dx >= DRAG_THRESHOLD) go(-1);
  };

  const onDownload = () => {
    toast.info("Building your manual…", "Rendering pages.");
    setTimeout(() => generateBooklet(brickModel, setCopy), 30);
  };

  // a turn auto-completes on transitionend; this is a safety net for when that
  // event is missed (tab backgrounded, transition interrupted, etc.). Armed only
  // once the leaf is actually animating (phase "end").
  useEffect(() => {
    if (!turn || turn.phase !== "end") return;
    const t = setTimeout(() => finishTurn(turn.to), 600);
    return () => clearTimeout(t);
  }, [turn, finishTurn]);

  const counter =
    page === 0 ? "Cover" : `Step ${page} of ${steps.length}`;

  return (
    <div className="flex w-full flex-col gap-stud-3">
      {/* header: brand + counter + download */}
      <div className="flex items-center justify-between gap-stud-2">
        <div className="min-w-0">
          <p className="text-nano font-extrabold uppercase tracking-widest text-brand-yellow-dark">
            lEgoarCh · building instructions
          </p>
          <p className="truncate font-display text-h3 font-extrabold text-ink">
            {cover.name}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onDownload} aria-label="Download the instructions as a PDF">
          <Download /> Download PDF
        </Button>
      </div>

      {/* the book — a single rotating leaf over the static target spread */}
      <div
        role="group"
        aria-roledescription="instruction booklet"
        aria-label={`${cover.name} — ${counter}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={cn(
          "relative mx-auto aspect-[4/5] w-full max-w-md select-none rounded-xl bg-elevated shadow-pop outline-none",
          "ring-1 ring-border focus-visible:shadow-focus",
          !reduced && "[perspective:1200px]"
        )}
      >
        {/* BASE (static spread). Forward turns reveal the destination underneath
            the peeling leaf; backward turns keep the current page underneath while
            the previous page folds back in over it. Keyed by page so the reduced-
            motion branch remounts and fades the new page in (the crossfade). */}
        <PageFace
          key={turn ? (turn.dir === 1 ? turn.to : page) : page}
          page={turn ? (turn.dir === 1 ? turn.to : page) : page}
          cover={cover}
          steps={steps}
          getThumb={getThumb}
          reduced={reduced}
        />

        {/* LEAF: one rotating page over the static base. Forward = the current
            page peels left (0 -> -160deg); backward = the previous page folds in
            (-160 -> 0deg). The flat-vs-folded difference between phase "start" and
            "end" is what the duration-flip transition animates. */}
        {!reduced && turn && (
          <div
            className="absolute inset-0 origin-left [transform-style:preserve-3d] transition-transform duration-flip ease-standard"
            style={{
              transform:
                turn.phase === "end"
                  ? turn.dir === 1
                    ? "rotateY(-160deg)"
                    : "rotateY(0deg)"
                  : turn.dir === 1
                    ? "rotateY(0deg)"
                    : "rotateY(-160deg)",
            }}
            onTransitionEnd={(e) => {
              if (e.propertyName === "transform") finishTurn(turn.to);
            }}
          >
            {/* the page that is visually moving */}
            <div className="absolute inset-0 [backface-visibility:hidden] shadow-pop">
              <PageFace
                page={turn.dir === 1 ? page : turn.to}
                cover={cover}
                steps={steps}
                getThumb={getThumb}
                reduced={reduced}
              />
            </div>
          </div>
        )}

        {/* REDUCED MOTION: no rotateY — the base PageFace is keyed by page so the
            swap itself is instant; its transition-opacity (in PageFace) gives the
            RecipeCard-style crossfade. */}
      </div>

      {/* controls — primary a11y affordance */}
      <div className="flex items-center justify-center gap-stud-2">
        <Button
          variant="nav"
          size="md"
          onClick={() => go(-1)}
          disabled={page === 0 || !!turn}
          aria-label="Previous page"
        >
          <ChevronLeft /> Prev
        </Button>
        <p className="min-w-28 text-center font-display text-sm font-bold text-muted" aria-live="polite">
          {counter}
        </p>
        <Button
          variant="nav"
          size="md"
          onClick={() => go(1)}
          disabled={page >= pageCount - 1 || !!turn}
          aria-label="Next page"
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

// One page face — either the cover or a single step. Pure presentation; pulls
// its iso render from the lazy thumb getter (null = still rendering).
function PageFace({ page, cover, steps, getThumb, reduced }) {
  if (page === 0) {
    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-between rounded-xl bg-table p-stud-4 text-center",
          // reduced-motion crossfade — the keyed remount fades the new page in
          reduced && "animate-in fade-in duration-moderate"
        )}
      >
        <div className="space-y-1">
          <p className="text-nano font-extrabold uppercase tracking-widest text-brand-yellow">
            lEgoarCh · architecture
          </p>
          <h2 className="font-display text-h2 font-extrabold text-on-dark">{cover.name}</h2>
          <p className="text-caption text-on-dark-muted">
            {cover.nBricks.toLocaleString()} pieces · {cover.grid[0]} × {cover.grid[1]} studs ·{" "}
            {cover.nCourses} steps
            {cover.number ? ` · set ${cover.number}` : ""}
          </p>
        </div>
        <ThumbImg src={getThumb(0)} alt="Finished build" />
        <div className="space-y-1">
          <p className="font-display text-sm font-bold text-on-dark">Building instructions</p>
          {cover.quote && (
            <p className="mx-auto max-w-xs text-nano italic text-on-dark-muted line-clamp-2">
              {cover.quote}
            </p>
          )}
        </div>
      </div>
    );
  }

  const step = steps[page - 1];
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col rounded-xl bg-elevated p-stud-3",
        // reduced-motion crossfade — the keyed remount fades the new page in
        reduced && "animate-in fade-in duration-moderate"
      )}
    >
      <div className="flex items-baseline gap-stud-2">
        <span className="font-display text-h1 font-extrabold leading-none text-ink">{page}</span>
        <span className="text-caption font-semibold text-muted">
          add this course
        </span>
      </div>

      <div className="my-stud-2 flex min-h-0 flex-1 items-center justify-center">
        <ThumbImg src={getThumb(step.course)} alt={`Build after step ${page}`} />
      </div>

      {/* parts added at this step */}
      <div className="flex flex-wrap items-center gap-x-stud-2 gap-y-1">
        <span className="text-caption font-bold text-muted">+{step.total} pcs</span>
        {step.parts.slice(0, 8).map((p, i) => (
          <span key={`${p.part}-${i}`} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/10"
              style={{ background: p.hex }}
            />
            <span className="text-caption text-ink">{p.qty}×</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// The iso render slot. Uses the shared renderer's dataURL into an <img> so it is
// byte-identical to the PDF; a skeleton fills the slot until the lazy tick lands.
function ThumbImg({ src, alt }) {
  if (!src) {
    return (
      <div
        className="aspect-square w-full max-w-[18rem] animate-pulse rounded-lg bg-sunken"
        aria-label="Rendering this step…"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="block aspect-square w-full max-w-[18rem] rounded-lg object-contain"
      draggable={false}
    />
  );
}
