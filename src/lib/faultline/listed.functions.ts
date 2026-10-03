import { createServerFn } from "@tanstack/react-start";
import type { Asset, Sector } from "@/lib/faultline/view";

export type ListedBook = {
  assets: Asset[];
  sectors: Sector[];
  market: {
    mcap: number;
    volume: number;
    capChange: number;
    btcDominance: number;
    activeFaults: number;
    severeFaults: number;
    mcapSpark: number[];
    volSpark: number[];
  };
  pulse: { breadth: number; volumeActivity: number; volatility: number; sentiment: number; state: string };
  paths: Record<string, { d: string; c: number; v: number }[]>;
};

export const EQUITIES: { yahoo: string; symbol: string; name: string; group: string }[] = [
  { yahoo: "SPY", symbol: "SPY", name: "S&P 500", group: "Indexes" },
  { yahoo: "QQQ", symbol: "QQQ", name: "Nasdaq 100", group: "Indexes" },
  { yahoo: "DIA", symbol: "DIA", name: "Dow Jones", group: "Indexes" },
  { yahoo: "IWM", symbol: "IWM", name: "Russell 2000", group: "Indexes" },
  { yahoo: "AAPL", symbol: "AAPL", name: "Apple", group: "Technology" },
  { yahoo: "MSFT", symbol: "MSFT", name: "Microsoft", group: "Technology" },
  { yahoo: "NVDA", symbol: "NVDA", name: "Nvidia", group: "Technology" },
  { yahoo: "AVGO", symbol: "AVGO", name: "Broadcom", group: "Technology" },
  { yahoo: "ORCL", symbol: "ORCL", name: "Oracle", group: "Technology" },
  { yahoo: "AMD", symbol: "AMD", name: "AMD", group: "Technology" },
  { yahoo: "AMZN", symbol: "AMZN", name: "Amazon", group: "Consumer" },
  { yahoo: "TSLA", symbol: "TSLA", name: "Tesla", group: "Consumer" },
  { yahoo: "WMT", symbol: "WMT", name: "Walmart", group: "Consumer" },
  { yahoo: "COST", symbol: "COST", name: "Costco", group: "Consumer" },
  { yahoo: "HD", symbol: "HD", name: "Home Depot", group: "Consumer" },
  { yahoo: "PG", symbol: "PG", name: "Procter & Gamble", group: "Consumer" },
  { yahoo: "KO", symbol: "KO", name: "Coca-Cola", group: "Consumer" },
  { yahoo: "META", symbol: "META", name: "Meta", group: "Communication" },
  { yahoo: "GOOGL", symbol: "GOOGL", name: "Alphabet", group: "Communication" },
  { yahoo: "NFLX", symbol: "NFLX", name: "Netflix", group: "Communication" },
  { yahoo: "DIS", symbol: "DIS", name: "Disney", group: "Communication" },
  { yahoo: "JPM", symbol: "JPM", name: "JPMorgan", group: "Financials" },
  { yahoo: "V", symbol: "V", name: "Visa", group: "Financials" },
  { yahoo: "MA", symbol: "MA", name: "Mastercard", group: "Financials" },
  { yahoo: "BAC", symbol: "BAC", name: "Bank of America", group: "Financials" },
  { yahoo: "UNH", symbol: "UNH", name: "UnitedHealth", group: "Health" },
  { yahoo: "LLY", symbol: "LLY", name: "Eli Lilly", group: "Health" },
  { yahoo: "JNJ", symbol: "JNJ", name: "Johnson & Johnson", group: "Health" },
  { yahoo: "XOM", symbol: "XOM", name: "Exxon Mobil", group: "Energy stocks" },
  { yahoo: "CVX", symbol: "CVX", name: "Chevron", group: "Energy stocks" },
  { yahoo: "GC=F", symbol: "GOLD", name: "Gold", group: "Metals" },
  { yahoo: "SI=F", symbol: "SILVER", name: "Silver", group: "Metals" },
  { yahoo: "HG=F", symbol: "COPPER", name: "Copper", group: "Metals" },
  { yahoo: "PL=F", symbol: "PLAT", name: "Platinum", group: "Metals" },
  { yahoo: "CL=F", symbol: "WTI", name: "WTI crude", group: "Energy commodities" },
  { yahoo: "BZ=F", symbol: "BRENT", name: "Brent crude", group: "Energy commodities" },
  { yahoo: "NG=F", symbol: "NATGAS", name: "Natural gas", group: "Energy commodities" },
  { yahoo: "ZC=F", symbol: "CORN", name: "Corn", group: "Agriculture" },
  { yahoo: "ZW=F", symbol: "WHEAT", name: "Wheat", group: "Agriculture" },
  { yahoo: "KC=F", symbol: "COFFEE", name: "Coffee", group: "Agriculture" },
  { yahoo: "SB=F", symbol: "SUGAR", name: "Sugar", group: "Agriculture" },
];

type Bar = { id: number; symbol: string; name: string; group: string; price: number; mcap: number; volume: number; change1: number; change7: number; volChange: number; sigma: number; realized: number; closes: { d: string; c: number; v: number }[] };

const cache = new Map<string, { at: number; book: ListedBook }>();

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, n) => s + (n - m) ** 2, 0) / (xs.length - 1));
}

function cosine(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 8) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  if (aa === 0 || bb === 0) return 0;
  return dot / Math.sqrt(aa * bb);
}

function rets(closes: number[]) {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) out.push(closes[i] / closes[i - 1] - 1);
  return out;
}

async function getText(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await fn(item);
      }
    }),
  );
}

function emptyAsset(row: Bar): Asset {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    category: row.group,
    price: row.price,
    volume: row.volume,
    volumeChange: null,
    mcap: row.mcap,
    change1: row.change1,
    change7: row.change7,
    rotation: null,
    health: null,
    healthPrev: null,
    dna: null,
    faultMag: null,
    faultType: null,
    faultText: null,
    evidence: row.closes.length > 8 ? "Live" : "Listing",
    factors: [],
    lines: [],
    neighbors: [],
    parts: { liquidity: null, volume: null, relativeStrength: null, recovery: null, volatilityStability: null, participation: null },
  };
}

function assemble(rows: Bar[], benchSymbol: string): ListedBook {
  const bench = rows.find((row) => row.symbol === benchSymbol) ?? rows[0];
  const benchChange = bench?.change7 ?? 0;
  const paths: ListedBook["paths"] = {};
  const assets = rows.map((row) => {
    const health = Math.round(
      clamp(50 + (row.change7 - benchChange) * 220, 0, 100) * 0.45 +
        clamp(50 + row.volChange * 35, 0, 100) * 0.25 +
        clamp(100 - row.realized * 350, 0, 100) * 0.3,
    );
    const dna = row.closes.length > 8 ? Math.round(clamp(Math.abs(row.sigma) * 28, 0, 100)) : null;
    const asset = emptyAsset(row);
    const volumes = row.closes.map((bar) => bar.v).filter((value) => value > 0);
    const latest = volumes[volumes.length - 1];
    const prior = volumes[volumes.length - 2];
    asset.volumeChange = prior && latest ? latest / prior - 1 : 0;
    asset.health = health;
    asset.healthPrev = health;
    asset.dna = dna;
    asset.parts.relativeStrength = clamp(50 + (row.change7 - benchChange) * 220, 0, 100);
    asset.parts.volume = clamp(50 + row.volChange * 35, 0, 100);
    asset.parts.volatilityStability = clamp(100 - row.realized * 350, 0, 100);
    if (row.closes.length > 8) asset.lines = [{ metric: "Daily move", sigma: Math.round(row.sigma * 10) / 10 }];
    if (row.closes.length) paths[String(row.id)] = row.closes.slice(-30);
    return asset;
  });
  const series = new Map(rows.map((row) => [row.id, rets(row.closes.map((bar) => bar.c))]));
  for (const asset of assets) {
    const mine = series.get(asset.id) ?? [];
    asset.neighbors = assets
      .filter((other) => other.id !== asset.id)
      .map((other) => ({ id: other.id, symbol: other.symbol, score: Math.round(cosine(mine, series.get(other.id) ?? []) * 100) }))
      .filter((other) => other.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
  const groups = new Map<string, Asset[]>();
  for (const asset of assets) {
    const list = groups.get(asset.category) ?? [];
    list.push(asset);
    groups.set(asset.category, list);
  }
  const sectors: Sector[] = [...groups.entries()].map(([name, members]) => {
    const up = members.filter((asset) => asset.change1 > 0).length / members.length;
    const ret7 = mean(members.map((asset) => asset.change7));
    const volume = members.reduce((sum, asset) => sum + asset.volume, 0);
    const volumeChange = mean(rows.filter((row) => row.group === name).map((row) => row.volChange));
    const rotation = Math.round(clamp(up * 45 + clamp(ret7, -0.15, 0.15) * 180 + clamp(volumeChange, -1, 1) * 15 + 20, 0, 100));
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    for (const asset of members) asset.rotation = rotation;
    return {
      id,
      name,
      count: members.length,
      assetIds: members.map((asset) => asset.id),
      rotation,
      heating: ret7 > 0.015 ? "up" : ret7 < -0.015 ? "down" : "flat",
      state: ret7 > 0.015 ? "Heating" : ret7 < -0.015 ? "Cooling" : "Steady",
      breadth: up,
      volume,
      volumeChange,
      ret7,
      health: Math.round(mean(members.map((asset) => asset.health ?? 0))),
      mcap: members.reduce((sum, asset) => sum + asset.mcap, 0),
      assets: members,
    };
  });
  for (const sector of sectors) {
    for (const asset of sector.assets) {
      if (asset.change1 > 0.02 && (rows.find((row) => row.id === asset.id)?.volChange ?? 0) < -0.25) {
        asset.faultMag = 6;
        asset.faultType = "PRICE_VOLUME_DIVERGENCE";
        asset.faultText = "The price is up. Trading activity is below this name's own recent pace.";
      } else if (asset.change7 < -0.03 && sector.ret7 > 0.015) {
        asset.faultMag = 5.5;
        asset.faultType = "ASSET_DOWN_CATEGORY_UP";
        asset.faultText = `${asset.symbol} is down over the week while ${sector.name} is up.`;
      }
    }
  }
  const mcap = assets.reduce((sum, asset) => sum + asset.mcap, 0);
  const volume = assets.reduce((sum, asset) => sum + asset.volume, 0);
  const breadth = assets.length ? Math.round((assets.filter((asset) => asset.change1 > 0).length / assets.length) * 100) : 0;
  const faults = assets.filter((asset) => (asset.faultMag ?? 0) >= 3);
  const anchor = assets.find((asset) => asset.symbol === "BTC" || asset.symbol === "SPY");
  const topVolume = Math.max(...sectors.map((sector) => sector.volume), 1);
  return {
    assets,
    sectors,
    market: {
      mcap,
      volume,
      capChange: mcap > 0 ? assets.reduce((sum, asset) => sum + asset.mcap * asset.change1, 0) / mcap : mean(assets.map((asset) => asset.change1)),
      btcDominance: anchor && mcap > 0 ? anchor.mcap / mcap : topVolume / Math.max(volume, 1),
      activeFaults: faults.length,
      severeFaults: faults.filter((asset) => (asset.faultMag ?? 0) >= 6.5).length,
      mcapSpark: [],
      volSpark: [],
    },
    pulse: {
      breadth,
      volumeActivity: assets.length ? Math.round((rows.filter((row) => row.volChange > 0).length / rows.length) * 100) : 0,
      volatility: Math.round(clamp(mean(rows.map((row) => row.realized)) * 400, 0, 100)),
      sentiment: Math.round(mean(sectors.map((sector) => sector.rotation))),
      state: breadth >= 55 ? "Heating" : breadth <= 40 ? "Cooling" : "Steady",
    },
    paths,
  };
}

async function equityBars(): Promise<Bar[]> {
  const bars: Bar[] = [];
  await pool(EQUITIES, 6, async (spec) => {
    const raw = await getText(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(spec.yahoo)}?interval=1d&range=1mo`);
    try {
      const body = JSON.parse(raw) as {
        chart?: { result?: { timestamp?: number[]; meta?: { regularMarketPrice?: number; marketCap?: number }; indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] } }[] };
      };
      const result = body.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const closes: Bar["closes"] = [];
      (result?.timestamp ?? []).forEach((ts, i) => {
        const c = Number(quote?.close?.[i]);
        const v = Number(quote?.volume?.[i] ?? 0);
        if (c > 0) closes.push({ d: new Date(ts * 1000).toISOString().slice(0, 10), c, v: Number.isFinite(v) ? v : 0 });
      });
      if (closes.length < 3) return;
      const last = closes[closes.length - 1];
      const prev = closes[closes.length - 2];
      const week = closes[Math.max(0, closes.length - 8)];
      const rs = rets(closes.map((bar) => bar.c));
      const prior = rs.slice(0, -1);
      const sd = stdev(prior);
      const today = rs[rs.length - 1] ?? 0;
      const vols = closes.slice(-8, -1).map((bar) => bar.v).filter((n) => n > 0);
      const base = mean(vols);
      bars.push({
        id: 1_000_000 + EQUITIES.indexOf(spec),
        symbol: spec.symbol,
        name: spec.name,
        group: spec.group,
        price: Number(result?.meta?.regularMarketPrice) || last.c,
        mcap: Number(result?.meta?.marketCap) || 0,
        volume: last.v,
        change1: prev.c > 0 ? last.c / prev.c - 1 : 0,
        change7: week.c > 0 ? last.c / week.c - 1 : 0,
        volChange: base > 0 ? last.v / base - 1 : 0,
        sigma: sd > 1e-8 ? (today - mean(prior)) / sd : 0,
        realized: stdev(rs.slice(-14)),
        closes,
      });
    } catch {
      /* skip a name that did not answer */
    }
  });
  return bars;
}

function cmcGroup(tags: string[]) {
  const blob = tags.join(" ");
  if (blob.includes("stablecoin")) return "Stables";
  if (blob.includes("memes")) return "Meme";
  if (blob.includes("defi") || blob.includes("decentralized-finance")) return "DeFi";
  if (blob.includes("artificial-intelligence") || blob.includes("ai-big-data")) return "AI";
  if (blob.includes("gaming") || blob.includes("metaverse")) return "Gaming";
  if (blob.includes("real-world") || blob.includes("tokenized")) return "Real world";
  if (blob.includes("layer-2") || blob.includes("scaling")) return "Layer 2";
  if (blob.includes("layer-1") || blob.includes("smart-contracts")) return "Layer 1";
  return "Other listed";
}

async function cmcBars(): Promise<Bar[]> {
  const raw = await getText(
    "https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=100&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false",
  );
  try {
    const body = JSON.parse(raw) as {
      data?: {
        cryptoCurrencyList?: {
          id: number;
          name: string;
          symbol: string;
          tags?: string[];
          quotes?: { price?: number; volume24h?: number; marketCap?: number; percentChange24h?: number; percentChange7d?: number; volumePercentChange?: number }[];
        }[];
      };
    };
    return (body.data?.cryptoCurrencyList ?? [])
      .map((row) => {
        const quote = row.quotes?.[0];
        const change1 = Number(quote?.percentChange24h);
        const change7 = Number(quote?.percentChange7d);
        const volChange = Number(quote?.volumePercentChange);
        const price = Number(quote?.price) || 0;
        if (!(price > 0) || Math.abs(change1) > 500) return null;
        return {
          id: row.id,
          symbol: row.symbol,
          name: row.name,
          group: cmcGroup(row.tags ?? []),
          price,
          mcap: Number(quote?.marketCap) || 0,
          volume: Number(quote?.volume24h) || 0,
          change1: Number.isFinite(change1) ? change1 / 100 : 0,
          change7: Number.isFinite(change7) ? change7 / 100 : 0,
          volChange: Number.isFinite(volChange) ? volChange / 100 : 0,
          sigma: 0,
          realized: Math.abs(Number.isFinite(change1) ? change1 / 100 : 0),
          closes: [] as Bar["closes"],
        };
      })
      .filter((row): row is Bar => row != null);
  } catch {
    return [];
  }
}

async function load(kind: "equities" | "cmc") {
  const hit = cache.get(kind);
  if (hit && Date.now() - hit.at < (kind === "equities" ? 60_000 : 90_000)) return hit.book;
  const bars = kind === "equities" ? await equityBars() : await cmcBars();
  const book = assemble(bars, kind === "equities" ? "SPY" : "BTC");
  if (book.assets.length) cache.set(kind, { at: Date.now(), book });
  return book;
}

export const loadListedBook = createServerFn({ method: "POST" })
  .validator((kind: string) => (kind === "cmc" ? "cmc" : "equities"))
  .handler(async ({ data }) => load(data));
