// The sign-in ask, as a dialog rather than a wall.
//
// Signing in is optional: anyone can explore, and an account only buys you a
// collection that survives the browser. So the ask arrives at the moment it
// earns itself — the intro's second door, or pressing Pack as a guest — and it
// closes itself the instant sign-in succeeds, leaving the user exactly where
// they were. Nothing in the build state is touched, so a guest who signs in
// mid-flow keeps the set they were working on.
import { useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "./useAuth.js";
import SignInPanel from "./SignInPanel.jsx";

export default function SignInDialog() {
  const open = useAuth((s) => s.promptOpen);
  const reason = useAuth((s) => s.promptReason);
  const close = useAuth((s) => s.closePrompt);
  const status = useAuth((s) => s.status);

  // signed in — the ask is answered, get out of the way
  useEffect(() => { if (open && status === "in") close(); }, [open, status, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={close}
    >
      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-elevated p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-black/10"
        >
          <X size={15} />
        </button>

        <h2 className="pr-8 font-display text-xl font-black text-ink">Keep your sets</h2>
        <p className="mt-1.5 text-sm text-muted">
          Sign in and your collection lives on your account — the sets you pack follow you to any
          device instead of one browser.
        </p>

        <div className="mt-4">
          <SignInPanel reason={reason} />
        </div>
      </div>
    </div>
  );
}
