import {
  CATEGORY_COLOR,
  CATEGORY_NAME,
  DISCOVERY,
  DAYS,
  FAULT_COPY,
  FAULT_THRESHOLD,
  HEALTH_PERSISTENCE,
  HEALTH_WEIGHTS,
  LAYOUT_VERSION,
  ROTATION_WEIGHTS,
  SNAPSHOT_AS_OF,
  type CategoryId,
} from "./config.ts";
import { layoutAssets, regionPolygon, type Pt } from "./geography.ts";
import { clamp, corrRange, mad, maxDrawdown, mean, percentile, stdev } from "./stats.ts";
import { buildSeries, snapshotDates, type SeriesAsset } from "./universe.ts";

export type FaultType =
  | "PRICE_VOLUME_DIVERGENCE"
  | "VOLUME_PRICE_DIVERGENCE"
  | "FLAT_VOLUME_SURGE"
  | "ASSET_UP_CATEGORY_DOWN"
  | "ASSET_DOWN_CATEGORY_UP"
  | "BTC_DECOUPLING"
  | "CATEGORY_DECOUPLING"
  | "STRUCTURAL_DIVERGENCE";

export type Factor = {
  metric: string;
  value: number | null;
  baseline: number | null;
  deviation: number | null;
  contribution: number;
};

export type Evidence = "High" | "Moderate" | "Limited" | "Insufficient";

export type Dir = "up" | "flat" | "down";

export type Components = {
  liquidity: (number | null)[];
  volume: (number | null)[];
  marketDiversity: (number | null)[];
  relativeStrength: (number | null)[];
  recovery: (number | null)[];
  volatilityStability: (number | null)[];
  participation: (number | null)[];
  marketCapStability: (number | null)[];
};

export type WorldNode = {
  id: number;
  symbol: string;
  name: string;
  category: CategoryId;
  x: number;
  y: number;
  price: number[];
  volume: number[];
  mcap: number[];
  rotation: (number | null)[];
  rotationDir: (Dir | null)[];
  health: (number | null)[];
  contradiction: (number | null)[];
  faultType: (FaultType | null)[];
  faultMagnitude: (number | null)[];
  factors: Factor[][];
  dnaDeviation: (number | null)[];
  deviationLines: { metric: string; sigma: number }[][];
  evidence: Evidence[];
  components: Components;
  neighbors: { id: number; symbol: string; score: number }[];
};

export type RegionModel = {
  id: CategoryId;
  name: string;
  color: string;
  polygon: Pt[];
  assetIds: number[];
  rotation: (number | null)[];
  health: (number | null)[];
  breadth: (number | null)[];
  deteriorating: number[];
};

export type MarketDay = {
  mcap: number;
  volume: number;
  btcDominance: number;
  activeFaults: number;
  severeFaults: number;
  deteriorating: number;
  hottest: { id: CategoryId; name: string; rotation: number } | null;
  coolest: { id: CategoryId; name: string; rotation: number } | null;
};

export type Link = { a: number; b: number; score: number };

export type World = {
  status: "DEMO";
  asOf: string;
  layoutVersion: string;
  days: number;
  dates: string[];
  nodes: WorldNode[];
  regions: RegionModel[];
  links: Link[];
  market: MarketDay[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

const DIM_LABEL: Record<string, string> = {
  vol: "Volatility",
  downside: "Downside volatility",
  btcCorr: "BTC coupling",
  ethCorr: "ETH coupling",
  catCorr: "Category coupling",
  volSens: "Volume sensitivity",
  momentum: "Momentum persistence",
  dd: "Drawdown depth",
  relStr: "Relative strength",
  volStab: "Volume stability",
  mcapStab: "Market-cap stability",
};

const DIMS = Object.keys(DIM_LABEL);

type Feat = Record<string, number | null>;

function emptyFeat(): Feat {
  const f: Feat = {};
  for (const d of DIMS) f[d] = null;
  return f;
}

function features(
  asset: SeriesAsset,
  peer: number[],
  btc: SeriesAsset,
  eth: SeriesAsset,
  i0: number,
  i1: number,
): Feat {
  const f = emptyFeat();
  if (i1 - i0 < 10) return f;
  const r = asset.returns;
  f.vol = stdev(r, i0, i1) * Math.sqrt(365);
  const neg: number[] = [];
  for (let i = i0; i <= i1; i++) if (r[i] < 0) neg.push(r[i]);
  if (neg.length >= 8) {
    const m = neg.reduce((s, v) => s + v, 0) / neg.length;
    const sd = Math.sqrt(neg.reduce((s, v) => s + (v - m) ** 2, 0) / (neg.length - 1));
    f.downside = sd * Math.sqrt(365);
  }
  if (asset.symbol !== "BTC") f.btcCorr = corrRange(r, btc.returns, i0, i1);
  if (asset.symbol !== "ETH") f.ethCorr = corrRange(r, eth.returns, i0, i1);
  f.catCorr = corrRange(r, peer, i0, i1);
  const absR = r.map((v) => Math.abs(v));
  f.volSens = corrRange(absR, asset.volume, i0, i1);
  if (i0 + 1 <= i1) {
    const a: number[] = [];
    const b: number[] = [];
    for (let i = i0 + 1; i <= i1; i++) {
      a.push(r[i]);
      b.push(r[i - 1]);
    }
    f.momentum = corrRange(a, b, 0, a.length - 1);
  }
  f.dd = maxDrawdown(asset.price, i0, i1);
  const assetRet = asset.price[i1] / asset.price[i0] - 1;
  const btcRet = btc.price[i1] / btc.price[i0] - 1;
  f.relStr = asset.symbol === "BTC" ? 0 : assetRet - btcRet;
  const vm = mean(asset.volume, i0, i1);
  const vs = stdev(asset.volume, i0, i1);
  f.volStab = vm > 0 ? 1 / (1 + vs / vm) : null;
  const pm = mean(asset.price, i0, i1);
  const ps = stdev(asset.price, i0, i1);
  f.mcapStab = pm > 0 ? 1 / (1 + ps / pm) : null;
  return f;
}

function median(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function evidenceFor(t: number, feat: Feat): Evidence {
  const present = DIMS.filter((d) => feat[d] != null).length;
  let e: Evidence = t >= 100 ? "High" : t >= 70 ? "Moderate" : t >= 40 ? "Limited" : "Insufficient";
  if (present < DIMS.length / 2 && e === "High") e = "Moderate";
  if (present < 4 && e !== "Insufficient") e = "Limited";
  return e;
}

function pushFault(
  bag: { type: FaultType; score: number; factors: Factor[] }[],
  type: FaultType,
  score: number,
  factors: Factor[],
) {
  if (score <= 0) return;
  bag.push({ type, score: clamp(score, 0, 100), factors });
}

export function buildWorld(): World {
  const series = buildSeries();
  const dates = snapshotDates();
  const btc = series.find((s) => s.symbol === "BTC")!;
  const eth = series.find((s) => s.symbol === "ETH")!;
  const byCat = new Map<CategoryId, SeriesAsset[]>();
  for (const a of series) {
    const arr = byCat.get(a.category) ?? [];
    arr.push(a);
    byCat.set(a.category, arr);
  }
  const peerRet = series.map((asset) => {
    const peers = (byCat.get(asset.category) ?? []).filter((p) => p.id !== asset.id);
    return Array.from({ length: DAYS }, (_, t) => {
      if (!peers.length) return asset.returns[t];
      let s = 0;
      for (const p of peers) s += p.returns[t];
      return s / peers.length;
    });
  });

  const n = series.length;
  const rotation: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const rotationDir: (Dir | null)[][] = series.map(() => Array(DAYS).fill(null));
  const health: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const contradiction: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const faultType: (FaultType | null)[][] = series.map(() => Array(DAYS).fill(null));
  const faultMagnitude: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const factors: Factor[][][] = series.map(() => Array.from({ length: DAYS }, () => []));
  const dnaDeviation: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const deviationLines: { metric: string; sigma: number }[][][] = series.map(() =>
    Array.from({ length: DAYS }, () => []),
  );
  const evidence: Evidence[][] = series.map(() => Array(DAYS).fill("Insufficient"));
  const blank = () => series.map(() => Array<number | null>(DAYS).fill(null));
  const components: Components[] = series.map(() => ({
    liquidity: blank()[0],
    volume: Array<number | null>(DAYS).fill(null),
    marketDiversity: Array<number | null>(DAYS).fill(null),
    relativeStrength: Array<number | null>(DAYS).fill(null),
    recovery: Array<number | null>(DAYS).fill(null),
    volatilityStability: Array<number | null>(DAYS).fill(null),
    participation: Array<number | null>(DAYS).fill(null),
    marketCapStability: Array<number | null>(DAYS).fill(null),
  }));
  // The blank()[0] above shares nothing useful — rebuild cleanly.
  for (let i = 0; i < n; i++) {
    components[i] = {
      liquidity: Array(DAYS).fill(null),
      volume: Array(DAYS).fill(null),
      marketDiversity: Array(DAYS).fill(null),
      relativeStrength: Array(DAYS).fill(null),
      recovery: Array(DAYS).fill(null),
      volatilityStability: Array(DAYS).fill(null),
      participation: Array(DAYS).fill(null),
      marketCapStability: Array(DAYS).fill(null),
    };
  }

  const ret7: (number | null)[][] = series.map(() => Array(DAYS).fill(null));
  const ret30: (number | null)[][] = series.map(() => Array(DAYS).fill(null));

  for (let t = 30; t < DAYS; t++) {
    const rawRet7: number[] = [];
    const rawRet30: number[] = [];
    const rawVolAcc: number[] = [];
    const rawMom: number[] = [];
    const rawRs: number[] = [];
    const vol7s: number[] = [];
    const btcRet7 = btc.price[t] / btc.price[t - 7] - 1;

    for (let i = 0; i < n; i++) {
      const a = series[i];
      const r7 = a.price[t] / a.price[t - 7] - 1;
      const r30 = a.price[t] / a.price[t - 30] - 1;
      ret7[i][t] = r7;
      ret30[i][t] = r30;
      const v7 = mean(a.volume, t - 6, t);
      const v30 = mean(a.volume, t - 29, t);
      const vPrev = mean(a.volume, t - 13, t - 7);
      vol7s.push(v7);
      rawRet7.push(r7);
      rawRet30.push(r30);
      rawVolAcc.push(vPrev > 0 ? v7 / vPrev - 1 : 0);
      rawMom.push(r30);
      rawRs.push(a.symbol === "BTC" ? 0 : r7 - btcRet7);
    }
    const totalV = vol7s.reduce((s, v) => s + v, 0) || 1;
    const shares = vol7s.map((v) => v / totalV);
    let prevShares: number[] | null = null;
    if (t >= 37) {
      const prev: number[] = [];
      for (let i = 0; i < n; i++) prev.push(mean(series[i].volume, t - 13, t - 7));
      const ps = prev.reduce((s, v) => s + v, 0) || 1;
      prevShares = prev.map((v) => v / ps);
    }
    const shareDelta = shares.map((s, i) => (prevShares ? s - prevShares[i] : 0));

    const breadthByCat = new Map<CategoryId, number>();
    for (const [cat, members] of byCat) {
      const idxs = members.map((m) => series.findIndex((s) => s.id === m.id));
      const pos = idxs.filter((i) => (ret7[i][t] ?? 0) > 0).length / idxs.length;
      const beat = idxs.filter((i) => (ret7[i][t] ?? 0) > btcRet7).length / idxs.length;
      let volUp = 0;
      for (const i of idxs) {
        const v7 = mean(series[i].volume, t - 6, t);
        const v30 = mean(series[i].volume, t - 29, t);
        if (v7 > v30) volUp++;
      }
      breadthByCat.set(cat, (0.45 * pos + 0.3 * beat + 0.25 * (volUp / idxs.length)) * 100);
    }

    const pRet = rawRet7.map((v) => percentile(v, rawRet7));
    const pVol = rawVolAcc.map((v) => percentile(v, rawVolAcc));
    const pMom = rawMom.map((v) => percentile(v, rawMom));
    const pRs = rawRs.map((v) => percentile(v, rawRs));
    const pShare = shareDelta.map((v) => percentile(v, shareDelta));

    for (let i = 0; i < n; i++) {
      const breadth = (breadthByCat.get(series[i].category) ?? 50) / 100;
      const score =
        (ROTATION_WEIGHTS.relativePerformance * pRet[i] +
          ROTATION_WEIGHTS.volumeAcceleration * pVol[i] +
          ROTATION_WEIGHTS.categoryBreadth * breadth +
          ROTATION_WEIGHTS.marketCapMomentum * pMom[i] +
          ROTATION_WEIGHTS.btcRelativeStrength * pRs[i] +
          ROTATION_WEIGHTS.shareOfMarketVolumeChange * pShare[i]) *
        100;
      rotation[i][t] = score;
      const prev = t >= 33 ? rotation[i][t - 3] : null;
      rotationDir[i][t] = prev == null ? "flat" : score > prev + 4 ? "up" : score < prev - 4 ? "down" : "flat";
    }

    const catMedian = new Map<CategoryId, number>();
    for (const [cat, members] of byCat) {
      catMedian.set(
        cat,
        median(members.map((m) => ret7[series.findIndex((s) => s.id === m.id)][t] ?? 0)),
      );
    }

    for (let i = 0; i < n; i++) {
      const a = series[i];
      const v7 = mean(a.volume, t - 6, t);
      const v30 = mean(a.volume, t - 29, t);
      const baseStart = Math.max(0, t - 89);
      const baseV = mean(a.volume, baseStart, t);
      const ratio = baseV > 0 ? v7 / baseV : 1;
      const cv = v30 > 0 ? stdev(a.volume, t - 29, t) / v30 : 1;
      const levelScore = clamp(((ratio - 0.35) / (1.6 - 0.35)) * 100, 0, 100);
      const stabScore = clamp(100 - cv * 90, 0, 100);
      const liquidity = 0.55 * levelScore + 0.45 * stabScore;
      const volumeScore = clamp(((v7 / (v30 || 1) - 0.4) / 1.3) * 100, 0, 100);
      const med = catMedian.get(a.category) ?? 0;
      const rs = (ret30[i][t] ?? 0) - med;
      const relativeStrength = clamp(62 + rs * 140, 0, 100);
      const start60 = Math.max(0, t - 59);
      let peak = a.price[start60];
      for (let k = start60; k <= t; k++) if (a.price[k] > peak) peak = a.price[k];
      const dist = a.price[t] / peak - 1;
      const recovery = clamp(100 + dist * 200, 0, 100);
      const vs = stdev(a.returns, t - 6, t);
      const vl = stdev(a.returns, t - 29, t) || 1e-8;
      const volatilityStability = clamp(100 - Math.abs(Math.log(vs / vl)) * 80, 0, 100);
      const members = byCat.get(a.category)!;
      let catNow = 0;
      let catPrev = 0;
      const ownPrev = mean(a.volume, Math.max(0, t - 36), Math.max(0, t - 30));
      for (const m of members) {
        catNow += mean(m.volume, t - 6, t);
        catPrev += mean(m.volume, Math.max(0, t - 36), Math.max(0, t - 30));
      }
      const shareNow = catNow > 0 ? v7 / catNow : 0;
      const shareOld = catPrev > 0 ? ownPrev / catPrev : shareNow;
      const participation =
        members.length < 2 ? 70 : clamp(50 + ((shareOld > 0 ? shareNow / shareOld : 1) - 1) * 80, 0, 100);
      const dd = maxDrawdown(a.price, t - 29, t);
      const marketCapStability = clamp(100 + dd * 170, 0, 100);

      components[i].liquidity[t] = liquidity;
      components[i].volume[t] = volumeScore;
      components[i].relativeStrength[t] = relativeStrength;
      components[i].recovery[t] = recovery;
      components[i].volatilityStability[t] = volatilityStability;
      components[i].participation[t] = participation;
      components[i].marketCapStability[t] = marketCapStability;

      const parts: [number, number][] = [
        [HEALTH_WEIGHTS.liquidity, liquidity],
        [HEALTH_WEIGHTS.volume, volumeScore],
        [HEALTH_WEIGHTS.relativeStrength, relativeStrength],
        [HEALTH_WEIGHTS.recovery, recovery],
        [HEALTH_WEIGHTS.volatilityStability, volatilityStability],
        [HEALTH_WEIGHTS.participation, participation],
        [HEALTH_WEIGHTS.marketCapStability, marketCapStability],
      ];
      const wsum = parts.reduce((s, [w]) => s + w, 0);
      const raw = parts.reduce((s, [w, v]) => s + w * v, 0) / wsum;
      const prevH = t > 30 ? health[i][t - 1] : null;
      health[i][t] = prevH == null ? raw : HEALTH_PERSISTENCE * prevH + (1 - HEALTH_PERSISTENCE) * raw;

      const volRatio = v30 > 0 ? v7 / v30 : 1;
      const r7 = ret7[i][t] ?? 0;
      const bag: { type: FaultType; score: number; factors: Factor[] }[] = [];
      if (r7 > 0.06 && volRatio < 0.9) {
        const score = clamp((r7 - 0.06) / 0.2, 0, 1) * 58 + clamp((0.9 - volRatio) / 0.4, 0, 1) * 42;
        pushFault(bag, "PRICE_VOLUME_DIVERGENCE", score, [
          { metric: "7D price", value: r7, baseline: 0.06, deviation: r7 - 0.06, contribution: 0.58 },
          { metric: "Volume vs 30D", value: volRatio - 1, baseline: 0, deviation: volRatio - 0.9, contribution: 0.42 },
        ]);
      }
      if (r7 < -0.06 && volRatio > 1.28) {
        const score = clamp((-0.06 - r7) / 0.2, 0, 1) * 50 + clamp((volRatio - 1.28) / 0.6, 0, 1) * 50;
        pushFault(bag, "VOLUME_PRICE_DIVERGENCE", score, [
          { metric: "7D price", value: r7, baseline: -0.06, deviation: r7 + 0.06, contribution: 0.5 },
          { metric: "Volume vs 30D", value: volRatio - 1, baseline: 0.28, deviation: volRatio - 1.28, contribution: 0.5 },
        ]);
      }
      if (Math.abs(r7) < 0.035 && volRatio > 1.55) {
        const score = clamp((volRatio - 1.55) / 0.8, 0, 1) * 80;
        pushFault(bag, "FLAT_VOLUME_SURGE", score, [
          { metric: "7D price", value: r7, baseline: 0, deviation: r7, contribution: 0.35 },
          { metric: "Volume vs 30D", value: volRatio - 1, baseline: 0.55, deviation: volRatio - 1.55, contribution: 0.65 },
        ]);
      }
      const cm = catMedian.get(a.category) ?? 0;
      if (members.length > 2 && r7 > 0.05 && cm < -0.02 && r7 - cm > 0.1) {
        pushFault(bag, "ASSET_UP_CATEGORY_DOWN", clamp((r7 - cm) / 0.25, 0, 1) * 85, [
          { metric: "7D price", value: r7, baseline: cm, deviation: r7 - cm, contribution: 1 },
          { metric: "Category median", value: cm, baseline: 0, deviation: cm, contribution: 0.4 },
        ]);
      }
      if (members.length > 2 && r7 < -0.05 && cm > 0.02 && cm - r7 > 0.1) {
        pushFault(bag, "ASSET_DOWN_CATEGORY_UP", clamp((cm - r7) / 0.25, 0, 1) * 85, [
          { metric: "7D price", value: r7, baseline: cm, deviation: r7 - cm, contribution: 1 },
          { metric: "Category median", value: cm, baseline: 0, deviation: cm, contribution: 0.4 },
        ]);
      }
      const c30 = a.symbol === "BTC" ? null : corrRange(a.returns, btc.returns, t - 29, t);
      const c90 = t >= 90 && a.symbol !== "BTC" ? corrRange(a.returns, btc.returns, t - 89, t) : null;
      if (c30 != null && c90 != null && c90 > 0.45 && c30 < c90 - 0.3) {
        pushFault(bag, "BTC_DECOUPLING", clamp((c90 - c30 - 0.3) / 0.4, 0, 1) * 90, [
          { metric: "BTC correlation 30D", value: c30, baseline: c90, deviation: c30 - c90, contribution: 1 },
        ]);
      }
      const pc30 = corrRange(a.returns, peerRet[i], t - 29, t);
      const pc90 = t >= 90 ? corrRange(a.returns, peerRet[i], t - 89, t) : null;
      if (pc30 != null && pc90 != null && pc90 > 0.4 && pc30 < pc90 - 0.32) {
        pushFault(bag, "CATEGORY_DECOUPLING", clamp((pc90 - pc30 - 0.32) / 0.4, 0, 1) * 88, [
          { metric: "Category correlation 30D", value: pc30, baseline: pc90, deviation: pc30 - pc90, contribution: 1 },
        ]);
      }
      const h7 = t >= 37 ? health[i][t - 7] : null;
      if (h7 != null && health[i][t] != null && r7 > 0.06 && h7 - (health[i][t] as number) > 6) {
        pushFault(bag, "STRUCTURAL_DIVERGENCE", clamp((h7 - (health[i][t] as number)) / 18, 0, 1) * 90, [
          { metric: "7D price", value: r7, baseline: 0.06, deviation: r7 - 0.06, contribution: 0.45 },
          {
            metric: "Structural health change",
            value: (health[i][t] as number) - h7,
            baseline: 0,
            deviation: (health[i][t] as number) - h7,
            contribution: 0.55,
          },
        ]);
      }
      bag.sort((x, y) => y.score - x.score);
      const best = bag[0];
      const second = bag[1];
      const score = best ? clamp(best.score + (second ? second.score * 0.22 : 0), 0, 100) : 0;
      contradiction[i][t] = score;
      if (best && score >= FAULT_THRESHOLD) {
        faultType[i][t] = best.type;
        faultMagnitude[i][t] = score / 10;
        factors[i][t] = best.factors;
      }
      const longFeat = features(a, peerRet[i], btc, eth, Math.max(0, t - 89), t);
      evidence[i][t] = evidenceFor(t, longFeat);
    }

    if (t >= 60) {
      const recent: Feat[] = [];
      const base: Feat[] = [];
      for (let i = 0; i < n; i++) {
        recent.push(features(series[i], peerRet[i], btc, eth, t - 13, t));
        base.push(features(series[i], peerRet[i], btc, eth, Math.max(0, t - 90), t - 15));
      }
      const zByDim = new Map<string, number[]>();
      for (const d of DIMS) {
        const diffs: number[] = [];
        for (let i = 0; i < n; i++) {
          if (recent[i][d] != null && base[i][d] != null) diffs.push((recent[i][d] as number) - (base[i][d] as number));
        }
        const scale = mad(diffs) * 1.4826;
        const zs = new Array<number>(n).fill(0);
        if (scale > 1e-6) {
          let k = 0;
          for (let i = 0; i < n; i++) {
            if (recent[i][d] != null && base[i][d] != null) {
              zs[i] = diffs[k] / scale;
              k++;
            }
          }
        }
        zByDim.set(d, zs);
      }
      for (let i = 0; i < n; i++) {
        const lines: { metric: string; sigma: number }[] = [];
        let absSum = 0;
        let count = 0;
        for (const d of DIMS) {
          const z = zByDim.get(d)![i];
          if (!z) continue;
          absSum += Math.abs(z);
          count++;
          lines.push({ metric: DIM_LABEL[d], sigma: z });
        }
        lines.sort((a, b) => Math.abs(b.sigma) - Math.abs(a.sigma));
        deviationLines[i][t] = lines.slice(0, 3);
        dnaDeviation[i][t] = count ? clamp((absSum / count / 2.1) * 100, 0, 100) : null;
      }
    }
  }

  const layoutFeat = series.map((a, i) => features(a, peerRet[i], btc, eth, DAYS - 90, DAYS - 1));
  const percentiled: (number | null)[][] = DIMS.map((_, di) => {
    const col = layoutFeat.map((f) => f[DIMS[di]]);
    const present = col.filter((v): v is number => v != null);
    return col.map((v) => (v == null ? null : percentile(v, present)));
  });
  const vectors = series.map((_, i) => DIMS.map((_, di) => percentiled[di][i]));
  const maxMcap = Math.max(...series.map((a) => a.mcap[DAYS - 1]));
  const positions = layoutAssets(
    series.map((a, i) => ({
      id: a.id,
      category: a.category,
      vector: vectors[i].map((v) => (v == null ? 0.5 : v)),
      radius: 18 + 40 * Math.sqrt(a.mcap[DAYS - 1] / maxMcap),
    })),
  );

  function cosine(i: number, j: number): number | null {
    let dp = 0;
    let na = 0;
    let nb = 0;
    let c = 0;
    for (let d = 0; d < DIMS.length; d++) {
      const x = vectors[i][d];
      const y = vectors[j][d];
      if (x == null || y == null) continue;
      const a = x - 0.5;
      const b = y - 0.5;
      dp += a * b;
      na += a * a;
      nb += b * b;
      c++;
    }
    if (c < 4 || na < 1e-9 || nb < 1e-9) return null;
    return dp / Math.sqrt(na * nb);
  }

  const neighbors: WorldNode["neighbors"][] = series.map((a, i) => {
    const scored: { id: number; symbol: string; score: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const c = cosine(i, j);
      if (c == null) continue;
      scored.push({ id: series[j].id, symbol: series[j].symbol, score: Math.round(clamp((c + 1) / 2, 0, 1) * 100) });
    }
    scored.sort((p, q) => q.score - p.score);
    return scored.slice(0, 4);
  });

  const linkKeys = new Set<string>();
  const links: Link[] = [];
  const addLink = (i: number, j: number, score: number) => {
    const a = series[i].id;
    const b = series[j].id;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (linkKeys.has(key) || score < 62) return;
    linkKeys.add(key);
    links.push({ a, b, score });
  };
  for (let i = 0; i < n; i++) {
    const same: { j: number; score: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j || series[i].category !== series[j].category) continue;
      const c = cosine(i, j);
      if (c == null) continue;
      same.push({ j, score: Math.round(clamp((c + 1) / 2, 0, 1) * 100) });
    }
    same.sort((p, q) => q.score - p.score);
    for (const s of same.slice(0, 2)) addLink(i, s.j, s.score);
    for (const nb of neighbors[i].slice(0, 2)) {
      const j = series.findIndex((s) => s.id === nb.id);
      if (j >= 0) addLink(i, j, nb.score);
    }
  }

  const nodes: WorldNode[] = series.map((a, i) => {
    const p = positions.get(a.id) ?? { x: 0, y: 0 };
    return {
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      x: p.x,
      y: p.y,
      price: a.price,
      volume: a.volume,
      mcap: a.mcap,
      rotation: rotation[i],
      rotationDir: rotationDir[i],
      health: health[i],
      contradiction: contradiction[i],
      faultType: faultType[i],
      faultMagnitude: faultMagnitude[i],
      factors: factors[i],
      dnaDeviation: dnaDeviation[i],
      deviationLines: deviationLines[i],
      evidence: evidence[i],
      components: components[i],
      neighbors: neighbors[i],
    };
  });

  const regions: RegionModel[] = [];
  for (const [cat, members] of byCat) {
    const ids = members.map((m) => m.id);
    const pts = ids.map((id) => positions.get(id)!).filter(Boolean);
    const rotationR: (number | null)[] = [];
    const healthR: (number | null)[] = [];
    const breadthR: (number | null)[] = [];
    const det: number[] = [];
    for (let t = 0; t < DAYS; t++) {
      const rs = ids
        .map((id) => nodes.find((nd) => nd.id === id)!)
        .map((nd) => nd.rotation[t])
        .filter((v): v is number => v != null);
      const hs = ids
        .map((id) => nodes.find((nd) => nd.id === id)!)
        .map((nd) => nd.health[t])
        .filter((v): v is number => v != null);
      rotationR.push(rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : null);
      healthR.push(hs.length ? hs.reduce((s, v) => s + v, 0) / hs.length : null);
      const memberIdx = members.map((m) => series.findIndex((s) => s.id === m.id));
      if (t >= 30) {
        const btcRet7 = btc.price[t] / btc.price[t - 7] - 1;
        const pos = memberIdx.filter((i) => (ret7[i][t] ?? 0) > 0).length / memberIdx.length;
        const beat = memberIdx.filter((i) => (ret7[i][t] ?? 0) > btcRet7).length / memberIdx.length;
        let volUp = 0;
        for (const i of memberIdx) {
          if (mean(series[i].volume, t - 6, t) > mean(series[i].volume, t - 29, t)) volUp++;
        }
        breadthR.push((0.45 * pos + 0.3 * beat + 0.25 * (volUp / memberIdx.length)) * 100);
      } else breadthR.push(null);
      det.push(hs.filter((h) => h < 50).length);
    }
    regions.push({
      id: cat,
      name: CATEGORY_NAME[cat],
      color: CATEGORY_COLOR[cat],
      polygon: regionPolygon(cat, pts),
      assetIds: ids,
      rotation: rotationR,
      health: healthR,
      breadth: breadthR,
      deteriorating: det,
    });
  }

  const market: MarketDay[] = [];
  for (let t = 0; t < DAYS; t++) {
    let mcap = 0;
    let volume = 0;
    let faults = 0;
    let severe = 0;
    let deteriorating = 0;
    for (const nd of nodes) {
      mcap += nd.mcap[t];
      volume += nd.volume[t];
      if (nd.faultType[t]) faults++;
      if ((nd.faultMagnitude[t] ?? 0) >= 8) severe++;
      if ((nd.health[t] ?? 100) < 50) deteriorating++;
    }
    const ranked = regions
      .map((r) => ({ id: r.id, name: r.name, rotation: r.rotation[t] }))
      .filter((r): r is { id: CategoryId; name: string; rotation: number } => r.rotation != null);
    ranked.sort((a, b) => b.rotation - a.rotation);
    const btcNode = nodes.find((nd) => nd.symbol === "BTC")!;
    market.push({
      mcap,
      volume,
      btcDominance: mcap > 0 ? btcNode.mcap[t] / mcap : 0,
      activeFaults: faults,
      severeFaults: severe,
      deteriorating,
      hottest: ranked[0] ?? null,
      coolest: ranked.length ? ranked[ranked.length - 1] : null,
    });
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of regions) {
    for (const p of r.polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  for (const nd of nodes) {
    if (!Number.isFinite(nd.x) || !Number.isFinite(nd.y)) {
      throw new Error(`Non-finite position for ${nd.symbol}`);
    }
  }

  return {
    status: "DEMO",
    asOf: SNAPSHOT_AS_OF,
    layoutVersion: LAYOUT_VERSION,
    days: DAYS,
    dates,
    nodes,
    regions,
    links,
    market,
    bounds: { minX, minY, maxX, maxY },
  };
}

export const WORLD = buildWorld();

const byId = new Map(WORLD.nodes.map((n) => [n.id, n]));

export function nodeById(id: number): WorldNode | undefined {
  return byId.get(id);
}

export function hiddenCracks(day: number): WorldNode[] {
  if (day < 37) return [];
  return WORLD.nodes.filter((n) => {
    const ret = n.price[day] / n.price[day - 7] - 1;
    const h = n.health[day];
    const h0 = n.health[day - 7];
    return h != null && h0 != null && ret >= DISCOVERY.crackPrice7dMin && h0 - h >= DISCOVERY.crackHealthDrop;
  });
}

export function quietStrength(day: number): WorldNode[] {
  if (day < 37) return [];
  return WORLD.nodes.filter((n) => {
    const ret = n.price[day] / n.price[day - 7] - 1;
    const h = n.health[day];
    const h0 = n.health[day - 7];
    return (
      h != null &&
      h0 != null &&
      Math.abs(ret) <= DISCOVERY.quietPriceAbsMax &&
      h - h0 >= DISCOVERY.quietHealthGain
    );
  });
}

export function timeline(node: WorldNode, day: number): { date: string; text: string }[] {
  const events: { date: string; text: string }[] = [];
  let prevFault: FaultType | null = null;
  let prevHealth: number | null = null;
  for (let t = 0; t <= day; t++) {
    const f = node.faultType[t];
    const h = node.health[t];
    if (f && f !== prevFault) {
      events.push({ date: WORLD.dates[t], text: FAULT_COPY[f] ?? "Contradiction detected." });
    }
    if (f == null && prevFault) {
      events.push({ date: WORLD.dates[t], text: "The prior contradiction no longer clears the threshold." });
    }
    if (h != null && prevHealth != null) {
      if (prevHealth >= 50 && h < 50) {
        events.push({ date: WORLD.dates[t], text: "Structural health fell below 50." });
      } else if (prevHealth < 65 && h >= 65) {
        events.push({ date: WORLD.dates[t], text: "Structural health recovered into the stable range." });
      }
    }
    prevFault = f;
    if (h != null) prevHealth = h;
  }
  return events.slice(-6);
}

export function faultSentence(type: FaultType | null): string | null {
  if (!type) return null;
  return FAULT_COPY[type] ?? null;
}
