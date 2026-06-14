// "The call sheet" — three one-tap predictions made during the long mesh
// wait, scored together at the reveal ("you called 2 of 3"). Gives the 4–6
// minute room an arc with a payoff. Calls live in the build store (they
// survive re-materialize and re-legolize on purpose — the bet is about the
// FINAL set) and are folded into runRecord at legolize so saved sets keep
// them.
import { Chip } from "../components/ui/index.js";
import { useBuild } from "../state/store.js";
import { totalParts, totalColors } from "../lib/brickModel.js";
import { playSnap } from "../lib/sound.js";

export const BETS = [
  {
    key: "pieces",
    label: "pieces",
    options: [
      { id: "lt2k", label: "< 2,000" },
      { id: "2to5k", label: "2–5,000" },
      { id: "5to10k", label: "5–10,000" },
      { id: "gt10k", label: "> 10,000" },
    ],
    judge: (bm) => {
      const n = totalParts(bm);
      return n < 2000 ? "lt2k" : n < 5000 ? "2to5k" : n < 10000 ? "5to10k" : "gt10k";
    },
    actual: (bm) => totalParts(bm).toLocaleString(),
  },
  {
    key: "stable",
    label: "stability",
    options: [
      { id: "stable", label: "Stable" },
      { id: "wobbly", label: "Wobbly" },
    ],
    judge: (bm) => (bm.stability.connected ? "stable" : "wobbly"),
    actual: (bm) => (bm.stability.connected ? "Stable" : "Wobbly"),
  },
  {
    key: "colors",
    label: "colors",
    options: [
      { id: "lt8", label: "< 8" },
      { id: "8to14", label: "8–14" },
      { id: "gt14", label: "15+" },
    ],
    judge: (bm) => {
      const n = totalColors(bm);
      return n < 8 ? "lt8" : n < 15 ? "8to14" : "gt14";
    },
    actual: (bm) => String(totalColors(bm)),
  },
];

// → { rows: [{key,label,picked,actual,hit}], hits, total } or null
export function scoreCalls(calls, bm) {
  if (!calls || !bm) return null;
  const rows = BETS.filter((b) => calls[b.key]).map((b) => {
    const picked = b.options.find((o) => o.id === calls[b.key]);
    return {
      key: b.key,
      label: b.label,
      picked: picked?.label ?? calls[b.key],
      actual: b.actual(bm),
      hit: calls[b.key] === b.judge(bm),
    };
  });
  if (!rows.length) return null;
  return { rows, hits: rows.filter((r) => r.hit).length, total: rows.length };
}

export default function CallSheet() {
  const calls = useBuild((s) => s.calls);
  const set = useBuild((s) => s.set);
  const done = BETS.every((b) => calls?.[b.key]);
  // always merge against the LIVE store value — two quick taps in the same
  // tick would otherwise overwrite each other via the stale render closure
  const pick = (key, id) => {
    if (id) playSnap();   // a click when you place a call (not when you clear)
    set({ calls: { ...(useBuild.getState().calls || {}), [key]: id } });
  };

  return (
    <div className="mt-3 rounded-xl bg-white/5 px-3.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-nano font-bold uppercase tracking-widest text-on-dark-muted">
          the call sheet
        </p>
        <p className="text-nano text-on-dark-muted">
          {done ? "locked in — judged at the reveal" : "make your calls — judged at the reveal"}
        </p>
      </div>
      {BETS.map((b) => {
        const picked = b.options.find((o) => o.id === calls?.[b.key]);
        return (
          <div key={b.key} className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="w-16 shrink-0 text-micro text-on-dark-muted">{b.label}</span>
            {picked ? (
              <>
                <span className="text-sm font-semibold text-brand-yellow">{picked.label}</span>
                <button
                  onClick={() => pick(b.key, null)}
                  className="text-micro text-on-dark-muted underline-offset-2 hover:underline"
                >
                  change
                </button>
              </>
            ) : (
              b.options.map((o) => (
                <Chip key={o.id} onClick={() => pick(b.key, o.id)}>
                  {o.label}
                </Chip>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
