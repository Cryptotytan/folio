import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PageHead, Ticker, refreshBook, useMarketEdition } from "@/components/fl/shell";
import { formatPct } from "@/lib/faultline/format";
import { recordFaults, type FaultEvent } from "@/lib/faultline/fault-history";
import { faultLabel, faults, initialFaults, quoteState, subscribeEdition, type Asset } from "@/lib/faultline/view";
import { useDesk } from "@/lib/faultline/desk";

export const Route = createFileRoute("/faults")({
  component: FaultsPage,
});

const CURSOR = "faultline-fault-cursor";

const FILTERS: { id: string; label: string; match: (t: string | null) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "history", label: "History", match: () => true },
  { id: "pv", label: "Price / volume", match: (t) => t === "PRICE_VOLUME_DIVERGENCE" || t === "VOLUME_PRICE_DIVERGENCE" || t === "FLAT_VOLUME_SURGE" },
  { id: "cat", label: "Category divergence", match: (t) => t === "ASSET_UP_CATEGORY_DOWN" || t === "ASSET_DOWN_CATEGORY_UP" || t === "CATEGORY_DECOUPLING" },
  { id: "corr", label: "Correlation", match: (t) => t === "BTC_DECOUPLING" },
  { id: "struct", label: "Structure", match: (t) => t === "STRUCTURAL_DIVERGENCE" },
];

const KIND: Record<FaultEvent["kind"], { label: string; chip: string }> = {
  opened: { label: "Opened", chip: "bg-orange-50 text-warn" },
  updated: { label: "Updated", chip: "bg-blue-soft text-blue" },
  closed: { label: "Closed", chip: "bg-bg text-muted" },
};

function storedEvents(): FaultEvent[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem("faultline-fault-history") || "") as { events?: FaultEvent[] };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function dayLabel(iso: string) {
  const day = iso.slice(0, 10);
  return day === new Date().toISOString().slice(0, 10) ? "Today" : day;
}

function FaultsPage() {
  const edition = useMarketEdition();
  const desk = useDesk();
  const [filter, setFilter] = useState("all");
  const [list, setList] = useState<Asset[] | null>(null);
  const [history, setHistory] = useState<FaultEvent[]>([]);
  const [missed, setMissed] = useState<FaultEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const rule = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];

  useEffect(() => {
    if (list || quoteState() !== "live") return;
    setList(faults.slice());
    setHistory(storedEvents());
    if (!localStorage.getItem(CURSOR)) localStorage.setItem(CURSOR, new Date().toISOString());
  }, [edition, list]);

  const liveFaults = useSyncExternalStore(subscribeEdition, () => faults, () => initialFaults);
  const shown = (desk.kind === "crypto" ? (list ?? liveFaults) : desk.faults).filter((n) => rule.match(n.faultType));

  const refresh = () => {
    setBusy(true);
    const since = localStorage.getItem(CURSOR) || "";
    refreshBook()
      .then(() => {
        recordFaults(faults);
        const events = storedEvents();
        setMissed(since ? events.filter((event) => event.at > since) : events);
        localStorage.setItem(CURSOR, new Date().toISOString());
        setList(faults.slice());
        setHistory(events);
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <PageHead
        kicker="Market faults"
        title="Unusual contradictions"
        text="A disagreement between signals. A description, not an accusation or a forecast. Folio calculated this from the live price and volume. These are not exchange quotes."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`h-8 shrink-0 rounded-full px-3 text-xs ${filter === f.id ? "bg-ink text-white" : "border border-line bg-surface text-fg"}`}
          >
            {f.label}
            {f.id === "history" && history.length > 0 ? ` ${history.length}` : ""}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={refresh} className="ml-auto h-8 shrink-0 rounded-full bg-ink px-3 text-xs font-medium text-white disabled:opacity-60">
          {busy ? "Refreshing" : "Refresh"}
        </button>
      </div>
      {missed.length > 0 && filter !== "history" && (
        <div className="card mb-3 overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Since you last refreshed</p>
            <p className="text-xs text-muted">{missed.length === 1 ? "1 change you had not seen." : `${missed.length} changes you had not seen.`}</p>
          </div>
          <ul className="divide-y divide-line">
            {missed.map((event) => (
              <li key={event.id}>
                <Link to="/asset/$id" params={{ id: String(event.assetId) }} search={{ tab: "faults" }} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                  <Ticker symbol={event.symbol} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{event.name}</span>
                    {event.faultText && <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{event.faultText}</span>}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${KIND[event.kind].chip}`}>{KIND[event.kind].label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {filter === "history" && desk.kind === "crypto" ? (
        <HistoryView events={history} />
      ) : (
        <ul className="card divide-y divide-line">
          {shown.map((n) => (
            <li key={n.id}>
              <Link to="/asset/$id" params={{ id: String(n.id) }} search={{ tab: "faults" }} className="block px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                  <Ticker symbol={n.symbol} name={n.name} />
                  <span className="num shrink-0 text-sm font-semibold text-warn">{(n.faultMag ?? 0).toFixed(1)}</span>
                </div>
                <p className="mt-2 text-xs text-muted">{faultLabel(n.faultType)} · {formatPct(n.change1)} today</p>
                {n.faultText && <p className="mt-1 line-clamp-2 text-sm">{n.faultText}</p>}
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing in this filter. Refresh to check for anything new.</li>}
        </ul>
      )}
    </>
  );
}

function HistoryView({ events }: { events: FaultEvent[] }) {
  const [kind, setKind] = useState<FaultEvent["kind"] | "all">("all");
  const [q, setQ] = useState("");
  const counts = useMemo(() => {
    const tally = { opened: 0, updated: 0, closed: 0 };
    for (const event of events) tally[event.kind] += 1;
    return tally;
  }, [events]);
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = events.filter((event) => (kind === "all" || event.kind === kind) && (!query || `${event.symbol} ${event.name}`.toLowerCase().includes(query)));
    const order: string[] = [];
    const map = new Map<string, FaultEvent[]>();
    for (const event of rows) {
      const label = dayLabel(event.at);
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(event);
    }
    return order.map((label) => ({ label, events: map.get(label)! }));
  }, [events, kind, q]);

  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Count label="Opened" value={counts.opened} />
        <Count label="Updated" value={counts.updated} />
        <Count label="Closed" value={counts.closed} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a coin"
          autoComplete="off"
          className="h-8 w-full max-w-xs rounded-full border border-line bg-surface px-3 text-xs outline-none focus:border-blue"
        />
        {(["all", "opened", "updated", "closed"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={`h-8 rounded-full px-3 text-xs ${kind === id ? "bg-blue-soft text-blue" : "text-muted"}`}
          >
            {id === "all" ? "All" : KIND[id].label}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="card px-4 py-3 text-sm text-muted">Nothing in this view. Refresh to check. Past faults stay here.</p>}
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{group.label}</h2>
            <ul className="card divide-y divide-line">
              {group.events.map((event) => (
                <li key={event.id}>
                  <Link to="/asset/$id" params={{ id: String(event.assetId) }} search={{ tab: "faults" }} className="flex items-start gap-3 px-3 py-3 sm:items-center sm:px-4">
                    <span className="shrink-0 pt-0.5 sm:pt-0">
                      <Ticker symbol={event.symbol} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{event.faultType ? faultLabel(event.faultType) : event.name}</span>
                      {event.faultText && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">{event.faultText}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${KIND[event.kind].chip}`}>{KIND[event.kind].label}</span>
                      <span className="num mt-1 block text-xs font-semibold text-warn">{event.faultMag == null ? "—" : event.faultMag.toFixed(1)}</span>
                      <span className="num mt-0.5 block text-[10px] text-muted">{event.at.slice(11, 16)} UTC</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-3 py-2">
      <p className="text-[10px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="num mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}
