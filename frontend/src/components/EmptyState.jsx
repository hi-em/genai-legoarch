import { useUI } from "../state/store.js";

export default function EmptyState({ message = "No build yet." }) {
  const setTab = useUI((s) => s.setTab);
  return (
    <section className="bf-card" style={{ textAlign: "center" }}>
      <h2 className="bf-h">🧱 {message}</h2>
      <p className="bf-muted">Generate a building first, then come back here.</p>
      <button className="bf-stud-btn" onClick={() => setTab("generate")}>Go to Generate ▶</button>
    </section>
  );
}
