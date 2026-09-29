import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Token, useMarketEdition } from "@/components/fl/shell";
import { CandleChart } from "@/components/fl/charts";
import { formatPct, formatUsd, faultBand, healthState } from "@/lib/faultline/format";
import { assetDetail } from "@/lib/faultline/detail";
import { loadCandles, type Candle } from "@/lib/faultline/candles.functions";
import { asOf, assetById, faultLabel, SECTORS } from "@/lib/faultline/view";
import { toggleWatch, useWatch } from "@/lib/faultline/watch";

const candleCache = new Map<string, Candle[]>();

function fromSeries(series: { d: string; p: number; v: number }[], live: number): Candle[] {
  const rows = series.filter((row) => row.p > 0);
  if (rows.length < 2) return [];
  const last = rows[rows.length - 1].p;
  const scale = live > 0 ? live / last : 1;
  return rows.map((row, i) => {
    const close = row.p * scale;
    const open = (i ? rows[i - 1].p : row.p) * scale;
    const wick = Math.max(Math.abs(close - open) * 0.35, close * 0.0015);
    return {
      d: row.d,
      o: open,
      h: Math.max(open, close) + wick,
      l: Math.max(0, Math.min(open, close) - wick),
      c: close,
      v: row.v,
    };
  });
}
const TABS = ["overview", "dna", "health", "faults", "history", "evidence"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/asset/$id")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : "overview",
  }),
  component: AssetPage,
});

function spanReturn(rows: Candle[], days: number) {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1]?.c;
  const prev = rows[Math.max(0, rows.length - 1 - days)]?.c;
  if (!(last > 0) || !(prev > 0)) return null;
  return (last - prev) / prev;
}

function AssetPage() {
  useMarketEdition();
  const pinned = useWatch();
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const node = assetById(Number(id));
  const [live, setLive] = useState<Candle[] | null>(null);
  useEffect(() => {
    if (!node) return;
    let cancel = false;
    const load = () => {
      loadCandles({ data: node.symbol })
        .then((rows) => {
          if (cancel) return;
          if (rows.length) candleCache.set(node.symbol, rows);
          setLive(rows);
        })
        .catch(() => {
          if (!cancel) setLive(candleCache.get(node.symbol) ?? []);
        });
    };
    const cached = candleCache.get(node.symbol);
    if (cached) setLive(cached);
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [node?.symbol]);
  const fallback = useMemo(
    () => (node ? fromSeries(assetDetail(node.id).series, node.price) : []),
    [node?.id, node?.price, node?.symbol],
  );
  const candles = useMemo(() => {
    const rows = live && live.length ? live : fallback;
    const price = node?.price ?? 0;
    if (!rows.length || !(price > 0)) return rows;
    const next = rows.slice();
    const last = { ...next[next.length - 1] };
    last.c = price;
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
    next[next.length - 1] = last;
    return next;
  }, [live, fallback, node?.price]);
  if (!node) {
    return (
      <>
        <p>That asset is not tracked.</p>
        <Link to="/app" className="text-blue">Back</Link>
      </>
    );
  }
  const detail = assetDetail(node.id);
  const liveBook = Boolean(live && live.length);
  const sector = SECTORS.find((s) => s.assetIds.includes(node.id));
  const move7 = spanReturn(candles, 7);
  const onList = pinned.includes(node.id);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Token symbol={node.symbol} size={36} />
          <div>
            <p className="text-sm font-semibold leading-none">{node.symbol}</p>
            <h1 className="mt-1 text-3xl font-semibold">{node.name}</h1>
            <p className="mt-1 text-2xl font-semibold">{formatUsd(node.price)}</p>
            <p className={node.change1 >= 0 ? "text-pos" : "text-neg"}>{formatPct(node.change1)} today</p>
            <button type="button" className="btn-ghost mt-2 h-8 px-3 text-xs" onClick={() => toggleWatch(node.id)}>
              {onList ? "Pinned to brief" : "Pin to brief"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Score label="Health" value={node.health == null ? "n/a" : String(node.health)} />
          <Score label="DNA" value={node.dna == null ? "n/a" : String(Math.round(node.dna))} />
          <Score label="Faults" value={(node.faultMag ?? 0) >= 5 ? "1" : "0"} />
          <Score label="Rotation" value={node.rotation == null ? "n/a" : String(Math.round(node.rotation))} />
        </div>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <Link
            key={item}
            to="/asset/$id"
            params={{ id }}
            search={{ tab: item }}
            className={`h-8 shrink-0 rounded-full px-3 text-xs capitalize leading-8 ${tab === item ? "bg-ink text-white" : "border border-line bg-surface text-muted"}`}
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-5">
            <article className="card p-4 lg:col-span-3">
              <h2 className="font-semibold">Price</h2>
              <p className="text-xs text-muted">
                {liveBook ? "Hourly candles. The last bar follows the live price." : candles.length ? "Estimated from the daily book" : "Loading candles"}
              </p>
              <CandleChart data={candles} />
            </article>
            <article className="card p-4 lg:col-span-2">
              <h2 className="font-semibold">Market</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Market cap" v={formatUsd(node.mcap)} />
                <Row k="Volume" v={formatUsd(node.volume)} />
                <Row k="7D" v={move7 == null ? formatPct(node.change7) : formatPct(move7)} />
                <Row k="Sector" v={sector ? sector.name : node.category} />
              </dl>
              {sector && move7 != null && (
                <p className="mt-4 text-sm">
                  {node.symbol} is {formatPct(move7)} over these candles. {sector.name} is {formatPct(sector.ret7)} on today's edition.
                </p>
              )}
              <h3 className="mt-5 font-semibold">Behaves like</h3>
              <ul className="mt-2 space-y-2">
                {node.neighbors.map((nb) => (
                  <li key={nb.id}>
                    <Link to="/asset/$id" params={{ id: String(nb.id) }} search={{ tab: "overview" }} className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <Token symbol={nb.symbol} size={22} />
                        <span className="font-medium">{nb.symbol}</span>
                      </span>
                      <span className="text-sm text-muted">{nb.score} similarity</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        )}
        {tab === "dna" && <DnaPanel node={node} />}
        {tab === "health" && <HealthPanel node={node} />}
        {tab === "faults" && <FaultPanel node={node} sector={sector?.name} />}
        {tab === "history" && <HistoryPanel symbol={node.symbol} events={detail.history} />}
        {tab === "evidence" && <EvidencePanel node={node} />}
      </div>
    </>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <article className="card px-3 py-2">
      <p className="text-[10px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="num mt-0.5 text-lg font-semibold">{value}</p>
    </article>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function DnaPanel({ node }: { node: NonNullable<ReturnType<typeof assetById>> }) {
  const score = node.dna;
  const lead =
    score == null
      ? `${node.symbol} does not have enough of its own history to score a deviation.`
      : score >= 70
        ? `${node.symbol} is far from the pattern it usually keeps. ${Math.round(score)} means several habits are outside that range. It is a description of behavior, not a verdict.`
        : score >= 40
          ? `${node.symbol} has shifted from its own pattern. ${Math.round(score)} is a real change in how it is trading, not a new identity.`
          : `${node.symbol} is still close to its own pattern. ${Math.round(score)} sits inside the range it usually occupies.`;
  return (
    <article className="card p-5">
      <h2 className="text-xl font-semibold">Behavioral DNA</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">{lead}</p>
      <ul className="mt-5 space-y-4">
        {node.lines.map((line) => {
          const side = line.sigma > 0.5 ? "higher than" : line.sigma < -0.5 ? "lower than" : "close to";
          const size = Math.abs(line.sigma) >= 2 ? "That is a large gap for this asset." : Math.abs(line.sigma) >= 1 ? "That is a noticeable gap." : "That is a small gap.";
          return (
            <li key={line.metric} className="border-t border-line pt-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{line.metric}</span>
                <span className="num text-sm font-semibold">{line.sigma > 0 ? "+" : ""}{line.sigma.toFixed(1)}σ</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {line.metric} is {side} {node.symbol}'s own history. {size}
              </p>
            </li>
          );
        })}
        {node.lines.length === 0 && <li className="text-sm text-muted">There is not enough history to break the score into separate habits.</li>}
      </ul>
      {node.neighbors.length > 0 && (
        <>
          <h3 className="mt-6 font-semibold">Who shares this behavior</h3>
          <ul className="mt-3 space-y-3">
            {node.neighbors.map((nb) => (
              <li key={nb.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2">
                  <Token symbol={nb.symbol} size={22} />
                  <span className="font-medium">{nb.symbol}</span>
                </span>
                <span className="text-right text-muted">{nb.score} similar. A match of behavior, not a pair trade.</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function HealthPanel({ node }: { node: NonNullable<ReturnType<typeof assetById>> }) {
  const band = node.health == null ? null : healthState(node.health);
  const prior = node.healthPrev == null ? null : healthState(node.healthPrev);
  const shift =
    node.health == null
      ? `${node.symbol} does not have enough structure to score.`
      : prior && prior !== band
        ? `Health is ${node.health}, ${band}. Yesterday's edition was ${node.healthPrev}, ${prior}. The band changed. The score is smoothed, so one session did not rewrite it.`
        : `Health is ${node.health}, ${band}. It is in the same band as the previous edition${node.healthPrev == null ? "" : ` (${node.healthPrev})`}. One day is not enough to move the band.`;
  const parts = [
    ["Liquidity", node.parts.liquidity, "how easily size can trade without the price jumping"],
    ["Volume", node.parts.volume, "whether trading activity is holding up against its own recent level"],
    ["Relative strength", node.parts.relativeStrength, "whether it is keeping up with Bitcoin"],
    ["Recovery", node.parts.recovery, "whether it is repairing after a drawdown"],
    ["Volatility stability", node.parts.volatilityStability, "whether the size of daily moves is staying orderly"],
    ["Participation", node.parts.participation, "whether the move has breadth behind it, not just price"],
  ] as const;
  return (
    <article className="card p-5">
      <h2 className="text-xl font-semibold">Structural health</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">{shift}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {parts.map(([label, value, meaning]) => (
          <li key={label} className="rounded-xl bg-bg px-3 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{label}</span>
              <span className="num">{value == null ? "n/a" : value}</span>
            </div>
            <p className="mt-1 text-muted">
              {value == null
                ? `${label} is not in this edition. ${meaning[0].toUpperCase()}${meaning.slice(1)}.`
                : `${value >= 70 ? "Firm." : value >= 45 ? "Middling." : "Weak."} This is ${meaning}.`}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FaultPanel({ node, sector }: { node: NonNullable<ReturnType<typeof assetById>>; sector?: string }) {
  const mag = node.faultMag ?? 0;
  const active = mag >= 5 && node.faultType;
  const kind =
    node.faultType === "PRICE_VOLUME_DIVERGENCE"
      ? "Price and participation are moving apart. The price can look strong while fewer participants are behind it, or the reverse."
      : node.faultType === "ASSET_DOWN_CATEGORY_UP"
        ? `${node.symbol} is lagging ${sector ?? "its sector"}. The group is firm and this name is not.`
        : "No named contradiction is active.";
  return (
    <article className="card p-5">
      <h2 className="text-xl font-semibold">{active ? faultLabel(node.faultType) : "No active fault"}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed">
        {active
          ? `${kind} ${node.faultText ?? ""} Magnitude is ${mag.toFixed(1)} out of 10, which this edition calls ${faultBand(mag).toLowerCase()}. A fault is a disagreement between signals. It is not a forecast and not a verdict.`
          : `${node.symbol} does not clear the fault line. Magnitude is ${mag.toFixed(1)} out of 10. The signals that usually define a contradiction are still close enough to agree.`}
      </p>
    </article>
  );
}

function HistoryPanel({ symbol, events }: { symbol: string; events: { date: string; text: string }[] }) {
  return (
    <ul className="space-y-2">
      {events.map((ev) => (
        <li key={ev.date + ev.text} className="card p-4 text-sm">
          <p className="text-xs text-muted">{ev.date}</p>
          <p className="mt-1 font-medium">{ev.text}</p>
          <p className="mt-1 text-muted">{historyNote(symbol, ev.text)}</p>
        </li>
      ))}
      {events.length === 0 && <li className="text-sm text-muted">Nothing in this window crossed a line worth recording.</li>}
    </ul>
  );
}

function historyNote(symbol: string, text: string) {
  if (text.includes("no longer clears")) return `The earlier contradiction on ${symbol} closed. This is the day it stopped qualifying, not a new alarm.`;
  if (text.includes("recovered")) return `Health moved back into a calmer band. Because the score is smoothed, this records a band change, not a one-day spike.`;
  if (text.includes("category")) return `${symbol} and its sector stopped moving together. The note is about direction versus the group, not about the size of the move.`;
  if (text.includes("participation") || text.includes("volume")) return `Price and participation diverged. The history keeps the day that gap became large enough to name.`;
  return `Recorded because ${symbol} crossed a line on this edition that the day before had not.`;
}

function EvidencePanel({ node }: { node: NonNullable<ReturnType<typeof assetById>> }) {
  const quality =
    node.evidence === "High"
      ? "The inputs behind these scores are complete enough to read."
      : node.evidence === "Medium"
        ? "Some inputs are thin. Read the scores, and do not lean on a single line."
        : "The record is thin. Treat the scores as incomplete.";
  return (
    <article className="card p-5 text-sm">
      <h2 className="text-lg font-semibold">Evidence</h2>
      <p className="mt-2 max-w-2xl leading-relaxed">
        As of {asOf}, refreshed at 00:00 UTC. Evidence quality is {node.evidence || "unrated"}. {quality} Each line below is this edition's reading against the asset's own baseline.
      </p>
      <ul className="mt-4 space-y-4">
        {node.factors.map((f) => (
          <li key={f.metric} className="border-t border-line pt-3">
            <p className="font-medium">{f.metric}</p>
            <p className="mt-1 text-muted">
              {f.value == null
                ? "This input was not measured."
                : `The reading is ${formatPct(f.value)}. The baseline is ${f.baseline == null ? "not set" : formatPct(f.baseline)}. The gap between them is ${f.deviation == null ? "not set" : formatPct(f.deviation)}.`}
            </p>
          </li>
        ))}
        {node.lines.map((line) => (
          <li key={`line-${line.metric}`} className="border-t border-line pt-3">
            <p className="font-medium">{line.metric}</p>
            <p className="mt-1 text-muted">
              Against {node.symbol}'s own history this sits {line.sigma > 0 ? "+" : ""}
              {line.sigma.toFixed(1)} standard deviations {line.sigma >= 0 ? "above" : "below"} the usual level.
            </p>
          </li>
        ))}
        {node.factors.length === 0 && node.lines.length === 0 && <li className="text-muted">No factor breakdown was stored for this asset.</li>}
      </ul>
    </article>
  );
}
