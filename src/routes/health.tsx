import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHead, useMarketEdition } from "@/components/fl/shell";
import { healthRanked, healthState } from "@/lib/faultline/view";

export const Route = createFileRoute("/health")({
  component: HealthPage,
});

type Sort = "health" | "trend" | "symbol";
type Band = "all" | "strong" | "stable" | "watch" | "weak";

function bandOf(score: number | null): Exclude<Band, "all"> {
  if (score == null) return "weak";
  if (score >= 80) return "strong";
  if (score >= 65) return "stable";
  if (score >= 50) return "watch";
  return "weak";
}

function HealthPage() {
  const edition = useMarketEdition();
  const [sort, setSort] = useState<Sort>("health");
  const [band, setBand] = useState<Band>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = healthRanked
      .filter((n) => (band === "all" || bandOf(n.health) === band) && (!query || `${n.symbol} ${n.name}`.toLowerCase().includes(query)))
      .map((n) => ({
        n,
        trend: n.health != null && n.healthPrev != null ? n.health - n.healthPrev : null,
      }));
    list.sort((a, b) => {
      if (sort === "symbol") return a.n.symbol.localeCompare(b.n.symbol);
      if (sort === "trend") return (b.trend ?? -999) - (a.trend ?? -999);
      return (b.n.health ?? -1) - (a.n.health ?? -1);
    });
    return list;
  }, [sort, band, q, edition]);
  const counts = useMemo(() => {
    const tally = { strong: 0, stable: 0, watch: 0, weak: 0 };
    for (const n of healthRanked) tally[bandOf(n.health)] += 1;
    return tally;
  }, [edition]);

  return (
    <>
      <PageHead
        kicker="Structural health"
        title="Is participation holding up?"
        text="A 0–100 read of volume, relative strength, and how orderly the daily moves are. Higher is firmer."
      />
      <div className="mb-3 grid grid-cols-4 gap-2">
        <Count label="Strong" value={counts.strong} tone="text-pos" />
        <Count label="Stable" value={counts.stable} tone="text-ink" />
        <Count label="Watch" value={counts.watch} tone="text-blue" />
        <Count label="Weak" value={counts.weak} tone="text-neg" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a coin"
          autoComplete="off"
          className="h-9 w-full max-w-xs rounded-full border border-line bg-surface px-3 text-sm outline-none focus:border-blue"
        />
        {(
          [
            ["all", "All"],
            ["strong", "Strong"],
            ["stable", "Stable"],
            ["watch", "Watch"],
            ["weak", "Weak"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setBand(id)} className={`h-8 rounded-full px-3 text-xs ${band === id ? "bg-ink text-white" : "border border-line bg-surface text-muted"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto flex gap-1 text-xs">
          {(
            [
              ["health", "Score"],
              ["trend", "Change"],
              ["symbol", "Name"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSort(id)} className={`h-8 rounded-full px-3 ${sort === id ? "bg-blue-soft text-blue" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <ul className="card divide-y divide-line">
        {rows.map(({ n, trend }) => {
          const group = bandOf(n.health);
          const bar = group === "strong" ? "bg-pos" : group === "weak" ? "bg-neg" : group === "watch" ? "bg-blue" : "bg-ink";
          return (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "health" }} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <img src={`/coins/${n.symbol.toLowerCase()}.png`} alt="" width={28} height={28} decoding="async" className="token shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{n.symbol}</span>
                    <span className="truncate text-xs text-muted">{n.name}</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-bg">
                    <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(4, Math.min(100, n.health ?? 0))}%` }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-sm font-semibold">{n.health ?? "n/a"}</span>
                  <span className="block text-[10px] text-muted">{n.health == null ? "No read" : healthState(n.health)}</span>
                </span>
                <span className={`num w-10 text-right text-xs font-semibold ${trend == null ? "text-muted" : trend >= 0 ? "text-pos" : "text-neg"}`}>
                  {trend == null ? "—" : `${trend > 0 ? "+" : ""}${Math.round(trend)}`}
                </span>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-3 text-sm text-muted">No assets in this band.</li>}
      </ul>
    </>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card px-3 py-2">
      <p className="text-[10px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={`num mt-0.5 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
