import { createServerFn } from "@tanstack/react-start";

export type TapeRow = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change1: number;
  mcap: number;
  volume: number;
  group: string;
  coinId?: number;
};

export type Story = {
  reason: string;
  source: string;
  url: string;
  at: string;
};

const STOCKS: { symbol: string; name: string; group: string }[] = [
  { symbol: "SPY", name: "S&P 500", group: "Index" },
  { symbol: "QQQ", name: "Nasdaq 100", group: "Index" },
  { symbol: "DIA", name: "Dow Jones", group: "Index" },
  { symbol: "IWM", name: "Russell 2000", group: "Index" },
  { symbol: "AAPL", name: "Apple", group: "Technology" },
  { symbol: "MSFT", name: "Microsoft", group: "Technology" },
  { symbol: "NVDA", name: "Nvidia", group: "Technology" },
  { symbol: "AVGO", name: "Broadcom", group: "Technology" },
  { symbol: "ORCL", name: "Oracle", group: "Technology" },
  { symbol: "AMD", name: "AMD", group: "Technology" },
  { symbol: "AMZN", name: "Amazon", group: "Consumer" },
  { symbol: "TSLA", name: "Tesla", group: "Consumer" },
  { symbol: "WMT", name: "Walmart", group: "Consumer" },
  { symbol: "COST", name: "Costco", group: "Consumer" },
  { symbol: "HD", name: "Home Depot", group: "Consumer" },
  { symbol: "PG", name: "Procter & Gamble", group: "Consumer" },
  { symbol: "KO", name: "Coca-Cola", group: "Consumer" },
  { symbol: "META", name: "Meta", group: "Communication" },
  { symbol: "GOOGL", name: "Alphabet", group: "Communication" },
  { symbol: "NFLX", name: "Netflix", group: "Communication" },
  { symbol: "DIS", name: "Disney", group: "Communication" },
  { symbol: "JPM", name: "JPMorgan", group: "Financials" },
  { symbol: "V", name: "Visa", group: "Financials" },
  { symbol: "MA", name: "Mastercard", group: "Financials" },
  { symbol: "BAC", name: "Bank of America", group: "Financials" },
  { symbol: "UNH", name: "UnitedHealth", group: "Health" },
  { symbol: "LLY", name: "Eli Lilly", group: "Health" },
  { symbol: "JNJ", name: "Johnson & Johnson", group: "Health" },
  { symbol: "XOM", name: "Exxon Mobil", group: "Energy" },
  { symbol: "CVX", name: "Chevron", group: "Energy" },
];

const cryptoCache = new Map<number, { at: number; rows: TapeRow[]; total: number }>();
let stockCache: { at: number; rows: TapeRow[] } | null = null;
const storyCache = new Map<string, { at: number; story: Story }>();

const EMPTY: Story = { reason: "No published report names this yet.", source: "", url: "", at: "" };

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getText(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json, application/xml, text/xml, */*", "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export const loadCryptoBoard = createServerFn({ method: "POST" })
  .validator((start: number) => {
    const n = Math.floor(Number(start));
    if (!Number.isFinite(n) || n < 1 || n > 8000) return 1;
    return n;
  })
  .handler(async ({ data: start }) => {
    const hit = cryptoCache.get(start);
    if (hit && Date.now() - hit.at < 45_000) return { rows: hit.rows, total: hit.total, start };
    const raw = await getText(
      `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=${start}&limit=100&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false`,
    );
    let rows: TapeRow[] = [];
    let total = 0;
    try {
      const body = JSON.parse(raw) as {
        data?: {
          totalCount?: number;
          cryptoCurrencyList?: {
            id: number;
            name: string;
            symbol: string;
            cmcRank?: number;
            tags?: string[];
            quotes?: { price?: number; volume24h?: number; marketCap?: number; percentChange24h?: number }[];
          }[];
        };
      };
      total = body.data?.totalCount ?? 0;
      rows = (body.data?.cryptoCurrencyList ?? [])
        .map((row) => {
          const quote = row.quotes?.[0];
          const change = Number(quote?.percentChange24h);
          return {
            id: String(row.id),
            coinId: row.id,
            symbol: row.symbol,
            name: row.name,
            price: Number(quote?.price) || 0,
            change1: Number.isFinite(change) ? change / 100 : 0,
            mcap: Number(quote?.marketCap) || 0,
            volume: Number(quote?.volume24h) || 0,
            group: row.tags?.find((tag) => !tag.includes("portfolio") && tag.length < 24) ?? "Crypto",
          };
        })
        .filter((row) => row.price > 0 && Math.abs(row.change1) < 5);
    } catch {
      rows = hit?.rows ?? [];
      total = hit?.total ?? 0;
    }
    cryptoCache.set(start, { at: Date.now(), rows, total });
    return { rows, total, start };
  });

export const loadStockBoard = createServerFn({ method: "GET" }).handler(async () => {
  if (stockCache && Date.now() - stockCache.at < 45_000) return stockCache.rows;
  const symbols = STOCKS.map((row) => row.symbol).join(",");
  const raw = await getText(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols}&range=1d&interval=1d`);
  const bySymbol = new Map<string, { price: number; change1: number }>();
  try {
    const body = JSON.parse(raw) as {
      spark?: { result?: { symbol: string; response?: { meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number } }[] }[] };
    };
    for (const row of body.spark?.result ?? []) {
      const meta = row.response?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      const change = Number(meta?.regularMarketChangePercent);
      if (price > 0) bySymbol.set(row.symbol, { price, change1: Number.isFinite(change) ? change / 100 : 0 });
    }
  } catch {
    /* keep the last board */
  }
  const rows = STOCKS.map((row) => {
    const live = bySymbol.get(row.symbol);
    return {
      id: row.symbol,
      symbol: row.symbol,
      name: row.name,
      price: live?.price ?? 0,
      change1: live?.change1 ?? 0,
      mcap: 0,
      volume: 0,
      group: row.group,
    };
  }).filter((row) => row.price > 0);
  if (rows.length) stockCache = { at: Date.now(), rows };
  return rows;
});

function googleItem(xml: string) {
  const item = xml.split("<item>")[1] ?? "";
  const title = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const link = decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
  const at = decode(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "");
  if (!title || !link) return null;
  const cut = title.lastIndexOf(" - ");
  return {
    title: cut > 0 ? title.slice(0, cut) : title,
    source: cut > 0 ? title.slice(cut + 3) : "News",
    url: link,
    at,
  };
}

export const loadStory = createServerFn({ method: "POST" })
  .validator((input: { symbol: string; name: string; kind: "crypto" | "stock"; coinId?: number }) => {
    const symbol = input.symbol.trim().slice(0, 16);
    const name = input.name.trim().slice(0, 80);
    const kind = input.kind === "stock" ? "stock" : "crypto";
    const coinId = Number(input.coinId);
    if (!symbol || !name) throw new Error("Missing name");
    return { symbol, name, kind, coinId: Number.isFinite(coinId) ? coinId : undefined };
  })
  .handler(async ({ data }) => {
    const key = `${data.kind}:${data.symbol}`;
    const hit = storyCache.get(key);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.story;
    const query = encodeURIComponent(`${data.name} ${data.symbol} ${data.kind === "stock" ? "stock" : "crypto"}`);
    const [rss, cmc] = await Promise.all([
      getText(`https://news.google.com/rss/search?q=${query}+when:2d&hl=en-US&gl=US&ceid=US:en`),
      data.kind === "crypto" && data.coinId
        ? getText(`https://api.coinmarketcap.com/content/v3/news?page=1&size=5&coins=${data.coinId}`)
        : Promise.resolve(""),
    ]);
    const news = googleItem(rss);
    let cmcTitle = "";
    let cmcSource = "";
    let cmcUrl = "";
    let cmcAt = "";
    try {
      const body = JSON.parse(cmc || "{}") as {
        data?: { slug?: string; createdAt?: string; meta?: { title?: string; subtitle?: string; sourceName?: string; sourceUrl?: string } }[];
      };
      const named = (body.data ?? []).find((row) => {
        const blob = `${row.meta?.title ?? ""} ${row.meta?.subtitle ?? ""}`.toLowerCase();
        return blob.includes(data.symbol.toLowerCase()) || blob.includes(data.name.toLowerCase().split(" ")[0] ?? "");
      });
      const row = named ?? body.data?.[0];
      cmcTitle = row?.meta?.subtitle || row?.meta?.title || "";
      cmcSource = row?.meta?.sourceName || "CoinMarketCap";
      cmcUrl = row?.meta?.sourceUrl || (row?.slug ? `https://coinmarketcap.com/headlines/news/${row.slug}/` : "");
      cmcAt = row?.createdAt || "";
    } catch {
      /* news is optional */
    }
    const story: Story = news
      ? {
          reason: cmcTitle || news.title,
          source: news.source || cmcSource,
          url: news.url,
          at: news.at || cmcAt,
        }
      : cmcTitle
        ? { reason: cmcTitle, source: cmcSource, url: cmcUrl, at: cmcAt }
        : EMPTY;
    storyCache.set(key, { at: Date.now(), story });
    return story;
  });
