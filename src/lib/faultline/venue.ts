const KUCOIN = new Set(["MNT", "RUNE", "AKT", "XMR"]);
const KRAKEN = new Set(["TON", "DAI"]);

export function volumeVenue(symbol: string, listed = false) {
  if (listed) return "Yahoo";
  if (KUCOIN.has(symbol)) return "KuCoin";
  if (KRAKEN.has(symbol)) return "Kraken";
  return "OKX";
}

export const FOLIO_SCORE = "Folio calculated this from the live price and volume. These are not exchange quotes.";
