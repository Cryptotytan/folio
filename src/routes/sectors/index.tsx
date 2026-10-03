import { Link, createFileRoute } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { PageHead, Token, useMarketEdition } from "@/components/fl/shell";
import { formatPct } from "@/lib/faultline/format";
import { SECTORS, initialSectors, subscribeEdition, type Asset, type Sector } from "@/lib/faultline/view";
import { useDesk } from "@/lib/faultline/desk";

export const Route = createFileRoute("/sectors/")({
  component: SectorsPage,
});

function leaders(sector: Sector) {
  return [...sector.assets].sort((a, b) => (b.rotation ?? 0) - (a.rotation ?? 0) || b.change1 - a.change1).slice(0, 3);
}

function heatCopy(sector: Sector) {
  if (sector.heating === "up") return "Heating";
  if (sector.heating === "down") return "Cooling";
  return "Steady";
}

function SectorsPage() {
  useMarketEdition();
  const desk = useDesk();
  const liveSectors = useSyncExternalStore(subscribeEdition, () => SECTORS, () => initialSectors);
  const sectors = desk.kind === "crypto" ? liveSectors : desk.sectors;
  return (
    <>
      <PageHead
        kicker="Market flow"
        title="Which sectors are gaining attention?"
        text="Hover a card to turn it. The other side shows who is leading, and how they moved today. Folio calculated rotation from the live price and volume. These are not exchange quotes."
      />
      <div className="grid grid-cols-2 items-start gap-2 lg:grid-cols-3 lg:gap-3">
        {[...sectors].sort((a, b) => b.rotation - a.rotation).map((s) => {
          const up = s.heating === "up";
          const down = s.heating === "down";
          return (
            <Link key={s.id} to="/sectors/$slug" params={{ slug: s.id }} preload="intent" className="flip block">
              <div className="flip-inner">
                <div className="flip-face card">
                  <div className="flex h-full flex-col p-2.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-sm leading-tight sm:text-lg">{s.name}</h2>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs ${up ? "bg-emerald-50 text-pos" : down ? "bg-rose-50 text-neg" : "bg-bg text-muted"}`}>
                        {heatCopy(s)}
                      </span>
                    </div>
                    <div className="score-well">
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">Rotation</p>
                          <p className="num text-2xl font-semibold leading-none tracking-tight sm:text-4xl">{Math.round(s.rotation)}</p>
                        </div>
                        <ul className="flex gap-1.5 pb-0.5">
                          {leaders(s).map((a) => (
                            <li key={a.id} className="inline-flex items-center gap-1">
                              <Token symbol={a.symbol} size={16} />
                              <span className="hidden text-[11px] font-semibold sm:inline">{a.symbol}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white">
                        <div className={`h-full rounded-full ${up ? "bg-pos" : down ? "bg-neg" : "bg-ink"}`} style={{ width: `${Math.max(6, Math.min(100, s.rotation))}%` }} />
                      </div>
                    </div>
                    <dl className="stat-row text-[10px] sm:text-xs">
                      <div>
                        <dt className="text-muted">7D</dt>
                        <dd className={`num mt-0.5 font-semibold ${s.ret7 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(s.ret7)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Volume</dt>
                        <dd className={`num mt-0.5 font-semibold ${s.volumeChange >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(s.volumeChange)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Breadth</dt>
                        <dd className="num mt-0.5 font-semibold text-ink">{Math.round(s.breadth * 100)}%</dd>
                      </div>
                    </dl>
                    <p className="mt-2 hidden text-[11px] text-muted sm:block">{s.count} assets tracked</p>
                  </div>
                </div>
                <div className="flip-face flip-back card p-3 sm:p-4">
                  <p className="text-[10px] font-medium tracking-wide text-muted uppercase sm:text-xs">Leading {s.name}</p>
                  <ul className="mt-2">
                    {leaders(s).map((a) => (
                      <Leader key={a.id} asset={a} />
                    ))}
                  </ul>
                  <p className="mt-auto pt-2 text-xs font-medium text-blue sm:text-sm">Open {s.name}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function Leader({ asset }: { asset: Asset }) {
  const up = asset.change1 >= 0;
  return (
    <li className="flex items-center gap-2 border-t border-line py-1.5 first:border-0 sm:gap-3 sm:py-2.5">
      <span className="inline-flex min-w-0 flex-1 items-start gap-2">
        <Token symbol={asset.symbol} size={28} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-none">{asset.symbol}</span>
          <span className="mt-1 block truncate text-xs text-muted">{asset.name}</span>
        </span>
      </span>
      <span className={`num rounded-md px-1.5 py-1 text-right text-xs font-semibold sm:text-sm ${up ? "bg-emerald-50 text-pos" : "bg-rose-50 text-neg"}`}>
        {formatPct(asset.change1)}
        <span className="mt-0.5 hidden text-[10px] font-medium tracking-wide uppercase sm:block">Today</span>
      </span>
    </li>
  );
}
