import { useUI } from "./state/store.js";
import { MOCK } from "./api.js";
import Brand from "./components/Brand.jsx";
import BrickBuddy from "./components/BrickBuddy.jsx";
import Generate from "./screens/Generate.jsx";
import Viewer3D from "./screens/Viewer3D.jsx";
import BrickStudio from "./screens/BrickStudio.jsx";
import Shelf from "./screens/Shelf.jsx";
import Playground from "./screens/Playground.jsx";
import { Sparkles, Box, Blocks, LibraryBig, Shapes, Volume2, VolumeX } from "lucide-react";

const TABS = [
  ["generate", "Generate", Sparkles, Generate],
  ["viewer", "3D · Print", Box, Viewer3D],
  ["studio", "Brick Studio", Blocks, BrickStudio],
  ["shelf", "My Shelf", LibraryBig, Shelf],
  ["playground", "Playground", Shapes, Playground],
];

export default function App() {
  const { tab, setTab, muted, toggleMute } = useUI();
  const Active = TABS.find(([k]) => k === tab)[3];

  return (
    <div className="bf-app">
      <header className="bf-header">
        <Brand />
        <nav className="bf-nav">
          {TABS.map(([key, label, Icon]) => (
            <button key={key} className={"bf-btn" + (tab === key ? " is-active" : "")} onClick={() => setTab(key)}>
              <Icon /> {label}
            </button>
          ))}
        </nav>
        <div className="bf-header-right">
          {MOCK && <span className="bf-badge" title="The AI image + TRELLIS steps are mocked; geometry, bricks, exports & shelf are real.">MOCK MODE</span>}
          <button className="bf-icon-btn" aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      <main className="bf-main bf-baseplate">
        <Active />
      </main>

      <footer className="bf-footer">
        <span>lEgoarCh · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI</span>
        <span className="bf-disclaimer">
          LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this academic, non-commercial project.
        </span>
      </footer>

      <BrickBuddy />
    </div>
  );
}
