import { createServerFn } from "@tanstack/react-start";
import snap from "@/lib/faultline/snapshot-lite.json";

export type LiveQuote = {
  symbol: string;
  price: number;
  volume: number;
  change1: number;
  change7?: number;
  volChange?: number;
  sigma?: number;
  realizedVol?: number;
  mcap?: number;
  health?: number;
  healthPrev?: number;
  neighbors?: { symbol: string; score: number }[];
};

export type JournalEvent = {
  id: string;
  at: string;
  kind: "opened" | "updated" | "closed";
  assetId: number;
  symbol: string;
  name: string;
  faultType: string | null;
  faultMag: number | null;
  faultText: string | null;
};

export type JournalNotice = {
  id: string;
  at: string;
  asset: number;
  symbol: string;
  name: string;
  tab: "faults" | "health";
  title: string;
  text: string;
};

type Book = {
  day: string;
  source: "okx" | "model";
  quotes: LiveQuote[];
};

type Hist = { change7: number; volChange: number; sigma: number; realizedVol: number; rets: number[] };

const meta = new Map((snap.assets as { id: number; symbol: string; name: string }[]).map((a) => [a.symbol, a]));
const sectors = (snap.sectors as { name: string; assetIds: number[] }[]).map((s) => ({
  name: s.name,
  symbols: s.assetIds.map((id) => (snap.assets as { id: number; symbol: string }[]).find((a) => a.id === id)?.symbol).filter((s): s is string => Boolean(s)),
}));

type Disk = {
  health: Record<string, number>;
  healthAt: number;
  faults: Record<string, { mag: number; type: string | null; text: string | null }>;
  events: JournalEvent[];
  notices: JournalNotice[];
};

const EMPTY_DISK: Disk = { health: {}, healthAt: 0, faults: {}, events: [], notices: [] };
let disk = EMPTY_DISK;
let diskRead = false;
const JOURNAL = "/workspace/.data/market-journal.json";

let cache: (Book & { at: number }) | null = null;
const tracked = (snap.assets as { symbol: string }[]).map((a) => a.symbol);
const trackedSet = new Set(tracked);
const history = new Map<string, Hist>();
let historyAt = 0;
let historyFlight: Promise<void> | null = null;

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((s, n) => s + n, 0) / xs.length;
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, n) => s + (n - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

async function oneHistory(symbol: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=1D&limit=30`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { data?: string[][] };
    const rows = (body.data ?? [])
      .map((row) => ({ c: Number(row[4]), v: Number(row[7] ?? row[6]) }))
      .filter((row) => row.c > 0)
      .reverse();
    if (rows.length < 8) return;
    const last = rows.length - 1;
    const prev = rows[last - 7].c;
    const rets: number[] = [];
    for (let i = 1; i < rows.length; i++) rets.push(rows[i].c / rows[i - 1].c - 1);
    const prior = rets.slice(0, -1);
    const sd = stdev(prior);
    const today = rets[rets.length - 1];
    const vols = rows.slice(last - 7, last).map((row) => row.v).filter((n) => n > 0);
    const base = mean(vols);
    history.set(symbol, {
      change7: prev > 0 ? rows[last].c / prev - 1 : 0,
      volChange: base > 0 ? rows[last].v / base - 1 : 0,
      sigma: sd > 1e-8 ? (today - mean(prior)) / sd : 0,
      realizedVol: stdev(rets.slice(-14)),
      rets: rets.slice(-14),
    });
  } catch {
    /* keep the last reading */
  } finally {
    clearTimeout(timer);
  }
}

function ensureHistory() {
  if (historyFlight) return;
  if (history.size > 0 && Date.now() - historyAt < 10 * 60 * 1000) return;
  historyFlight = (async () => {
    let i = 0;
    async function worker() {
      while (i < tracked.length) {
        const symbol = tracked[i++];
        await oneHistory(symbol);
      }
    }
    await Promise.all(Array.from({ length: 6 }, () => worker()));
    historyAt = Date.now();
  })().finally(() => {
    historyFlight = null;
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function cosine(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length, 14);
  if (n < 8) return 0;
  const left = a.slice(-n);
  const right = b.slice(-n);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += left[i] * right[i];
    na += left[i] * left[i];
    nb += right[i] * right[i];
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / Math.sqrt(na * nb);
}

function neighborsFor(symbol: string) {
  const mine = history.get(symbol)?.rets;
  if (!mine) return undefined;
  const scored = tracked
    .filter((other) => other !== symbol)
    .map((other) => {
      const rets = history.get(other)?.rets;
      if (!rets) return null;
      return { symbol: other, score: Math.round(((cosine(mine, rets) + 1) / 2) * 100) };
    })
    .filter((row): row is { symbol: string; score: number } => row != null && row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.length ? scored : undefined;
}

function band(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Stable";
  if (score >= 50) return "Watch";
  if (score >= 35) return "Deteriorating";
  return "Severe deterioration";
}

async function readDisk() {
  if (diskRead) return disk;
  diskRead = true;
  try {
    const { readFile } = await import("node:fs/promises");
    const parsed = JSON.parse(await readFile(JOURNAL, "utf8")) as Disk;
    if (parsed && Array.isArray(parsed.events) && parsed.health && parsed.faults) {
      disk = { ...EMPTY_DISK, ...parsed, notices: Array.isArray(parsed.notices) ? parsed.notices : [] };
    }
  } catch {
    disk = EMPTY_DISK;
  }
  return disk;
}

async function writeDisk(next: Disk) {
  disk = next;
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir("/workspace/.data", { recursive: true });
    await writeFile(JOURNAL, JSON.stringify(next));
  } catch {
    /* the in-memory copy still serves this process */
  }
}

let caps: { at: number; map: Map<string, number> } | null = null;

async function marketCaps() {
  if (caps && Date.now() - caps.at < 5 * 60 * 1000 && caps.map.size) return caps.map;
  const map = new Map<string, number>();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://api.coinpaprika.com/v1/tickers?quotes=USD", {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { symbol?: string; quotes?: { USD?: { market_cap?: number } } }[];
    for (const row of body) {
      const symbol = row.symbol?.toUpperCase();
      const cap = row.quotes?.USD?.market_cap;
      if (!symbol || !trackedSet.has(symbol) || !(cap && cap > 0)) continue;
      const prev = map.get(symbol) ?? 0;
      if (cap > prev) map.set(symbol, cap);
    }
  } catch {
    /* keep the last cap map */
  }
  if (map.size) caps = { at: Date.now(), map };
  return caps?.map ?? map;
}

function settle(quotes: LiveQuote[]) {
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const btc7 = bySymbol.get("BTC")?.change7 ?? 0;
  const sectorOf = new Map<string, { name: string; ret7: number }>();
  for (const sector of sectors) {
    const vals = sector.symbols.map((symbol) => bySymbol.get(symbol)?.change7).filter((n): n is number => n != null);
    const ret7 = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0;
    for (const symbol of sector.symbols) sectorOf.set(symbol, { name: sector.name, ret7 });
  }
  const now = new Date().toISOString();
  const prime = disk.events.length === 0 && disk.notices.length === 0 && Object.keys(disk.faults).length === 0;
  const events = disk.events.slice();
  const notices = disk.notices.slice();
  const faults = { ...disk.faults };
  const health = { ...disk.health };
  const smooth = Date.now() - disk.healthAt > 10 * 60 * 1000;
  const live = new Set<string>();
  for (const quote of quotes) {
    const info = meta.get(quote.symbol);
    if (!info) continue;
    if (quote.change7 != null && quote.volChange != null && quote.realizedVol != null) {
      const relative = clamp(50 + (quote.change7 - btc7) * 250, 0, 100);
      const volumePart = clamp(50 + quote.volChange * 40, 0, 100);
      const stability = clamp(100 - quote.realizedVol * 800, 0, 100);
      const raw = Math.round(relative * 0.45 + volumePart * 0.25 + stability * 0.3);
      const prev = health[quote.symbol];
      const next = !smooth || prev == null ? (prev ?? raw) : Math.round(prev * 0.85 + raw * 0.15);
      if (smooth || prev == null) {
        if (prev != null && !prime && band(next) !== band(prev) && next < prev) {
          notices.unshift({
            id: `${quote.symbol}-${now}-health`,
            at: now,
            asset: info.id,
            symbol: quote.symbol,
            name: info.name,
            tab: "health",
            title: `${quote.symbol} dropped a health band`,
            text: `${band(prev)} to ${band(next)}.`,
          });
        }
        quote.healthPrev = prev ?? next;
        health[quote.symbol] = next;
      }
      quote.health = health[quote.symbol] ?? next;
      quote.healthPrev = quote.healthPrev ?? prev ?? quote.health;
    }
    quote.neighbors = neighborsFor(quote.symbol);
    let faultType: string | null = null;
    let faultMag = 0;
    let faultText: string | null = null;
    const sector = sectorOf.get(quote.symbol);
    if (quote.change7 != null && quote.volChange != null && quote.change1 > 0.02 && quote.volChange < -0.2) {
      faultType = "PRICE_VOLUME_DIVERGENCE";
      faultMag = clamp(5 + Math.abs(quote.volChange) * 4, 5, 10);
      faultText = "Price is up while volume is below this asset's own recent week.";
    } else if (quote.change7 != null && sector && quote.change7 < -0.015 && sector.ret7 > 0.015) {
      faultType = "ASSET_DOWN_CATEGORY_UP";
      faultMag = clamp(5 + (sector.ret7 - quote.change7) * 20, 5, 10);
      faultText = `${quote.symbol} is down over 7 days while ${sector.name} is up.`;
    }
    const mag = Math.round(faultMag * 10) / 10;
    if (faultType) {
      live.add(quote.symbol);
      const prev = faults[quote.symbol];
      if (!prev) {
        if (!prime) {
          events.unshift(entry(now, "opened", info, faultType, mag, faultText));
          notices.unshift(notice(now, info, "faults", `${quote.symbol} crossed into a fault`, faultText));
        }
      } else if (!prime && (prev.type !== faultType || Math.abs(prev.mag - mag) >= 0.5)) {
        events.unshift(entry(now, "updated", info, faultType, mag, faultText));
        notices.unshift(notice(now, info, "faults", `${quote.symbol} fault changed`, faultText));
      }
      faults[quote.symbol] = { mag, type: faultType, text: faultText };
    }
  }
  for (const symbol of Object.keys(faults)) {
    if (live.has(symbol)) continue;
    const prev = faults[symbol];
    const info = meta.get(symbol);
    if (!info || prime) continue;
    events.unshift(entry(now, "closed", info, prev.type, prev.mag, prev.text));
    notices.unshift(notice(now, info, "faults", `${symbol} fault cleared`, prev.text || "The contradiction is no longer large enough to list."));
    delete faults[symbol];
  }
  if (prime || events.length !== disk.events.length || notices.length !== disk.notices.length || smooth) {
    void writeDisk({
      health,
      healthAt: smooth || Object.keys(health).length !== Object.keys(disk.health).length ? Date.now() : disk.healthAt,
      faults,
      events,
      notices,
    });
  }
}

function entry(at: string, kind: JournalEvent["kind"], info: { id: number; symbol: string; name: string }, faultType: string | null, faultMag: number, faultText: string | null): JournalEvent {
  return { id: `${info.symbol}-${at}-${kind}`, at, kind, assetId: info.id, symbol: info.symbol, name: info.name, faultType, faultMag, faultText };
}

function notice(at: string, info: { id: number; symbol: string; name: string }, tab: "faults" | "health", title: string, text: string | null): JournalNotice {
  return { id: `${info.symbol}-${at}-${tab}`, at, asset: info.id, symbol: info.symbol, name: info.name, tab, title, text: text || title };
}

async function pull(): Promise<Book> {
  const day = utcDay();
  ensureHistory();
  if (cache && cache.day === day && Date.now() - cache.at < 15_000) return cache;
  const capTask = marketCaps();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const [res] = await Promise.all([
      fetch("https://www.okx.com/api/v5/market/tickers?instType=SPOT", {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      }),
      readDisk(),
    ]);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as {
      data?: { instId?: string; last?: string; open24h?: string; volCcy24h?: string }[];
    };
    const capMap = caps?.map ?? new Map<string, number>();
    const quotes: LiveQuote[] = [];
    for (const row of body.data ?? []) {
      if (!row.instId?.endsWith("-USDT")) continue;
      const symbol = row.instId.slice(0, -5);
      if (!trackedSet.has(symbol)) continue;
      const price = Number(row.last);
      const open = Number(row.open24h);
      const volume = Number(row.volCcy24h);
      if (!Number.isFinite(price) || price <= 0) continue;
      const hist = history.get(symbol);
      quotes.push({
        symbol,
        price,
        volume: Number.isFinite(volume) ? volume : 0,
        change1: open > 0 ? (price - open) / open : 0,
        change7: hist?.change7,
        volChange: hist?.volChange,
        sigma: hist?.sigma,
        realizedVol: hist?.realizedVol,
        mcap: capMap.get(symbol),
      });
    }
    if (quotes.length) settle(quotes);
    cache = { day, source: quotes.length ? "okx" : "model", quotes, at: Date.now() };
    void capTask.then((map) => {
      if (!cache || !map.size) return;
      for (const quote of cache.quotes) {
        const cap = map.get(quote.symbol);
        if (cap && cap > 0) quote.mcap = cap;
      }
    });
  } catch {
    cache = { day, source: "model", quotes: [], at: Date.now() };
  } finally {
    clearTimeout(timer);
  }
  return cache;
}

const TAPE = ["BTC", "ETH", "SOL"] as const;

async function oneTape(symbol: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { last?: string; open24h?: string }[] };
    const row = body.data?.[0];
    const price = Number(row?.last);
    const open = Number(row?.open24h);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { symbol, price, change1: open > 0 ? (price - open) / open : 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const loadTape = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await Promise.all(TAPE.map((symbol) => oneTape(symbol)));
  return rows.filter((row): row is { symbol: string; price: number; change1: number } => row != null);
});

export const loadDailyBook = createServerFn({ method: "GET" }).handler(async () => pull());

export const loadMarketJournal = createServerFn({ method: "GET" }).handler(async () => {
  await readDisk();
  return { events: disk.events, notices: disk.notices };
});

if (typeof window === "undefined") {
  setInterval(() => {
    pull().catch(() => {});
  }, 60_000);
}
