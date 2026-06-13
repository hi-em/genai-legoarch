// Plain, accessible grid of saved sets — the fallback when the 3D room can't
// run (no WebGL, or a context loss), and a keyboard-first way to browse. Same
// card design the collection has always used.
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

export default function CollectionList({ items, onSelect, onRemove }) {
  return (
    <div className="mx-auto grid w-full max-w-[1000px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <motion.div
          key={it.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="group relative cursor-pointer overflow-hidden rounded-xl bg-elevated shadow-plate-flat"
          onClick={() => onSelect(it)}
        >
          <div className="aspect-square bg-[linear-gradient(#eef3f7,#d7dee5)]">
            {it.thumb && <img src={it.thumb} alt={it.title} className="h-full w-full object-contain" />}
          </div>
          <div className="p-2.5">
            <p className="truncate font-display text-sm font-bold text-ink">{it.title}</p>
            <p className="text-micro text-muted">
              {(it.nBricks || 0).toLocaleString()} pcs{it.setNumber ? ` · ${it.setNumber}` : ""}
            </p>
          </div>
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100 hover:bg-brand-red"
              aria-label={`Delete ${it.title || "set"}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );
}
