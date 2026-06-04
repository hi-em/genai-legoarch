import { useBuild, useCollection, useCanvas } from "../state/store.js";
import BrickViewer from "../viewer/BrickViewer.jsx";
import { toLdraw, download, partsToCsv } from "../lib/ldraw.js";
import { frontElevationThumb } from "../lib/thumb.js";
import { playPop } from "../lib/sound.js";
import EmptyState from "../components/EmptyState.jsx";
import { Download, FileText, Star, Link2, LayoutGrid, Anchor, Grid3x3, ChevronDown } from "lucide-react";
import {
  Button, StatTile, Table, Swatch, Eyebrow, toast,
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem,
} from "../components/ui/index.js";

export default function BrickStudio({ active = true }) {
  const { brickModel, prompt } = useBuild();
  const addToShelf = useCollection((s) => s.add);
  const focus = useCanvas((s) => s.focus);
  if (!brickModel) return <EmptyState />;

  const st = brickModel.stability;
  const totalParts = brickModel.parts.reduce((a, p) => a + p.qty, 0);
  const safeName = (prompt || "model").slice(0, 24).replace(/\W+/g, "_");

  function onLdr() {
    download(`${safeName}.ldr`, toLdraw(brickModel, prompt), "text/plain");
    toast.success("LDraw exported", "Open the .ldr in BrickLink Studio.");
  }
  function onCsv() {
    download(`${safeName}_parts.csv`, partsToCsv(brickModel.parts), "text/csv");
    toast.success("Parts list exported", "CSV ready for shopping sites.");
  }
  function onInstructions() {
    const txt =
      `${prompt}\n\nBuild instructions (${brickModel.grid[2]} layers, ${totalParts} parts)\n` +
      brickModel.parts.map((p) => `- ${p.qty}x ${p.name} (${p.part})`).join("\n") +
      `\n\n(Open the .ldr in BrickLink Studio for full step-by-step visuals.)\n`;
    download(`${safeName}_instructions.txt`, txt, "text/plain");
    toast.success("Instructions exported", "Human-readable build guide saved.");
  }
  function onAddToShelf() {
    playPop();
    addToShelf({
      id: `${Date.now()}`,
      title: (prompt || "Untitled").split(",")[0].replace("legoarch ", ""),
      thumb: frontElevationThumb(brickModel),
      nBricks: st.nBricks,
      created_at: new Date().toISOString(),
    });
    toast.success("Added to shelf", "Find it any time in My Shelf.");
    focus("shelf");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="nodrag nowheel flex-1 overflow-y-auto p-6 lg:p-7">
        <Eyebrow step={3} label="Brick Studio" />
        <h2 className="text-h2 font-display font-extrabold">Brick Studio · Build it</h2>
        <p className="mt-1.5 text-muted">Real, buildable bricks — legolized, colored, checked, and exportable.</p>

        <div className="mt-4">
          <BrickViewer brickModel={brickModel} studs height={380} active={active} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <StatTile value={st.nBricks} label={<><LayoutGrid /> bricks</>} />
          <StatTile value={brickModel.grid.join("×")} label={<><Grid3x3 /> grid</>} />
          <StatTile
            variant={st.connected ? "ok" : "warn"}
            value={st.connected ? "✓" : st.components}
            label={<><Link2 /> {st.connected ? "connected" : "islands"}</>}
          />
          <StatTile
            variant={st.supportRatio > 0.95 ? "ok" : "warn"}
            value={`${Math.round(st.supportRatio * 100)}%`}
            label={<><Anchor /> supported</>}
          />
        </div>

        <h3 className="mt-6 mb-1 text-h3 font-display font-bold">Parts list</h3>
        <Table>
          <thead>
            <tr><th></th><th>Color</th><th>Part</th><th>Qty</th></tr>
          </thead>
          <tbody>
            {brickModel.parts.map((p) => (
              <tr key={p.color + p.part}>
                <td className="w-7"><Swatch color={p.hex} /></td>
                <td>{p.name}</td>
                <td className="font-mono text-muted">{p.part}</td>
                <td className="font-semibold">{p.qty}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="secondary">
                <Download /> Export <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onSelect={onLdr}><Download /> LDraw (.ldr)</DropdownItem>
              <DropdownItem onSelect={onCsv}><Download /> Parts list (CSV)</DropdownItem>
              <DropdownItem onSelect={onInstructions}><FileText /> Instructions (TXT)</DropdownItem>
            </DropdownContent>
          </DropdownMenu>

          <Button variant="primary" onClick={onAddToShelf}>
            <Star /> Add to Shelf
          </Button>
        </div>
      </div>
    </div>
  );
}
