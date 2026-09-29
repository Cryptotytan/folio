import { Link } from "@tanstack/react-router";
import {
  Activity,
  Cloud,
  Droplets,
  Info,
  Landmark,
  List,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Waypoints,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MapLayer } from "@/components/faultline/MarketCanvas";
import { MarketCanvas } from "@/components/faultline/MarketCanvas";
import { FAULT_COPY, ROTATION_WEIGHTS } from "@/lib/faultline/config";
import {
  faultBand,
  formatPct,
  formatScore,
  formatUsd,
  healthState,
  rotationArrow,
  rotationState,
} from "@/lib/faultline/format";
import {
  faultSentence,
  hiddenCracks,
  nodeById,
  quietStrength,
  timeline,
  WORLD,
  type WorldNode,
} from "@/lib/faultline/model";

export type WorldFilter = "none" | "cracks" | "quiet" | "severe";

export type WorldSearch = {
  layer: MapLayer;
  asset?: number;
  day?: number;
  filter: WorldFilter;
};

const LAST = WORLD.days - 1;

const LAYERS: { id: MapLayer; label: string; icon: typeof Activity }[] = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "faults", label: "Faults", icon: Waypoints },
  { id: "dna", label: "DNA", icon: Network },
  { id: "health", label: "Health", icon: Shield },
  { id: "leverage", label: "Leverage", icon: Cloud },
  { id: "liquidations", label: "Liquidations", icon: Droplets },
  { id: "rwa", label: "RWA", icon: Landmark },
];

type Fly = { kind: "asset" | "region" | "home" | "zoom"; id?: number | string; nonce: number };

export function WorldShell({
  search,
  onSearch,
}: {
  search: WorldSearch;
  onSearch: (patch: Partial<WorldSearch>) => void;
}) {
  const day = clampDay(search.day ?? LAST);
  const selected = search.asset != null ? nodeById(search.asset) : undefined;
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [legend, setLegend] = useState(false);
  const [sheet, setSheet] = useState<"collapsed" | "half" | "full">("half");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fly, setFly] = useState<Fly | null>(null);
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const nonce = useRef(1);
  const dayRef = useRef(day);
  dayRef.current = day;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem("faultline-onboard-v1")) setTip(0);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setLegend(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!playing || reduced) return;
    const id = window.setInterval(() => {
      const cur = dayRef.current;
      const next = cur >= LAST ? 30 : cur + 1;
      onSearch({ day: next });
      if (next >= LAST) setPlaying(false);
    }, 900 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, reduced, onSearch]);

  const market = WORLD.market[day];
  const highlight = useMemo(() => {
    if (search.filter === "cracks") return hiddenCracks(day).map((n) => n.id);
    if (search.filter === "quiet") return quietStrength(day).map((n) => n.id);
    if (search.filter === "severe") {
      return WORLD.nodes.filter((n) => (n.faultMagnitude[day] ?? 0) >= 6.5).map((n) => n.id);
    }
    return null;
  }, [search.filter, day]);

  const flyTo = (next: Fly["kind"], id?: number | string) => {
    nonce.current += 1;
    setFly({ kind: next, id, nonce: nonce.current });
  };

  useEffect(() => {
    if (search.asset == null) return;
    const node = nodeById(search.asset);
    if (!node) return;
    setOpenRegion(node.category);
    flyTo("asset", node.id);
  }, [search.asset]);

  const resetView = () => {
    setOpenRegion(null);
    onSearch({ asset: undefined });
    flyTo("home");
  };

  const openSector = (id: string | null) => {
    if (!id) {
      resetView();
      return;
    }
    setOpenRegion(id);
    onSearch({ asset: undefined });
    flyTo("region", id);
  };

  const selectAsset = (id: number | null) => {
    if (id == null) {
      onSearch({ asset: undefined });
      return;
    }
    const node = nodeById(id);
    if (node) setOpenRegion(node.category);
    onSearch({ asset: id });
    setSheet("half");
    flyTo("asset", id);
  };

  const setLayer = (layer: MapLayer) => {
    onSearch({ layer });
    if (layer === "rwa") {
      setOpenRegion("rwa");
      flyTo("region", "rwa");
    }
  };

  const tips = [
    "Each circle is a market sector. Only the sector name is shown from here.",
    "Click a circle to open it. The assets inside appear after it zooms in.",
    "Faults mark contradictions between market signals. They are not accusations.",
  ];

  return (
    <div className="relative flex w-full flex-col overflow-hidden bg-bg text-fg" style={{ height: "100vh", minHeight: "100vh" }}>
      <header className="z-20 flex shrink-0 items-start justify-between gap-3 border-b border-line bg-bg px-3 py-2 md:px-4">
        <div className="flex max-w-[70%] flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link to="/" search={{ layer: "activity", filter: "none" }} className="leading-none">
              <span className="block text-sm font-medium tracking-[0.18em]">FOLIO</span>
            </Link>
            <span className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] tracking-wide text-muted">
              DEMO SNAPSHOT
            </span>
          </div>
          <p className="hidden text-sm text-muted md:block">See the market beneath the market.</p>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Primary">
            <NavButton
              current={search.layer === "activity" && !openRegion}
              onClick={() => {
                setOpenRegion(null);
                onSearch({ layer: "activity", asset: undefined });
                flyTo("home");
              }}
            >
              World
            </NavButton>
            <NavButton current={search.layer === "faults"} onClick={() => setLayer("faults")}>
              Faults
            </NavButton>
            <NavButton current={search.layer === "dna"} onClick={() => setLayer("dna")}>
              DNA
            </NavButton>
            <NavButton current={search.layer === "health"} onClick={() => setLayer("health")}>
              Health
            </NavButton>
            <NavButton current={false} onClick={() => onSearch({ day: Math.max(30, day - 30) })}>
              History
            </NavButton>
            <NavButton current={search.layer === "rwa"} onClick={() => setLayer("rwa")}>
              RWA
            </NavButton>
            <Link
              to="/signals"
              className="inline-flex h-11 items-center px-2 text-sm text-muted hover:text-fg"
            >
              List
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden md:inline">Search</span>
          </button>
          <Link
            to="/methodology"
            className="hidden h-11 items-center px-2 text-sm text-muted hover:text-fg md:inline-flex"
          >
            Methodology
          </Link>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <MarketCanvas
          day={day}
          layer={search.layer}
          selectedId={selected?.id ?? null}
          highlight={highlight}
          fly={fly}
          reducedMotion={reduced}
          panelOpen={Boolean(selected)}
          openRegion={openRegion}
          onOpenRegion={openSector}
          onSelect={selectAsset}
        />
      <aside className="absolute top-3 right-3 z-20 hidden flex-col gap-1 md:flex">
        {LAYERS.map((layer) => {
          const Icon = layer.icon;
          const on = search.layer === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              aria-pressed={on}
              onClick={() => setLayer(layer.id)}
              className={`inline-flex h-11 items-center gap-2 rounded-full border px-3 text-sm ${
                on ? "border-fg bg-fg text-accent-fg" : "border-line bg-surface text-fg"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span>{layer.label}</span>
            </button>
          );
        })}
        <div className="mt-2 flex flex-col gap-1">
          <IconButton label="Zoom in" onClick={() => flyTo("zoom", 1.18)}>
            <Plus className="size-4" />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => flyTo("zoom", 1 / 1.18)}>
            <Minus className="size-4" />
          </IconButton>
          <IconButton label="Reset view" onClick={resetView}>
            <RotateCcw className="size-4" />
          </IconButton>
          <IconButton label="Legend" onClick={() => setLegend((v) => !v)}>
            <Info className="size-4" />
          </IconButton>
        </div>
      </aside>
      <div className="absolute right-3 bottom-3 z-20 flex gap-1 md:hidden">
        <IconButton label="Zoom in" onClick={() => flyTo("zoom", 1.18)}>
          <Plus className="size-4" />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => flyTo("zoom", 1 / 1.18)}>
          <Minus className="size-4" />
        </IconButton>
        <IconButton label="Legend" onClick={() => setLegend((v) => !v)}>
          <Info className="size-4" />
        </IconButton>
      </div>

      {(search.layer === "leverage" || search.layer === "liquidations") && (
        <div className="absolute top-3 left-3 z-20 max-w-sm rounded-lg border border-line bg-surface p-4">
          <p className="text-sm font-medium">
            {search.layer === "leverage" ? "Leverage weather" : "Liquidations"} unavailable
          </p>
          <p className="mt-1 text-sm text-muted">
            Derivatives and liquidation series are not connected. Spot-market analysis remains active.
            This is not a forecast.
          </p>
        </div>
      )}

      <section className="absolute bottom-3 left-3 z-20 max-w-xs">
        <div className="rounded-lg border border-line bg-surface/95 p-3">
          <p className="text-[11px] tracking-[0.16em] text-faint">MARKET STATE</p>
          <p className="mt-1 text-sm">
            {market.hottest ? (
              <>
                <button type="button" className="underline-offset-2 hover:underline" onClick={() => openSector(market.hottest!.id)}>
                  {market.hottest.name}
                </button>{" "}
                {rotationArrow(market.hottest.rotation >= 60 ? "up" : "flat")}
              </>
            ) : (
              "Rotation n/a"
            )}
            {market.coolest ? ` · ${market.coolest.name} cooling` : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-muted tabular-nums">
            Active faults {market.activeFaults} · Deteriorating {market.deteriorating}
          </p>
          {search.filter !== "none" && (
            <button
              type="button"
              className="mt-2 text-xs text-muted underline-offset-2 hover:underline"
              onClick={() => onSearch({ filter: "none" })}
            >
              Clear filter · {highlight?.length ?? 0} assets
            </button>
          )}
        </div>
      </section>
      </div>

      <footer className="z-20 shrink-0 border-t border-line bg-bg px-3 py-2 md:px-4">
        <div className="mb-2 flex items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-muted">
            <span className="hidden sm:inline">Time</span>
            <input
              type="range"
              min={30}
              max={LAST}
              value={day}
              onChange={(e) => {
                setPlaying(false);
                onSearch({ day: Number(e.target.value) });
              }}
              className="w-full accent-accent"
              suppressHydrationWarning
              aria-valuetext={WORLD.dates[day]}
            />
            <span className="font-mono text-fg tabular-nums">{WORLD.dates[day].slice(5)}</span>
          </label>
          <button
            type="button"
            className="h-11 rounded-full border border-line px-3 text-sm"
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? "Pause" : "Replay"}
          </button>
          <button
            type="button"
            className="hidden h-11 rounded-full border border-line px-3 font-mono text-xs md:inline"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
          >
            {speed}×
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 font-mono text-xs text-muted tabular-nums">
          <Stat label="Market cap" value={formatUsd(market.mcap)} />
          <Stat label="Volume" value={formatUsd(market.volume)} />
          <Stat label="BTC dominance" value={formatPct(market.btcDominance, 1)} />
          <Stat label="Fear & greed" value="n/a" />
          <Stat label="Altcoin season" value="n/a" />
          <Stat label="Liquidations" value="n/a" />
          <Stat label="Active faults" value={String(market.activeFaults)} />
          <span className="whitespace-nowrap text-faint">Updated as of {WORLD.asOf} · demo</span>
        </div>
      </footer>

      {selected && (
        <AssetPanel
          node={selected}
          day={day}
          sheet={sheet}
          setSheet={setSheet}
          onClose={() => onSearch({ asset: undefined })}
          onLayer={setLayer}
        />
      )}

      {legend && (
        <div className="absolute bottom-28 left-3 z-30 w-[min(22rem,calc(100%-1.5rem))] rounded-lg border border-line bg-surface p-4 md:bottom-24">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">How to read the world</h2>
            <button type="button" aria-label="Close legend" onClick={() => setLegend(false)} className="size-11">
              <X className="size-4" />
            </button>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>Each circle is one sector. Names are the only labels until you open it.</li>
            <li>Click a circle to zoom in. Assets inside that sector appear after the zoom.</li>
            <li>City size, once you are inside, is market cap.</li>
            <li>A fault ring means contradictory signals. It is not an accusation.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-1">
            {WORLD.regions.map((r) => (
              <button
                key={r.id}
                type="button"
                className="h-9 rounded-full border border-line px-3 text-xs"
                onClick={() => {
                  openSector(r.id);
                  setLegend(false);
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
          <Link to="/signals" className="mt-3 inline-flex items-center gap-2 text-sm text-fg">
            <List className="size-4" aria-hidden /> View as list
          </Link>
        </div>
      )}

      {searchOpen && (
        <SearchDialog
          query={query}
          setQuery={setQuery}
          day={day}
          onClose={() => setSearchOpen(false)}
          onPickAsset={(id) => {
            setSearchOpen(false);
            selectAsset(id);
          }}
          onFilter={(filter) => {
            setSearchOpen(false);
            onSearch({ filter });
          }}
          onRegion={(id) => {
            setSearchOpen(false);
            openSector(id);
          }}
        />
      )}

      {tip != null && (
        <div className="absolute bottom-36 left-1/2 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-line bg-surface p-4">
          <p className="text-sm">{tips[tip]}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="h-11 rounded-full bg-fg px-4 text-sm text-accent-fg"
              onClick={() => {
                if (tip >= tips.length - 1) {
                  setTip(null);
                  try {
                    localStorage.setItem("faultline-onboard-v1", "1");
                  } catch {
                    /* ignore */
                  }
                } else setTip(tip + 1);
              }}
            >
              {tip >= tips.length - 1 ? "Explore" : "Next"}
            </button>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {market.hottest ? `${market.hottest.name} is the hottest region.` : ""} {market.activeFaults} active faults.
        As of {WORLD.asOf}. Refreshed daily at 00:00 UTC.
      </p>
    </div>
  );
}

function clampDay(day: number) {
  if (!Number.isFinite(day)) return LAST;
  return Math.max(30, Math.min(LAST, Math.round(day)));
}

function NavButton({
  children,
  current,
  onClick,
}: {
  children: string;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={`h-11 shrink-0 px-2 text-sm ${current ? "text-fg" : "text-muted"}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-faint">{label} </span>
      <span className="text-fg">{value}</span>
    </span>
  );
}

function AssetPanel({
  node,
  day,
  sheet,
  setSheet,
  onClose,
  onLayer,
}: {
  node: WorldNode;
  day: number;
  sheet: "collapsed" | "half" | "full";
  setSheet: (s: "collapsed" | "half" | "full") => void;
  onClose: () => void;
  onLayer: (layer: MapLayer) => void;
}) {
  const ret1 = node.price[day] / node.price[day - 1] - 1;
  const ret7 = node.price[day] / node.price[Math.max(0, day - 7)] - 1;
  const health = node.health[day];
  const health7 = day >= 7 ? node.health[day - 7] : null;
  const rot = node.rotation[day];
  const fault = node.faultType[day];
  const mag = node.faultMagnitude[day];
  const events = timeline(node, day);
  const h = sheet === "collapsed" ? "h-24" : sheet === "half" ? "h-[48vh]" : "h-[86vh]";

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.14em] text-faint">{node.category.toUpperCase()}</p>
          <h2 className="text-xl font-medium">
            {node.symbol} <span className="text-muted">{node.name}</span>
          </h2>
          <p className="font-mono text-sm tabular-nums">
            {formatUsd(node.price[day])} <span className={ret1 >= 0 ? "text-health" : "text-fault"}>{formatPct(ret1)}</span>
          </p>
        </div>
        <button type="button" aria-label="Close asset" onClick={onClose} className="inline-flex size-11 items-center justify-center">
          <X className="size-4" />
        </button>
      </div>
      <div className={`mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${sheet === "collapsed" ? "hidden md:block" : ""}`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs tabular-nums">
          <Pair k="Market cap" v={formatUsd(node.mcap[day])} />
          <Pair k="Volume" v={formatUsd(node.volume[day])} />
          <Pair k="7D" v={formatPct(ret7)} />
          <Pair k="CMC id" v={String(node.id)} />
        </dl>
        <Block title="Rotation">
          <p className="font-mono text-sm tabular-nums">
            {rot == null ? "n/a" : `${rot.toFixed(0)} / 100`} {rot != null ? rotationState(rot) : ""}{" "}
            {rotationArrow(node.rotationDir[day])}
          </p>
          <p className="mt-1 text-xs text-muted">Activity rotation. Not a measure of money flow. Weights are fixed in configuration.</p>
        </Block>
        <Block title="Fault">
          {fault && mag != null ? (
            <>
              <p className="font-mono text-sm tabular-nums">
                Magnitude {mag.toFixed(1)} / 10 · {faultBand(mag)}
              </p>
              <p className="mt-1 text-sm">{faultSentence(fault)}</p>
              <p className="mt-1 text-xs text-faint">Folio visual scale. Not a geological magnitude or a prediction.</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
                {node.factors[day].map((f) => (
                  <li key={f.metric}>
                    {f.metric}: {f.value == null ? "n/a" : f.value.toFixed(3)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">No contradiction currently clears the threshold.</p>
          )}
        </Block>
        <Block title="Structural health">
          <p className="font-mono text-sm tabular-nums">
            {health == null ? "n/a" : `${health.toFixed(0)} · ${healthState(health)}`}
            {health != null && health7 != null ? ` · ${health7.toFixed(0)} → ${health.toFixed(0)}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">Higher means healthier structure in this model. It is not a fraud score.</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <Comp label="Liquidity proxy" value={node.components.liquidity[day]} />
            <Comp label="Volume" value={node.components.volume[day]} />
            <Comp label="Market diversity" value={null} />
            <Comp label="Relative strength" value={node.components.relativeStrength[day]} />
            <Comp label="Recovery" value={node.components.recovery[day]} />
            <Comp label="Volatility stability" value={node.components.volatilityStability[day]} />
            <Comp label="Participation" value={node.components.participation[day]} />
            <Comp label="Market-cap stability" value={node.components.marketCapStability[day]} />
          </ul>
        </Block>
        <Block title="DNA deviation">
          <p className="font-mono text-sm tabular-nums">
            {node.dnaDeviation[day] == null ? "n/a" : `${node.dnaDeviation[day]!.toFixed(0)} / 100`}
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
            {node.deviationLines[day].map((line) => (
              <li key={line.metric}>
                {line.metric} {line.sigma >= 0 ? "+" : ""}
                {line.sigma.toFixed(1)}σ
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-faint">Evidence {node.evidence[day]}. Compared with this asset's own longer window.</p>
        </Block>
        <Block title="Behavioral neighbors">
          <ul className="space-y-1 text-sm">
            {node.neighbors.map((nb) => (
              <li key={nb.id} className="flex justify-between font-mono tabular-nums">
                <span>{nb.symbol}</span>
                <span className="text-muted">{nb.score}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-faint">Similarity, not a ranking.</p>
        </Block>
        <Block title="Fault timeline">
          {events.length === 0 ? (
            <p className="text-sm text-muted">No threshold crossings in the visible window.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {events.map((ev, i) => (
                <li key={`${ev.date}-${i}`}>
                  <span className="font-mono text-xs text-faint">{ev.date}</span>
                  <p>{ev.text}</p>
                </li>
              ))}
            </ol>
          )}
        </Block>
        <p className="text-xs text-faint">
          Source as of the daily refresh. Rotation weights example: relative performance{" "}
          {Math.round(ROTATION_WEIGHTS.relativePerformance * 100)}%. {fault ? FAULT_COPY[fault] : ""}
        </p>
        <div className="flex flex-wrap gap-2 pb-2">
          <button type="button" className="h-11 rounded-full border border-line px-3 text-sm" onClick={() => onLayer("dna")}>
            View DNA
          </button>
          <button type="button" className="h-11 rounded-full border border-line px-3 text-sm" onClick={() => onLayer("health")}>
            View Health
          </button>
          <Link
            to="/investigate/$assetId"
            params={{ assetId: String(node.id) }}
            className="inline-flex h-11 items-center rounded-full bg-fg px-4 text-sm text-accent-fg"
          >
            Investigate
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="pointer-events-auto absolute top-0 right-0 z-40 hidden h-full w-96 border-l border-line bg-surface p-4 md:block">
        {body}
      </aside>
      <div className={`pointer-events-auto absolute inset-x-0 bottom-16 z-40 border-t border-line bg-surface p-4 md:hidden ${h}`}>
        <button type="button" className="mb-2 h-11 w-full text-xs tracking-wide text-muted" onClick={() => setSheet(sheet === "full" ? "collapsed" : sheet === "collapsed" ? "half" : "full")}>
          {node.symbol} · {formatUsd(node.price[day])} · Health {formatScore(health)} · tap to {sheet === "full" ? "collapse" : "expand"}
        </button>
        {body}
      </div>
    </>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-faint">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-xs tracking-[0.14em] text-faint">{title.toUpperCase()}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Comp({ label, value }: { label: string; value: number | null }) {
  return (
    <li className="flex justify-between gap-3">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value == null ? "Unavailable" : value.toFixed(0)}</span>
    </li>
  );
}

function SearchDialog({
  query,
  setQuery,
  day,
  onClose,
  onPickAsset,
  onFilter,
  onRegion,
}: {
  query: string;
  setQuery: (q: string) => void;
  day: number;
  onClose: () => void;
  onPickAsset: (id: number) => void;
  onFilter: (f: WorldFilter) => void;
  onRegion: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const assets = WORLD.nodes
    .filter((n) => !q || n.symbol.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
    .slice(0, 8);
  const commands: { label: string; run: () => void }[] = [
    { label: "Show hidden cracks", run: () => onFilter("cracks") },
    { label: "Show quiet strength", run: () => onFilter("quiet") },
    { label: "Show major faults", run: () => onFilter("severe") },
    ...WORLD.regions
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .map((r) => ({ label: `Go to ${r.name}`, run: () => onRegion(r.id) })),
  ].filter((c) => !q || c.label.toLowerCase().includes(q));

  return (
    <div className="absolute inset-0 z-40 bg-bg/70 p-4" role="dialog" aria-label="Search the market world">
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SOL, AI, hidden cracks"
            className="h-11 w-full bg-transparent text-sm outline-none"
          />
          <button type="button" aria-label="Close search" onClick={onClose} className="size-11">
            <X className="size-4" />
          </button>
        </div>
        <ul className="max-h-80 overflow-auto">
          {commands.slice(0, 6).map((c) => (
            <li key={c.label}>
              <button type="button" className="h-11 w-full px-2 text-left text-sm text-muted hover:text-fg" onClick={c.run}>
                {c.label}
              </button>
            </li>
          ))}
          {assets.map((n) => (
            <li key={n.id}>
              <button type="button" className="flex h-11 w-full items-center justify-between px-2 text-left text-sm" onClick={() => onPickAsset(n.id)}>
                <span>
                  {n.symbol} <span className="text-muted">{n.name}</span>
                </span>
                <span className="font-mono text-xs tabular-nums">{formatUsd(n.price[day])}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 pb-1 text-xs text-faint">Deterministic parser. It does not invent prices or scores. As of day {WORLD.dates[day]}.</p>
      </div>
    </div>
  );
}
