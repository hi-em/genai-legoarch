import { useBuild, useUI } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { brickModelToStl } from "../lib/stl.js";
import { download } from "../lib/ldraw.js";
import EmptyState from "../components/EmptyState.jsx";

export default function Viewer3D() {
  const { brickModel, prompt } = useBuild();
  const setTab = useUI((s) => s.setTab);
  if (!brickModel) return <EmptyState />;

  function onDownloadStl() {
    const stl = brickModelToStl(brickModel, true);
    download(`${(prompt || "model").slice(0, 24).replace(/\W+/g, "_")}.stl`, stl, "model/stl");
  }

  return (
    <section className="bf-card">
      <h2 className="bf-h">3D model · Print it (Exit 1)</h2>
      <p className="bf-muted">
        Your render is now a 3D model. <b>Stop here</b> to download the STL and 3D-print a smooth souvenir,
        or <b>continue</b> to turn it into real, buildable bricks.
      </p>
      <BrickViewer brickModel={brickModel} monochrome studs={false} height={400} />
      <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <button className="bf-stud-btn" onClick={onDownloadStl}>⬇ Download STL</button>
        <button className="bf-stud-btn" onClick={() => setTab("studio")}>Continue → Brick Studio ▶</button>
      </div>
      <p className="bf-muted" style={{ fontSize: ".8rem", marginTop: ".75rem" }}>
        STL export is real (generated in-browser). The smooth geometry here will come from TRELLIS once ComfyUI is connected.
      </p>
    </section>
  );
}
