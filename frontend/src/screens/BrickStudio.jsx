import { useBuild, useCollection, useUI } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { toLdraw, download, partsToCsv } from "../lib/ldraw.js";
import { frontElevationThumb } from "../lib/thumb.js";
import EmptyState from "../components/EmptyState.jsx";

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
    const steps = brickModel.grid[2];
    const txt = `${prompt}\n\nBuild instructions (${steps} layers, ${totalParts} parts)\n` +
      brickModel.parts.map((p) => `- ${p.qty}x ${p.name} (${p.part})`).join("\n") +
      `\n\n(Open the .ldr in BrickLink Studio for full step-by-step visuals.)\n`;
    download(`${safeName}_instructions.txt`, txt, "text/plain");
  }
  function onAddToShelf() {
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
    <section className="bf-card">
      <h2 className="bf-h">Brick Studio · Build it (Exit 2)</h2>
      <p className="bf-muted">Real, buildable bricks — legolized, colored, checked, and exportable.</p>

      <BrickViewer brickModel={brickModel} studs height={400} />

      <div className="bf-stats">
        <div className="bf-stat"><span>{st.nBricks}</span><small>bricks</small></div>
        <div className="bf-stat"><span>{brickModel.grid.join("×")}</span><small>grid</small></div>
        <div className={"bf-stat " + (st.connected ? "ok" : "warn")}>
          <span>{st.connected ? "✓" : st.components}</span><small>{st.connected ? "connected" : "islands"}</small>
        </div>
        <div className={"bf-stat " + (st.supportRatio > 0.95 ? "ok" : "warn")}>
          <span>{Math.round(st.supportRatio * 100)}%</span><small>supported</small>
        </div>
      </div>

      <h3 className="bf-h" style={{ fontSize: "1rem", marginTop: "1rem" }}>Parts list</h3>
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

      <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button className="bf-stud-btn" onClick={onLdr}>⬇ LDraw (.ldr)</button>
        <button className="bf-stud-btn" onClick={onCsv}>⬇ Parts list (CSV)</button>
        <button className="bf-stud-btn" onClick={onInstructions}>⬇ Instructions</button>
        <button className="bf-stud-btn" onClick={onAddToShelf}>★ Add to Shelf</button>
      </div>
    </section>
  );
}
