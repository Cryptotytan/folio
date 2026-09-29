import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLiveBook } from "@/components/fl/shell";
import { formatPct, formatUsd } from "@/lib/faultline/format";
import { loadTape } from "@/lib/faultline/book.functions";
import { ASSETS, SECTORS, applyTape, pulse, quoteState, tapeOf } from "@/lib/faultline/view";

export const Route = createFileRoute("/")({
  component: Welcome,
});

function Welcome() {
  useLiveBook();
  useEffect(() => {
    loadTape()
      .then((rows) => applyTape(rows))
      .catch(() => {});
  }, []);
  const live = quoteState() === "live";
  const rows = ["BTC", "ETH", "SOL"].map((symbol) => ASSETS.find((a) => a.symbol === symbol)).filter((a) => a != null);
  const hottest = [...SECTORS].sort((a, b) => b.rotation - a.rotation)[0];
  return (
    <div className="welcome min-h-dvh">
      <span className="welcome-glass welcome-glass-a" aria-hidden />
      <span className="welcome-glass welcome-glass-b" aria-hidden />
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="logo">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <rect width="22" height="22" rx="6" fill="#162033" />
            <path d="M4.5 14.2 8.8 9.2l2.6 2.8L17.2 6.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Folio
        </Link>
      </header>
      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 md:min-h-[calc(100dvh-4rem)] md:grid-cols-2 md:gap-12 md:px-5 md:py-0">
        <div>
          <p className="kicker">Market intelligence</p>
          <h1 className="mt-3 text-4xl leading-[1.08] md:text-6xl">See the market beneath the market.</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Rotation, unusual behavior, and structural strength — read as a brief, not a terminal.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/app" className="btn">
              Enter Folio <span className="arrow">→</span>
            </Link>
            <Link to="/methodology" className="btn-ghost">
              How it works
            </Link>
          </div>
        </div>
        <aside className="card p-2">
          <div className="rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-muted">Today’s read</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{pulse.state}</p>
          </div>
          <ul className="divide-y divide-line px-2">
            {rows.map((row) => {
              const tape = tapeOf(row.symbol);
              const price = live ? row.price : tape?.price;
              const change = live ? row.change1 : tape?.change1;
              return (
              <li key={row.symbol} className="flex items-center gap-3 py-3.5">
                <img src={`/coins/${row.symbol.toLowerCase()}.png`} alt="" width={36} height={36} className="token" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{row.symbol}</span>
                  <span className="block text-xs text-muted">{row.name}</span>
                </span>
                <span className="ml-auto text-right">
                  {price != null && change != null ? (
                    <>
                      <span className="num block text-sm font-medium">{formatUsd(price)}</span>
                      <span className={change >= 0 ? "num text-xs text-pos" : "num text-xs text-neg"}>{formatPct(change)}</span>
                    </>
                  ) : (
                    <span className="block text-xs text-muted">{quoteState() === "model" ? "Quote unavailable" : "Loading quote"}</span>
                  )}
                </span>
              </li>
              );
            })}
          </ul>
          {hottest && (
            <div className="m-2 flex items-center justify-between rounded-lg border border-line px-4 py-3">
              <div>
                <p className="text-xs text-muted">Sector in focus</p>
                <p className="font-medium">{hottest.name}</p>
              </div>
              <p className="num text-right text-sm text-ink">
                {hottest.heating === "up" ? "Heating" : hottest.heating === "down" ? "Cooling" : "Steady"}
                <span className="mt-0.5 block text-muted">Rotation {Math.round(hottest.rotation)}</span>
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
