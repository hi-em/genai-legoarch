// Consent + Google's button. Rendered inside the sign-in dialog, and reusable
// anywhere else that needs to ask.
//
// Google Identity Services is loaded from gstatic on demand rather than bundled
// (Google requires the live script; a vendored copy is unsupported and breaks
// when they rotate endpoints).
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth.js";

const GIS_SRC = "https://accounts.google.com/gsi/client";

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis-blocked")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis-blocked"));
    document.head.appendChild(s);
  });
}

export default function SignInPanel({ reason }) {
  const clientId = useAuth((s) => s.clientId);
  const configured = useAuth((s) => s.configured);
  const signIn = useAuth((s) => s.signIn);
  const error = useAuth((s) => s.error);
  const btnRef = useRef(null);
  const [consented, setConsented] = useState(false);
  const [gisError, setGisError] = useState(false);

  // Google's button renders only once consent is ticked — a button you can
  // click before consenting would make the checkbox decorative.
  useEffect(() => {
    if (!clientId || !consented || !btnRef.current) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !btnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => signIn(resp.credential),
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "signin_with",
        });
      })
      .catch(() => { if (!cancelled) setGisError(true); });
    return () => { cancelled = true; };
  }, [clientId, consented, signIn]);

  if (configured === false) {
    return (
      <p className="text-sm text-muted">
        <strong className="text-ink">Sign-in isn't configured on this server.</strong>{" "}
        Set <code className="rounded bg-black/10 px-1">GOOGLE_CLIENT_ID</code> and restart —
        see <code className="rounded bg-black/10 px-1">docs/deploy.md</code>. You can keep
        exploring without an account.
      </p>
    );
  }

  return (
    <>
      {reason && <p className="mb-3 text-sm text-ink">{reason}</p>}

      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand-red"
        />
        <span>
          I agree that lEgoarCh may store my <strong className="text-ink">name, email address
          and profile picture</strong>, and the <strong className="text-ink">LEGO sets I choose
          to save</strong>. Nothing else is recorded — not the prompts I type, not the settings
          I change. I can delete my account and everything on it at any time, from the account
          menu. <a href="/privacy.html" target="_blank" rel="noreferrer"
            className="underline underline-offset-2 hover:text-ink"
            onClick={(e) => e.stopPropagation()}>Privacy</a>
        </span>
      </label>

      <div className="mt-4 grid min-h-[44px] place-items-center">
        {consented ? (
          gisError ? (
            <p className="text-center text-xs text-brand-red">
              Google's sign-in script didn't load — an ad blocker or a strict privacy extension
              will do this. Allow <code>accounts.google.com</code> and reload.
            </p>
          ) : (
            <div ref={btnRef} />
          )
        ) : (
          <p className="text-center text-xs text-muted">Tick the box to continue with Google.</p>
        )}
      </div>

      {error && <p className="mt-3 text-center text-xs text-brand-red">{error}</p>}
    </>
  );
}
