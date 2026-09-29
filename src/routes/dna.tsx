import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHead, useMarketEdition } from "@/components/fl/shell";
import { dnaRanked, type Asset } from "@/lib/faultline/view";

export const Route = createFileRoute("/dna")({
  component: DnaPage,
});

function tone(dna: number | null) {
  if (dna == null) return "n/a";
  if (dna >= 70) return "Far";
  if (dna >= 40) return "Odd";
  return "Close";
}

function DnaPage() {
  const edition = useMarketEdition();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return dnaRanked.filter((n) => !query || n.symbol.toLowerCase().includes(query) || n.name.toLowerCase().includes(query));
  }, [q, edition]);
  return (
    <>
      <PageHead
        kicker="Market DNA"
        title="When an asset stops behaving like itself"
        text="Hover a card to turn it. The other side shows who shares this behavior, and how close that match is."
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search BTC, SOL, AI..."
        autoComplete="off"
        className="mb-4 h-12 w-full max-w-md rounded-xl border border-line bg-surface px-3 outline-none focus:border-blue"
      />
      <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3">
        {rows.map((n) => (
          <DnaCard key={n.id} asset={n} />
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No assets match.</p>}
      </div>
    </>
  );
}

function DnaCard({ asset }: { asset: Asset }) {
  const score = asset.dna;
  const far = (score ?? 0) >= 70;
  const odd = (score ?? 0) >= 40;
  const lead = [...asset.lines].sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma))[0];
  const kin = asset.neighbors.slice(0, 3);
  const chip = far ? "bg-orange-50 text-warn" : odd ? "bg-blue-soft text-blue" : "bg-bg text-muted";
  return (
    <Link to="/asset/$id" params={{ id: String(asset.id) }} search={{ tab: "dna" }} preload="intent" className="flip block">
      <div className="flip-inner">
        <div className="flip-face card">
          <div className={`h-1 ${far ? "bg-warn" : odd ? "bg-blue" : "bg-line"}`} />
          <div className="flex h-full flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex min-w-0 items-center gap-2">
                <img src={`/coins/${asset.symbol.toLowerCase()}.png`} alt="" width={28} height={28} decoding="async" className="token shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-none">{asset.symbol}</span>
                  <span className="mt-1 block truncate text-[11px] text-muted">{asset.name}</span>
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${chip}`}>{tone(score)}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Deviation</p>
                <p className="num text-3xl font-semibold leading-none tracking-tight sm:text-4xl">{score == null ? "n/a" : Math.round(score)}</p>
              </div>
              {lead && (
                <p className={`num text-right text-sm font-semibold ${lead.sigma >= 0 ? "text-pos" : "text-neg"}`}>
                  {lead.sigma > 0 ? "+" : ""}
                  {lead.sigma.toFixed(1)}σ
                  <span className="mt-0.5 block text-[10px] font-medium tracking-wide text-muted uppercase">vs usual</span>
                </p>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
              <div className={`h-full rounded-full ${far ? "bg-warn" : odd ? "bg-blue" : "bg-ink"}`} style={{ width: `${Math.max(4, Math.min(100, score ?? 0))}%` }} />
            </div>
            <p className="mt-auto line-clamp-2 pt-2 text-[11px] leading-snug text-muted sm:text-xs">
              {lead ? `${lead.metric} is ${lead.sigma >= 0 ? "above" : "below"} this asset's own history.` : "Not enough history for a behavior line."}
            </p>
          </div>
        </div>
        <div className="flip-face flip-back card p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <img src={`/coins/${asset.symbol.toLowerCase()}.png`} alt="" width={18} height={18} decoding="async" className="token shrink-0" />
            <p className="min-w-0 truncate text-[10px] font-medium tracking-wide text-muted uppercase sm:text-xs">Behaves like {asset.symbol}</p>
          </div>
          <ul className="mt-2">
            {kin.map((n) => (
              <li key={n.id} className="flex items-center gap-2 border-t border-line py-1.5 first:border-0 sm:py-2">
                <img src={`/coins/${n.symbol.toLowerCase()}.png`} alt="" width={22} height={22} decoding="async" className="token shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">{n.symbol}</span>
                <span className="num rounded-md bg-bg px-1.5 py-1 text-right text-xs font-semibold text-ink">
                  {n.score}
                  <span className="mt-0.5 hidden text-[10px] font-medium tracking-wide text-muted uppercase sm:block">Similar</span>
                </span>
              </li>
            ))}
            {kin.length === 0 && <li className="pt-3 text-sm text-muted">No close behavior match.</li>}
          </ul>
          <p className="mt-auto pt-2 text-xs font-medium text-blue">Open {asset.symbol}</p>
        </div>
      </div>
    </Link>
  );
}
