import { useUI } from "./state/store.js";
import Generate from "./screens/Generate.jsx";
import Viewer3D from "./screens/Viewer3D.jsx";
import BrickStudio from "./screens/BrickStudio.jsx";
import Shelf from "./screens/Shelf.jsx";
import Playground from "./screens/Playground.jsx";
import { MOCK } from "./api.js";

const TABS = [
  ["generate", "Generate", Generate],
  ["viewer", "3D · Print", Viewer3D],
  ["studio", "Brick Studio", BrickStudio],
  ["shelf", "My Shelf", Shelf],
  ["playground", "Playground", Playground],
];

export default function App() {
  const { tab, setTab } = useUI();
  const Active = TABS.find(([k]) => k === tab)[2];

  return (
    <div className="bf-app">
      <header className="bf-header">
        <span className="bf-logo">🧱 BrickForge</span>
        <nav className="bf-nav">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              className={"bf-stud-btn" + (tab === key ? " is-active" : "")}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        {MOCK && <span className="bf-badge" title="AI image + TRELLIS are mocked; geometry, bricks, exports & shelf are real.">MOCK MODE</span>}
      </header>
      <main className="bf-main bf-baseplate">
        <Active />
      </main>
      <footer className="bf-footer">
        Academic project · Emilie El Chidiac &amp; Charles Abi Chahine · MaCAD Generative AI
      </footer>
    </div>
  );
}
