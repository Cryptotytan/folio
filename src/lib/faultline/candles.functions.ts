import { createServerFn } from "@tanstack/react-start";

export type Candle = {
  d: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type Cache = { at: number; rows: Candle[] };

const cache = new Map<string, Cache>();

function label(ts: number) {
  return new Date(ts).toISOString().slice(0, 16);
}

async function pull(symbol: string): Promise<Candle[]> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return hit.rows;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=1H&limit=72`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { data?: string[][] };
    const rows: Candle[] = [];
    for (const row of body.data ?? []) {
      const o = Number(row[1]);
      const h = Number(row[2]);
      const l = Number(row[3]);
      const c = Number(row[4]);
      const v = Number(row[7] ?? row[6]);
      if (![o, h, l, c].every((n) => Number.isFinite(n) && n > 0)) continue;
      rows.push({ d: label(Number(row[0])), o, h, l, c, v: Number.isFinite(v) ? v : 0 });
    }
    rows.reverse();
    cache.set(symbol, { at: Date.now(), rows });
    return rows;
  } catch {
    if (hit?.rows.length) return hit.rows;
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const loadCandles = createServerFn({ method: "POST" })
  .validator((symbol: string) => {
    const clean = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(clean)) throw new Error("Unknown symbol");
    return clean;
  })
  .handler(async ({ data }) => pull(data));
