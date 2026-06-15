// Accessible modal overlay shared by every artifact expander (render, mesh,
// build, box art). Escape and a backdrop click close it; focus is trapped while
// open and restored to the trigger on close; body scroll is locked. The caller
// supplies the framed content; the shell paints the dim backdrop + close button.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

function focusables(root) {
  if (!root) return [];
  return [...root.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
  )];
}

export default function Lightbox({ open, onClose, label, children }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
      if (e.key === "Tab") {
        const f = focusables(panelRef.current);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    const raf = requestAnimationFrame(() => (focusables(panelRef.current)[0] || panelRef.current)?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  // Guard the portal target: never let an unavailable document.body (teardown /
  // hot-reload edge) throw out of render.
  if (!open || typeof document === "undefined" || !document.body) return null;
  // Portal to <body> so the fixed overlay escapes any transformed/perspective
  // ancestor (e.g. RecipeCard's 3D flip) that would otherwise contain it.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-6"
      onClick={(e) => { e.stopPropagation(); onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[860px] outline-none"
      >
        {children}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-pop transition hover:brightness-95"
        >
          <X size={18} />
        </button>
      </div>
    </div>,
    document.body
  );
}
