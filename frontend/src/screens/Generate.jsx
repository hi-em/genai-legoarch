import { useState } from "react";
import { generate } from "../api.js";
import { useBuild, useUI } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";

const EXAMPLES = [
  "legoarch Fondation Louis Vuitton, Frank Gehry, LEGO Architecture set",
  "legoarch KAPSARC Riyadh, Zaha Hadid, LEGO Architecture set",
  "legoarch Beijing Daxing Airport, radiating concourse, LEGO set",
  "legoarch brutalist concrete tower, stepped setbacks",
];

export default function Generate() {
  const { prompt, brickModel, busy, set } = useBuild();
  const setTab = useUI((s) => s.setTab);
  const [text, setText] = useState(prompt || EXAMPLES[0]);

  async function onGenerate() {
    set({ busy: true });
    try {
      const r = await generate(text);
      set({ prompt: r.prompt, imageUrl: r.imageUrl, model: r.model, brickModel: r.brickModel, busy: false });
    } catch (e) {
      set({ busy: false });
      alert(String(e));
    }
  }

  return (
    <section className="bf-card">
      <h2 className="bf-h">Generate a LEGO building 🧱</h2>
      <p className="bf-muted">
        Type a building (or paste a famous one). The <code>legoarch</code> model renders it as a LEGO
        Architecture set, then we build real 3D geometry from it.
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={{ width: "100%" }} />
      <div className="bf-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="bf-chip" onClick={() => setText(ex)}>{ex.split(",")[0].replace("legoarch ", "")}</button>
        ))}
      </div>
      <div style={{ marginTop: ".75rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <button className="bf-stud-btn" onClick={onGenerate} disabled={busy}>
          {busy ? "Building…" : "⚡ Generate"}
        </button>
        <label className="bf-uploadhint bf-muted">＋ or upload a photo (wired with ComfyUI later)</label>
      </div>

      {brickModel && (
        <div style={{ marginTop: "1.25rem" }}>
          <div className="bf-row">
            <div style={{ flex: 1 }}>
              <h3 className="bf-h" style={{ fontSize: "1rem" }}>AI render</h3>
              <div className="bf-mockrender">
                <span>🖼️ legoarch render</span>
                <small className="bf-muted">mocked until ComfyUI is connected</small>
              </div>
            </div>
            <div style={{ flex: 1.3 }}>
              <h3 className="bf-h" style={{ fontSize: "1rem" }}>Live 3D geometry</h3>
              <BrickViewer brickModel={brickModel} height={260} />
            </div>
          </div>
          <div style={{ marginTop: ".75rem", display: "flex", gap: ".5rem" }}>
            <button className="bf-stud-btn" onClick={() => setTab("viewer")}>Continue → 3D · Print ▶</button>
            <button className="bf-stud-btn" onClick={() => setTab("studio")}>Skip to Brick Studio ▶</button>
          </div>
        </div>
      )}
    </section>
  );
}
