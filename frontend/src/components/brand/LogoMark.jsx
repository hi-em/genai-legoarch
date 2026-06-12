// The lEgoarCh mark — "Plate Stack": three offset plates, one per stage of
// the journey (Visualize · Materialize · Legolize), one stud on top.
// Three stages, one build. Chosen from the 2026-06 logo round.
// Trademark-safe: an abstract plate stack, not a LEGO brick silhouette.
export default function LogoMark({ size = 24, mono = false, className }) {
  const c = mono
    ? { top: "currentColor", mid: "currentColor", base: "currentColor" }
    : { top: "#f6c700", mid: "#c91a09", base: "#1e5aa8" };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-label="lEgoarCh"
      role="img"
    >
      <rect x="8" y="44" width="48" height="13" rx="3" fill={c.base} />
      <rect x="14" y="30" width="40" height="13" rx="3" fill={c.mid} />
      <rect x="20" y="16" width="30" height="13" rx="3" fill={c.top} />
      <rect x="30" y="9" width="10" height="8" rx="2.5" fill={c.top} />
      <rect x="30" y="9" width="10" height="3" rx="1.5" fill="#ffffff" opacity="0.22" />
    </svg>
  );
}
