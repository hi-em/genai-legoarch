// Circular magnifier over the waiting-room square — "inspect the photo
// TRELLIS is studying". Pure CSS background-zoom: the lens is a div whose
// background is the same image, scaled and offset so the point under the
// pointer lands at the lens centre. Direct style writes per pointer move (no
// re-render); works under reduced motion because it is user-driven, not an
// ambient animation. Touch: press and drag.
import { useRef } from "react";

const SIZE = 140; // lens diameter (px)
const ZOOM = 2.2;

export default function Loupe({ imageUrl }) {
  const hostRef = useRef(null);
  const lensRef = useRef(null);

  const hide = () => {
    if (lensRef.current) lensRef.current.style.opacity = "0";
  };

  const move = (e) => {
    const host = hostRef.current;
    const lens = lensRef.current;
    if (!host || !lens) return;
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) return hide();
    lens.style.opacity = "1";
    lens.style.left = `${x - SIZE / 2}px`;
    lens.style.top = `${y - SIZE / 2}px`;
    lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${SIZE / 2 - x * ZOOM}px ${SIZE / 2 - y * ZOOM}px`;
  };

  return (
    // Purely visual magnifier — aria-hidden is correct: the pointer handlers
    // only position the lens; no functionality is hidden from AT users.
    <div
      ref={hostRef}
      aria-hidden
      className="absolute inset-0 cursor-zoom-in"
      style={{ touchAction: "none" }}
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={hide}
      onPointerCancel={hide}
    >
      <div
        ref={lensRef}
        className="pointer-events-none absolute rounded-full border-2 border-white/70 shadow-pop"
        style={{
          width: SIZE,
          height: SIZE,
          opacity: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundRepeat: "no-repeat",
          transition: "opacity 150ms",
        }}
      />
    </div>
  );
}
