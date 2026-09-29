import { CATEGORIES, type CategoryId, DAYS, SNAPSHOT_AS_OF } from "./config.ts";

export type Shock = { from: number; drift: number; volumeMul: number };

export type AssetSpec = {
  id: number;
  symbol: string;
  name: string;
  category: CategoryId;
  price: number;
  mcap: number;
  /** Annualized total volatility used for Bitcoin; others use beta + idio. */
  vol: number;
  beta: number;
  idio: number;
  /** Annualized drift. */
  drift: number;
  volume: number;
  /** End/start volume ratio across the full window, before any shock. */
  volumeEnd: number;
  shock?: Shock;
};

/**
 * Illustrative fixture. Prices, volumes and paths are a labeled demo snapshot,
 * not live CoinMarketCap quotes. `id` values are published CMC ids used as stable keys.
 */
export const SPECS: AssetSpec[] = [
  { id: 1, symbol: "BTC", name: "Bitcoin", category: "monetary", price: 64200, mcap: 1.27e12, vol: 0.46, beta: 1, idio: 0.02, drift: 0.28, volume: 32e9, volumeEnd: 1.08 },
  { id: 1831, symbol: "BCH", name: "Bitcoin Cash", category: "monetary", price: 410, mcap: 8.1e9, vol: 0.72, beta: 0.74, idio: 0.38, drift: 0.05, volume: 380e6, volumeEnd: 0.9 },
  { id: 2, symbol: "LTC", name: "Litecoin", category: "monetary", price: 78, mcap: 5.9e9, vol: 0.64, beta: 0.7, idio: 0.3, drift: 0.06, volume: 420e6, volumeEnd: 0.95 },

  { id: 1027, symbol: "ETH", name: "Ethereum", category: "l1", price: 3180, mcap: 382e9, vol: 0.58, beta: 0.86, idio: 0.22, drift: 0.32, volume: 15e9, volumeEnd: 1.12 },
  { id: 5426, symbol: "SOL", name: "Solana", category: "l1", price: 148, mcap: 71e9, vol: 0.88, beta: 0.8, idio: 0.48, drift: 0.48, volume: 3.4e9, volumeEnd: 1.35 },
  { id: 52, symbol: "XRP", name: "XRP", category: "l1", price: 0.58, mcap: 33e9, vol: 0.7, beta: 0.48, idio: 0.52, drift: 0.12, volume: 1.6e9, volumeEnd: 1.05 },
  { id: 2010, symbol: "ADA", name: "Cardano", category: "l1", price: 0.42, mcap: 15e9, vol: 0.76, beta: 0.72, idio: 0.36, drift: -0.08, volume: 420e6, volumeEnd: 0.82 },
  { id: 5805, symbol: "AVAX", name: "Avalanche", category: "l1", price: 27, mcap: 11e9, vol: 0.92, beta: 0.8, idio: 0.42, drift: 0.14, volume: 480e6, volumeEnd: 1.1 },
  { id: 6636, symbol: "DOT", name: "Polkadot", category: "l1", price: 4.8, mcap: 7.2e9, vol: 0.8, beta: 0.74, idio: 0.36, drift: -0.12, volume: 210e6, volumeEnd: 0.78 },
  { id: 1958, symbol: "TRX", name: "TRON", category: "l1", price: 0.16, mcap: 14e9, vol: 0.42, beta: 0.34, idio: 0.28, drift: 0.22, volume: 620e6, volumeEnd: 1.15 },
  { id: 11419, symbol: "TON", name: "Toncoin", category: "l1", price: 5.6, mcap: 14e9, vol: 0.74, beta: 0.42, idio: 0.5, drift: 0.04, volume: 280e6, volumeEnd: 0.9 },
  { id: 3794, symbol: "ATOM", name: "Cosmos", category: "l1", price: 5.4, mcap: 2.1e9, vol: 0.7, beta: 0.28, idio: 0.22, drift: 0.02, volume: 140e6, volumeEnd: 1.0, shock: { from: 108, drift: 0.0, volumeMul: 2.5 } },
  { id: 6535, symbol: "NEAR", name: "NEAR Protocol", category: "l1", price: 4.1, mcap: 4.5e9, vol: 0.85, beta: 0.5, idio: 0.32, drift: 0.06, volume: 260e6, volumeEnd: 1.05, shock: { from: 106, drift: 0.0, volumeMul: 2.1 } },
  { id: 20947, symbol: "SUI", name: "Sui", category: "l1", price: 1.85, mcap: 6.6e9, vol: 1.05, beta: 0.74, idio: 0.58, drift: 0.4, volume: 720e6, volumeEnd: 1.45 },
  { id: 21794, symbol: "APT", name: "Aptos", category: "l1", price: 7.4, mcap: 3.5e9, vol: 0.96, beta: 0.76, idio: 0.44, drift: 0.16, volume: 210e6, volumeEnd: 1.12 },
  { id: 4642, symbol: "HBAR", name: "Hedera", category: "l1", price: 0.17, mcap: 6.4e9, vol: 0.84, beta: 0.4, idio: 0.55, drift: 0.18, volume: 180e6, volumeEnd: 1.2 },
  { id: 4030, symbol: "ALGO", name: "Algorand", category: "l1", price: 0.16, mcap: 1.4e9, vol: 0.74, beta: 0.55, idio: 0.4, drift: -0.06, volume: 70e6, volumeEnd: 0.88 },
  { id: 6892, symbol: "EGLD", name: "MultiversX", category: "l1", price: 29, mcap: 0.82e9, vol: 0.96, beta: 0.58, idio: 0.52, drift: -0.18, volume: 36e6, volumeEnd: 0.7 },

  { id: 11841, symbol: "ARB", name: "Arbitrum", category: "l2", price: 0.82, mcap: 3.1e9, vol: 0.92, beta: 0.78, idio: 0.42, drift: 0.06, volume: 280e6, volumeEnd: 1.08 },
  { id: 11840, symbol: "OP", name: "Optimism", category: "l2", price: 1.55, mcap: 1.7e9, vol: 0.98, beta: 0.8, idio: 0.44, drift: 0.0, volume: 160e6, volumeEnd: 0.92 },
  { id: 28321, symbol: "POL", name: "Polygon", category: "l2", price: 0.41, mcap: 3.8e9, vol: 0.86, beta: 0.74, idio: 0.4, drift: -0.1, volume: 190e6, volumeEnd: 0.8 },
  { id: 22691, symbol: "STRK", name: "Starknet", category: "l2", price: 0.46, mcap: 1.05e9, vol: 1.12, beta: 0.68, idio: 0.62, drift: -0.22, volume: 110e6, volumeEnd: 0.62, shock: { from: 96, drift: -0.8, volumeMul: 0.7 } },
  { id: 27075, symbol: "MNT", name: "Mantle", category: "l2", price: 0.7, mcap: 2.3e9, vol: 0.82, beta: 0.62, idio: 0.42, drift: 0.18, volume: 140e6, volumeEnd: 1.25 },

  { id: 7083, symbol: "UNI", name: "Uniswap", category: "defi", price: 8.4, mcap: 5.1e9, vol: 0.78, beta: 0.7, idio: 0.4, drift: 0.1, volume: 180e6, volumeEnd: 1.05 },
  { id: 7278, symbol: "AAVE", name: "Aave", category: "defi", price: 168, mcap: 2.5e9, vol: 0.86, beta: 0.66, idio: 0.48, drift: 0.22, volume: 160e6, volumeEnd: 1.3 },
  { id: 1518, symbol: "MKR", name: "Maker", category: "defi", price: 1540, mcap: 1.4e9, vol: 0.8, beta: 0.55, idio: 0.5, drift: 0.08, volume: 48e6, volumeEnd: 0.95 },
  { id: 1975, symbol: "LINK", name: "Chainlink", category: "defi", price: 13.5, mcap: 8.4e9, vol: 0.74, beta: 0.7, idio: 0.36, drift: 0.2, volume: 420e6, volumeEnd: 1.18 },
  { id: 7226, symbol: "INJ", name: "Injective", category: "defi", price: 18, mcap: 1.8e9, vol: 1.05, beta: 0.72, idio: 0.6, drift: 0.16, volume: 120e6, volumeEnd: 1.1 },
  { id: 4157, symbol: "RUNE", name: "THORChain", category: "defi", price: 4.2, mcap: 1.4e9, vol: 1.0, beta: 0.6, idio: 0.62, drift: -0.05, volume: 90e6, volumeEnd: 0.85 },
  { id: 8000, symbol: "LDO", name: "Lido DAO", category: "defi", price: 1.35, mcap: 1.2e9, vol: 0.95, beta: 0.75, idio: 0.48, drift: 0.05, volume: 80e6, volumeEnd: 0.9 },
  { id: 9481, symbol: "PENDLE", name: "Pendle", category: "defi", price: 3.8, mcap: 0.62e9, vol: 1.1, beta: 0.62, idio: 0.7, drift: 0.12, volume: 70e6, volumeEnd: 1.15 },

  { id: 22974, symbol: "TAO", name: "Bittensor", category: "ai", price: 310, mcap: 3.2e9, vol: 1.15, beta: 0.55, idio: 0.8, drift: 0.7, volume: 180e6, volumeEnd: 1.7, shock: { from: 94, drift: 1.4, volumeMul: 1.55 } },
  { id: 3773, symbol: "FET", name: "Artificial Superintelligence Alliance", category: "ai", price: 1.25, mcap: 3.1e9, vol: 1.2, beta: 0.6, idio: 0.75, drift: 0.45, volume: 220e6, volumeEnd: 1.5, shock: { from: 96, drift: 0.8, volumeMul: 1.4 } },
  { id: 5690, symbol: "RENDER", name: "Render", category: "ai", price: 6.4, mcap: 3.3e9, vol: 1.1, beta: 0.62, idio: 0.7, drift: 0.55, volume: 160e6, volumeEnd: 1.6, shock: { from: 94, drift: 1.1, volumeMul: 1.45 } },
  { id: 7431, symbol: "AKT", name: "Akash", category: "ai", price: 2.8, mcap: 0.7e9, vol: 1.25, beta: 0.5, idio: 0.9, drift: 0.35, volume: 40e6, volumeEnd: 1.35 },
  { id: 13502, symbol: "WLD", name: "Worldcoin", category: "ai", price: 2.15, mcap: 1.15e9, vol: 1.05, beta: 0.35, idio: 0.55, drift: -0.05, volume: 240e6, volumeEnd: 1.0, shock: { from: 104, drift: 7.4, volumeMul: 0.28 } },

  { id: 74, symbol: "DOGE", name: "Dogecoin", category: "meme", price: 0.14, mcap: 20e9, vol: 0.95, beta: 0.55, idio: 0.7, drift: 0.18, volume: 1.4e9, volumeEnd: 1.25 },
  { id: 5994, symbol: "SHIB", name: "Shiba Inu", category: "meme", price: 0.000018, mcap: 10.6e9, vol: 1.05, beta: 0.5, idio: 0.8, drift: 0.05, volume: 380e6, volumeEnd: 0.95 },
  { id: 24478, symbol: "PEPE", name: "Pepe", category: "meme", price: 0.0000094, mcap: 4e9, vol: 1.45, beta: 0.42, idio: 1.15, drift: 0.35, volume: 720e6, volumeEnd: 1.4 },
  { id: 23095, symbol: "BONK", name: "Bonk", category: "meme", price: 0.000021, mcap: 1.6e9, vol: 1.5, beta: 0.4, idio: 1.2, drift: 0.1, volume: 180e6, volumeEnd: 1.05 },
  { id: 10804, symbol: "FLOKI", name: "FLOKI", category: "meme", price: 0.00014, mcap: 1.35e9, vol: 1.4, beta: 0.45, idio: 1.1, drift: -0.05, volume: 150e6, volumeEnd: 0.8 },
  { id: 28752, symbol: "WIF", name: "dogwifhat", category: "meme", price: 1.55, mcap: 1.55e9, vol: 1.6, beta: 0.38, idio: 1.3, drift: 0.2, volume: 260e6, volumeEnd: 1.2 },

  { id: 6210, symbol: "SAND", name: "The Sandbox", category: "gaming", price: 0.32, mcap: 0.74e9, vol: 0.95, beta: 0.62, idio: 0.55, drift: -0.2, volume: 70e6, volumeEnd: 0.7, shock: { from: 94, drift: -1.3, volumeMul: 0.55 } },
  { id: 1966, symbol: "MANA", name: "Decentraland", category: "gaming", price: 0.34, mcap: 0.65e9, vol: 0.98, beta: 0.6, idio: 0.58, drift: -0.25, volume: 55e6, volumeEnd: 0.65, shock: { from: 94, drift: -1.1, volumeMul: 0.58 } },
  { id: 6783, symbol: "AXS", name: "Axie Infinity", category: "gaming", price: 5.4, mcap: 0.82e9, vol: 1.0, beta: 0.58, idio: 0.6, drift: -0.3, volume: 48e6, volumeEnd: 0.6, shock: { from: 96, drift: -1.4, volumeMul: 0.5 } },
  { id: 7080, symbol: "GALA", name: "Gala", category: "gaming", price: 0.022, mcap: 0.95e9, vol: 1.15, beta: 0.55, idio: 0.75, drift: -0.15, volume: 90e6, volumeEnd: 0.72, shock: { from: 96, drift: -0.9, volumeMul: 0.6 } },
  { id: 10603, symbol: "IMX", name: "Immutable", category: "gaming", price: 1.25, mcap: 2e9, vol: 1.05, beta: 0.64, idio: 0.62, drift: -0.05, volume: 60e6, volumeEnd: 0.78, shock: { from: 98, drift: -0.7, volumeMul: 0.62 } },

  { id: 2280, symbol: "FIL", name: "Filecoin", category: "storage", price: 4.6, mcap: 2.7e9, vol: 0.95, beta: 0.6, idio: 0.58, drift: -0.05, volume: 180e6, volumeEnd: 0.9 },
  { id: 5632, symbol: "AR", name: "Arweave", category: "storage", price: 18, mcap: 1.2e9, vol: 1.15, beta: 0.5, idio: 0.8, drift: 0.05, volume: 50e6, volumeEnd: 1.05 },

  { id: 825, symbol: "USDT", name: "Tether", category: "stable", price: 1, mcap: 118e9, vol: 0.015, beta: 0.01, idio: 0.012, drift: 0, volume: 48e9, volumeEnd: 1.04 },
  { id: 3408, symbol: "USDC", name: "USDC", category: "stable", price: 1, mcap: 36e9, vol: 0.012, beta: 0.01, idio: 0.01, drift: 0, volume: 8e9, volumeEnd: 1.08 },
  { id: 4943, symbol: "DAI", name: "Dai", category: "stable", price: 1, mcap: 4.8e9, vol: 0.018, beta: 0.02, idio: 0.014, drift: 0, volume: 280e6, volumeEnd: 0.96 },

  { id: 1839, symbol: "BNB", name: "BNB", category: "exchange", price: 590, mcap: 86e9, vol: 0.52, beta: 0.55, idio: 0.28, drift: 0.22, volume: 1.8e9, volumeEnd: 1.1 },
  { id: 3897, symbol: "OKB", name: "OKB", category: "exchange", price: 48, mcap: 2.9e9, vol: 0.7, beta: 0.4, idio: 0.5, drift: 0.1, volume: 40e6, volumeEnd: 0.9 },
  { id: 3635, symbol: "CRO", name: "Cronos", category: "exchange", price: 0.1, mcap: 2.6e9, vol: 0.75, beta: 0.48, idio: 0.48, drift: 0.05, volume: 28e6, volumeEnd: 0.85 },

  { id: 328, symbol: "XMR", name: "Monero", category: "privacy", price: 168, mcap: 3.1e9, vol: 0.7, beta: 0.35, idio: 0.5, drift: 0.12, volume: 80e6, volumeEnd: 1.05 },
  { id: 1437, symbol: "ZEC", name: "Zcash", category: "privacy", price: 42, mcap: 0.68e9, vol: 0.9, beta: 0.4, idio: 0.65, drift: 0.02, volume: 70e6, volumeEnd: 1.2 },

  { id: 21159, symbol: "ONDO", name: "Ondo", category: "rwa", price: 0.92, mcap: 2.9e9, vol: 1.05, beta: 0.4, idio: 0.75, drift: 0.28, volume: 160e6, volumeEnd: 1.35 },
  { id: 4705, symbol: "PAXG", name: "PAX Gold", category: "rwa", price: 2680, mcap: 620e6, vol: 0.16, beta: 0.05, idio: 0.14, drift: 0.12, volume: 40e6, volumeEnd: 1.02 },
];

export type SeriesAsset = Omit<AssetSpec, "price" | "volume" | "mcap"> & {
  returns: number[];
  price: number[];
  volume: number[];
  mcap: number[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  const v = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function buildReturns(spec: AssetSpec, btc: number[] | null): number[] {
  const rng = mulberry32(10_000 + spec.id);
  const out = new Array<number>(DAYS);
  for (let t = 0; t < DAYS; t++) {
    let drift = spec.drift / 365;
    if (spec.shock && t >= spec.shock.from) {
      const span = Math.max(1, DAYS - 1 - spec.shock.from);
      const u = (t - spec.shock.from) / span;
      drift += (spec.shock.drift / 365) * u;
    }
    const dailyIdio = (spec.symbol === "BTC" ? spec.vol : spec.idio) / Math.sqrt(365);
    const beta = spec.symbol === "BTC" || !btc ? 0 : spec.beta;
    out[t] = drift + beta * (btc ? btc[t] : 0) + dailyIdio * gauss(rng);
  }
  return out;
}

function materialize(spec: AssetSpec, returns: number[]): SeriesAsset {
  const rng = mulberry32(80_000 + spec.id);
  const rel = new Array<number>(DAYS);
  rel[0] = 1;
  for (let t = 1; t < DAYS; t++) rel[t] = rel[t - 1] * Math.exp(returns[t]);
  const scale = spec.price / rel[DAYS - 1];
  const price = rel.map((v) => v * scale);
  const supply = spec.mcap / spec.price;
  const mcap = price.map((p) => p * supply);
  const volume = new Array<number>(DAYS);
  const dailyVol = Math.max(0.004, (spec.symbol === "BTC" ? spec.vol : spec.idio) / Math.sqrt(365));
  for (let t = 0; t < DAYS; t++) {
    const trend = 1 + (spec.volumeEnd - 1) * (t / (DAYS - 1));
    let shockM = 1;
    if (spec.shock && t >= spec.shock.from) {
      const span = Math.max(1, DAYS - 1 - spec.shock.from);
      const u = (t - spec.shock.from) / span;
      shockM = 1 + (spec.shock.volumeMul - 1) * u;
    }
    const activity =
      spec.shock && t >= spec.shock.from && spec.shock.volumeMul < 1
        ? 1
        : Math.min(2.4, Math.exp((0.18 * Math.abs(returns[t])) / dailyVol));
    volume[t] = spec.volume * trend * shockM * (0.82 + 0.36 * rng()) * activity;
  }
  return { ...spec, returns, price, volume, mcap };
}

export function buildSeries(): SeriesAsset[] {
  const btcSpec = SPECS.find((s) => s.symbol === "BTC");
  if (!btcSpec) throw new Error("BTC missing from universe");
  const btcReturns = buildReturns(btcSpec, null);
  return SPECS.map((spec) => materialize(spec, spec.symbol === "BTC" ? btcReturns : buildReturns(spec, btcReturns)));
}

export function snapshotDates(): string[] {
  const [y, m, d] = SNAPSHOT_AS_OF.split("-").map(Number);
  const end = Date.UTC(y, m - 1, d);
  return Array.from({ length: DAYS }, (_, day) => {
    const t = end - (DAYS - 1 - day) * 86_400_000;
    return new Date(t).toISOString().slice(0, 10);
  });
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
