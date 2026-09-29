export function mean(a: number[], i0: number, i1: number): number {
  let s = 0;
  const n = i1 - i0 + 1;
  for (let i = i0; i <= i1; i++) s += a[i];
  return s / n;
}

export function stdev(a: number[], i0: number, i1: number): number {
  const m = mean(a, i0, i1);
  let s = 0;
  const n = i1 - i0 + 1;
  for (let i = i0; i <= i1; i++) {
    const d = a[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / Math.max(1, n - 1));
}

export function corrRange(a: number[], b: number[], i0: number, i1: number): number | null {
  const n = i1 - i0 + 1;
  if (n < 18) return null;
  const ma = mean(a, i0, i1);
  const mb = mean(b, i0, i1);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = i0; i <= i1; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da < 1e-14 || db < 1e-14) return null;
  return num / Math.sqrt(da * db);
}

export function maxDrawdown(price: number[], i0: number, i1: number): number {
  let peak = price[i0];
  let dd = 0;
  for (let i = i0; i <= i1; i++) {
    if (price[i] > peak) peak = price[i];
    const d = price[i] / peak - 1;
    if (d < dd) dd = d;
  }
  return dd;
}

export function percentile(value: number, all: number[]): number {
  if (all.length <= 1) return 0.5;
  let below = 0;
  for (const v of all) if (v < value) below++;
  return below / (all.length - 1);
}

export function mad(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const dev = values.map((v) => Math.abs(v - mid)).sort((a, b) => a - b);
  return dev[Math.floor(dev.length / 2)] || 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a raw ratio onto 0–100 with a soft center at `mid`. */
export function scoreAround(value: number, low: number, mid: number, high: number): number {
  if (value <= mid) {
    const t = (value - low) / (mid - low || 1);
    return clamp(t, 0, 1) * 60;
  }
  const t = (value - mid) / (high - mid || 1);
  return clamp(60 + t * 40, 0, 100);
}
