import { useBuild, useCanvas } from "../state/store.js";
import { generate3D } from "../api.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import GlbViewer from "../viewer/GlbViewer.jsx";
import { brickModelToStl } from "../lib/stl.js";
import { download } from "../lib/ldraw.js";
import EmptyState from "../components/EmptyState.jsx";
import { Download, Blocks, Box, Sparkles } from "lucide-react";
import { Button, Skeleton, Eyebrow, toast } from "../components/ui/index.js";

export default function Viewer3D({ active = true }) {
  const { brickModel, prompt, imageUrl, glbUrl, busy3d, set } = useBuild();
  const next = useCanvas((s) => s.next);
  if (!brickModel) return <EmptyState />;

  function onDownloadStl() {
    const stl = brickModelToStl(brickModel, true);
    download(`${(prompt || "model").slice(0, 24).replace(/\W+/g, "_")}.stl`, stl, "model/stl");
    toast.success("STL downloaded", "Brick geometry exported for 3D printing.");
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
      set({
        glbUrl: res.glbUrl,
        busy3d: false,
        ...(res.brickModel ? { model: res.model, brickModel: res.brickModel } : {}),
      });
      if (res.voxelError) toast.info("Kept procedural bricks", "Voxelizing the mesh failed; using the procedural geometry.");
      else toast.success("3D mesh ready", "Reconstructed from your render via TRELLIS.");
    } catch (e) {
      set({ busy3d: false });
      toast.error("3D generation failed", String(e?.message || e));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="nodrag nowheel flex-1 overflow-y-auto p-6 lg:p-7">
        <Eyebrow step={2} label="3D · Print" />
        <h2 className="text-h2 font-display font-extrabold">3D model · Print it</h2>
        <p className="mt-1.5 text-muted">
          Turn your render into a smooth 3D model with <b>TRELLIS</b>, then <b>stop here</b> to download the
          STL/GLB and 3D-print a souvenir, or <b>continue</b> to real buildable bricks.
        </p>

        <div className="mt-4">
          {glbUrl ? (
            <GlbViewer url={glbUrl} height={380} active={active} />
          ) : busy3d ? (
            <Skeleton className="h-[360px] w-full" />
          ) : (
            <BrickViewer brickModel={brickModel} monochrome studs={false} stand={false} height={360} active={active} />
          )}
        </div>

        {!glbUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" loading={busy3d} disabled={!imageUrl} onClick={onGenerate3D}>
              {!busy3d && <Sparkles />}
              {busy3d ? "Reconstructing 3D…" : "Generate smooth 3D mesh (TRELLIS)"}
            </Button>
            {!imageUrl && <span className="text-sm text-muted">Generate an AI render first.</span>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2.5">
          {glbUrl && (
            <Button variant="primary" onClick={onDownloadGlb}>
              <Download /> Download GLB
            </Button>
          )}
          <Button variant="secondary" onClick={onDownloadStl}>
            <Download /> Download STL (bricks)
          </Button>
          {glbUrl && (
            <Button variant="ghost" onClick={() => set({ glbUrl: null })}>
              <Box /> Back to block preview
            </Button>
          )}
          <Button variant="secondary" onClick={() => next()}>
            <Blocks /> Continue → Brick Studio
          </Button>
        </div>

        <p className="mt-3 text-sm text-muted">
          The block preview is a procedural stand-in. <b>Generate smooth 3D mesh</b> reconstructs the real
          geometry from your render via TRELLIS (ComfyUI :8189) — this also rebuilds <b>Brick Studio</b> from
          the actual mesh.
        </p>
      </div>
    </div>
  );
}
