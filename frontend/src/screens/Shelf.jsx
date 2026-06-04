import { LibraryBig, X, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useCollection, useCanvas } from "../state/store.js";
import { SPRING } from "../lib/motion.js";
import { Button, IconButton, Eyebrow } from "../components/ui/index.js";

export default function Shelf() {
  const { items, remove } = useCollection();
  const focus = useCanvas((s) => s.focus);

  return (
    <div className="flex h-full flex-col">
      <div className="nodrag nowheel flex-1 overflow-y-auto p-6 lg:p-7">
        <Eyebrow label="My Shelf" icon={LibraryBig} />
        <h2 className="text-h2 font-display font-extrabold">My Shelf</h2>
        <p className="mt-1.5 text-muted">Every building you make lands here — your own growing collection.</p>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted">
            <LibraryBig className="h-10 w-10 opacity-40" />
            <p>Empty shelf. Go generate your first build!</p>
            <Button variant="primary" onClick={() => focus("generate")}>
              <Sparkles /> Go to Generate
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {items.map((it) => (
              <motion.figure
                key={it.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING.bouncy}
                className="relative m-0 rounded-lg bg-elevated p-2.5 shadow-plate-flat"
              >
                <img src={it.thumb} alt={it.title} className="block w-full rounded" />
                <figcaption className="mt-2 flex flex-col">
                  <strong className="font-display">{it.title}</strong>
                  <small className="text-muted">{it.nBricks} bricks</small>
                </figcaption>
                <IconButton
                  size="sm"
                  variant="solid"
                  className="absolute right-2 top-2 h-7 w-7 bg-brand-red text-white shadow-[0_2px_0_var(--brand-red-dark)]"
                  title="Remove"
                  aria-label={`Remove ${it.title}`}
                  onClick={() => remove(it.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </motion.figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
