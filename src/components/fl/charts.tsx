import { useState } from "react";
import { formatUsd } from "@/lib/faultline/format";
import type { Candle } from "@/lib/faultline/candles.functions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function labelDate(value: string) {
  const [day, time] = value.split("T");
  const parts = day.split("-");
  if (parts.length === 3) {
    const name = MONTHS[Number(parts[1]) - 1];
    const date = name ? `${name} ${Number(parts[2])}` : day;
    return time ? `${date} ${time.slice(0, 5)}` : `${date}, ${parts[0]}`;
  }
  const name = MONTHS[Number(parts[0]) - 1];
  return name && parts[1] ? `${name} ${Number(parts[1])}` : value;
}

export function patternName(curr: Candle, prev?: Candle) {
  const range = curr.h - curr.l;
  if (!(range > 0)) return null;
  const body = Math.abs(curr.c - curr.o);
  const upper = curr.h - Math.max(curr.o, curr.c);
  const lower = Math.min(curr.o, curr.c) - curr.l;
  if (body <= range * 0.1) return "Doji";
  if (lower >= body * 2 && upper <= body * 0.8) return "Hammer";
  if (upper >= body * 2 && lower <= body * 0.8) return "Shooting star";
  if (prev) {
    const prevUp = prev.c >= prev.o;
    const up = curr.c >= curr.o;
    const prevBody = Math.abs(prev.c - prev.o);
    if (!prevUp && up && curr.o <= Math.min(prev.o, prev.c) && curr.c >= Math.max(prev.o, prev.c) && body > prevBody) return "Bullish engulfing";
    if (prevUp && !up && curr.o >= Math.max(prev.o, prev.c) && curr.c <= Math.min(prev.o, prev.c) && body > prevBody) return "Bearish engulfing";
  }
  return null;
}

const SHAPE_LINE: Record<string, string> = {
  Doji: "Open and close almost met. The day did not pick a side.",
  Hammer: "It was sold down and recovered. That describes the day, not a trade.",
  "Shooting star": "The push higher was rejected before the close.",
  "Bullish engulfing": "Today's rise covered the whole of yesterday's drop.",
  "Bearish engulfing": "Today's drop covered the whole of yesterday's rise.",
};
export function CandleChart({ data }: { data: Candle[] }) {
  const rows = data.filter((row) => row.c > 0 && row.h >= row.l);
  const [active, setActive] = useState<number | null>(null);
  const [mode, setMode] = useState<"candles" | "line">("candles");
  if (rows.length < 2) return <p className="py-8 text-sm text-muted">No candles for this asset yet.</p>;

  const w = 720;
  const h = 360;
  const priceTop = 16;
  const priceBot = 200;
  const volTop = 228;
  const volBot = 286;
  const padL = 12;
  const padR = 112;
  const plotRight = w - padR;
  const slot = (plotRight - padL) / rows.length;
  const bodyW = Math.max(2, Math.min(8, slot * 0.62));
  const hi = Math.max(...rows.map((r) => r.h));
  const lo = Math.min(...rows.map((r) => r.l));
  const span = hi - lo || hi * 0.02 || 1;
  const maxVol = Math.max(...rows.map((r) => r.v), 1);
  const y = (price: number) => priceTop + (1 - (price - lo) / span) * (priceBot - priceTop);
  const x = (i: number) => padL + slot * i + slot / 2;
  const index = active == null ? rows.length - 1 : Math.min(active, rows.length - 1);
  const focus = rows[index];
  const prev = index > 0 ? rows[index - 1] : undefined;
  const shape = patternName(focus, prev);
  const up = focus.c >= focus.o;

  const move = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width) return;
    const px = ((clientX - rect.left) / rect.width) * w;
    const next = Math.max(0, Math.min(rows.length - 1, Math.floor((px - padL) / slot)));
    setActive(next);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="num text-xs text-muted">O {formatUsd(focus.o)}</span>
        <span className="num text-xs text-muted">H {formatUsd(focus.h)}</span>
        <span className="num text-xs text-muted">L {formatUsd(focus.l)}</span>
        <span className="num text-xs text-muted">Vol {formatUsd(focus.v)}</span>
        {shape && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${up ? "bg-emerald-50 text-pos" : "bg-rose-50 text-neg"}`}>{shape}</span>}
        <span className="ml-auto inline-flex rounded-full bg-bg p-0.5">
          <button type="button" className={`h-7 rounded-full px-3 text-xs ${mode === "candles" ? "bg-white font-medium text-ink shadow-sm" : "text-muted"}`} onClick={() => setMode("candles")}>Candles</button>
          <button type="button" className={`h-7 rounded-full px-3 text-xs ${mode === "line" ? "bg-white font-medium text-ink shadow-sm" : "text-muted"}`} onClick={() => setMode("line")}>Line</button>
        </span>
      </div>
      {shape && <p className="mb-2 text-xs text-muted">{SHAPE_LINE[shape]}</p>}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-56 w-full touch-none sm:h-80"
        role="img"
        aria-label="Candles and volume. Move across a day to read its price."
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
      >
        {[0, 1, 2].map((i) => {
          const gy = priceTop + ((priceBot - priceTop) * i) / 2;
          return <line key={i} x1={padL} x2={plotRight} y1={gy} y2={gy} stroke="#e6ebf2" strokeWidth="1" />;
        })}
        <line x1={x(index)} x2={x(index)} y1={priceTop} y2={volBot} stroke="#d5deea" strokeDasharray="3 4" />
        <line x1={padL} x2={plotRight} y1={y(focus.c)} y2={y(focus.c)} stroke="#d5deea" strokeDasharray="3 4" />
        {mode === "line" && (
          <path d={rows.map((row, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(row.c).toFixed(1)}`).join(" ")} fill="none" stroke="#162033" strokeWidth="2.25" strokeLinejoin="round" />
        )}
        {rows.map((row, i) => {
          const cx = x(i);
          const rising = row.c >= row.o;
          const color = rising ? "#067647" : "#b42318";
          const top = y(Math.max(row.o, row.c));
          const bot = y(Math.min(row.o, row.c));
          const volH = (row.v / maxVol) * (volBot - volTop);
          return (
            <g key={`${row.d}-${i}`}>
              {mode === "candles" && (
                <>
                  <line x1={cx} x2={cx} y1={y(row.h)} y2={y(row.l)} stroke={color} strokeWidth="1.25" />
                  <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1.5, bot - top)} fill={color} rx="0.5" />
                </>
              )}
              <rect x={cx - bodyW / 2} y={volBot - volH} width={bodyW} height={Math.max(1, volH)} fill={color} opacity={i === index ? 0.9 : 0.45} rx="0.5" />
            </g>
          );
        })}
        <circle cx={x(index)} cy={y(focus.c)} r="4.5" fill="#fff" stroke={up ? "#067647" : "#b42318"} strokeWidth="2" />
        {[hi, (hi + lo) / 2, lo].map((price) => {
          const py = y(price);
          if (Math.abs(py - y(focus.c)) < 18) return null;
          return (
            <text key={price} x={w - 8} y={py + 4} textAnchor="end" fill="#8b98a8" fontSize="11" fontFamily="Manrope, sans-serif">
              {formatUsd(price)}
            </text>
          );
        })}
        <g>
          <rect x={plotRight + 8} y={Math.min(priceBot - 20, Math.max(priceTop, y(focus.c) - 11))} width="96" height="22" rx="4" fill={up ? "#067647" : "#b42318"} />
          <text
            x={w - 12}
            y={Math.min(priceBot - 20, Math.max(priceTop, y(focus.c) - 11)) + 15}
            textAnchor="end"
            fill="#ffffff"
            fontSize="11"
            fontFamily="Manrope, sans-serif"
          >
            {formatUsd(focus.c)}
          </text>
        </g>
        <g>
          <rect x={Math.min(Math.max(x(index) - 58, padL), plotRight - 120)} y={308} width="116" height="22" rx="4" fill="#121a27" />
          <text
            x={Math.min(Math.max(x(index) - 58, padL), plotRight - 120) + 58}
            y="323"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontFamily="Manrope, sans-serif"
          >
            {labelDate(focus.d)}
          </text>
        </g>
        <text x={padL} y={volTop - 4} fill="#8b98a8" fontSize="10" fontFamily="Manrope, sans-serif">
          Volume
        </text>
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
      </svg>
    </div>
  );
}
