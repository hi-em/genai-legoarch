import { lazy, Suspense, useState } from "react";
import { MotionConfig } from "framer-motion";
import HeroFlow from "./hero/HeroFlow.jsx";
import Collection from "./hero/Collection.jsx";
import BrickBuddy from "./components/BrickBuddy.jsx";
import { useView } from "./state/store.js";
import { Toaster, TooltipProvider } from "./components/ui/index.js";

// Lazy so the montage (component + 40 webp tiles) stays out of the main chunk.
const LaunchIntro = lazy(() => import("./intro/LaunchIntro.jsx"));

export default function App() {
  const view = useView((s) => s.view);
  // Launch intro plays once per session; the hero mounts beneath it so the
  // dissolve reveals the app already in place.
  const [intro, setIntro] = useState(() => {
    try {
      return sessionStorage.getItem("lEgoarCh.introSeen") !== "1";
    } catch {
      return false;
    }
  });
  return (
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
        <div className="h-full w-full overflow-y-auto">
          {view === "collection" ? <Collection /> : <HeroFlow />}
        </div>

        <footer className="pointer-events-none fixed inset-x-0 bottom-1 z-20 mx-auto hidden max-w-[64ch] px-4 text-center text-micro leading-tight text-on-dark-muted md:block">
          lEgoarCh · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI — LEGO® is a
          trademark of the LEGO Group, which does not sponsor or endorse this academic, non-commercial project.
        </footer>

        {intro && (
          <Suspense fallback={null}>
            <LaunchIntro
              onDone={() => {
                try {
                  sessionStorage.setItem("lEgoarCh.introSeen", "1");
                } catch {}
                setIntro(false);
              }}
            />
          </Suspense>
        )}

        <BrickBuddy />
        <Toaster />
      </MotionConfig>
    </TooltipProvider>
  );
}
