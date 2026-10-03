import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, useSyncExternalStore } from "react";
import { Ticker, Token, useMarketEdition } from "@/components/fl/shell";
import { formatPct, formatUsd, compareCopy } from "@/lib/faultline/format";
import { ASSETS, asOf, sinceYesterday } from "@/lib/faultline/view";
import { useDesk, listedAsset } from "@/lib/faultline/desk";
import { WorldMap } from "@/components/fl/world-map";
import { useWatch } from "@/lib/faultline/watch";

export const Route = createFileRoute("/app")({
  component: Dashboard,
});

function Dashboard() {
  useMarketEdition();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const desk = useDesk();
  const { pulse, sectors, faults, dnaRanked, cracks, quiet, market } = desk;
  const onStocks = desk.kind === "equities";
  const hottest = [...sectors].sort((a, b) => b.rotation - a.rotation)[0];
  const flow = [...sectors].sort((a, b) => b.rotation - a.rotation);
  const topFaults = faults.filter((n) => (n.faultMag ?? 0) >= 5).slice(0, 3);
  const odd = dnaRanked.filter((n) => (n.dna ?? 0) >= 55).slice(0, 3);
  const pins = useWatch();
  const pinned = pins
    .map((id) => (id >= 1_000_000 ? listedAsset(id) : ASSETS.find((a) => a.id === id)))
    .filter((a): a is NonNullable<typeof a> => a != null && (onStocks ? a.id >= 1_000_000 : a.id < 1_000_000));
  const cryptoDelta = sinceYesterday();
  const delta = onStocks
    ? {
        mcapDelta: market.capChange,
        sector: hottest ? { id: hottest.id, name: hottest.name, rotation: hottest.rotation, delta: 0 } : null,
        freshFaults: faults.filter((n) => (n.faultMag ?? 0) >= 5).length,
        freshNames: faults.filter((n) => (n.faultMag ?? 0) >= 5).slice(0, 3).map((n) => n.symbol),
      }
    : cryptoDelta;
  const bars = [
    { label: "Market breadth", value: pulse.breadth, color: "#1f4fd8", track: "#e7eefb" },
    { label: "Volume activity", value: pulse.volumeActivity, color: "#0f8f7a", track: "#e5f5f1" },
    { label: "Volatility", value: pulse.volatility, color: "#b54708", track: "#fdeede" },
    { label: "Rotation", value: pulse.sentiment, color: "#3d4d9a", track: "#eceef8" },
  ];
  const tape = [...(hottest?.assets ?? [])].sort((a, b) => b.change1 - a.change1).slice(0, 3);
  const namedFaults = delta.freshNames
    .map((symbol) => desk.assets.find((a) => a.symbol === symbol))
    .filter((a) => a != null);

  return (
    <>
      <header className="mb-10">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-7">
          <div className="max-w-3xl">
            <p className="kicker">Overview</p>
            <h1 className="mt-3 text-3xl leading-[1.08] sm:text-4xl md:text-5xl">The market beneath the market.</h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              What changed overnight, where attention is sitting, and which names are off their own pattern. Open the briefing in the corner for today’s read.
            </p>
          </div>
          <p className="chip mb-1">
            <i />
            {asOf} · {mounted ? desk.source : "Waiting"}
          </p>
        </div>
      </header>

      <BriefBubble hottest={hottest} pulseState={pulse.state} delta={delta} namedFaults={namedFaults} tape={tape} pins={pinned} live={mounted && desk.source === "Exchange"} />

      {!desk.ready && <p className="mb-4 text-sm text-muted">Reading this tape.</p>}
      {desk.error && <p className="mb-4 text-sm text-muted">This tape did not answer. The crypto book is still there.</p>}

      {mounted ? (
        <WorldMap crypto={onStocks ? [] : desk.assets} stocks={onStocks ? desk.assets : []} watchIds={pinned.map((asset) => asset.id)} />
      ) : (
        <div className="mt-10 h-80 rounded-[1.6rem] bg-[#d9e3ef]" />
      )}

      {pinned.length > 0 && (
        <section id="list" className="mt-6">
          <p className="text-[11px] font-medium tracking-[0.14em] text-blue uppercase">Pinned</p>
          <ul className="mt-2 flex gap-2 overflow-x-auto">
            {pinned.map((n) => (
              <li key={n.id} className="min-w-[11rem] flex-1">
                <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "overview" }} className="card card-hover block px-3 py-2">
                  <Ticker symbol={n.symbol} name={n.name} />
                  <p className="mt-1.5 text-sm text-ink">
                    <span className={`num font-medium ${n.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(n.change1)}</span>
                    <span className="text-muted"> today</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <p className="text-[11px] font-medium tracking-[0.14em] text-blue uppercase">Read this first</p>
        <h2 className="mt-1 text-2xl">What's interesting right now?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {hottest && (
            <Link to="/sectors/$slug" params={{ slug: hottest.id }} className="card card-hover block p-2.5 sm:p-4">
              <p className="text-sm font-medium leading-snug">{hottest.name} is {hottest.heating === "up" ? "heating up" : "leading"}</p>
              <p className="mt-1 line-clamp-3 text-xs text-muted sm:text-sm">
                {(() => {
                  const lead = [...hottest.assets].sort((a, b) => Math.abs(b.change1) - Math.abs(a.change1))[0];
                  const today = hottest.assets.reduce((sum, asset) => sum + asset.change1, 0) / Math.max(1, hottest.assets.length);
                  return lead ? compareCopy(lead.name, lead.change1, hottest.name, today) : `Rotation ${Math.round(hottest.rotation)}.`;
                })()}
              </p>
            </Link>
          )}
          <Link to="/dna" className="card card-hover block p-2.5 sm:p-4">
            <p className="text-sm font-medium leading-snug">{odd.length} assets are off their usual pattern</p>
            <p className="mt-1 line-clamp-3 text-xs text-muted sm:text-sm">Unlike each asset's own history. Not a verdict.</p>
          </Link>
          <a href="#cracks" className="card card-hover block p-2.5 sm:p-4">
            <p className="text-sm font-medium leading-snug">
              {cracks.length === 1
                ? "1 asset looks strong while structure weakens"
                : cracks.length
                  ? `${cracks.length} assets look strong while structure weakens`
                  : "No hidden cracks clear the bar"}
            </p>
            <p className="mt-1 line-clamp-3 text-xs text-muted sm:text-sm">Price is not the whole story</p>
          </a>
        </div>
      </section>

      <section id="pulse" className="mt-6 grid grid-cols-1 gap-2 sm:mt-10 lg:grid-cols-5 lg:gap-4">
        <article className="overflow-hidden rounded-2xl border border-[#d5e2f8] bg-gradient-to-b from-white to-[#eef3fc] p-2.5 shadow-[0_16px_40px_rgba(31,79,216,0.06)] sm:p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight sm:text-xl">Market pulse</h2>
            </div>
            <p className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-3 sm:py-1 sm:text-sm ${pulse.state === "Heating" ? "bg-[#e7f6ee] text-pos" : pulse.state === "Cooling" ? "bg-[#fdecec] text-neg" : "bg-blue-soft text-blue"}`}>
              {pulse.state}
            </p>
          </div>
          <p className="mt-3 hidden text-sm text-muted sm:block">Breadth, volume, volatility and rotation. Not a forecast.</p>
          <ul className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-4">
            {bars.map((row) => (
              <li key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-1 text-[10px] sm:mb-1.5 sm:text-sm">
                  <span className="truncate text-ink">{row.label}</span>
                  <span className="num shrink-0 font-semibold" style={{ color: row.color }}>{row.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full sm:h-2.5" style={{ background: row.track }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, row.value))}%`, background: row.color }} />
                </div>
              </li>
            ))}
          </ul>
        </article>
        <article className="overflow-hidden rounded-2xl border border-[#d7dee8] bg-white shadow-[0_16px_40px_rgba(18,26,39,0.05)] lg:col-span-3">
          <div className="flex items-start justify-between gap-1 border-b border-line bg-[#f7f9fc] px-2.5 py-2 sm:items-center sm:px-4 sm:py-3">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold sm:text-sm">Sector flow</h2>
              <p className="hidden text-xs text-muted sm:block">Highest rotation first. Attention, not fund flow.</p>
            </div>
            <Link to="/sectors" className="shrink-0 text-[11px] font-medium text-blue sm:text-sm">All<span className="hidden sm:inline"> sectors</span></Link>
          </div>
          <ul>
            {flow.slice(0, 6).map((s, i) => {
              const up = s.heating === "up";
              const down = s.heating === "down";
              const color = up ? "#067647" : down ? "#b42318" : "#1f4fd8";
              const wash = up ? "#f3faf6" : down ? "#fdf6f5" : "#f5f8fd";
              return (
                <li key={s.id} className="border-b border-line last:border-0">
                  <Link to="/sectors/$slug" params={{ slug: s.id }} className="flex items-center gap-1.5 px-2 py-1.5 transition hover:bg-[#f8fafc] sm:gap-3 sm:px-4 sm:py-3">
                    <span className="num grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold sm:size-6 sm:text-[11px]" style={{ background: wash, color }}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-ink sm:text-sm">{s.name}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[#eef2f6] sm:mt-1.5 sm:h-1.5">
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, s.rotation))}%`, background: color }} />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-xs font-semibold sm:text-sm" style={{ color }}>{Math.round(s.rotation)}</span>
                      <span className="hidden text-[10px] text-muted sm:block">{up ? "Heating" : down ? "Cooling" : "Steady"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.14em] text-blue uppercase">Contradictions</p>
            <h2 className="mt-1 text-2xl">Active faults</h2>
          </div>
          <Link to="/faults" className="text-sm font-medium text-blue">View all</Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          {topFaults.map((n) => (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "faults" }} className="block rounded-2xl border border-[#f0d3c4] bg-[#fff8f4] p-2.5 shadow-[0_10px_30px_rgba(181,71,8,0.05)] sm:p-4">
                <Ticker symbol={n.symbol} name={n.name} />
                <p className="mt-3 text-sm text-ink">Magnitude {(n.faultMag ?? 0).toFixed(1)} / 10</p>
                <p className="mt-1 text-sm text-muted">{n.faultText || "Signals disagree."}</p>
              </Link>
            </li>
          ))}
          {topFaults.length === 0 && <li className="text-sm text-muted">No fault clears the line.</li>}
        </ul>
      </section>

      <section id="cracks" className="mt-10 grid gap-3 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[#d7dee8] bg-white">
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

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#d5e2f8] bg-gradient-to-b from-[#f7faff] to-white shadow-[0_16px_40px_rgba(31,79,216,0.05)] sm:mt-10">
        <div className="flex items-center justify-between gap-2 border-b border-[#e4ecf8] px-3 py-2.5 sm:items-end sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.12em] text-blue uppercase sm:text-[11px]">Quiet</p>
            <h2 className="mt-0.5 text-base leading-tight sm:mt-1 sm:text-2xl">Quiet on the surface</h2>
            <p className="mt-1 hidden text-sm text-muted sm:block">The price barely moved. Health is still intact.</p>
          </div>
          <p className="num shrink-0 rounded-full bg-[#e7eefb] px-2 py-0.5 text-xs font-semibold text-blue sm:px-3 sm:py-1 sm:text-sm">{quiet.length}</p>
        </div>
        {quiet.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted sm:px-5 sm:py-6">Nothing is this still right now.</p>
        ) : (
          <ul className="grid grid-cols-3">
            {quiet.slice(0, 3).map((n) => (
              <li key={n.id} className="border-l border-[#e4ecf8] first:border-l-0">
                <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "overview" }} className="block px-2 py-2 transition hover:bg-[#f3f7fd] sm:px-5 sm:py-4">
                  <span className="flex items-center gap-1.5">
                    <Token symbol={n.symbol} size={16} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold sm:text-sm">{n.symbol}</span>
                      <span className="mt-0.5 hidden truncate text-xs text-muted sm:block">{n.name}</span>
                    </span>
                  </span>
                  <p className="mt-1.5 text-[11px] text-ink sm:mt-3 sm:text-sm">
                    <span className={`num font-semibold ${n.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(n.change1)}</span>
                  </p>
                  <p className="text-[10px] text-muted sm:text-sm sm:text-ink">Health {n.health ?? "n/a"}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function BriefBubble({
  hottest,
  pulseState,
  delta,
  namedFaults,
  tape,
  pins,
  live,
}: {
  hottest: { name: string; rotation: number; assets: { id: number; name: string; change1: number }[] } | undefined;
  pulseState: string;
  delta: ReturnType<typeof sinceYesterday>;
  namedFaults: { id: number; symbol: string }[];
  tape: { id: number; symbol: string; name: string; price: number; change1: number }[];
  pins: { id: number; symbol: string; name: string; price: number; change1: number; faultMag: number | null; faultText: string | null; dna: number | null }[];
  live: boolean;
}) {
  const [open, setOpen] = useState(false);
  const alerts = pins.filter((row) => (row.faultMag ?? 0) >= 5 || (row.dna ?? 0) >= 55);
  const lead = hottest ? [...hottest.assets].sort((a, b) => Math.abs(b.change1) - Math.abs(a.change1))[0] : undefined;
  const today = hottest && hottest.assets.length ? hottest.assets.reduce((sum, asset) => sum + asset.change1, 0) / hottest.assets.length : 0;
  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-40 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_18px_50px_rgba(18,26,39,0.18)] md:bottom-24">
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                <span className={`inline-block size-1.5 rounded-full ${live ? "bg-pos" : "bg-warn"}`} />
                Briefing
              </p>
              <p className="mt-1 text-base font-semibold leading-snug">
                {alerts.length
                  ? `${alerts.length === 1 ? alerts[0].symbol : `${alerts.length} names`} need a look.`
                  : hottest
                    ? `${pulseState}. ${hottest.name} leads.`
                    : pulseState}
              </p>
            </div>
            <button type="button" className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="max-h-[min(24rem,58dvh)] overflow-auto px-4 py-3">
            <p className="text-sm leading-relaxed text-muted">
              {alerts.length
                ? "These are the names you asked to be told about. A fault is open, or the day is unlike their own pattern."
                : pins.length
                  ? "Nothing on your list is breaking its pattern. The tape below is the rest of the market."
                  : hottest
                    ? `${pulseState === "Cooling" ? "Fewer than 40% of tracked names are up." : pulseState === "Heating" ? "At least 55% of tracked names are up." : "The share of names that are up sits in the middle."} ${lead ? compareCopy(lead.name, lead.change1, hottest.name, today) : ""}`
                    : "The tape has not answered yet."}
            </p>
            {alerts.length > 0 && (
              <ul className="mt-3 divide-y divide-line rounded-2xl bg-bg">
                {alerts.map((row) => (
                  <li key={row.id}>
                    <Link to="/asset/$id" params={{ id: String(row.id) }} search={{ tab: (row.faultMag ?? 0) >= 5 ? "faults" : "dna" }} className="flex items-center gap-2 px-3 py-2" onClick={() => setOpen(false)}>
                      <Token symbol={row.symbol} size={18} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{row.symbol}</span>
                        <span className="block truncate text-[11px] text-muted">{(row.faultMag ?? 0) >= 5 ? row.faultText || "A fault is open." : "Off its own pattern."}</span>
                      </span>
                      <span className={`num ml-auto text-xs font-semibold ${row.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(row.change1)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] font-medium tracking-wide text-muted uppercase">{pins.length && !alerts.length ? "Your list" : hottest ? `Leading ${hottest.name}` : "Leading names"}</p>
            <ul className="mt-1 divide-y divide-line rounded-2xl bg-bg">
              {(pins.length && !alerts.length ? pins : tape).slice(0, 3).map((row) => (
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
        aria-label="Briefing"
        className="fixed right-4 bottom-24 z-40 grid size-16 place-items-center rounded-full bg-ink text-white shadow-[0_12px_28px_rgba(18,26,39,0.28)] md:bottom-6"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-ink ${live ? "bg-pos" : alerts.length ? "bg-warn" : "bg-pos"}`} />
        <span className="px-1 text-center text-[9px] font-semibold leading-tight tracking-wide">Briefing</span>
      </button>
    </>
  );
}
