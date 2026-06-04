import { useUI } from "../state/store.js";
import { Sparkles, Boxes } from "lucide-react";

export default function EmptyState({ message = "No build yet." }) {
  const setTab = useUI((s) => s.setTab);
  return (
    <section className="bf-plate" style={{ textAlign: "center" }}>
      <Boxes size={44} style={{ opacity: 0.4 }} />
      <h2 className="bf-h2">{message}</h2>
      <p className="bf-muted">Generate a building first, then come back here.</p>
      <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={() => setTab("generate")}>
        <Sparkles /> Go to Generate
      </button>
    </section>
  );
}
