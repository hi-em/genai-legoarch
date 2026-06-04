import { Tooltip } from "./ui/index.js";

// lEgoarCh wordmark — a clean white mark with the red brick glyph as the only
// standing accent; a yellow underline grows in on hover. The E & C (Emilie &
// Charles) meaning lives in the tooltip + aria-label, not in clashing colors.
export default function Brand({ onClick }) {
  return (
    <Tooltip content="lEgoarCh — Emilie El Chidiac & Charles Abi Chahine · MaCAD">
      <button
        type="button"
        onClick={onClick}
        aria-label="lEgoarCh — back to overview"
        className="group -ml-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-white/10 focus-visible:shadow-focus"
      >
        <img
          src="/brick.svg"
          alt=""
          aria-hidden="true"
          className="h-7 w-7 drop-shadow-[0_2px_0_rgba(0,0,0,.25)] transition-transform duration-moderate group-hover:-translate-y-0.5 group-hover:-rotate-6"
        />
        <span className="relative font-display text-[1.4rem] font-black leading-none tracking-[-0.02em] text-on-dark">
          lEgoarCh
          <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-full bg-brand-yellow transition-all duration-moderate group-hover:w-full" />
        </span>
      </button>
    </Tooltip>
  );
}
