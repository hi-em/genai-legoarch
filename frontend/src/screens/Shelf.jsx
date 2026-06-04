import { useCollection } from "../state/store.js";

// M3 (must-have): the collection shelf — a gallery of the user's own creations.
export default function Shelf() {
  const items = useCollection((s) => s.items);

  return (
    <section className="bf-card">
      <h2 className="bf-h">My Shelf ★</h2>
      <p className="bf-muted">Every building you make lands here — your own growing LEGO Architecture collection.</p>
      {items.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center" }} className="bf-muted">
          Empty shelf. Go generate your first build!
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "1rem" }}>
          {items.map((it) => (
            <figure key={it.id} style={{ margin: 0 }}>
              <img src={it.thumb} alt={it.title} style={{ width: "100%", borderRadius: 8 }} />
              <figcaption style={{ fontSize: ".85rem", marginTop: ".25rem" }}>{it.title}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
