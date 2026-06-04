// M4 (nice-to-have): free play.
//  - Mash two buildings into one set
//  - Restyle slider across architectural eras
//  - Generate a sectional axonometric of a detail
//  - Drag-to-recolor bricks
export default function Playground() {
  const toys = [
    ["🏗️ Mashup", "Blend two landmarks into one LEGO set"],
    ["🎚️ Restyle", "Slide a building across architectural eras"],
    ["📐 Detail axo", "Generate a sectional axonometric of a detail"],
    ["🎨 Recolor", "Drag to repaint bricks in the LEGO palette"],
  ];
  return (
    <section className="bf-card">
      <h2 className="bf-h">Playground 🎲</h2>
      <p className="bf-muted">Experiments — not part of the core pipeline, just fun.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "1rem" }}>
        {toys.map(([t, d]) => (
          <div key={t} style={{ background: "#fff", border: "2px dashed #d7d7d4", borderRadius: 10, padding: "1rem" }}>
            <strong>{t}</strong>
            <p className="bf-muted" style={{ margin: ".4rem 0 0" }}>{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
