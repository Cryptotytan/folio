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

function hashDay(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nudgeAsset(a: Asset, rng: () => number): Asset {
  const healthN = (rng() * 2 - 1) * 3;
  const dnaN = (rng() * 2 - 1) * 2;
  const faultN = (rng() * 2 - 1) * 0.3;
  const rotN = (rng() * 2 - 1) * 4;
  return {
    ...a,
    price: Math.max(1e-8, a.price * (1 + (rng() * 2 - 1) * 0.012)),
    volume: a.volume * (1 + (rng() * 2 - 1) * 0.04),
    mcap: a.mcap * (1 + (rng() * 2 - 1) * 0.012),
    change1: a.change1 + (rng() * 2 - 1) * 0.004,
    change7: a.change7 + (rng() * 2 - 1) * 0.008,
    rotation: a.rotation == null ? null : Math.round(clamp(a.rotation + rotN, 0, 100)),
    health: a.health == null ? null : Math.round(clamp(a.health + healthN, 0, 100)),
    dna: a.dna == null ? null : Math.round(clamp(a.dna + dnaN, 0, 100) * 10) / 10,
    faultMag: a.faultMag == null ? null : Math.round(clamp(a.faultMag + faultN, 0, 10) * 10) / 10,
  };
}

function build(day: string) {
  const rng = mulberry32(hashDay(day));
  const assets = baseAssets.map((a) => nudgeAsset(a, rng));
  const byId = new Map(assets.map((a) => [a.id, a]));
  const sectors: Sector[] = snap.sectors.map((s) => {
    const drift = rng() * 2 - 1;
    const rotation = clamp(Math.round(s.rotation + drift * 5), 0, 100);
    const heating: Sector["heating"] = drift > 0.2 ? "up" : drift < -0.2 ? "down" : (s.heating as Sector["heating"]);
    return {
      ...(s as Omit<Sector, "assets" | "heating">),
      rotation,
      heating,
      ret7: s.ret7 + drift * 0.008,
      volumeChange: s.volumeChange + drift * 0.05,
      breadth: clamp(s.breadth + drift * 0.04, 0, 1),
      assets: s.assetIds.map((id) => byId.get(id)!),
    };
  });
  const mcapScale = 1 + (rng() * 2 - 1) * 0.01;
  const volScale = 1 + (rng() * 2 - 1) * 0.03;
  const mcapSpark = snap.market.mcapSpark.slice();
  const volSpark = snap.market.volSpark.slice();
  if (mcapSpark.length) mcapSpark[mcapSpark.length - 1] *= mcapScale;
  if (volSpark.length) volSpark[volSpark.length - 1] *= volScale;
  const activeFaults = assets.filter((a) => (a.faultMag ?? 0) >= 3).length;
  const severeFaults = assets.filter((a) => (a.faultMag ?? 0) >= 6.5).length;
  const breadth = clamp(Math.round(snap.pulse.breadth + (rng() * 2 - 1) * 4), 0, 100);
  const volumeActivity = clamp(Math.round(snap.pulse.volumeActivity + (rng() * 2 - 1) * 4), 0, 100);
  const volatility = clamp(Math.round(snap.pulse.volatility + (rng() * 2 - 1) * 3), 0, 100);
  const sentiment = clamp(Math.round(snap.pulse.sentiment + (rng() * 2 - 1) * 4), 0, 100);
  return {
    asOf: day,
    assets,
    byId,
    sectors,
    market: {
      ...snap.market,
      mcap: snap.market.mcap * mcapScale,
      volume: snap.market.volume * volScale,
      capChange: snap.market.capChange + (rng() * 2 - 1) * 0.15,
      btcDominance: clamp(snap.market.btcDominance + (rng() * 2 - 1) * 0.008, 0.3, 0.75),
      activeFaults,
      severeFaults,
      mcapSpark,
      volSpark,
    },
    pulse: {
      ...snap.pulse,
      breadth,
      volumeActivity,
      volatility,
      sentiment,
      state: breadth >= 55 ? "Heating" : breadth <= 40 ? "Cooling" : "Steady",
    },
    cracks: snap.cracks.map((id) => byId.get(id)!).filter(Boolean),
    quiet: snap.quiet.map((id) => byId.get(id)!).filter(Boolean),
    faults: assets.filter((a) => (a.faultMag ?? 0) >= 3).sort((a, b) => (b.faultMag ?? 0) - (a.faultMag ?? 0)),
    dnaRanked: [...assets].sort((a, b) => (b.dna ?? 0) - (a.dna ?? 0)),
    healthRanked: [...assets].sort((a, b) => (b.health ?? 0) - (a.health ?? 0)),
  };
}

const first = build(utcDay());

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

export function refreshIfNewDay() {
  const day = utcDay();
  if (day === asOf) return false;
  publish(day);
  sourceKind = "model";
  listeners.forEach((listener) => listener());
  return true;
}

export function bookLabel() {
  return sourceKind === "okx" ? "Live quotes" : "Daily model";
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
  quotes: { symbol: string; price: number; volume: number; change1: number; change7?: number; volChange?: number; sigma?: number; realizedVol?: number; mcap?: number; health?: number; healthPrev?: number; neighbors?: { symbol: string; score: number }[] }[];
}) {
  try {
    if (book.source === "okx" && book.quotes.length && sourceKind === "okx") {
      const unchanged = book.quotes.every((q) => {
        const cur = ASSETS.find((a) => a.symbol === q.symbol);
        return cur != null && cur.price === q.price && cur.volume === q.volume && cur.change1 === q.change1 && cur.change7 === (q.change7 ?? cur.change7) && cur.mcap === (q.mcap && q.mcap > 0 ? q.mcap : cur.mcap) && cur.health === (q.health ?? cur.health);
      });
      if (unchanged) return;
    }
    publish(utcDay());
    if (book.source !== "okx" || book.quotes.length === 0) {
      sourceKind = "model";
      quotes = "model";
      listeners.forEach((listener) => listener());
      return;
    }
    const map = new Map(book.quotes.map((q) => [q.symbol, q]));
    const btcQuote = map.get("BTC");
    const btc7 = btcQuote?.change7 ?? 0;
    let next = ASSETS.map((a) => {
      const q = map.get(a.symbol);
      if (!q || !(q.price > 0) || !(a.price > 0)) return a;
      const ratio = q.price / a.price;
      const trusted = ratio > 0.05 && ratio < 20;
      const change7 = q.change7 ?? a.change7;
      const volChange = q.volChange;
      const hasHist = q.change7 != null && q.sigma != null && q.realizedVol != null;
      const relative = clamp(50 + (change7 - btc7) * 250, 0, 100);
      const volumePart = volChange == null ? a.parts.volume : clamp(50 + volChange * 40, 0, 100);
      const stability = q.realizedVol == null ? a.parts.volatilityStability : clamp(100 - q.realizedVol * 800, 0, 100);
      const raw = hasHist ? Math.round(relative * 0.45 + (volumePart ?? 50) * 0.25 + (stability ?? 50) * 0.3) : a.health;
      const health = q.health ?? (sourceKind === "okx" && a.health != null && raw != null ? Math.round(a.health * 0.85 + raw * 0.15) : raw);
      const dna = q.sigma == null ? a.dna : Math.round(clamp(Math.abs(q.sigma) / 3, 0, 1) * 1000) / 10;
      const neighbors = q.neighbors?.length
        ? q.neighbors
            .map((n) => {
              const match = ASSETS.find((asset) => asset.symbol === n.symbol);
              return match ? { id: match.id, symbol: match.symbol, score: n.score } : null;
            })
            .filter((n): n is { id: number; symbol: string; score: number } => n != null)
        : a.neighbors;
      return {
        ...a,
        price: q.price,
        volume: q.volume,
        mcap: q.mcap && q.mcap > 0 ? q.mcap : trusted ? a.mcap * ratio : a.mcap,
        change1: q.change1,
        change7,
        health,
        healthPrev: q.healthPrev ?? a.health,
        dna,
        neighbors,
        parts: {
          ...a.parts,
          relativeStrength: hasHist ? Math.round(relative) : a.parts.relativeStrength,
          volume: volumePart == null ? a.parts.volume : Math.round(volumePart),
          volatilityStability: stability == null ? a.parts.volatilityStability : Math.round(stability),
        },
        lines: q.sigma == null ? a.lines : [{ metric: "1D return", sigma: Math.round(q.sigma * 10) / 10 }],
        factors: q.change7 == null
          ? a.factors
          : [
              { metric: "7D price", value: q.change7, baseline: 0, deviation: q.change7 },
              { metric: "Volume vs 7D", value: q.volChange ?? null, baseline: 0, deviation: q.volChange ?? null },
            ],
      };
    });
    const bySymbol = new Map(next.map((a) => [a.symbol, a]));
    const sectorDraft = SECTORS.map((s) => {
      const assets = s.assetIds.map((id) => next.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a));
      const ret7 = assets.length ? assets.reduce((sum, a) => sum + a.change7, 0) / assets.length : s.ret7;
      const breadth = assets.length ? assets.filter((a) => a.change1 > 0).length / assets.length : s.breadth;
      const volumeChange = assets.length
        ? assets.reduce((sum, a) => sum + (map.get(a.symbol)?.volChange ?? 0), 0) / assets.length
        : s.volumeChange;
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
      volumeActivity: volMoves.length ? Math.round(clamp(50 + (volMoves.reduce((s, n) => s + n, 0) / volMoves.length) * 40, 0, 100)) : pulse.volumeActivity,
      volatility: vols.length ? Math.round(clamp((vols.reduce((s, n) => s + n, 0) / vols.length) * 800, 0, 100)) : pulse.volatility,
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
