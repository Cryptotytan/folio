import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Ticker, Token, refreshBook, useMarketEdition } from "@/components/fl/shell";
import { formatPct, formatUsd } from "@/lib/faultline/format";
import { recordCatchup, revealCatchup, usePendingChanges, useRevealedChanges } from "@/lib/faultline/catchup";
import { ASSETS, SECTORS, asOf, bookLabel, cracks, dnaRanked, faults, market, pulse, quiet, sinceYesterday } from "@/lib/faultline/view";
import { useWatch } from "@/lib/faultline/watch";

export const Route = createFileRoute("/app")({
  component: Dashboard,
});

function Dashboard() {
  useMarketEdition();
  const hottest = [...SECTORS].sort((a, b) => b.rotation - a.rotation)[0];
  const flow = [...SECTORS].sort((a, b) => b.rotation - a.rotation);
  const delta = sinceYesterday();
  const topFaults = faults.filter((n) => (n.faultMag ?? 0) >= 5).slice(0, 3);
  const odd = dnaRanked.filter((n) => (n.dna ?? 0) >= 55).slice(0, 3);
  const pins = useWatch();
  const pinned = pins.map((id) => ASSETS.find((a) => a.id === id)).filter((a) => a != null);
  const changes = useRevealedChanges();
  const bars = [
    { label: "Market breadth", value: pulse.breadth },
    { label: "Volume activity", value: pulse.volumeActivity },
    { label: "Volatility", value: pulse.volatility },
    { label: "Rotation", value: pulse.sentiment },
  ];
  const tape = [...(hottest?.assets ?? [])].sort((a, b) => b.change1 - a.change1).slice(0, 3);
  const namedFaults = delta.freshNames
    .map((symbol) => ASSETS.find((a) => a.symbol === symbol))
    .filter((a) => a != null);

  return (
    <>
      <header className="mb-8 border-b border-line pb-5">
        <p className="kicker">Overview</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="max-w-3xl text-3xl md:text-4xl">The market beneath the market.</h1>
          <p className="chip">
            <i />
            {asOf} · {bookLabel()}
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          What changed overnight, where attention is sitting, and which names are off their own pattern. Open the brief in the corner for today’s read.
        </p>
      </header>

      <BriefBubble hottest={hottest} pulseState={pulse.state} delta={delta} namedFaults={namedFaults} tape={tape} live={bookLabel() === "Live quotes"} />

      <section id="changed">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Only what changed</h2>
          <RefreshChanges />
        </div>
        <ul className="card mt-3 divide-y divide-line">
          {changes.slice(0, 3).map((note) => (
            <li key={note.id}>
              <Link to="/asset/$id" params={{ id: String(note.asset) }} search={{ tab: note.tab }} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <Ticker symbol={note.symbol} name={note.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{note.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{note.text}</span>
                </span>
              </Link>
            </li>
          ))}
          {changes.length > 3 && (
            <li>
              <Link to="/changes" className="block px-4 py-3 text-sm font-medium text-blue">
                See more
              </Link>
            </li>
          )}
          {changes.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing pulled yet. Refresh to see what you missed.</li>}
        </ul>
      </section>

      <section id="list" className="mt-6">
        <h2 className="text-lg font-semibold">Your list</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {pinned.map((n) => (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "overview" }} className="card card-hover block p-3">
                <Ticker symbol={n.symbol} name={n.name} />
                <p className={`num mt-3 text-sm ${n.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(n.change1)} today</p>
                <p className="mt-1 text-sm text-muted">
                  Health {n.health ?? "n/a"}
                  {(n.faultMag ?? 0) >= 5 ? ` · ${n.faultText || "Signals disagree."}` : " · No active fault"}
                </p>
              </Link>
            </li>
          ))}
          {pinned.length === 0 && <li className="text-sm text-muted">Pin an asset from its page. It stays on this page.</li>}
        </ul>
      </section>

      <section id="book" className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
        <Metric title="Total market cap" value={formatUsd(market.mcap)} change={formatPct(market.capChange)} series={market.mcapSpark} tone={market.capChange >= 0 ? "pos" : "neg"} />
        <Metric title="24H volume" value={formatUsd(market.volume)} change="Quote volume" series={market.volSpark} />
        <Metric title="BTC dominance" value={`${(market.btcDominance * 100).toFixed(1)}%`} change="Share of tracked cap" bar={market.btcDominance * 100} />
        <Metric title="Breadth" value={`${pulse.breadth}%`} change="Share of the book that is up" bar={pulse.breadth} tone={pulse.breadth >= 55 ? "pos" : pulse.breadth <= 40 ? "neg" : undefined} />
        <Metric title="Hottest sector" value={hottest ? hottest.name : "—"} change={hottest ? `Rotation ${Math.round(hottest.rotation)}` : ""} tone={hottest?.heating === "up" ? "pos" : hottest?.heating === "down" ? "neg" : undefined} />
        <Metric title="Active faults" value={String(market.activeFaults)} change={`${delta.freshFaults} new since yesterday`} tone={market.activeFaults > 0 ? "warn" : undefined} />
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">What's interesting right now?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {hottest && (
            <Link to="/sectors/$slug" params={{ slug: hottest.id }} className="card card-hover block p-3 sm:p-4">
              <p className="font-medium">{hottest.name} is {hottest.heating === "up" ? "heating up" : "leading"}</p>
              <p className="mt-1 text-sm text-muted">Rotation score {Math.round(hottest.rotation)}. Attention heat, not fund flow.</p>
            </Link>
          )}
          <Link to="/dna" className="card card-hover block p-3 sm:p-4">
            <p className="font-medium">{odd.length} assets are off their usual pattern</p>
            <p className="mt-1 text-sm text-muted">Unlike each asset's own history. Not a verdict.</p>
          </Link>
          <a href="#cracks" className="card card-hover block p-3 sm:p-4">
            <p className="font-medium">
              {cracks.length === 1
                ? "1 asset looks strong while structure weakens"
                : cracks.length
                  ? `${cracks.length} assets look strong while structure weakens`
                  : "No hidden cracks clear the bar"}
            </p>
            <p className="mt-1 text-sm text-muted">Price is not the whole story</p>
          </a>
        </div>
      </section>

      <section id="pulse" className="mt-6 grid gap-4 lg:grid-cols-5">
        <article className="card p-3 sm:p-5 lg:col-span-2">
          <h2 className="text-xl font-semibold">Market pulse</h2>
          <p className="mt-1 text-2xl font-semibold text-ink">{pulse.state}</p>
          <p className="mt-1 text-sm text-muted">Breadth, volume, volatility and rotation. Not a forecast.</p>
          <ul className="mt-4 space-y-3">
            {bars.map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="text-muted">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-blue-soft">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${row.value}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Sector flow</h2>
              <p className="text-xs text-muted">Highest rotation first. Attention, not fund flow.</p>
            </div>
            <Link to="/sectors" className="text-sm font-medium text-blue">All sectors</Link>
          </div>
          <ul className="divide-y divide-line">
            {flow.slice(0, 6).map((s, i) => (
              <li key={s.id}>
                <Link to="/sectors/$slug" params={{ slug: s.id }} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num w-4 text-xs text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-bg">
                      <span className={`block h-full rounded-full ${s.heating === "up" ? "bg-pos" : s.heating === "down" ? "bg-neg" : "bg-ink"}`} style={{ width: `${Math.max(4, Math.min(100, s.rotation))}%` }} />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-sm font-semibold">{Math.round(s.rotation)}</span>
                    <span className={`block text-[10px] ${s.heating === "up" ? "text-pos" : s.heating === "down" ? "text-neg" : "text-muted"}`}>
                      {s.heating === "up" ? "Heating" : s.heating === "down" ? "Cooling" : "Steady"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active faults</h2>
          <Link to="/faults" className="text-sm font-medium text-blue">View all</Link>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {topFaults.map((n) => (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "faults" }} className="card card-hover block p-3 sm:p-4">
                <Ticker symbol={n.symbol} name={n.name} />
                <p className="mt-3 text-sm">Magnitude {(n.faultMag ?? 0).toFixed(1)} / 10</p>
                <p className="mt-1 text-sm text-muted">{n.faultText || "Signals disagree."}</p>
              </Link>
            </li>
          ))}
          {topFaults.length === 0 && <li className="text-sm text-muted">No fault clears the line.</li>}
        </ul>
      </section>

      <section id="cracks" className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Looks strong, structure does not</h2>
            <p className="mt-0.5 text-xs text-muted">The price is firm. The health score is not.</p>
          </div>
          <ul className="divide-y divide-line">
            {cracks.slice(0, 4).map((n) => (
              <li key={n.id}>
                <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "health" }} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <Ticker symbol={n.symbol} name={n.name} />
                  </span>
                  <span className="text-right">
                    <span className={`num block text-sm font-semibold ${n.change7 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(n.change7)}</span>
                    <span className="block text-[10px] text-muted">Health {n.health ?? "n/a"}</span>
                  </span>
                </Link>
              </li>
            ))}
            {cracks.length === 0 && <li className="px-4 py-3 text-sm text-muted">None clear the bar.</li>}
          </ul>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Off their own pattern</h2>
            <p className="mt-0.5 text-xs text-muted">Unlike their own history. Not a verdict.</p>
          </div>
          <ul className="divide-y divide-line">
            {odd.map((n) => (
              <li key={n.id}>
                <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "dna" }} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <Ticker symbol={n.symbol} name={n.name} />
                  </span>
                  <span className="text-right">
                    <span className="num block text-sm font-semibold">{n.dna ?? "n/a"}</span>
                    <span className="block text-[10px] text-muted">Deviation</span>
                  </span>
                </Link>
              </li>
            ))}
            {odd.length === 0 && <li className="px-4 py-3 text-sm text-muted">None stand out.</li>}
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Quiet on the surface</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {quiet.slice(0, 3).map((n) => (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "overview" }} className="card card-hover block p-3">
                <Ticker symbol={n.symbol} name={n.name} />
                <p className="mt-2 text-sm text-muted">Little price noise. Health {n.health ?? "n/a"}.</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function RefreshChanges() {
  const pending = usePendingChanges();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        refreshBook()
          .then(() => {
            recordCatchup();
            revealCatchup();
          })
          .finally(() => setBusy(false));
      }}
      className="h-8 shrink-0 rounded-full bg-ink px-3 text-xs font-medium text-white disabled:opacity-60"
    >
      {busy ? "Refreshing" : pending > 0 ? `Refresh · ${pending} new` : "Refresh"}
    </button>
  );
}

function BriefBubble({
  hottest,
  pulseState,
  delta,
  namedFaults,
  tape,
  live,
}: {
  hottest: { name: string; rotation: number } | undefined;
  pulseState: string;
  delta: ReturnType<typeof sinceYesterday>;
  namedFaults: { id: number; symbol: string }[];
  tape: { id: number; symbol: string; name: string; price: number; change1: number }[];
  live: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-40 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_18px_50px_rgba(18,26,39,0.18)] md:bottom-24">
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                <span className={`inline-block size-1.5 rounded-full ${live ? "bg-pos" : "bg-warn"}`} />
                Morning brief
              </p>
              <p className="mt-1 text-base font-semibold leading-snug">
                {hottest ? `${pulseState}. ${hottest.name} leads.` : pulseState}
              </p>
            </div>
            <button type="button" className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="max-h-[min(24rem,58dvh)] overflow-auto px-4 py-3">
            <p className="text-sm leading-relaxed text-muted">
              {pulseState === "Cooling"
                ? "Fewer than 40% of tracked assets are up."
                : pulseState === "Heating"
                  ? "At least 55% of tracked assets are up."
                  : "The share of assets that are up sits in the middle."}{" "}
              {hottest ? `${hottest.name} has the highest rotation, ${Math.round(hottest.rotation)}. That is attention, not money moving between coins.` : ""}
            </p>
            <p className="mt-3 text-[11px] font-medium tracking-wide text-muted uppercase">
              {hottest ? `Leading ${hottest.name}` : "Leading names"}
            </p>
            <ul className="mt-1 divide-y divide-line rounded-2xl bg-bg">
              {tape.map((row) => (
                <li key={row.id}>
                  <Link to="/asset/$id" params={{ id: String(row.id) }} search={{ tab: "overview" }} className="flex items-center gap-2 px-3 py-2" onClick={() => setOpen(false)}>
                    <Token symbol={row.symbol} size={18} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{row.symbol}</span>
                      <span className="block truncate text-[11px] text-muted">{row.name}</span>
                    </span>
                    <span className="num ml-auto text-sm font-medium">{formatUsd(row.price)}</span>
                    <span className={`num text-xs font-semibold ${row.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(row.change1)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">Since yesterday</dt>
                <dd className={`num mt-0.5 text-xl font-semibold ${delta.mcapDelta >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(delta.mcapDelta)}</dd>
                <dd className="text-muted">Change in the assets on this page. Not the whole market.</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">Sector to read</dt>
                <dd className="mt-0.5 font-semibold">{delta.sector ? delta.sector.name : "None"}</dd>
                <dd className="text-muted">
                  {delta.sector
                    ? `Rotation ${Math.round(delta.sector.rotation)} of 100, ${delta.sector.delta >= 0 ? "up" : "down"} ${Math.abs(Math.round(delta.sector.delta))} since yesterday.`
                    : "No sector stood out."}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">New faults</dt>
                <dd className="num mt-0.5 text-xl font-semibold">{delta.freshFaults}</dd>
                <dd className="text-muted">Signals that usually agree and no longer do.</dd>
                {namedFaults.length > 0 && (
                  <dd className="mt-1">
                    {namedFaults.map((asset, i) => (
                      <span key={asset.id}>
                        {i > 0 && ", "}
                        <Link to="/asset/$id" params={{ id: String(asset.id) }} search={{ tab: "faults" }} className="inline-flex items-center gap-1 font-medium hover:text-blue" onClick={() => setOpen(false)}>
                          <Token symbol={asset.symbol} size={16} />
                          {asset.symbol}
                        </Link>
                      </span>
                    ))}
                  </dd>
                )}
              </div>
            </dl>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Morning brief"
        className="fixed right-4 bottom-24 z-40 grid size-16 place-items-center rounded-full bg-ink text-white shadow-[0_12px_28px_rgba(18,26,39,0.28)] md:bottom-6"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-ink ${live ? "bg-pos" : "bg-warn"}`} />
        <span className="text-[11px] font-semibold tracking-wide">Brief</span>
      </button>
    </>
  );
}

function Metric({ title, value, change, series, tone, bar }: { title: string; value: string; change: string; series?: number[]; tone?: "pos" | "neg" | "warn"; bar?: number }) {
  const up = change.startsWith("+");
  const down = change.startsWith("-") || change.startsWith("−");
  const accent = tone === "pos" ? "bg-pos" : tone === "neg" ? "bg-neg" : tone === "warn" ? "bg-warn" : "bg-blue";
  return (
    <article className="card overflow-hidden">
      <div className={`h-0.5 ${accent}`} />
      <div className="p-3 sm:p-4">
        <p className="text-[10px] font-medium tracking-wide text-muted uppercase sm:text-xs">{title}</p>
        <p className="display num mt-2 truncate text-xl leading-none sm:text-2xl">{value}</p>
        <p className={`num mt-1.5 text-xs sm:text-sm ${up ? "text-pos" : down ? "text-neg" : "text-muted"}`}>{change}</p>
        {bar != null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg">
            <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(4, Math.min(100, bar))}%` }} />
          </div>
        )}
        {series && series.length > 1 && <Spark series={series} />}
      </div>
    </article>
  );
}

function Spark({ series }: { series: number[] }) {
  const values = series.filter((n) => Number.isFinite(n));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 4 + (1 - (v - min) / span) * 22;
    return { x, y };
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fill = `${line} L100,30 L0,30 Z`;
  const up = values[values.length - 1] >= values[0];
  return (
    <svg viewBox="0 0 100 32" className="mt-2 h-8 w-full sm:mt-3 sm:h-10" aria-hidden>
      <path d={fill} fill={up ? "#e7f6ee" : "#e7eefc"} />
      <path d={line} fill="none" stroke={up ? "#067647" : "#1f4fd8"} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
