import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHead, Ticker } from "@/components/fl/shell";
import { useRevealedChanges, type Notice } from "@/lib/faultline/catchup";

export const Route = createFileRoute("/changes")({
  component: ChangesPage,
});

type Kind = "opened" | "changed" | "cleared" | "health";

function kindOf(note: Notice): Kind {
  if (note.tab === "health") return "health";
  if (note.title.includes("cleared")) return "cleared";
  if (note.title.includes("changed")) return "changed";
  return "opened";
}

const KIND: Record<Kind, { label: string; chip: string }> = {
  opened: { label: "Opened", chip: "bg-orange-50 text-warn" },
  changed: { label: "Changed", chip: "bg-blue-soft text-blue" },
  cleared: { label: "Cleared", chip: "bg-bg text-muted" },
  health: { label: "Health", chip: "bg-blue-soft text-blue" },
};

function dayLabel(iso: string) {
  const day = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (day === today) return "Today";
  return day;
}

function ChangesPage() {
  const changes = useRevealedChanges();
  const [filter, setFilter] = useState<Kind | "all">("all");
  const rows = useMemo(() => changes.filter((note) => filter === "all" || kindOf(note) === filter), [changes, filter]);
  const counts = useMemo(() => {
    const tally = { opened: 0, changed: 0, cleared: 0, health: 0 };
    for (const note of changes) tally[kindOf(note)] += 1;
    return tally;
  }, [changes]);
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, Notice[]>();
    for (const note of rows) {
      const label = dayLabel(note.at);
      if (!map.has(label)) {
        map.set(label, []);
        order.push(label);
      }
      map.get(label)!.push(note);
    }
    return order.map((label) => ({ label, notes: map.get(label)! }));
  }, [rows]);

  return (
    <>
      <PageHead kicker="Only what changed" title="Everything since you last looked" text="The overview keeps the newest three. This page keeps the rest." />
      <div className="mb-3 grid grid-cols-4 gap-2">
        <Count label="Opened" value={counts.opened} />
        <Count label="Changed" value={counts.changed} />
        <Count label="Cleared" value={counts.cleared} />
        <Count label="Health" value={counts.health} />
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {(["all", "opened", "changed", "cleared", "health"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-8 shrink-0 rounded-full px-3 text-xs ${filter === id ? "bg-ink text-white" : "border border-line bg-surface text-muted"}`}
          >
            {id === "all" ? "All" : KIND[id].label}
          </button>
        ))}
      </div>
      {groups.length === 0 && <p className="card px-4 py-3 text-sm text-muted">Nothing in this view yet. Refresh on the overview to pull what changed.</p>}
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{group.label}</h2>
            <ul className="card divide-y divide-line">
              {group.notes.map((note) => {
                const kind = KIND[kindOf(note)];
                return (
                  <li key={note.id}>
                    <Link to="/asset/$id" params={{ id: String(note.asset) }} search={{ tab: note.tab }} className="flex items-start gap-3 px-3 py-3 sm:items-center sm:px-4">
                      <span className="shrink-0 pt-0.5 sm:pt-0">
                        <Ticker symbol={note.symbol} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">{note.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">{note.text}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${kind.chip}`}>{kind.label}</span>
                        <span className="num mt-1 block text-[10px] text-muted">{note.at.slice(11, 16)} UTC</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
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
