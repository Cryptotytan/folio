import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHead, Token } from "@/components/fl/shell";
import { formatPct, formatUsd } from "@/lib/faultline/format";
import { loadStockBoard, loadStory, type Story, type TapeRow } from "@/lib/faultline/markets.functions";

export const Route = createFileRoute("/markets")({
  component: MarketsPage,
});

function savedTape(): TapeRow[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem("folio-stock-tape") || "[]") as TapeRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function MarketsPage() {
  const [rows, setRows] = useState<TapeRow[]>(savedTape);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty">(savedTape().length ? "ready" : "loading");

  useEffect(() => {
    let cancel = false;
    loadStockBoard()
      .then((list) => {
        if (cancel) return;
        if (list.length) {
          setRows(list);
          sessionStorage.setItem("folio-stock-tape", JSON.stringify(list));
        }
        setState(list.length || rows.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancel) setState("empty");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.symbol} ${row.name} ${row.group}`.toLowerCase().includes(query));
  }, [rows, q]);

  const movers = useMemo(() => {
    return [...shown].filter((row) => Math.abs(row.change1) >= 0.008).sort((a, b) => Math.abs(b.change1) - Math.abs(a.change1)).slice(0, 3);
  }, [shown]);

  return (
    <>
      <PageHead
        kicker="Markets"
        title="Stocks and commodities."
        text="The major US names, the indexes, and the commodity tape. When one is moving, Folio looks for a published report and links out. It does not invent a cause."
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter Apple, Nvidia, gold..."
        className="mb-4 h-11 w-full max-w-md rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-blue"
      />

      <section className="mb-8">
        <h2 className="text-lg font-semibold">Why it moved</h2>
        <p className="mt-1 text-sm text-muted">The three largest moves, and the latest report that names them.</p>
        {state === "loading" && <p className="mt-3 text-sm text-muted">Reading the tape.</p>}
        {state !== "loading" && movers.length === 0 && <p className="mt-3 text-sm text-muted">Nothing here is moving more than a small amount.</p>}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {movers.map((row) => (
            <Mover key={row.id} row={row} />
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <ul className="divide-y divide-line">
          {shown.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              <Token symbol={row.symbol} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{row.symbol}</span>
                <span className="block truncate text-xs text-muted">
                  {row.name}
                  <span> · {row.group}</span>
                </span>
              </span>
              <span className="num text-sm font-medium">{row.price ? formatUsd(row.price) : "—"}</span>
              <span className={`num w-16 text-right text-sm font-semibold ${row.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(row.change1)}</span>
            </li>
          ))}
          {state === "ready" && shown.length === 0 && <li className="px-4 py-8 text-sm text-muted">Nothing matches that.</li>}
          {state === "empty" && <li className="px-4 py-8 text-sm text-muted">The tape did not answer. Try again in a moment.</li>}
        </ul>
      </section>
    </>
  );
}

function Mover({ row }: { row: TapeRow }) {
  const [story, setStory] = useState<Story | null>(null);
  useEffect(() => {
    let cancel = false;
    loadStory({ data: { symbol: row.symbol, name: row.name, kind: "stock" } })
      .then((next) => {
        if (!cancel) setStory(next);
      })
      .catch(() => {
        if (!cancel) setStory({ reason: "The report search did not answer.", source: "", url: "", at: "" });
      });
    return () => {
      cancel = true;
    };
  }, [row.symbol, row.name]);
  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <Token symbol={row.symbol} size={22} />
          <h3 className="text-base font-semibold">{row.symbol}</h3>
        </span>
        <span className={`num text-sm font-semibold ${row.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(row.change1)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{row.name}</p>
      <p className="mt-3 text-sm leading-relaxed">{story ? story.reason : "Looking for a report."}</p>
      {story?.url && (
        <a href={story.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-blue">
          {story.source ? `${story.source} →` : "Read the report →"}
        </a>
      )}
    </article>
  );
}
