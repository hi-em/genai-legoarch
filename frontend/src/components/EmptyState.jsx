import { Sparkles, Boxes } from "lucide-react";
import { useCanvas } from "../state/store.js";
import { Button } from "./ui/index.js";

export default function EmptyState({ message = "No build yet." }) {
  const focus = useCanvas((s) => s.focus);
  return (
    <div className="nodrag flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Boxes className="h-11 w-11 text-muted opacity-50" />
      <h2 className="text-h2 font-display font-extrabold">{message}</h2>
      <p className="text-muted">Generate a building first, then come back here.</p>
      <Button variant="primary" onClick={() => focus("generate")}>
        <Sparkles /> Go to Generate
      </Button>
    </div>
  );
}
