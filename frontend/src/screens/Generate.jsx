import { useState } from "react";
import { generate } from "../api.js";
import { useBuild, useUI } from "../state/store.js";
import { playSnap } from "../lib/sound.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { Sparkles, Hammer, Box, Blocks, Upload } from "lucide-react";

const EXAMPLES = [
  "legoarch Fondation Louis Vuitton, Frank Gehry, LEGO Architecture set",
  "legoarch KAPSARC Riyadh, Zaha Hadid, LEGO Architecture set",
  "legoarch Beijing Daxing Airport, radiating concourse, LEGO set",
  "legoarch brutalist concrete tower, stepped setbacks",
];

export default function Generate() {
  const { prompt, imageUrl, brickModel, busy, set } = useBuild();
  const setTab = useUI((s) => s.setTab);
  const [text, setText] = useState(prompt || EXAMPLES[0]);

  async function onGenerate() {
    playSnap();
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
    <section className="bf-plate">
      <h2 className="bf-h2">Generate a brick building</h2>
      <p className="bf-muted">
        Type a building (or paste a famous one). The <code>legoarch</code> model renders it as a set built of
        LEGO bricks, then we build real 3D geometry from it.
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <div className="bf-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="bf-chip" onClick={() => setText(ex)}>
            {ex.split(",")[0].replace("legoarch ", "")}
          </button>
        ))}
      </div>

      <div className="bf-toolbar">
        <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onGenerate} disabled={busy}>
          {busy ? <span className="bf-building"><i /><i /><i /></span> : <Sparkles />} {busy ? "Building…" : "Generate"}
        </button>
        <span className="bf-muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: ".85rem" }}>
          <Upload size={15} /> or upload a photo (wired with ComfyUI later)
        </span>
      </div>

      {brickModel && (
        <div style={{ marginTop: "calc(var(--u) * 3)" }}>
          <div className="bf-row">
            <div style={{ flex: 1, minWidth: 240 }}>
              <h3 className="bf-h2" style={{ fontSize: "1rem" }}>AI render</h3>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="legoarch render"
                  style={{ width: "100%", borderRadius: "calc(var(--u) * 1.5)", display: "block" }}
                />
              ) : (
                <div className="bf-mockrender">
                  <Hammer />
                  <span>legoarch render</span>
                  <small className="bf-muted">connect ComfyUI to generate</small>
                </div>
              )}
            </div>
            <div style={{ flex: 1.3, minWidth: 280 }}>
              <h3 className="bf-h2" style={{ fontSize: "1rem" }}>Live 3D geometry</h3>
              <BrickViewer brickModel={brickModel} height={260} />
            </div>
          </div>
          <div className="bf-toolbar">
            <button className="bf-btn" onClick={() => setTab("viewer")}><Box /> Continue → 3D · Print</button>
            <button className="bf-btn" onClick={() => setTab("studio")}><Blocks /> Skip to Brick Studio</button>
          </div>
        </div>
      )}
    </section>
  );
}
