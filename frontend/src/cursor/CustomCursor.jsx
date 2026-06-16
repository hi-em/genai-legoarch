// A fun brick cursor. The native pointer is hidden and replaced by a 1×1 LEGO
// brick that sits on the mouse; over interactive elements it becomes a minifig
// hand; on click it pops and fires the brick-snap sound. Desktop sugar only:
// shows by default, hides only after a real touch (pure-touch device). Toggle
// in the header (useUI.cursor, persisted).
//
// The element is ALWAYS opacity:1 when mounted — it just starts off-screen and
// is moved to the pointer on the first event (and parked off-screen when the
// mouse leaves the page). No opacity/visibility class dance, no rAF — so it
// cannot get stranded invisible. Portaled to <body> so no transformed ancestor
// can offset its fixed position.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "../state/store.js";
import { playSnap } from "../lib/sound.js";
import brickImg from "./cursor-brick.png";
import handImg from "./cursor-hand.png";

const INTERACTIVE =
  'a,button,[role="button"],[role="tab"],input,select,textarea,label,summary,canvas,.cursor-pointer,[data-cursor="grab"]';
const OFF = "translate3d(-100px, -100px, 0)";

export default function CustomCursor() {
  const on = useUI((s) => s.cursor);
  const [touch, setTouch] = useState(false);
  const elRef = useRef(null);

  // Hide only on real touch devices (after the first touch). We do NOT gate on
  // `(pointer: fine)` — it reads false on touchscreen laptops that have a mouse.
  useEffect(() => {
    const onTouch = () => setTouch(true);
    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  const active = on && !touch;

  useEffect(() => {
    if (!active) return;
    const el = elRef.current;
    if (!el) return;
    const root = document.documentElement;
    root.classList.add("bf-cursor-on");
    el.style.transform = OFF;

    let mode = "default";
    const setMode = (m) => { if (m !== mode) { mode = m; el.dataset.mode = m; } };
    const track = (e) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const t = e.target;
      setMode(t instanceof Element && t.closest(INTERACTIVE) ? "hover" : "default");
    };
    const onDown = () => {
      el.classList.remove("bf-pop"); void el.offsetWidth; el.classList.add("bf-pop");
      playSnap();
    };
    const park = () => { el.style.transform = OFF; };
    const onAnimEnd = () => el.classList.remove("bf-pop");

    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerover", track, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("mouseleave", park);
    el.addEventListener("animationend", onAnimEnd);

    return () => {
      root.classList.remove("bf-cursor-on");
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerover", track);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mouseleave", park);
      el.removeEventListener("animationend", onAnimEnd);
    };
  }, [active]);

  if (!active || typeof document === "undefined" || !document.body) return null;
  return createPortal(
    <div ref={elRef} className="bf-cursor" data-mode="default" aria-hidden="true" style={{ transform: OFF }}>
      <div className="bf-cursor-inner">
        <img className="bf-cursor-brick" src={brickImg} alt="" draggable="false" />
        <img className="bf-cursor-hand" src={handImg} alt="" draggable="false" />
      </div>
    </div>,
    document.body
  );
}
