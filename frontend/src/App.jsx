import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import HeroFlow from "./hero/HeroFlow.jsx";
import Collection from "./hero/Collection.jsx";
import BrickBuddy from "./components/BrickBuddy.jsx";
import CustomCursor from "./cursor/CustomCursor.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useView, useCollection } from "./state/store.js";
import { useAuth } from "./auth/useAuth.js";
import SignInDialog from "./auth/SignInDialog.jsx";
import { primeAudio } from "./lib/sound.js";
import { Toaster, TooltipProvider } from "./components/ui/index.js";

// Lazy so the montage (component + 40 webp tiles) stays out of the main chunk.
const LaunchIntro = lazy(() => import("./intro/LaunchIntro.jsx"));

export default function App() {
  const view = useView((s) => s.view);
  const authStatus = useAuth((s) => s.status);

  // The shelf lives on the account, so it can only be pulled once we know whose
  // it is. Signing out empties it in memory — the next user must not inherit
  // the previous one's sets on a shared machine.
  useEffect(() => {
    if (authStatus === "in") useCollection.getState().hydrate();
    if (authStatus === "out") useCollection.getState().reset();
  }, [authStatus]);
  // The launch ritual plays on EVERY load (owner decision) — it holds with an
  // "Enter the studio" CTA and is skippable, so repetition stays cheap. The
  // hero mounts beneath it so dismissal reveals the app already in place.
  const [intro, setIntro] = useState(true);

  // Resume the (autoplay-suspended) AudioContext on the user's first gesture so
  // in-app sounds are ready immediately. We deliberately do NOT pre-create the
  // context at idle — doing so left it suspended and silenced the intro's
  // pre-gesture cascade snaps; lazy creation on the first snap lets the browser
  // start it running when media-engagement allows.
  useEffect(() => {
    const evs = ["pointerdown", "keydown", "touchstart"];
    const off = () => evs.forEach((ev) => window.removeEventListener(ev, prime, true));
    const prime = () => { primeAudio(); off(); };
    evs.forEach((ev) => window.addEventListener(ev, prime, { capture: true, passive: true }));
    return () => off();
  }, []);

  return (
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
        <div className="h-full w-full overflow-y-auto">
          <ErrorBoundary>{view === "collection" ? <Collection /> : <HeroFlow />}</ErrorBoundary>
        </div>

        <footer className="pointer-events-none fixed inset-x-0 bottom-1 z-20 mx-auto hidden max-w-[64ch] px-4 text-center text-micro leading-tight text-on-dark-muted md:block">
          lEgoarCh · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI ·{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="pointer-events-auto underline underline-offset-2">
            Privacy
          </a>{" "}
          — LEGO® is a trademark of the LEGO Group, which does not sponsor or endorse this academic, non-commercial project.
        </footer>

        {intro && (
          /* The intro is code-split, and the hero renders UNDERNEATH it by
             design (dismissing reveals the app already in place). A null
             fallback therefore shows the studio for however long the chunk
             takes to arrive — invisible on localhost, a clear flash of
             "step 1 of 3" over the network. The fallback paints the intro's
             own backdrop so there is nothing to see through. */
          <Suspense fallback={<div className="felt fixed inset-0 z-50" aria-hidden="true" />}>
            <LaunchIntro
              onDone={() => {
                setIntro(false);
                // the focused "Enter the studio" CTA just unmounted — land
                // keyboard users on the prompt box instead of <body>
                requestAnimationFrame(() => document.querySelector("main textarea")?.focus());
              }}
            />
          </Suspense>
        )}

        <SignInDialog />

        <ErrorBoundary silent>
          <BrickBuddy />
        </ErrorBoundary>
        <ErrorBoundary silent>
          <CustomCursor />
        </ErrorBoundary>
        <Toaster />
      </MotionConfig>
    </TooltipProvider>
  );
}
