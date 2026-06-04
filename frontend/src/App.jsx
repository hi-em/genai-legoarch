import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import World from "./canvas/World.jsx";
import StepperFlow from "./canvas/StepperFlow.jsx";
import BrickBuddy from "./components/BrickBuddy.jsx";
import { Toaster, TooltipProvider } from "./components/ui/index.js";

// The infinite canvas is the wrong interaction on small/touch screens, so we
// swap to a vertical guided stepper below 900px. State lives in stores, so
// crossing the breakpoint never loses the in-progress build.
function useIsDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = () => setDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

export default function App() {
  const desktop = useIsDesktop();
  return (
    <TooltipProvider>
      <MotionConfig reducedMotion="user">
        <div className="h-full w-full">{desktop ? <World /> : <StepperFlow />}</div>

        <footer className="pointer-events-none fixed inset-x-0 bottom-1 z-20 mx-auto hidden max-w-[64ch] px-4 text-center text-[11px] leading-tight text-on-dark-muted md:block">
          lEgoarCh · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI — LEGO® is a
          trademark of the LEGO Group, which does not sponsor or endorse this academic, non-commercial project.
        </footer>

        <BrickBuddy />
        <Toaster />
      </MotionConfig>
    </TooltipProvider>
  );
}
