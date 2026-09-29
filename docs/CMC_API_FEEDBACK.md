# CMC API feedback

Written from this build, not from a successful production integration. No key was available in the environment, so these notes are about the gaps that forced a demo snapshot rather than bugs observed against a live plan.

## What FAULTLINE wanted and did not have

- Historical market-pair snapshots, so market-diversity health could be a real series instead of "Unavailable".
- Historical open interest, funding and liquidation prints deep enough to score leverage contradictions without inventing them.
- A single asset-history bundle (quotes + OHLCV + category membership) so a map layout does not require dozens of credit-heavy calls per asset.
- Stable category membership over time. Assets sit in several categories; a primary-category field with a documented precedence would make continents less arbitrary.
- RWA market pairs are plan-gated. The region should still render from asset quotes when pairs are missing. This build does that with a fixture and says so.

## DX

- Credit headers should be documented as a single stable name. The probe reads both `x-cmc-pro-api-credit-count` and `cmc-credit-count` because the public name is easy to miss.
- 402 and 403 should say which field or plan blocked the call in the JSON body, so a map layer can disable itself without a guess.

## What we refused to fake

Fear and greed, altcoin season, liquidation totals, and derivatives weather stay unavailable until a real response exists.
