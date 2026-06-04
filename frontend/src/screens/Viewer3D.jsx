import { useBuild, useUI } from "../state/store.js";
import { generate3D } from "../api.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import GlbViewer from "../viewer/GlbViewer.jsx";
import { brickModelToStl } from "../lib/stl.js";
import { download } from "../lib/ldraw.js";
import EmptyState from "../components/EmptyState.jsx";
import { Download, Blocks, Box, Sparkles } from "lucide-react";

export default function Viewer3D() {
  const { brickModel, prompt, imageUrl, glbUrl, busy3d, set } = useBuild();
  const setTab = useUI((s) => s.setTab);
  if (!brickModel) return <EmptyState />;

  function onDownloadStl() {
    const stl = brickModelToStl(brickModel, true);
    download(`${(prompt || "model").slice(0, 24).replace(/\W+/g, "_")}.stl`, stl, "model/stl");
  }

  function onDownloadGlb() {
    const a = document.createElement("a");
    a.href = glbUrl;
    a.download = `${(prompt || "model").slice(0, 24).replace(/\W+/g, "_")}.glb`;
    a.click();
  }

  async function onGenerate3D() {
    set({ busy3d: true });
    try {
      const res = await generate3D(imageUrl);
      // The mesh-derived voxels replace the procedural geometry, so Brick Studio
      // now matches the real building.
      set({
        glbUrl: res.glbUrl,
        busy3d: false,
        ...(res.brickModel ? { model: res.model, brickModel: res.brickModel } : {}),
      });
      if (res.voxelError) console.warn("voxelize failed, kept procedural bricks:", res.voxelError);
    } catch (e) {
      set({ busy3d: false });
      alert(String(e));
    }
  }

  return (
    <section className="bf-plate">
      <h2 className="bf-h2">3D model · Print it <span className="bf-muted" style={{ fontWeight: 600, fontSize: "1rem" }}>(Exit 1)</span></h2>
      <p className="bf-muted">
        Turn your render into a smooth 3D model with <b>TRELLIS</b>, then <b>stop here</b> to download the
        STL/GLB and 3D-print a souvenir, or <b>continue</b> to real buildable bricks.
      </p>

      {glbUrl ? (
        <GlbViewer url={glbUrl} height={420} />
      ) : (
        <>
          <BrickViewer brickModel={brickModel} monochrome studs={false} stand={false} height={400} />
          <div className="bf-toolbar">
            <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onGenerate3D} disabled={busy3d || !imageUrl}>
              {busy3d ? <span className="bf-building"><i /><i /><i /></span> : <Sparkles />}
              {busy3d ? "Reconstructing 3D…" : "Generate smooth 3D mesh (TRELLIS)"}
            </button>
            {!imageUrl && <span className="bf-muted" style={{ fontSize: ".82rem" }}>Generate an AI render first.</span>}
          </div>
          <p className="bf-muted" style={{ fontSize: ".8rem", marginTop: "calc(var(--u) * 1.5)" }}>
            The block preview above is a procedural stand-in. Click <b>Generate smooth 3D mesh</b> to reconstruct
            the real geometry from your render via TRELLIS (ComfyUI :8189) — this also rebuilds <b>Brick Studio</b>
            from the actual mesh.
          </p>
        </>
      )}

      <div className="bf-toolbar">
        {glbUrl && <button className="bf-btn bf-btn--primary bf-btn--studded" onClick={onDownloadGlb}><Download /> Download GLB</button>}
        <button className="bf-btn" onClick={onDownloadStl}><Download /> Download STL (bricks)</button>
        {glbUrl && <button className="bf-btn" onClick={() => set({ glbUrl: null })}><Box /> Back to block preview</button>}
        <button className="bf-btn" onClick={() => setTab("studio")}><Blocks /> Continue → Brick Studio</button>
      </div>
    </section>
  );
}
