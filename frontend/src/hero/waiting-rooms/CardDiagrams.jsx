// One small diagram per mesh-deck card, drawn in the lEgoarCh language:
// brand plate colors, stud dots, dashed ghosts for what the AI infers.
// All sit on the card back's ink panel — strokes are on-dark whites, fills
// use the brand CSS variables so they stay token-true. Keyed by card title.
// Decorative (aria-hidden): the body text below each diagram carries the
// information for screen readers.
//
// NOTE on keys: this project's JSX dev transform emits only `jsxDEV` with
// isStaticChildren:false (no `jsxsDEV`), so React key-validates the children
// array of every element at its CREATION site. Diagrams with inline SVG
// children therefore need an explicit `key` on each direct child of <Frame>
// (the `.map()` diagrams are already keyed). tinyLabel carries its own key too.

const ON = "rgba(233,235,230,"; // on-dark white, append alpha + ")"

function Frame({ children, label }) {
  return (
    <svg
      viewBox="0 0 220 72"
      aria-hidden
      className="mt-2 h-[72px] w-full shrink-0"
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
      {label}
    </svg>
  );
}

// keyed by x so the multi-label `label={[...]}` arrays a few diagrams pass to
// Frame don't trip React's "unique key prop" warning (x is unique per frame)
const tinyLabel = (x, text, anchor = "middle") => (
  <text key={x} x={x} y="69" textAnchor={anchor} fontSize="7.5" fontWeight="600" fill={`${ON}.55)`} style={{ letterSpacing: ".08em", textTransform: "uppercase" }}>
    {text}
  </text>
);

const Arrow = ({ x1, x2, y = 36 }) => (
  <g stroke={`${ON}.4)`} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={`M${x1} ${y} H${x2}`} />
    <path d={`M${x2 - 5} ${y - 4} L${x2 + 1} ${y} L${x2 - 5} ${y + 4}`} />
  </g>
);

// isometric cube at (cx, topY), edge e — faces: top yellow, left blue, right pale
const Cube = ({ cx, topY, e = 16, mono = false }) => {
  const top = mono ? `${ON}.3)` : "var(--brand-yellow)";
  const left = mono ? `${ON}.18)` : "rgba(30,90,168,.75)";
  const right = mono ? `${ON}.1)` : `${ON}.25)`;
  return (
    <g>
      <path d={`M${cx - e} ${topY + e / 2} L${cx} ${topY} L${cx + e} ${topY + e / 2} L${cx} ${topY + e} Z`} fill={top} />
      <path d={`M${cx - e} ${topY + e / 2} L${cx} ${topY + e} V${topY + e * 2.1} L${cx - e} ${topY + e * 1.6} Z`} fill={left} />
      <path d={`M${cx + e} ${topY + e / 2} L${cx} ${topY + e} V${topY + e * 2.1} L${cx + e} ${topY + e * 1.6} Z`} fill={right} />
    </g>
  );
};

// a 2-stud brick, lEgoarCh red
const Brick = ({ x, y, w = 34, h = 16 }) => (
  <g>
    <rect x={x} y={y + 4} width={w} height={h} rx="2" fill="var(--brand-red)" opacity=".9" />
    <rect x={x + w * 0.14} y={y} width={w * 0.24} height="6" rx="2" fill="var(--brand-red)" opacity=".9" />
    <rect x={x + w * 0.6} y={y} width={w * 0.24} height="6" rx="2" fill="var(--brand-red)" opacity=".9" />
  </g>
);

// ---- the diagrams -----------------------------------------------------------

function PhotoToCube() {
  return (
    <Frame label={[tinyLabel(50, "one photo"), tinyLabel(172, "full 3d")]}>
      <rect key="photo" x="28" y="12" width="44" height="44" rx="4" fill="none" stroke={`${ON}.5)`} strokeWidth="1.2" />
      <circle key="sun" cx="40" cy="24" r="3.5" fill="var(--brand-yellow)" />
      <path key="hill" d="M32 48 L45 34 L53 42 L60 33 L68 43 V50 Q68 52 66 52 H34 Q32 52 32 50 Z" fill={`${ON}.22)`} />
      <Arrow key="arrow" x1={88} x2={120} />
      <Cube key="cube" cx={172} topY={14} e={17} />
    </Frame>
  );
}

function GuessTheBack() {
  return (
    <Frame label={[tinyLabel(74, "the photo"), tinyLabel(152, "inferred")]}>
      <rect key="ghost" x="92" y="10" width="56" height="38" rx="3" fill="none" stroke={`${ON}.45)`} strokeWidth="1.2" strokeDasharray="4 3" />
      <text key="q" x="120" y="34" textAnchor="middle" fontSize="17" fontWeight="700" fill={`${ON}.55)`}>?</text>
      <rect key="front" x="64" y="20" width="56" height="38" rx="3" fill="var(--brand-blue)" opacity=".85" />
    </Frame>
  );
}

function SparseLatents() {
  const filled = [[1, 1], [2, 2], [4, 1], [5, 3], [7, 0], [8, 2], [3, 0], [6, 1]];
  const dots = [];
  for (let c = 0; c < 10; c++)
    for (let r = 0; r < 4; r++)
      dots.push(<circle key={`${c}-${r}`} cx={28 + c * 18} cy={14 + r * 13} r="1.3" fill={`${ON}.2)`} />);
  return (
    <Frame label={tinyLabel(110, "latents only where the building is")}>
      {dots}
      {filled.map(([c, r]) => (
        <rect key={`f${c}-${r}`} x={28 + c * 18 - 4} y={14 + r * 13 - 4} width="8" height="8" rx="1.5" fill="var(--brand-yellow)" opacity=".9" />
      ))}
    </Frame>
  );
}

function FlatVsVolume() {
  return (
    <Frame label={[tinyLabel(52, "your render · 2d"), tinyLabel(168, "the mesh · 3d")]}>
      <rect key="flat" x="34" y="14" width="36" height="36" rx="3" fill="none" stroke={`${ON}.5)`} strokeWidth="1.2" />
      <text key="n2d" x="52" y="37" textAnchor="middle" fontSize="9" fontWeight="700" fill={`${ON}.6)`}>×28</text>
      <Arrow key="arrow" x1={88} x2={118} />
      <Cube key="cube" cx={168} topY={12} e={16} />
      <text key="n3d" x="200" y="40" textAnchor="middle" fontSize="9" fontWeight="700" fill={`${ON}.6)`}>×28³</text>
    </Frame>
  );
}

function ManyTeachers() {
  const cells = [];
  for (let c = 0; c < 7; c++)
    for (let r = 0; r < 2; r++) {
      const hero = c === 3 && r === 1;
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={30 + c * 20}
          y={14 + r * 20}
          width="13"
          height="13"
          rx="2.5"
          fill={hero ? "var(--brand-yellow)" : `${ON}.16)`}
        />
      );
    }
  return <Frame label={tinyLabel(110, "≈500,000 shapes · one of them is yours")}>{cells}</Frame>;
}

function ClayThenPaint() {
  return (
    <Frame label={[tinyLabel(60, "geometry first"), tinyLabel(170, "then paint")]}>
      <Cube key="clay" cx={60} topY={12} e={16} mono />
      <Arrow key="arrow" x1={96} x2={126} />
      <g key="painted">
        <path d="M154 28 L170 20 L186 28 L170 36 Z" fill="var(--brand-tan)" opacity=".95" />
        <path d="M154 28 L170 36 V53 L154 45 Z" fill="rgba(228,205,158,.55)" />
        <path d="M186 28 L170 36 V53 L186 45 Z" fill="rgba(228,205,158,.3)" />
      </g>
    </Frame>
  );
}

function ColorMatch() {
  const renderish = ["#8a7a5e", "#5e6a7a", "#7a5e5e", "#9a9a8e"];
  const lego = ["var(--brand-tan)", "var(--brand-blue)", "var(--brand-red)", "var(--brand-yellow)"];
  return (
    <Frame label={[tinyLabel(58, "render pixels"), tinyLabel(162, "real bricks")]}>
      {renderish.map((c, i) => (
        <rect key={`l${i}`} x="44" y={8 + i * 13} width="28" height="9" rx="2" fill={c} />
      ))}
      {lego.map((c, i) => (
        <rect key={`r${i}`} x="148" y={8 + i * 13} width="28" height="9" rx="2" fill={c} opacity=".9" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path key={`c${i}`} d={`M74 ${12.5 + i * 13} H146`} stroke={`${ON}.28)`} strokeWidth="1" strokeDasharray="2 3" />
      ))}
    </Frame>
  );
}

function Decimate() {
  return (
    <Frame label={[tinyLabel(56, "raw · ~200k tris"), tinyLabel(168, "kept · ~40k")]}>
      <g key="raw" stroke={`${ON}.35)`} strokeWidth=".8" fill="none">
        {[
          "M28 50 L40 16 L52 50 Z", "M40 16 L52 50 L64 20 Z", "M52 50 L64 20 L76 48 Z",
          "M40 16 L48 34 L58 24", "M30 38 L44 40 L40 16", "M58 24 L70 36 L64 20",
        ].map((d, i) => <path key={i} d={d} />)}
      </g>
      <Arrow key="arrow" x1={94} x2={122} />
      <g key="kept" stroke="var(--brand-yellow)" strokeWidth="1.2" fill="none" opacity=".85">
        <path d="M142 50 L166 14 L190 50 Z" />
        <path d="M154 50 L166 14 L178 50" />
      </g>
    </Frame>
  );
}

function CodeTakesOver() {
  return (
    <Frame label={[tinyLabel(40, "mesh"), tinyLabel(110, "voxels"), tinyLabel(182, "bricks")]}>
      <Cube key="mesh" cx={40} topY={14} e={14} mono />
      <Arrow key="a1" x1={66} x2={86} />
      <g key="grid" stroke={`${ON}.4)`} strokeWidth="1" fill="none">
        <rect x="94" y="16" width="32" height="32" rx="2" />
        <path d="M104.6 16 V48 M115.3 16 V48 M94 26.6 H126 M94 37.3 H126" />
      </g>
      <rect key="v1" x="95" y="27.6" width="9.6" height="9.7" fill="var(--brand-blue)" opacity=".8" />
      <rect key="v2" x="105.6" y="17" width="9.7" height="9.6" fill="var(--brand-blue)" opacity=".55" />
      <Arrow key="a2" x1={134} x2={154} />
      <Brick key="brick" x={165} y={22} />
    </Frame>
  );
}

function OneBreath() {
  return (
    <Frame
      label={[tinyLabel(24, "words"), tinyLabel(68, "photo"), tinyLabel(112, "mesh"), tinyLabel(156, "voxels"), tinyLabel(196, "bricks")]}
    >
      <text key="aa" x="24" y="38" textAnchor="middle" fontSize="15" fontWeight="800" fill={`${ON}.75)`} fontFamily="Nunito, system-ui">Aa</text>
      <Arrow key="a1" x1={36} x2={50} y={33} />
      <rect key="photo" x="58" y="20" width="22" height="22" rx="3" fill="none" stroke={`${ON}.5)`} strokeWidth="1.1" />
      <circle key="sun" cx="64.5" cy="26.5" r="2" fill="var(--brand-yellow)" />
      <Arrow key="a2" x1={86} x2={98} y={33} />
      <Cube key="cube" cx={112} topY={19} e={10} />
      <Arrow key="a3" x1={128} x2={140} y={33} />
      <g key="grid" stroke={`${ON}.45)`} strokeWidth="1" fill="none">
        <rect x="146" y="22" width="19" height="19" rx="2" />
        <path d="M152.3 22 V41 M158.6 22 V41 M146 28.3 H165 M146 34.6 H165" />
      </g>
      <Arrow key="a4" x1={171} x2={181} y={33} />
      <Brick key="brick" x={186} y={22} w={26} h={12} />
    </Frame>
  );
}

// keyed by card title (loadingContent.js)
export const DIAGRAMS = {
  "Meet TRELLIS.2": PhotoToCube,
  "TRELLIS guesses the back": GuessTheBack,
  "Structured latents": SparseLatents,
  "Why this takes minutes": FlatVsVolume,
  "Half a million teachers": ManyTeachers,
  "Texture is its own pass": ClayThenPaint,
  "Color matching, properly": ColorMatch,
  "Decimation, the quiet step": Decimate,
  "What happens after this": CodeTakesOver,
  "The pipeline in one breath": OneBreath,
};
