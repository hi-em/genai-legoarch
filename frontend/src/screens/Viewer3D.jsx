import { useBuild, useUI } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { brickModelToStl } from "../lib/stl.js";
import { download } from "../lib/ldraw.js";
import EmptyState from "../components/EmptyState.jsx";
import { Download, Blocks } from "lucide-react";

export default function Viewer3D() {
  const { brickModel, prompt } = useBuild();
  const setTab = useUI((s) => s.setTab);
  if (!brickModel) return <EmptyState />;

  function onDownloadStl() {
    const stl = brickModelToStl(brickModel, true);
    download(`${(prompt || "model").slice(0, 24).replace(/\W+/g, "_")}.stl`, stl, "model/stl");
  }

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">3D model · Print it <span className="bf-muted" style={{ fontWeight: 600, fontSize: "1rem" }}>(Exit 1)</span></h2>
      <p className="bf-muted">
        Your render is now a 3D model. <b>Stop here</b> to download the STL and 3D-print a smooth souvenir,
        or <b>continue</b> to turn it into real, buildable bricks.
      </p>
      <BrickViewer brickModel={brickModel} monochrome studs={false} stand={false} height={400} />
      <div className="bf-toolbar">
        <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onDownloadStl}><Download /> Download STL</button>
        <button className="bf-btn" onClick={() => setTab("studio")}><Blocks /> Continue → Brick Studio</button>
      </div>
      <p className="bf-muted" style={{ fontSize: ".8rem", marginTop: "calc(var(--u) * 1.5)" }}>
        STL export is real (generated in-browser). The smooth geometry will come from TRELLIS once ComfyUI is connected.
      </p>
    </section>
  );
}
