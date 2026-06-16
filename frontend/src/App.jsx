import { lazy, Suspense, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import HeroFlow from "./hero/HeroFlow.jsx";
import Collection from "./hero/Collection.jsx";
import BrickBuddy from "./components/BrickBuddy.jsx";
import CustomCursor from "./cursor/CustomCursor.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useView } from "./state/store.js";
import { primeAudio } from "./lib/sound.js";
import { Toaster, TooltipProvider } from "./components/ui/index.js";

// Lazy so the montage (component + 40 webp tiles) stays out of the main chunk.
const LaunchIntro = lazy(() => import("./intro/LaunchIntro.jsx"));

export default function App() {
  const view = useView((s) => s.view);
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
          lEgoarCh · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI — LEGO® is a
          trademark of the LEGO Group, which does not sponsor or endorse this academic, non-commercial project.
        </footer>

        {intro && (
          <Suspense fallback={null}>
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
