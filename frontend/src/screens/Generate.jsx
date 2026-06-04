import { useState } from "react";

// M0: upload photo + prompt -> POST /api/generate-image -> show legoarch render.
export default function Generate() {
  const [prompt, setPrompt] = useState("legoarch Fondation Louis Vuitton, LEGO Architecture set");
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  async function onGenerate() {
    setBusy(true);
    try {
      const r = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await r.json();
      setImageUrl(data.image_url);
    } catch (e) {
      alert("Backend not wired yet (M0). " + e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bf-card">
      <h2 className="bf-h">Generate a LEGO building 🧱</h2>
      <p className="bf-muted">Type a building (or upload a photo) — the legoarch LoRA renders it as a LEGO Architecture set.</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: "100%" }} />
      <div style={{ marginTop: ".75rem" }}>
        <button className="bf-stud-btn" onClick={onGenerate} disabled={busy}>
          {busy ? "Building…" : "Generate"}
        </button>
      </div>
      {imageUrl && <img src={imageUrl} alt="legoarch render" style={{ marginTop: "1rem", maxWidth: "100%", borderRadius: 8 }} />}
    </section>
  );
}
