import { healthState } from "@/lib/faultline/format";
import snap from "@/lib/faultline/snapshot-lite.json";

export type Factor = {
  metric: string;
  value: number | null;
  baseline: number | null;
  deviation: number | null;
};

export type Asset = {
  id: number;
  symbol: string;
  name: string;
  category: string;
  price: number;
  volume: number;
  volumeChange: number | null;
  mcap: number;
  change1: number;
  change7: number;
  rotation: number | null;
  health: number | null;
  healthPrev: number | null;
  dna: number | null;
  faultMag: number | null;
  faultType: string | null;
  faultText: string | null;
  evidence: string;
  factors: Factor[];
  lines: { metric: string; sigma: number }[];
  neighbors: { id: number; symbol: string; score: number }[];
  parts: {
    liquidity: number | null;
    volume: number | null;
    relativeStrength: number | null;
    recovery: number | null;
    volatilityStability: number | null;
    participation: number | null;
  };
};

export type Sector = {
  id: string;
  name: string;
  count: number;
  assetIds: number[];
  rotation: number;
  heating: "up" | "down" | "flat";
  state: string;
  breadth: number;
  volume: number;
  volumeChange: number;
  ret7: number;
  health: number | null;
  mcap: number;
  assets: Asset[];
};

const baseAssets = snap.assets as Asset[];

function utcDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function msUntilUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(1000, next - now);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function blankAsset(a: Asset): Asset {
  return {
    ...a,
    volumeChange: null,
    rotation: null,
    health: null,
    healthPrev: null,
    dna: null,
    faultMag: null,
    faultType: null,
    faultText: null,
    factors: [],
    lines: [],
    neighbors: [],
    parts: {
      liquidity: null,
      volume: null,
      relativeStrength: null,
      recovery: null,
      participation: null,
      volatilityStability: null,
    },
  };
}

function build(day: string) {
  const assets = baseAssets.map(blankAsset);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const sectors: Sector[] = snap.sectors.map((s) => ({
    ...(s as Omit<Sector, "assets" | "heating" | "rotation" | "ret7" | "volumeChange" | "breadth" | "health">),
    rotation: 0,
    heating: "flat" as const,
    ret7: 0,
    volumeChange: 0,
    breadth: 0,
    health: null,
    assets: s.assetIds.map((id) => byId.get(id)!),
  }));
  return {
    asOf: day,
    assets,
    byId,
    sectors,
    market: {
      ...snap.market,
      activeFaults: 0,
      severeFaults: 0,
    },
    pulse: {
      ...snap.pulse,
      breadth: 0,
      volumeActivity: 0,
      volatility: 0,
      sentiment: 0,
      state: "Steady",
    },
    cracks: [] as Asset[],
    quiet: [] as Asset[],
    faults: [] as Asset[],
    dnaRanked: [...assets],
    healthRanked: [...assets],
  };
}

const first = build(utcDay());

export const initialDnaRanked = first.dnaRanked;
export const initialHealthRanked = first.healthRanked;
export const initialSectors = first.sectors;
export const initialFaults = first.faults;

export let asOf = first.asOf;
export let market = first.market;
export let pulse = first.pulse;
export let ASSETS = first.assets;
export let SECTORS = first.sectors;
export let cracks = first.cracks;
export let quiet = first.quiet;
export let faults = first.faults;
export let dnaRanked = first.dnaRanked;
export let healthRanked = first.healthRanked;
export const assetCount = snap.assetCount;

let byId = first.byId;

function publish(day: string) {
  const next = build(day);
  asOf = next.asOf;
  market = next.market;
  pulse = next.pulse;
  ASSETS = next.assets;
  SECTORS = next.sectors;
  cracks = next.cracks;
  quiet = next.quiet;
  faults = next.faults;
  dnaRanked = next.dnaRanked;
  healthRanked = next.healthRanked;
  byId = next.byId;
}

const listeners = new Set<() => void>();

export function subscribeEdition(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let sourceKind: "okx" | "model" = "model";
let quotes: "pending" | "live" | "model" = "pending";

export function quoteState() {
  return quotes;
}

export function syncEdition() {
  const day = utcDay();
  if (day === asOf) return false;
  publish(day);
  sourceKind = "model";
  return true;
}

export function refreshIfNewDay() {
  if (!syncEdition()) return false;
  listeners.forEach((listener) => listener());
  return true;
}

export function bookLabel() {
  return sourceKind === "okx" ? "Live quotes" : "Waiting";
}

const tape = new Map<string, { price: number; change1: number }>();
let tapeTick = 0;

export function tapeOf(symbol: string) {
  return tape.get(symbol);
}

export function applyTape(rows: { symbol: string; price: number; change1: number }[]) {
  if (quotes === "live") return;
  let changed = false;
  for (const row of rows) {
    if (!(row.price > 0)) continue;
    tape.set(row.symbol, { price: row.price, change1: row.change1 });
    changed = true;
  }
  if (!changed) return;
  tapeTick += 1;
  listeners.forEach((listener) => listener());
}

export function editionStamp() {
  const btc = ASSETS.find((a) => a.symbol === "BTC");
  return `${asOf}|${sourceKind}|${btc?.price ?? 0}|${Math.round(market.mcap)}|${tapeTick}`;
}

export function bookReady() {
  return sourceKind === "okx" && asOf === utcDay();
}

export function applyLiveBook(book: {
  source: "okx" | "model";
  quotes: { symbol: string; price: number; volume: number; change1: number; change7?: number; volumeChange?: number; volChange?: number; sigma?: number; realizedVol?: number; mcap?: number; health?: number; healthPrev?: number; neighbors?: { symbol: string; score: number }[] }[];
}) {
  try {
    if (book.source === "okx" && book.quotes.length && sourceKind === "okx") {
      const unchanged = book.quotes.every((q) => {
        const cur = ASSETS.find((a) => a.symbol === q.symbol);
        return cur != null && (!(q.price > 0) || cur.price === q.price) && (!(q.volume > 0) || cur.volume === q.volume) && cur.change1 === q.change1 && cur.volumeChange === (q.volumeChange ?? cur.volumeChange) && cur.change7 === (q.change7 ?? cur.change7) && cur.mcap === (q.mcap && q.mcap > 0 ? q.mcap : cur.mcap) && cur.health === (q.health ?? cur.health);
      });
      if (unchanged) return;
    }
    if (book.source !== "okx" || book.quotes.length === 0) {
      if (sourceKind === "okx") return;
      sourceKind = "model";
      quotes = "model";
      listeners.forEach((listener) => listener());
      return;
    }
    publish(utcDay());
    const map = new Map(book.quotes.map((q) => [q.symbol, q]));
    const btcQuote = map.get("BTC");
    const btc7 = btcQuote?.change7 ?? 0;
    let next = ASSETS.map((a) => {
      const q = map.get(a.symbol);
      if (!q) return a;
      if (!(q.price > 0) || !(a.price > 0)) {
        return q.volumeChange == null ? a : { ...a, volumeChange: q.volumeChange };
      }
      const ratio = q.price / a.price;
      const trusted = ratio > 0.05 && ratio < 20;
      const change7 = q.change7 ?? 0;
      const volChange = q.volChange;
      const hasHist = q.change7 != null && q.sigma != null && q.realizedVol != null;
      const relative = clamp(50 + (change7 - btc7) * 250, 0, 100);
      const volumePart = volChange == null ? null : clamp(50 + volChange * 40, 0, 100);
      const stability = q.realizedVol == null ? null : clamp(100 - q.realizedVol * 800, 0, 100);
      const health = hasHist ? Math.round(relative * 0.45 + (volumePart ?? 50) * 0.25 + (stability ?? 50) * 0.3) : null;
      const dna = q.sigma == null ? null : Math.round(clamp(Math.abs(q.sigma) / 3, 0, 1) * 1000) / 10;
      const neighbors = q.neighbors?.length
        ? q.neighbors
            .map((n) => {
              const match = ASSETS.find((asset) => asset.symbol === n.symbol);
              return match ? { id: match.id, symbol: match.symbol, score: n.score } : null;
            })
            .filter((n): n is { id: number; symbol: string; score: number } => n != null)
        : [];
      return {
        ...a,
        price: q.price,
        volume: q.volume,
        volumeChange: q.volumeChange != null ? q.volumeChange : null,
        mcap: q.mcap && q.mcap > 0 ? q.mcap : trusted ? a.mcap * ratio : a.mcap,
        change1: q.change1,
        change7,
        health,
        healthPrev: a.health,
        dna,
        neighbors,
        parts: {
          liquidity: null,
          volume: volumePart == null ? null : Math.round(volumePart),
          relativeStrength: hasHist ? Math.round(relative) : null,
          recovery: null,
          participation: null,
          volatilityStability: stability == null ? null : Math.round(stability),
        },
        lines: q.sigma == null ? [] : [{ metric: "1D return", sigma: Math.round(q.sigma * 10) / 10 }],
        factors: q.change7 == null
          ? []
          : [
              { metric: "7D price", value: q.change7, baseline: 0, deviation: q.change7 },
              { metric: "Volume vs 7D", value: q.volChange ?? null, baseline: 0, deviation: q.volChange ?? null },
            ],
      };
    });
    const bySymbol = new Map(next.map((a) => [a.symbol, a]));
    const sectorDraft = SECTORS.map((s) => {
      const assets = s.assetIds.map((id) => next.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a));
      const ret7 = assets.length ? assets.reduce((sum, a) => sum + a.change7, 0) / assets.length : 0;
      const breadth = assets.length ? assets.filter((a) => a.change1 > 0).length / assets.length : 0;
      const known = assets.map((a) => a.volumeChange).filter((n): n is number => n != null);
      const volumeChange = known.length ? known.reduce((sum, n) => sum + n, 0) / known.length : 0;
      return { ...s, assets, ret7, breadth, volumeChange, volume: assets.reduce((sum, a) => sum + a.volume, 0), mcap: assets.reduce((sum, a) => sum + a.mcap, 0) };
    });
    const ret7s = sectorDraft.map((s) => s.ret7);
    const volChg = sectorDraft.map((s) => s.volumeChange);
    SECTORS = sectorDraft.map((s) => {
      const rotation = Math.round(clamp((rank(s.ret7, ret7s) * 0.45 + rank(s.volumeChange, volChg) * 0.25 + s.breadth * 0.3) * 100, 0, 100));
      const heating: Sector["heating"] = rotation >= 60 ? "up" : rotation <= 40 ? "down" : "flat";
      return { ...s, rotation, heating };
    });
    const sectorOf = new Map<number, (typeof SECTORS)[number]>();
    for (const s of SECTORS) for (const id of s.assetIds) sectorOf.set(id, s);
    next = next.map((a) => {
      const sector = sectorOf.get(a.id);
      const q = map.get(a.symbol);
      const volChange = q?.volChange;
      let faultType: string | null = null;
      let faultMag = 0;
      let faultText: string | null = null;
      if (q?.change7 != null && volChange != null && a.change1 > 0.02 && volChange < -0.2) {
        faultType = "PRICE_VOLUME_DIVERGENCE";
        faultMag = clamp(5 + Math.abs(volChange) * 4, 5, 10);
        faultText = "Price is up while volume is below this asset's own recent week.";
      } else if (q?.change7 != null && sector && a.change7 < -0.015 && sector.ret7 > 0.015) {
        faultType = "ASSET_DOWN_CATEGORY_UP";
        faultMag = clamp(5 + (sector.ret7 - a.change7) * 20, 5, 10);
        faultText = `${a.symbol} is down over 7 days while ${sector.name} is up.`;
      }
      return {
        ...a,
        rotation: sector ? sector.rotation : a.rotation,
        faultType,
        faultMag: Math.round(faultMag * 10) / 10,
        faultText,
      };
    });
    const cap = next.reduce((sum, a) => sum + a.mcap, 0);
    const vol = next.reduce((sum, a) => sum + a.volume, 0);
    const weighted = next.reduce((sum, a) => sum + a.mcap * a.change1, 0);
    const btc = next.find((a) => a.symbol === "BTC");
    const upShare = next.length ? Math.round((next.filter((a) => a.change1 > 0).length / next.length) * 100) : pulse.breadth;
    const volMoves = book.quotes.map((q) => q.volChange).filter((n): n is number => n != null);
    const vols = book.quotes.map((q) => q.realizedVol).filter((n): n is number => n != null);
    const rotAvg = SECTORS.length ? SECTORS.reduce((sum, s) => sum + s.rotation, 0) / SECTORS.length : pulse.sentiment;
    ASSETS = next;
    byId = new Map(next.map((a) => [a.id, a]));
    SECTORS = SECTORS.map((s) => ({ ...s, assets: s.assetIds.map((id) => byId.get(id)!).filter(Boolean) }));
    faults = next.filter((a) => (a.faultMag ?? 0) >= 3).sort((a, b) => (b.faultMag ?? 0) - (a.faultMag ?? 0));
    dnaRanked = [...next].sort((a, b) => (b.dna ?? 0) - (a.dna ?? 0));
    healthRanked = [...next].sort((a, b) => (b.health ?? 0) - (a.health ?? 0));
    cracks = next.filter((a) => a.change7 > 0.02 && (a.health ?? 100) < 45).slice(0, 4);
    quiet = next.filter((a) => Math.abs(a.change1) < 0.01 && (a.faultMag ?? 0) < 3).slice(0, 3);
    market = {
      ...market,
      mcap: cap,
      volume: vol,
      capChange: cap > 0 ? weighted / cap : 0,
      btcDominance: btc && cap > 0 ? btc.mcap / cap : market.btcDominance,
    };
    pulse = {
      ...pulse,
      breadth: upShare,
      volumeActivity: volMoves.length ? Math.round(clamp(50 + (volMoves.reduce((s, n) => s + n, 0) / volMoves.length) * 40, 0, 100)) : 0,
      volatility: vols.length ? Math.round(clamp((vols.reduce((s, n) => s + n, 0) / vols.length) * 800, 0, 100)) : 0,
      sentiment: Math.round(rotAvg),
      state: upShare >= 55 ? "Heating" : upShare <= 40 ? "Cooling" : "Steady",
    };
    sourceKind = "okx";
    quotes = "live";
    sinceCache = null;
    listeners.forEach((listener) => listener());
  } catch {
    sourceKind = "model";
    quotes = "model";
  }
}

function rank(value: number, all: number[]) {
  if (all.length <= 1) return 0.5;
  let below = 0;
  for (const v of all) if (v < value) below++;
  return below / (all.length - 1);
}

function previousDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

let sinceCache: { key: string; value: ReturnType<typeof compareYesterday> } | null = null;

function compareYesterday() {
  const prior = build(previousDay(asOf));
  const hottest = [...SECTORS].sort((a, b) => b.rotation - a.rotation)[0];
  const prev = hottest ? prior.sectors.find((s) => s.id === hottest.id) : undefined;
  const priorIds = new Set(prior.faults.map((f) => f.id));
  const fresh = faults.filter((f) => !priorIds.has(f.id));
  const mcapDelta = sourceKind === "okx" ? market.capChange : prior.market.mcap ? (market.mcap - prior.market.mcap) / prior.market.mcap : 0;
  return {
    mcapDelta,
    sector: hottest
      ? { id: hottest.id, name: hottest.name, rotation: hottest.rotation, delta: hottest.rotation - (prev?.rotation ?? hottest.rotation) }
      : null,
    freshFaults: fresh.length,
    freshNames: fresh.slice(0, 3).map((f) => f.symbol),
  };
}

export function sinceYesterday() {
  const key = editionStamp();
  if (sinceCache?.key === key) return sinceCache.value;
  const value = compareYesterday();
  sinceCache = { key, value };
  return value;
}

export function assetById(id: number) {
  return byId.get(id);
}

export function assetBySymbol(symbol: string) {
  return ASSETS.find((a) => a.symbol === symbol);
}

export function sectorById(id: string) {
  return SECTORS.find((s) => s.id === id);
}

export function faultLabel(type: string | null) {
  if (!type) return "No active fault";
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export { healthState };
