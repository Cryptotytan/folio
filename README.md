# FOLIO

The living map of crypto markets.

Price tells you what happened. Structure tells you what's happening.

## Problem

Most crypto interfaces are tables of prices. A price can rise while participation, liquidity proxies and peer relationships are getting worse. That difference is hard to see in a grid.

## Solution

FOLIO turns a market snapshot into a world.

- Cities are assets. Size is market cap. Brightness is trading activity.
- Continents are categories, placed so behaviorally similar groups sit near each other.
- Activity rotation shows where attention is heating or cooling. It is not a claim about money flow.
- Faults are contradictions between signals.
- Market DNA places similar behavior near itself and measures how far today sits from an asset's own history.
- Structural health tracks persistent deterioration. It is not a fraud score.

## Demo

This workspace ships a **labeled demo snapshot** dated 2026-09-28. Prices, volumes and paths are a fixture. Scores are calculated from that fixture. They are not live CoinMarketCap quotes.

If `CMC_API_KEY` is present on the server, the data page can run a sanitized quotes probe for BTC, ETH and SOL. The key is never sent to the browser.

## Why a map

Position, size, brightness, roads, rings and cracks each encode a measurement. The homepage is the map. A sortable list exists for anyone who does not want the spatial view.

## Architecture

TanStack Start, React, TypeScript, Canvas 2D. Analytics and layout run deterministically in `src/lib/faultline`. There is no database in this build: the snapshot is the source, and history replay only reads observations through the selected day.

## Market geography

DNA percentiles go through PCA. Category anchors sit on a ring ordered by similarity. A fixed relaxation pass separates cities. Coastlines are smoothed hulls with a seeded edge so they do not change between renders. Layout version: `snapshot-2026-09-28`.

## Endpoint table

| Endpoint | Role in a full CMC deployment | This build |
| --- | --- | --- |
| `/v3/cryptocurrency/quotes/latest` | Spot quotes | Optional live probe |
| `/v2/cryptocurrency/ohlcv/historical` | DNA and health history | Fixture path |
| `/v1/cryptocurrency/categories` | Continents | Curated taxonomy |
| `/v1/global-metrics/quotes/latest` | Market strip | Computed from the snapshot |
| Fear and greed, altcoin season | Sentiment | Unavailable, not invented |
| Derivatives and liquidations | Leverage weather | Unavailable |
| RWA asset list | RWA continent | Partial fixture |

## Setup

```bash
npm run dev
```

Optional:

```bash
CMC_API_KEY=
```

Do not commit the key.

## Testing

```bash
node --experimental-strip-types --test src/lib/faultline/model.test.ts
```

## Limitations

- Not the live top-150 universe.
- No order-book liquidity, market-pair diversity, open interest, funding or liquidation prints.
- Liquidity health is a volume proxy.
- Natural language search is a deterministic command list, not an LLM.
- Replay keeps the current geography stable on purpose.

## How CoinMarketCap makes FAULTLINE possible

A full deployment uses CMC for stable asset ids, categories, historical OHLCV, quotes, global metrics, sentiment, derivatives, liquidations and RWA coverage. FAULTLINE's job is to turn those series into DNA, geography, rotation, faults and structural health. This demo shows that second half with the data boundary labeled honestly.
