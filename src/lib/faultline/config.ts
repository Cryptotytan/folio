/** Configurable methodology. The methodology page reads these weights directly. */

export const SNAPSHOT_AS_OF = "2026-09-28";
export const LAYOUT_VERSION = "snapshot-2026-09-28";
export const DAYS = 120;

export const ROTATION_WEIGHTS = {
  relativePerformance: 0.25,
  volumeAcceleration: 0.25,
  categoryBreadth: 0.2,
  marketCapMomentum: 0.15,
  btcRelativeStrength: 0.1,
  shareOfMarketVolumeChange: 0.05,
} as const;

/** Diversity is specified but unavailable without market-pair snapshots, so it is dropped and the rest renormalized. */
export const HEALTH_WEIGHTS = {
  liquidity: 0.2,
  volume: 0.15,
  marketDiversity: 0.15,
  relativeStrength: 0.15,
  recovery: 0.1,
  volatilityStability: 0.1,
  participation: 0.1,
  marketCapStability: 0.05,
} as const;

export const HEALTH_UNAVAILABLE = ["marketDiversity"] as const;

/** Share of yesterday's structural health kept. One session cannot rewrite the score. */
export const HEALTH_PERSISTENCE = 0.82;

export const FAULT_THRESHOLD = 54;

export const DISCOVERY = {
  crackPrice7dMin: 0.08,
  crackHealthDrop: 6,
  quietPriceAbsMax: 0.08,
  quietHealthGain: 8,
} as const;

export const CATEGORIES = [
  { id: "monetary", name: "Monetary", color: "#8b939e" },
  { id: "l1", name: "Layer 1", color: "#7d92a4" },
  { id: "l2", name: "Layer 2", color: "#6d8794" },
  { id: "defi", name: "DeFi", color: "#8a8476" },
  { id: "ai", name: "AI", color: "#978a78" },
  { id: "meme", name: "Memecoins", color: "#8c8088" },
  { id: "gaming", name: "Gaming", color: "#7a848f" },
  { id: "storage", name: "Storage", color: "#6f847c" },
  { id: "stable", name: "Stablecoins", color: "#868a84" },
  { id: "exchange", name: "Exchange", color: "#8e887c" },
  { id: "privacy", name: "Privacy", color: "#7e8494" },
  { id: "rwa", name: "Real World Assets", color: "#8d8876" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_NAME: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name]),
) as Record<CategoryId, string>;

export const CATEGORY_COLOR: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.color]),
) as Record<CategoryId, string>;

export const FAULT_COPY: Record<string, string> = {
  PRICE_VOLUME_DIVERGENCE:
    "Price is accelerating while normalized volume participation is declining.",
  VOLUME_PRICE_DIVERGENCE: "Trading activity is rising into price weakness.",
  FLAT_VOLUME_SURGE: "Participation surged without a comparable price move.",
  ASSET_UP_CATEGORY_DOWN: "This asset is rising while its category median is falling.",
  ASSET_DOWN_CATEGORY_UP: "This asset is lagging a category that is rising.",
  BTC_DECOUPLING:
    "Short-window coupling to Bitcoin is materially weaker than this asset's longer baseline.",
  CATEGORY_DECOUPLING: "Short-window behavior is diverging from its category peers.",
  STRUCTURAL_DIVERGENCE: "Price is strengthening while structural health is falling.",
};
