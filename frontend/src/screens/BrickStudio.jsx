import { useBuild, useCollection, useUI } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { toLdraw, download, partsToCsv } from "../lib/ldraw.js";
import { frontElevationThumb } from "../lib/thumb.js";
import { playPop } from "../lib/sound.js";
import EmptyState from "../components/EmptyState.jsx";
import { Download, FileText, Star, Link2, LayoutGrid, Anchor, Grid3x3 } from "lucide-react";

export default function BrickStudio() {
  const { brickModel, prompt } = useBuild();
  const addToShelf = useCollection((s) => s.add);
  const setTab = useUI((s) => s.setTab);
  if (!brickModel) return <EmptyState />;

  const st = brickModel.stability;
  const totalParts = brickModel.parts.reduce((a, p) => a + p.qty, 0);
  const safeName = (prompt || "model").slice(0, 24).replace(/\W+/g, "_");

  function onLdr() { download(`${safeName}.ldr`, toLdraw(brickModel, prompt), "text/plain"); }
  function onCsv() { download(`${safeName}_parts.csv`, partsToCsv(brickModel.parts), "text/csv"); }
  function onInstructions() {
    const txt = `${prompt}\n\nBuild instructions (${brickModel.grid[2]} layers, ${totalParts} parts)\n` +
      brickModel.parts.map((p) => `- ${p.qty}x ${p.name} (${p.part})`).join("\n") +
      `\n\n(Open the .ldr in BrickLink Studio for full step-by-step visuals.)\n`;
    download(`${safeName}_instructions.txt`, txt, "text/plain");
  }
  function onAddToShelf() {
    playPop();
    addToShelf({
      id: `${Date.now()}`,
      title: (prompt || "Untitled").split(",")[0].replace("legoarch ", ""),
      thumb: frontElevationThumb(brickModel),
      nBricks: st.nBricks,
      created_at: new Date().toISOString(),
    });
    setTab("shelf");
  }

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">Brick Studio · Build it <span className="bf-muted" style={{ fontWeight: 600, fontSize: "1rem" }}>(Exit 2)</span></h2>
      <p className="bf-muted">Real, buildable bricks — legolized, colored, checked, and exportable.</p>

      <BrickViewer brickModel={brickModel} studs height={400} />

      <div className="bf-stats">
        <div className="bf-stat"><span>{st.nBricks}</span><small><LayoutGrid /> bricks</small></div>
        <div className="bf-stat"><span>{brickModel.grid.join("×")}</span><small><Grid3x3 /> grid</small></div>
        <div className={"bf-stat " + (st.connected ? "ok" : "warn")}>
          <span>{st.connected ? "✓" : st.components}</span><small><Link2 /> {st.connected ? "connected" : "islands"}</small>
        </div>
        <div className={"bf-stat " + (st.supportRatio > 0.95 ? "ok" : "warn")}>
          <span>{Math.round(st.supportRatio * 100)}%</span><small><Anchor /> supported</small>
        </div>
      </div>

      <h3 className="bf-h2" style={{ fontSize: "1rem", marginTop: "calc(var(--u) * 2)" }}>Parts list</h3>
      <table className="bf-table">
        <thead><tr><th></th><th>Color</th><th>Part</th><th>Qty</th></tr></thead>
        <tbody>
          {brickModel.parts.map((p) => (
            <tr key={p.color + p.part}>
              <td><span className="bf-swatch" style={{ background: p.hex }} /></td>
              <td>{p.name}</td><td>{p.part}</td><td>{p.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="bf-toolbar">
        <button className="bf-btn" onClick={onLdr}><Download /> LDraw (.ldr)</button>
        <button className="bf-btn" onClick={onCsv}><Download /> Parts list (CSV)</button>
        <button className="bf-btn" onClick={onInstructions}><FileText /> Instructions</button>
        <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onAddToShelf}><Star /> Add to Shelf</button>
      </div>
    </section>
  );
}
