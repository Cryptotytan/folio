import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import map from "@/lib/faultline/world-map.json";
import { Token } from "@/components/fl/shell";
import { formatPct, formatUsd } from "@/lib/faultline/format";
import { volumeVenue } from "@/lib/faultline/venue";
import { homeOf, kindOf, type PlaceKind } from "@/lib/faultline/places";
import type { Asset } from "@/lib/faultline/view";

type Feature = { id: string; name: string; d: string; x: number; y: number };
type Pin = { asset: Asset; kind: PlaceKind; country: string; volume: number; volumeChange: number };
type Row = Feature & { volume: number; n: number; known: number; prev: number };
type Pick = { id: string };

const BLUES = ["#d9e6fb", "#9dbeee", "#3f73d8", "#173e9c"];

function placeTiles(rows: Row[]) {
  const active = rows.filter((row) => row.n > 0);
  const ranked = [...active].sort((a, b) => a.volume - b.volume || a.n - b.n);
  const tiles = active.map((row) => ({ id: row.id, x: row.x, y: row.y, ox: row.x, oy: row.y, volume: row.volume }));
  const gap = 16;
  for (let pass = 0; pass < 18; pass++) {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        let dx = tiles[j].x - tiles[i].x;
        let dy = tiles[j].y - tiles[i].y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist >= gap) continue;
        const push = (gap - dist) / 2;
        dx /= dist;
        dy /= dist;
        tiles[i].x -= dx * push;
        tiles[i].y -= dy * push;
        tiles[j].x += dx * push;
        tiles[j].y += dy * push;
      }
    }
    for (const tile of tiles) {
      const dx = tile.x - tile.ox;
      const dy = tile.y - tile.oy;
      const dist = Math.hypot(dx, dy);
      if (dist > 28) {
        tile.x = tile.ox + (dx / dist) * 28;
        tile.y = tile.oy + (dy / dist) * 28;
      }
    }
  }
  const tone = new Map<string, string>();
  ranked.forEach((row, index) => {
    const step = ranked.length <= 1 ? 3 : Math.min(3, Math.floor((index / (ranked.length - 1)) * 3.999));
    tone.set(row.id, BLUES[step] ?? BLUES[3]);
  });
  return { tiles, tone };
}

const ANCHOR: Record<string, [number, number]> = {
  US: [226.4, 213.2], CA: [205.6, 154.2], CN: [786.1, 228.8], AU: [872.2, 403.7], BR: [355.6, 360.1], RU: [750, 134.4],
};

function CountryList({ place, pins, onClose }: { place: { name: string }; pins: Pin[]; onClose: () => void }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 border-b border-[#e6edf5] px-3 py-3">
        <p className="display text-xl leading-none">{short(place.name)}</p>
        <button type="button" className="text-xs text-muted" onClick={onClose}>
          Close
        </button>
      </div>
      <ul className="max-h-64 overflow-auto p-1.5 sm:max-h-[16rem]">
        {pins
          .slice()
          .sort((a, b) => b.volume - a.volume)
          .map((pin) => (
            <li key={pin.asset.id}>
              <Link to="/asset/$id" params={{ id: String(pin.asset.id) }} search={{ tab: "overview" }} className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-[#f4f7fb]">
                <Token symbol={pin.asset.symbol} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{pin.asset.symbol}</span>
                  <span className="block truncate text-[11px] text-muted">{pin.asset.name}</span>
                </span>
                <span className="text-right">
                  <span className="num block text-xs font-semibold">{formatUsd(pin.volume)}</span>
                  <span className={`num block text-[11px] font-semibold ${pin.volumeChange >= 0 ? "text-pos" : "text-neg"}`}>
                    {Number.isFinite(pin.volumeChange) ? `${formatPct(pin.volumeChange)} · ${volumeVenue(pin.asset.symbol, pin.asset.id >= 1_000_000)}` : "—"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </>
  );
}

function short(name: string) {
  return name
    .replace("United States of America", "United States")
    .replace("United Kingdom", "UK")
    .replace("United Arab Emirates", "UAE")
    .replace(" S.A.R.", "");
}

function dayMove(row: { known: number; prev: number }) {
  if (!(row.prev > 0) || !(row.known > 0)) return null;
  return row.known / row.prev - 1;
}

const Land = memo(function Land({
  rows,
  pickId,
  onEnter,
  onLeave,
  onPick,
}: {
  rows: Row[];
  pickId: string | null;
  onEnter: (id: string) => void;
  onLeave: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const idle = rows.filter((row) => row.d && row.n === 0);
  const live = rows.filter((row) => row.d && row.n > 0);
  return (
    <>
      {idle.map((row) => (
        <path key={row.id} d={row.d} fill="#f4f7fb" stroke="#c5d3e4" strokeWidth={1.15} strokeLinejoin="round" pointerEvents="none" />
      ))}
      {live.map((row) => {
        const hot = pickId === row.id;
        return (
          <path
            key={row.id}
            d={row.d}
            fill={hot ? "#d5e2f4" : "#f7f9fc"}
            stroke={hot ? "#8eabd0" : "#9eb0c6"}
            strokeWidth={1.25}
            strokeLinejoin="round"
            className="map-country cursor-pointer"
            onMouseEnter={() => onEnter(row.id)}
            onMouseLeave={() => onLeave(row.id)}
            onPointerDown={() => onPick(row.id)}
          />
        );
      })}
    </>
  );
});

export function WorldMap({ crypto, stocks }: { crypto: Asset[]; stocks: Asset[]; watchIds?: number[] }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const listed = stocks.length > 0;
  const onEnter = useCallback((id: string) => setHover(id), []);
  const onLeave = useCallback((id: string) => setHover((current) => (current === id ? null : current)), []);
  const onPick = useCallback((id: string) => setPick((current) => (current?.id === id ? null : { id })), []);

  const pins = useMemo<Pin[]>(() => {
    const assets = listed ? stocks : crypto;
    const out: Pin[] = [];
    for (const asset of assets) {
      const country = homeOf(asset.symbol, listed);
      if (!country) continue;
      const volume = listed ? asset.price * asset.volume : asset.volume;
      if (!(volume > 0)) continue;
      out.push({ asset, kind: kindOf(asset.symbol, listed), country, volume, volumeChange: asset.volumeChange ?? Number.NaN });
    }
    return out;
  }, [crypto, stocks, listed]);

  const rows = useMemo(() => {
    const by = new Map<string, Row>();
    for (const feature of map.features as Feature[]) {
      const anchor = ANCHOR[feature.id];
      by.set(feature.id, { ...feature, x: anchor?.[0] ?? feature.x, y: anchor?.[1] ?? feature.y, volume: 0, n: 0, known: 0, prev: 0 });
    }
    for (const pin of pins) {
      const row = by.get(pin.country);
      if (!row) continue;
      row.n += 1;
      row.volume += pin.volume;
      if (Number.isFinite(pin.volumeChange) && pin.volumeChange > -0.99) {
        row.known += pin.volume;
        row.prev += pin.volume / (1 + pin.volumeChange);
      }
    }
    return [...by.values()];
  }, [pins]);

  const { tiles, tone } = useMemo(() => placeTiles(rows), [rows]);
  const chosen = pins.filter((pin) => pin.country === pick?.id);
  const place = rows.find((row) => row.id === pick?.id);
  const hovered = rows.find((row) => row.id === hover);
  const volumeLead = [...rows].filter((row) => row.volume > 0).sort((a, b) => b.volume - a.volume)[0];
  const leadMove = volumeLead ? dayMove(volumeLead) : null;
  const active = hovered && hovered.n > 0 ? hovered : place && place.n > 0 ? place : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">The map</p>
          <h2 className="display mt-1 text-[1.7rem] leading-none">Where they were founded</h2>
        </div>
        {volumeLead ? (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{short(volumeLead.name)}</span>
            {" · "}
            <span className="num">{formatUsd(volumeLead.volume)}</span>
            {leadMove == null ? " in 24 hours" : (
              <>
                {" · "}
                <span className={`num font-medium ${leadMove >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(leadMove)}</span>
                {" versus yesterday"}
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted">Reading the live books.</p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-[#d5deea] bg-white shadow-[0_24px_60px_rgba(18,26,39,0.06)]">
        <div className="relative bg-[#d9e3ef]">
          <svg viewBox="30 48 940 420" role="img" aria-label="World map" shapeRendering="optimizeSpeed" className="h-auto w-full">
            <Land rows={rows} pickId={pick?.id ?? null} onEnter={onEnter} onLeave={onLeave} onPick={onPick} />
          </svg>
          {tiles.map((tile) => {
            const row = rows.find((item) => item.id === tile.id);
            if (!row) return null;
            const on = hover === tile.id || pick?.id === tile.id;
            return (
              <button
                key={tile.id}
                type="button"
                aria-label={short(row.name)}
                className="absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center"
                style={{ left: `${((tile.x - 30) / 940) * 100}%`, top: `${((tile.y - 48) / 420) * 100}%` }}
                onMouseEnter={() => onEnter(tile.id)}
                onMouseLeave={() => onLeave(tile.id)}
                onClick={() => onPick(tile.id)}
              >
                <span className={`block rounded-full border-2 border-white shadow ${on ? "size-4" : "size-3"}`} style={{ background: tone.get(tile.id) }} />
              </button>
            );
          })}
          {active && (
            <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[calc(100%-1rem)] rounded-xl bg-[#162033] px-3 py-2 text-white shadow-[0_14px_30px_rgba(18,26,39,0.28)] sm:top-3 sm:left-3 sm:rounded-2xl sm:px-3.5 sm:py-2.5">
              <p className="display text-base leading-none sm:text-lg">{short(active.name)}</p>
              <p className="mt-1 text-xs text-white/75">
                <span className="num text-white">{formatUsd(active.volume)}</span>
                {" in 24 hours"}
                {dayMove(active) != null && (
                  <>
                    {" · "}
                    <span className={`num ${(dayMove(active) ?? 0) >= 0 ? "text-[#8ee4b8]" : "text-[#ffb4aa]"}`}>{formatPct(dayMove(active) ?? 0)}</span>
                  </>
                )}
              </p>
            </div>
          )}
          {pick && place && (
            <div className="absolute top-3 right-3 z-20 hidden max-h-[70%] w-[min(18rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#d5deea] bg-white shadow-[0_18px_40px_rgba(18,26,39,0.16)] sm:flex">
              <CountryList place={place} pins={chosen} onClose={() => setPick(null)} />
            </div>
          )}
        </div>
        {pick && place && (
          <div className="border-t border-[#d5deea] bg-white sm:hidden">
            <CountryList place={place} pins={chosen} onClose={() => setPick(null)} />
          </div>
        )}
        <div className="flex flex-col items-start gap-2 border-t border-[#e6edf5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <p className="min-w-0 text-[11px] leading-relaxed text-[#5c6b80]">Founded there. Darker means more volume in the last 24 hours.</p>
          <span className="inline-flex shrink-0 items-center gap-2 text-[10px] tracking-wide text-[#5c6b80] uppercase">
            Less
            <i className="h-1.5 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${BLUES.join(",")})` }} />
            More
          </span>
        </div>
      </div>
    </section>
  );
}
