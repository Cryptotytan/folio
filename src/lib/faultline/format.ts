export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toPrecision(2)}`;
}

export function formatPct(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "n/a";
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(digits)}%`;
}

export function formatScore(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

export function healthState(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Stable";
  if (score >= 50) return "Watch";
  if (score >= 35) return "Deteriorating";
  return "Severe deterioration";
}

export function faultBand(magnitude: number): string {
  if (magnitude < 3) return "Normal";
  if (magnitude < 5) return "Minor";
  if (magnitude < 6.5) return "Elevated";
  if (magnitude < 8) return "Major";
  return "Severe";
}

export function rotationState(score: number): string {
  if (score <= 20) return "Strongly cooling";
  if (score <= 40) return "Cooling";
  if (score < 60) return "Neutral";
  if (score < 80) return "Heating";
  return "Strongly heating";
}

export function rotationArrow(dir: "up" | "flat" | "down" | null): string {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  return "→";
}

export function evidenceLabel(q: string): string {
  return q;
}
