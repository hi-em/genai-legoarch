import { useCollection } from "../state/store.js";
import { X, LibraryBig } from "lucide-react";

export default function Shelf() {
  const { items, remove } = useCollection();

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">My Shelf</h2>
      <p className="bf-muted">Every building you make lands here — your own growing collection.</p>
      {items.length === 0 ? (
        <div style={{ padding: "calc(var(--u) * 4)", textAlign: "center" }} className="bf-muted">
          <LibraryBig size={40} style={{ opacity: 0.4 }} />
          <p>Empty shelf. Go generate your first build!</p>
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
              <button className="bf-x" title="Remove" onClick={() => remove(it.id)}><X /></button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
