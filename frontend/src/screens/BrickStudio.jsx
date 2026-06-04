// M2: EXIT 2 — the custom legolizer. Show the brick model, stability badge,
// parts list, and download LDraw + instructions.
// TODO: POST /api/legolize then render bricks (instanced cubes w/ studs) +
//       color the unstable bricks; POST /api/export for .ldr + parts CSV.
export default function BrickStudio() {
  return (
    <section className="bf-card">
      <h2 className="bf-h">Brick Studio · Build it (Exit 2)</h2>
      <p className="bf-muted">
        Our custom legolizer converts the model into legal, buildable bricks — with a parts list and step-by-step instructions.
      </p>
      <div style={{ height: 360, display: "grid", placeItems: "center", background: "#eef0ef", borderRadius: 8 }}>
        <span className="bf-muted">[ brick model viewer + stability heatmap — M2 ]</span>
      </div>
      <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button className="bf-stud-btn">⬇ LDraw (.ldr)</button>
        <button className="bf-stud-btn">⬇ Parts list</button>
        <button className="bf-stud-btn">⬇ Instructions</button>
        <button className="bf-stud-btn">★ Add to Shelf</button>
      </div>
    </section>
  );
}
