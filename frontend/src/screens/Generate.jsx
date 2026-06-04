import { useState, useRef } from "react";
import { generate } from "../api.js";
import { useBuild, useUI } from "../state/store.js";
import { playSnap } from "../lib/sound.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { Sparkles, Hammer, Box, Blocks, Upload, X } from "lucide-react";

// Just the building — the `legoarch` trigger + the rich LEGO-set styling are
// added on the backend, so users describe the subject, nothing more.
const EXAMPLES = [
  "Fondation Louis Vuitton, Frank Gehry",
  "KAPSARC Riyadh, Zaha Hadid",
  "Beijing Daxing Airport, radiating concourse",
  "brutalist concrete tower, stepped setbacks",
];

export default function Generate() {
  const { prompt, imageUrl, brickModel, busy, set } = useBuild();
  const setTab = useUI((s) => s.setTab);
  const [text, setText] = useState(prompt || EXAMPLES[0]);
  const [photo, setPhoto] = useState(null); // data URL of an optional reference photo
  const fileRef = useRef(null);

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  async function onGenerate() {
    playSnap();
    set({ busy: true });
    try {
      const r = await generate(text, photo); // photo -> img2img, else txt2img
      set({ prompt: r.prompt, imageUrl: r.imageUrl, glbUrl: null, model: r.model, brickModel: r.brickModel, busy: false });
    } catch (e) {
      set({ busy: false });
      alert(String(e));
    }
  }

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">Generate a brick building</h2>
      <p className="bf-muted">
        Name a building (or paste a famous one). The <code>legoarch</code> model renders it as a set built of
        LEGO bricks, then we build real 3D geometry from it. <em>No need to type “legoarch” — it’s added for you.</em>
      </p>

      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
      <div className="bf-chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} className="bf-chip" onClick={() => setText(ex)}>
            {ex.split(",")[0]}
          </button>
        ))}
      </div>

      <div className="bf-toolbar">
        <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onGenerate} disabled={busy}>
          {busy ? <span className="bf-building"><i /><i /><i /></span> : <Sparkles />} {busy ? "Building…" : "Generate"}
        </button>

        {/* Reference photo -> image-to-image */}
        <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
        {photo ? (
          <span className="bf-muted" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: ".85rem" }}>
            <img src={photo} alt="reference" style={{ height: 34, width: 34, objectFit: "cover", borderRadius: 6 }} />
            photo attached (img2img)
            <button className="bf-chip" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }} title="Remove photo">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button className="bf-btn" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload a photo
          </button>
        )}
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
