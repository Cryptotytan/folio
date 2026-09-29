import type { CategoryId } from "./config.ts";

export type Pt = { x: number; y: number };

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function dominant(C: number[][]): { vec: number[]; val: number } {
  const d = C.length;
  let v = Array.from({ length: d }, (_, i) => (i === 0 ? 1 : 0.02 * (i + 1)));
  for (let iter = 0; iter < 64; iter++) {
    const w = new Array<number>(d).fill(0);
    for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) w[r] += C[r][c] * v[c];
    const n = Math.hypot(...w) || 1;
    v = w.map((x) => x / n);
  }
  let pivot = 0;
  for (let i = 1; i < d; i++) if (Math.abs(v[i]) > Math.abs(v[pivot])) pivot = i;
  if (v[pivot] < 0) v = v.map((x) => -x);
  const Cv = new Array<number>(d).fill(0);
  for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) Cv[r] += C[r][c] * v[c];
  const val = dot(v, Cv);
  return { vec: v, val };
}

/** Deterministic 2-component PCA. Rows are assets, columns are DNA dimensions. */
export function pca2(matrix: number[][]): Pt[] {
  const n = matrix.length;
  const d = matrix[0]?.length ?? 0;
  if (!n || !d) return [];
  const mean = new Array<number>(d).fill(0);
  for (const row of matrix) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= n;
  const X = matrix.map((row) => row.map((v, j) => v - mean[j]));
  const C = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < d; a++) {
      for (let b = 0; b < d; b++) C[a][b] += X[i][a] * X[i][b];
    }
  }
  const denom = Math.max(1, n - 1);
  for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) C[a][b] /= denom;
  for (let a = 0; a < d; a++) C[a][a] += 1e-8;
  const e1 = dominant(C);
  const C2 = C.map((row) => row.slice());
  for (let a = 0; a < d; a++) {
    for (let b = 0; b < d; b++) C2[a][b] -= e1.val * e1.vec[a] * e1.vec[b];
  }
  const e2 = dominant(C2);
  return X.map((row) => ({ x: dot(row, e1.vec), y: dot(row, e2.vec) }));
}

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function chaikin(points: Pt[]): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
    out.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
  }
  return out;
}

function centroid(points: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = points.length || 1;
  return { x: x / n, y: y / n };
}

export function regionPolygon(id: string, members: Pt[]): Pt[] {
  if (members.length === 0) return [];
  const c = centroid(members);
  if (members.length === 1) {
    return circle(c.x, c.y, 78, 36, id);
  }
  if (members.length === 2) {
    const dx = members[1].x - members[0].x;
    const dy = members[1].y - members[0].y;
    const len = Math.hypot(dx, dy) || 1;
    const r = Math.max(70, len * 0.55);
    return circle(c.x, c.y, r, 40, id);
  }
  const hull = convexHull(members);
  const expanded = hull.map((p) => ({
    x: c.x + (p.x - c.x) * 1.48 + Math.sign(p.x - c.x || 1) * 28,
    y: c.y + (p.y - c.y) * 1.48 + Math.sign(p.y - c.y || 1) * 28,
  }));
  let smooth = expanded;
  for (let i = 0; i < 2; i++) smooth = chaikin(smooth);
  const cc = centroid(smooth);
  return smooth.map((p, i) => {
    const n = hash01(`${id}:${i}`) * 2 - 1;
    const ang = Math.atan2(p.y - cc.y, p.x - cc.x);
    const mag = 10 + hash01(`${id}:m:${i}`) * 16;
    return { x: p.x + Math.cos(ang) * n * mag, y: p.y + Math.sin(ang) * n * mag };
  });
}

function circle(cx: number, cy: number, r: number, n: number, id: string): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 1 + (hash01(`${id}:c:${i}`) - 0.5) * 0.12;
    pts.push({ x: cx + Math.cos(a) * r * wobble, y: cy + Math.sin(a) * r * wobble });
  }
  return pts;
}

export type LayoutInput = {
  id: number;
  category: CategoryId;
  vector: number[];
  radius: number;
};

/**
 * Category anchors sit on a ring ordered by behavioral similarity.
 * Assets keep their PCA offset inside the category, then a deterministic
 * relaxation separates cities. The same vectors always yield the same map.
 */
export function layoutAssets(items: LayoutInput[]): Map<number, Pt> {
  const pos = new Map<number, Pt>();
  if (!items.length) return pos;
  const projected = pca2(items.map((it) => it.vector));
  const groups = new Map<CategoryId, number[]>();
  items.forEach((it, i) => {
    const arr = groups.get(it.category) ?? [];
    arr.push(i);
    groups.set(it.category, arr);
  });

  const catCenters: { id: CategoryId; x: number; y: number; idxs: number[] }[] = [];
  for (const [id, idxs] of groups) {
    let x = 0;
    let y = 0;
    for (const i of idxs) {
      x += projected[i].x;
      y += projected[i].y;
    }
    catCenters.push({ id, x: x / idxs.length, y: y / idxs.length, idxs });
  }
  catCenters.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x) || a.id.localeCompare(b.id));

  const anchors = new Map<CategoryId, Pt>();
  const nCat = catCenters.length;
  catCenters.forEach((cat, i) => {
    const ang = -Math.PI / 2 + (i / nCat) * Math.PI * 2;
    anchors.set(cat.id, { x: Math.cos(ang) * 690, y: Math.sin(ang) * 470 });
  });

  const preliminary: Pt[] = items.map(() => ({ x: 0, y: 0 }));
  for (const cat of catCenters) {
    const anchor = anchors.get(cat.id)!;
    let sx = 0;
    let sy = 0;
    for (const i of cat.idxs) {
      const dx = projected[i].x - cat.x;
      const dy = projected[i].y - cat.y;
      sx += dx * dx;
      sy += dy * dy;
    }
    const rms = Math.sqrt((sx + sy) / Math.max(1, cat.idxs.length)) || 1;
    const scale = 86 / rms;
    for (const i of cat.idxs) {
      preliminary[i] = {
        x: anchor.x + (projected[i].x - cat.x) * scale,
        y: anchor.y + (projected[i].y - cat.y) * scale,
      };
    }
  }

  const pts = preliminary.map((p) => ({ ...p }));
  for (let iter = 0; iter < 80; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let dist = Math.hypot(dx, dy);
        const min = items[i].radius + items[j].radius + (items[i].category === items[j].category ? 18 : 36);
        if (dist < 0.01) {
          dx = (i - j) * 0.01;
          dy = 0.02;
          dist = Math.hypot(dx, dy);
        }
        if (dist < min) {
          const push = ((min - dist) / dist) * 0.45;
          pts[i].x -= dx * push;
          pts[i].y -= dy * push;
          pts[j].x += dx * push;
          pts[j].y += dy * push;
        }
      }
    }
    for (let i = 0; i < pts.length; i++) {
      const anchor = anchors.get(items[i].category)!;
      pts[i].x += (anchor.x - pts[i].x) * 0.012;
      pts[i].y += (anchor.y - pts[i].y) * 0.012;
    }
  }

  items.forEach((it, i) => pos.set(it.id, pts[i]));
  return pos;
}
