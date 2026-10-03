export type Venue = "US" | "EU" | "AS";
export type PlaceKind = "stock" | "crypto" | "good" | "index";

const GOODS = new Set(["GOLD", "SILVER", "COPPER", "PLAT", "WTI", "BRENT", "NATGAS", "CORN", "WHEAT", "COFFEE", "SUGAR"]);
const INDEXES = new Set(["SPY", "QQQ", "DIA", "IWM"]);

/** Where the project was started. A later registration, or a move, does not count. Anonymous coins stay off. */
const CRYPTO_HOME: Record<string, string> = {
  ETH: "CH", SOL: "US", XRP: "US", ADA: "CH", AVAX: "US", DOT: "CH", TRX: "CN", TON: "AE", ATOM: "US", NEAR: "US",
  SUI: "US", APT: "US", HBAR: "US", ALGO: "US", EGLD: "RO", ARB: "US", OP: "US", POL: "IN", STRK: "IL", MNT: "SG",
  UNI: "US", AAVE: "FI", MKR: "DK", LINK: "US", INJ: "US", PENDLE: "SG", TAO: "CA", FET: "GB",
  RENDER: "US", AKT: "US", WLD: "US", SAND: "HK", MANA: "AR", AXS: "VN", GALA: "US", IMX: "AU", FIL: "US", AR: "GB",
  USDT: "US", USDC: "US", DAI: "DK", BNB: "CN", OKB: "CN", CRO: "HK", LTC: "US", DOGE: "US", ZEC: "US", ONDO: "US", PAXG: "US",
};

/** Public companies and the funds in this book. Commodities are not companies. */
const STOCK_HOME: Record<string, string> = {
  SPY: "US", QQQ: "US", DIA: "US", IWM: "US",
  AAPL: "US", MSFT: "US", NVDA: "US", AVGO: "SG", ORCL: "US", AMD: "US",
  AMZN: "US", TSLA: "US", WMT: "US", COST: "US", HD: "US", PG: "US", KO: "US",
  META: "US", GOOGL: "US", NFLX: "US", DIS: "US",
  JPM: "US", V: "US", MA: "US", BAC: "US",
  UNH: "US", LLY: "US", JNJ: "US",
  XOM: "US", CVX: "US",
};

/** Where the main book trades. A Cayman registration can still trade in New York. */
const CRYPTO_TRADE: Record<string, Venue> = {
  BTC: "US", ETH: "US", SOL: "US", XRP: "US", ADA: "US", AVAX: "US", DOT: "US", LINK: "US", UNI: "US", AAVE: "US",
  LTC: "US", DOGE: "US", SHIB: "US", USDC: "US", DAI: "US", MKR: "US", HBAR: "US", ONDO: "US", PAXG: "US", ZEC: "US",
  RENDER: "US", AKT: "US", WLD: "US", GALA: "US", FIL: "US", AR: "US", ATOM: "US", NEAR: "US",
  BNB: "AS", OKB: "AS", TRX: "AS", TON: "AS", SUI: "AS", APT: "AS", CRO: "AS", INJ: "AS", RUNE: "AS", LDO: "AS",
  PENDLE: "AS", TAO: "AS", FET: "AS", SAND: "AS", MANA: "AS", AXS: "AS", IMX: "AS", EGLD: "AS", ALGO: "AS",
  POL: "AS", STRK: "AS", MNT: "AS", PEPE: "AS", BONK: "AS", FLOKI: "AS", WIF: "AS", USDT: "AS", ARB: "AS", OP: "AS",
};

const CITY: Record<string, string> = {
  AAPL: "Bay Area", NVDA: "Bay Area", AVGO: "Bay Area", AMD: "Bay Area", META: "Bay Area", GOOGL: "Bay Area", NFLX: "Bay Area", CVX: "Bay Area",
  MSFT: "Seattle", AMZN: "Seattle", COST: "Seattle",
  TSLA: "Texas", ORCL: "Texas", XOM: "Texas",
  JPM: "New York", V: "New York", MA: "New York", BAC: "New York", JNJ: "New York",
};

export const CITIES: { id: string; x: number; y: number }[] = [
  { id: "New York", x: 294.4, y: 208.8 },
  { id: "Bay Area", x: 160.8, y: 220.6 },
  { id: "Seattle", x: 160.2, y: 182.2 },
  { id: "Texas", x: 229.7, y: 242 },
];

export const REGION_OF: Record<string, string> = {
  US: "North America", CA: "North America", MX: "North America",
  GB: "Europe", CH: "Europe", DE: "Europe", FR: "Europe", NL: "Europe", IE: "Europe", LU: "Europe", RO: "Europe",
  SG: "Asia", HK: "Asia", JP: "Asia", KR: "Asia", CN: "Asia", IN: "Asia", AU: "Oceania",
  AE: "Middle East", IL: "Middle East", QA: "Middle East", BH: "Middle East",
  KY: "Caribbean", VG: "Caribbean", AR: "Latin America", BR: "Latin America",
};

export const FOCUS_REGIONS = ["North America", "Europe", "Asia", "Middle East"] as const;

export function homeOf(symbol: string, listed: boolean): string | null {
  if (!listed) return CRYPTO_HOME[symbol] ?? null;
  return STOCK_HOME[symbol] ?? null;
}

export function tradeOf(symbol: string, listed: boolean): Venue {
  if (listed) return symbol === "BRENT" ? "EU" : "US";
  return CRYPTO_TRADE[symbol] ?? "AS";
}

export function kindOf(symbol: string, listed: boolean): PlaceKind {
  if (!listed) return "crypto";
  if (GOODS.has(symbol)) return "good";
  if (INDEXES.has(symbol)) return "index";
  return "stock";
}

export function cityOf(symbol: string): string | null {
  return CITY[symbol] ?? null;
}

export const TRADE_HUB: Record<Venue, string> = { US: "US", EU: "GB", AS: "SG" };
