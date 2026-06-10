import { ExternalLink, Download } from "lucide-react";
import { Button, toast } from "../../components/ui/index.js";
import { estimateCost, fmtUSD, bricklinkSearchUrl } from "../../lib/pricing.js";
import { partsToCsv, download } from "../../lib/ldraw.js";

// "This set ≈ $X to build" — a believable estimate from real averages, with a
// link out to BrickLink for live pricing.
export default function PricedSet({ brickModel, setCopy }) {
  const parts = brickModel?.parts || [];
  const { total, lines } = estimateCost(parts);
  const name = setCopy?.set_name || "set";

  function onCsv() {
    try {
      download(`${name.replace(/[^\w]+/g, "_")}_parts.csv`, partsToCsv(parts));
      toast.success("Parts list saved", "CSV in your downloads.");
    } catch (e) {
      toast.error("Export failed", String(e?.message || e));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Estimated build cost</p>
          <p className="font-display text-4xl font-black text-ink">≈ {fmtUSD(total)}</p>
          <p className="text-xs text-muted">{parts.reduce((n, p) => n + p.qty, 0).toLocaleString()} parts · used-condition averages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCsv}><Download size={14} /> Parts CSV</Button>
          <a href={bricklinkSearchUrl(name)} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 rounded-pill border-2 border-brand-blue px-3 py-1.5 text-sm font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
            <ExternalLink size={14} /> Live price on BrickLink
          </a>
        </div>
      </div>

      <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-sunken text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-3 py-2">Color</th><th className="px-3 py-2">Part</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Est.</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
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
          </tbody>
        </table>
      </div>

      {setCopy?.value_verdict && (
        <p className="mt-3 text-sm italic text-muted">{setCopy.value_verdict}</p>
      )}
      <p className="mt-1 text-[11px] text-muted-faint">
        Estimate only — actual BrickLink prices vary by seller, condition, and color rarity.
      </p>
    </div>
  );
}
