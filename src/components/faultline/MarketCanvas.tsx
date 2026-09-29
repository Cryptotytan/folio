import { useEffect, useMemo, useState } from "react";
import type { CategoryId } from "@/lib/faultline/config";
import { WORLD, type WorldNode } from "@/lib/faultline/model";

export type MapLayer = "activity" | "faults" | "dna" | "health" | "leverage" | "liquidations" | "rwa";

type Fly = { kind: "asset" | "region" | "home" | "zoom"; id?: number | string; nonce: number };

type Props = {
  day: number;
  layer: MapLayer;
  selectedId: number | null;
  highlight: number[] | null;
  fly: Fly | null;
  reducedMotion: boolean;
  panelOpen: boolean;
  openRegion: string | null;
  onOpenRegion: (id: string | null) => void;
  onSelect: (id: number | null) => void;
};

type Disk = { id: string; name: string; x: number; y: number; r: number; color: string };

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function mix(hex: string, toward: [number, number, number], t: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const u = clamp(t, 0, 1);
  return `rgb(${Math.round(r + (toward[0] - r) * u)}, ${Math.round(g + (toward[1] - g) * u)}, ${Math.round(b + (toward[2] - b) * u)})`;
}

const DISKS: Disk[] = WORLD.regions.map((region) => {
  const members = WORLD.nodes.filter((n) => n.category === region.id);
  let x = 0;
  let y = 0;
  for (const m of members) {
    x += m.x;
    y += m.y;
  }
  const n = members.length || 1;
  x /= n;
  y /= n;
  let spread = 0;
  for (const m of members) spread = Math.max(spread, Math.hypot(m.x - x, m.y - y));
  return {
    id: region.id,
    name: region.name,
    x,
    y,
    r: Math.max(spread + 46, 120),
    color: region.color,
  };
});

const SPAN = (() => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of DISKS) {
    minX = Math.min(minX, d.x);
    minY = Math.min(minY, d.y);
    maxX = Math.max(maxX, d.x);
    maxY = Math.max(maxY, d.y);
  }
  return { minX, minY, maxX, maxY };
})();

function pct(v: number, min: number, max: number) {
  const n = 14 + ((v - min) / (max - min || 1)) * 72;
  return (Math.round(n * 100) / 100).toFixed(2);
}

function diskFill(disk: Disk, layer: MapLayer, day: number) {
  const region = WORLD.regions.find((r) => r.id === disk.id);
  const rot = region?.rotation[day] ?? 50;
  const health = region?.health[day] ?? 60;
  if (layer === "health") {
    return health < 50 ? mix(disk.color, [176, 104, 88], 0.5) : mix(disk.color, [186, 214, 186], 0.55);
  }
  if (layer === "faults") return mix(disk.color, [120, 96, 88], 0.28);
  if (layer === "dna") return mix(disk.color, [214, 222, 230], 0.5);
  return mix(disk.color, [232, 214, 184], 0.42 + clamp((rot - 40) / 120, 0, 0.28));
}

export function MarketCanvas({
  day,
  layer,
  selectedId,
  highlight,
  fly,
  openRegion,
  onOpenRegion,
  onSelect,
}: Props) {
  const [scale, setScale] = useState(1);
  const hi = useMemo(() => (highlight ? new Set(highlight) : null), [highlight]);
  const open = DISKS.find((d) => d.id === openRegion) ?? null;
  const assets = open ? WORLD.nodes.filter((n) => n.category === open.id) : [];
  const maxM = Math.max(1, ...assets.map((n) => n.mcap[day] || 1));

  useEffect(() => {
    if (!fly) return;
    if (fly.kind === "home") setScale(1);
    else if (fly.kind === "zoom" && typeof fly.id === "number") {
      const factor = fly.id;
      setScale((s) => clamp(s * factor, 0.85, 1.45));
    }
  }, [fly]);

  return (
    <div
      className="absolute inset-0"
      style={{ background: "radial-gradient(circle at 50% 42%, #1c3d56 0%, #123044 55%, #07141d 100%)" }}
    >
      {!open && (
        <div
          className="absolute inset-0"
          style={{ transform: `scale(${scale})`, transformOrigin: "50% 50%" }}
        >
          {DISKS.map((disk) => {
            const severe = WORLD.nodes.some((n) => n.category === disk.id && (n.faultMagnitude[day] ?? 0) >= 6.5);
            const marked = hi ? WORLD.nodes.some((n) => n.category === disk.id && hi.has(n.id)) : false;
            return (
              <button
                key={disk.id}
                type="button"
                onClick={() => onOpenRegion(disk.id)}
                className="absolute flex items-center justify-center rounded-full px-3 text-center text-[12px] font-semibold leading-tight"
                style={{
                  left: `${pct(disk.x, SPAN.minX, SPAN.maxX)}%`,
                  top: `${pct(disk.y, SPAN.minY, SPAN.maxY)}%`,
                  width: "clamp(84px, 13vmin, 148px)",
                  height: "clamp(84px, 13vmin, 148px)",
                  transform: "translate(-50%, -50%)",
                  background: diskFill(disk, layer, day),
                  color: "#10202c",
                  border: marked || (layer === "faults" && severe) ? "3px solid #f4f7fa" : "2px solid rgba(244,247,250,0.92)",
                  boxShadow: severe && layer === "activity" ? "0 0 0 5px rgba(196,132,114,0.85)" : "0 8px 24px rgba(0,0,0,0.25)",
                }}
              >
                {disk.name}
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => onOpenRegion(null)}
            className="absolute top-3 left-3 z-10 h-11 rounded-full border border-line bg-surface px-4 text-sm text-fg"
          >
            All sectors
          </button>
          <div
            className="relative rounded-full"
            style={{
              width: "min(78vmin, 560px)",
              height: "min(78vmin, 560px)",
              background: diskFill(open, layer, day),
              border: "3px solid rgba(244,247,250,0.95)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
            }}
          >
            <p className="pointer-events-none absolute inset-x-4 top-[7%] text-center text-sm font-semibold text-[#10202c]">
              {open.name}
            </p>
            {assets.map((node) => (
              <AssetButton
                key={node.id}
                node={node}
                disk={open}
                day={day}
                maxM={maxM}
                selected={node.id === selectedId}
                dimmed={Boolean(hi && !hi.has(node.id))}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetButton({
  node,
  disk,
  day,
  maxM,
  selected,
  dimmed,
  onSelect,
}: {
  node: WorldNode;
  disk: Disk;
  day: number;
  maxM: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: number) => void;
}) {
  const dx = clamp((node.x - disk.x) / disk.r, -0.82, 0.82);
  const dy = clamp((node.y - disk.y) / disk.r, -0.72, 0.72);
  const size = 36 + Math.sqrt((node.mcap[day] || 1) / maxM) * 28;
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="absolute flex items-center justify-center rounded-full text-[11px] font-semibold"
      style={{
        left: `${50 + dx * 36}%`,
        top: `${54 + dy * 34}%`,
        width: size,
        height: size,
        transform: "translate(-50%, -50%)",
        background: selected ? "#10202c" : "#f7f4ee",
        color: selected ? "#f4f7fa" : "#10202c",
        border: "1.5px solid #10202c",
        opacity: dimmed ? 0.35 : 1,
      }}
    >
      {node.symbol}
    </button>
  );
}

export type { CategoryId };
