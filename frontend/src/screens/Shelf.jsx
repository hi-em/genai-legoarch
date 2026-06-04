import { useCollection } from "../state/store.js";

export default function Shelf() {
  const { items, remove } = useCollection();

  return (
    <section className="bf-card">
      <h2 className="bf-h">My Shelf ★</h2>
      <p className="bf-muted">Every building you make lands here — your own growing LEGO Architecture collection.</p>
      {items.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center" }} className="bf-muted">
          Empty shelf. Go generate your first build!
        </div>
      ) : (
        <div className="bf-shelf">
          {items.map((it) => (
            <figure key={it.id} className="bf-shelfitem">
              <img src={it.thumb} alt={it.title} />
              <figcaption>
                <strong>{it.title}</strong>
                <small className="bf-muted">{it.nBricks} bricks</small>
              </figcaption>
              <button className="bf-x" title="Remove" onClick={() => remove(it.id)}>×</button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
