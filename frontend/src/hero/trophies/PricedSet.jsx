import { useMemo, useState } from "react";
import { ExternalLink, Download, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Button, Chip, toast } from "../../components/ui/index.js";
import { estimateCost, fmtUSD, bricklinkSearchUrl } from "../../lib/pricing.js";
import { partsToCsv, download } from "../../lib/ldraw.js";

// "This set ≈ $X to build" — a believable estimate from real averages, with a
// link out to BrickLink for live pricing. Client-side controls (search, color
// chips, sortable headers) let you slice the parts list before exporting.
export default function PricedSet({ brickModel, setCopy }) {
  const parts = brickModel?.parts || [];
  const { total, lines } = estimateCost(parts);
  const name = setCopy?.set_name || "set";

  const [query, setQuery] = useState("");
  const [colorFilter, setColorFilter] = useState(() => new Set()); // empty = All
  // sort.key: "color" | "part" | "qty" | "lineCost"; dir: "asc" | "desc"
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  // distinct colors present, for the chip row (stable by total qty desc)
  const colors = useMemo(() => {
    const m = new Map();
    for (const l of lines) {
      const cur = m.get(l.name);
      if (cur) cur.qty += l.qty;
      else m.set(l.name, { name: l.name, hex: l.hex, qty: l.qty });
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [lines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = lines.filter((l) => {
      if (colorFilter.size && !colorFilter.has(l.name)) return false;
      if (!q) return true;
      return (
        String(l.part).toLowerCase().includes(q) ||
        String(l.name).toLowerCase().includes(q)
      );
    });
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        let av = a[sort.key];
        let bv = b[sort.key];
        if (sort.key === "color") { av = a.name; bv = b.name; }
        if (typeof av === "string") return av.localeCompare(bv) * dir;
        return (av - bv) * dir;
      });
    }
    return rows;
  }, [lines, query, colorFilter, sort]);

  const shownQty = useMemo(
    () => filtered.reduce((n, l) => n + l.qty, 0),
    [filtered]
  );
  const shownCost = useMemo(
    () => filtered.reduce((n, l) => n + l.lineCost, 0),
    [filtered]
  );
  const totalQty = useMemo(
    () => lines.reduce((n, l) => n + l.qty, 0),
    [lines]
  );
  const isFiltered = !!query.trim() || colorFilter.size > 0;

  function toggleColor(cname) {
    setColorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cname)) next.delete(cname);
      else next.add(cname);
      return next;
    });
  }

  function toggleSort(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "qty" || key === "lineCost" ? "desc" : "asc" }
    );
  }

  function onCsv() {
    try {
      // export the currently visible rows (full set when nothing is filtered)
      download(`${name.replace(/[^\w]+/g, "_")}_parts.csv`, partsToCsv(filtered));
      toast.success(
        "Parts list saved",
        isFiltered ? `${filtered.length} filtered rows in your downloads.` : "CSV in your downloads."
      );
    } catch (e) {
      toast.error("Export failed", String(e?.message || e));
    }
  }

  const SortHead = ({ keyName, label, align = "left" }) => {
    const active = sort.key === keyName;
    return (
      <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => toggleSort(keyName)}
          aria-label={`Sort by ${label}${active ? `, currently ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}
          className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${active ? "text-ink" : ""} ${align === "right" ? "flex-row-reverse" : ""}`}
        >
          {label}
          {active ? (
            sort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          ) : (
            <span className="inline-block w-3" aria-hidden="true" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Estimated build cost</p>
          <p className="font-display text-4xl font-black text-ink">≈ {fmtUSD(total)}</p>
          <p className="text-xs text-muted">{totalQty.toLocaleString()} parts · used-condition averages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCsv}><Download size={14} /> Parts CSV</Button>
          <a href={bricklinkSearchUrl(name)} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-pill border-2 border-brand-blue px-3 py-1.5 text-sm font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
            <ExternalLink size={14} /> Live price on BrickLink
          </a>
        </div>
      </div>

      {/* controls */}
      <div className="mb-3 space-y-2.5">
        <label className="relative block">
          <span className="sr-only">Filter parts by part id or color</span>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-faint" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by part id or color…"
            className="w-full rounded-lg border border-border bg-elevated py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-muted-faint focus-visible:outline-none focus-visible:shadow-focus"
          />
        </label>

        {colors.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by color">
            <Chip
              size="sm"
              variant={colorFilter.size === 0 ? "selected" : "suggest"}
              onClick={() => setColorFilter(new Set())}
              aria-pressed={colorFilter.size === 0}
            >
              All
            </Chip>
            {colors.map((c) => {
              const on = colorFilter.has(c.name);
              return (
                <Chip
                  key={c.name}
                  size="sm"
                  variant={on ? "selected" : "suggest"}
                  onClick={() => toggleColor(c.name)}
                  aria-pressed={on}
                >
                  <span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ background: c.hex }} aria-hidden="true" />
                  {c.name}
                </Chip>
              );
            })}
          </div>
        )}

        <p className="text-micro text-muted" aria-live="polite">
          Showing {filtered.length.toLocaleString()} of {lines.length.toLocaleString()} part types
          {" · "}{shownQty.toLocaleString()} pcs
          {" · "}≈ {fmtUSD(shownCost)}
        </p>
      </div>

      <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-sunken text-xs text-muted">
            <tr>
              <SortHead keyName="color" label="Color" />
              <SortHead keyName="part" label="Part" />
              <SortHead keyName="qty" label="Qty" align="right" />
              <SortHead keyName="lineCost" label="Est." align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={`${l.part}|${l.color}`} className="border-t border-border">
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: l.hex }} />
                    {l.name}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-muted">{l.part}</td>
                <td className="px-3 py-1.5 text-right">{l.qty}</td>
                <td className="px-3 py-1.5 text-right text-muted">{fmtUSD(l.lineCost)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">
                  No parts match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {setCopy?.value_verdict && (
        <p className="mt-3 text-sm italic text-muted">{setCopy.value_verdict}</p>
      )}
      <p className="mt-1 text-micro text-muted-faint">
        Estimate only — actual BrickLink prices vary by seller, condition, and color rarity.
      </p>
    </div>
  );
}
