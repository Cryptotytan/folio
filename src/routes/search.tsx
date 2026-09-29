import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHead, Ticker, useMarketEdition } from "@/components/fl/shell";
import { ASSETS, SECTORS } from "@/lib/faultline/view";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

const PAGES = [
  { to: "/app" as const, label: "Overview" },
  { to: "/sectors" as const, label: "Sectors" },
  { to: "/faults" as const, label: "Faults" },
  { to: "/dna" as const, label: "DNA" },
  { to: "/health" as const, label: "Health" },
];

function SearchPage() {
  const edition = useMarketEdition();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const assets = useMemo(
    () =>
      ASSETS.filter(
        (n) => !query || `${n.symbol} ${n.name} ${n.category}`.toLowerCase().includes(query),
      ).slice(0, 24),
    [query, edition],
  );
  const secs = useMemo(
    () => SECTORS.filter((s) => !query || `${s.name} ${s.id}`.toLowerCase().includes(query)),
    [query, edition],
  );
  const pages = PAGES.filter((page) => !query || page.label.toLowerCase().includes(query));
  return (
    <>
      <PageHead kicker="Search" title="Find an asset or a sector" text="Try BTC, SOL, AI or DeFi." />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search BTC, SOL, AI, DeFi..."
        autoComplete="off"
        className="mb-6 h-12 w-full max-w-lg rounded-xl border border-line bg-surface px-3 outline-none focus:border-blue"
      />
      <h2 className="text-sm font-semibold text-muted">Assets</h2>
      <ul className="mt-2 space-y-2">
        {assets.map((n) => (
          <li key={n.id}>
            <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "overview" }} preload="intent" className="card flex h-14 w-full items-center px-3">
              <Ticker symbol={n.symbol} name={n.name} />
            </Link>
          </li>
        ))}
        {assets.length === 0 && <li className="text-sm text-muted">No assets match.</li>}
      </ul>
      <h2 className="mt-6 text-sm font-semibold text-muted">Sectors</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {secs.map((s) => (
          <li key={s.id}>
            <Link to="/sectors/$slug" params={{ slug: s.id }} preload="intent" className="btn-ghost">
              {s.name}
            </Link>
          </li>
        ))}
        {secs.length === 0 && <li className="text-sm text-muted">No sectors match.</li>}
      </ul>
      <h2 className="mt-6 text-sm font-semibold text-muted">Pages</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {pages.map((page) => (
          <li key={page.to}>
            <Link to={page.to} preload="intent" className="btn-ghost">
              {page.label}
            </Link>
          </li>
        ))}
        {pages.length === 0 && <li className="text-sm text-muted">No pages match.</li>}
      </ul>
    </>
  );
}
