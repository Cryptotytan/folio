import { createServerFn } from "@tanstack/react-start";

export const probeCmc = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.CMC_API_KEY;
  if (!key) {
    return {
      ok: false as const,
      status: "DEMO" as const,
      message:
        "No CMC_API_KEY is configured. Folio is showing the labeled demo snapshot, not live CoinMarketCap quotes.",
    };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest?id=1,1027,5426",
      {
        headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
        signal: ctrl.signal,
      },
    );
    const credit =
      res.headers.get("x-cmc-pro-api-credit-count") ??
      res.headers.get("cmc-credit-count");
    if (!res.ok) {
      return {
        ok: false as const,
        status: "DEGRADED" as const,
        http: res.status,
        message: "CoinMarketCap rejected the probe. The demo snapshot remains active.",
      };
    }
    const body = (await res.json()) as {
      data?: Record<string, { symbol?: string; quote?: { USD?: { price?: number; volume_24h?: number; last_updated?: string } } }>;
    };
    const quotes = [1, 1027, 5426].map((id) => {
      const row = body.data?.[String(id)];
      const usd = row?.quote?.USD;
      return {
        id,
        symbol: row?.symbol ?? null,
        price: usd?.price ?? null,
        volume24h: usd?.volume_24h ?? null,
        lastUpdated: usd?.last_updated ?? null,
      };
    });
    return {
      ok: true as const,
      status: "LIVE" as const,
      http: res.status,
      endpoint: "GET /v3/cryptocurrency/quotes/latest",
      credits: credit,
      quotes,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      ok: false as const,
      status: "DEGRADED" as const,
      message: timedOut ? "The CoinMarketCap probe timed out." : "Network error calling CoinMarketCap.",
    };
  } finally {
    clearTimeout(timer);
  }
});
