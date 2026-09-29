import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Activity, Dna, HeartPulse, LayoutDashboard, Search, ShieldAlert, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, Component } from "react";
import { formatPct, formatUsd } from "@/lib/faultline/format";
import { ASSETS, SECTORS, applyLiveBook, asOf, bookLabel, bookReady, editionStamp, faults, msUntilUtcMidnight, refreshIfNewDay, subscribeEdition } from "@/lib/faultline/view";
import { loadDailyBook, loadMarketJournal } from "@/lib/faultline/book.functions";
import { recordFaults, mergeServerFaults } from "@/lib/faultline/fault-history";
import { recordCatchup, mergeServerNotices } from "@/lib/faultline/catchup";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/sectors", label: "Sectors", icon: Waypoints },
  { to: "/faults", label: "Faults", icon: ShieldAlert },
  { to: "/dna", label: "DNA", icon: Dna },
  { to: "/health", label: "Health", icon: HeartPulse },
] as const;

const PAGES = [
  { id: "overview", label: "Overview", sub: "The market brief", to: "/app" as const },
  { id: "sectors", label: "Sectors", sub: "Where attention is sitting", to: "/sectors" as const },
  { id: "faults", label: "Faults", sub: "Signals that disagree", to: "/faults" as const },
  { id: "health", label: "Health", sub: "Structural strength", to: "/health" as const },
  { id: "dna", label: "DNA", sub: "Behavior versus history", to: "/dna" as const },
];

export function useMarketEdition() {
  return useSyncExternalStore(subscribeEdition, editionStamp, editionStamp);
}

export function Token({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-medium text-white"
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`/coins/${symbol.toLowerCase()}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="token shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect width="22" height="22" rx="6" fill="var(--color-ink)" />
      <path d="M4.5 14.2 8.8 9.2l2.6 2.8L17.2 6.4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

let flight: Promise<void> | null = null;
let bookSettled = false;

function ensureBook(force = false) {
  if (flight) return flight;
  if (!force && (bookReady() || bookSettled)) return Promise.resolve();
  flight = loadDailyBook()
    .then((book) => applyLiveBook(book))
    .catch(() => {
      if (!bookReady()) applyLiveBook({ source: "model", quotes: [] });
    })
    .finally(() => {
      bookSettled = true;
      flight = null;
    });
  return flight;
}

export function refreshBook() {
  return ensureBook(true);
}

class PageGuard extends Component<{ resetKey: string; children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: false });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="card p-6">
          <h1 className="text-xl">This view hit a problem.</h1>
          <p className="mt-2 text-sm text-muted">The rest of Folio is still available.</p>
          <a href="/app" className="mt-4 inline-flex text-sm font-medium text-blue">
            Back to overview
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

export function useLiveBook() {
  useMarketEdition();
  useEffect(() => {
    ensureBook();
    const id = window.setInterval(() => ensureBook(true), 20000);
    return () => window.clearInterval(id);
  }, []);
}

const WARM = ["/app", "/sectors", "/faults", "/dna", "/health", "/search"] as const;

export function AppFrame() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/") return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const edition = useMarketEdition();
  useEffect(() => {
    recordFaults(faults);
    recordCatchup();
  }, [edition]);

  useEffect(() => {
    ensureBook();
    const journal = () => {
      loadMarketJournal()
        .then((book) => {
          mergeServerFaults(book.events);
          mergeServerNotices(book.notices);
        })
        .catch(() => {});
    };
    journal();
    const warm = window.setTimeout(() => {
      for (const to of WARM) router.preloadRoute({ to }).catch(() => {});
    }, 40);
    const refresh = window.setInterval(() => {
      ensureBook(true);
      journal();
    }, 20000);
    const timer = window.setTimeout(() => {
      refreshIfNewDay();
      ensureBook(true);
    }, msUntilUtcMidnight());
    return () => {
      window.clearTimeout(warm);
      window.clearInterval(refresh);
      window.clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="glass sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-10 px-5">
          <Link to="/" className="logo shrink-0 self-center">
            <Mark />
            Folio
          </Link>
          <nav className="hidden items-stretch md:flex" aria-label="Primary">
            {NAV.map((item) => {
              const on = path === item.to || path.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="render"
                  aria-current={on ? "page" : undefined}
                  className={`relative inline-flex items-center px-3 text-[15px] ${on ? "font-medium text-ink" : "text-muted hover:text-ink"}`}
                >
                  {item.label}
                  <span className={`absolute inset-x-3 bottom-0 h-0.5 ${on ? "bg-ink" : "bg-transparent"}`} />
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center">
            <button type="button" className="btn-ghost h-9 gap-2 px-3 text-sm" onClick={() => setSearchOpen(true)}>
              <Search className="size-4" aria-hidden />
              Search
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-5 pb-24 md:px-5 md:pt-8 md:pb-16">
        <PageGuard resetKey={path}>{children}</PageGuard>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Mobile">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = path === item.to || path.startsWith(`${item.to}/`);
            return (
              <li key={item.to}>
                <Link to={item.to} preload="render" aria-current={on ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] ${on ? "text-blue" : "text-muted"}`}>
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

type Result =
  | { kind: "asset"; key: string; label: string; sub: string; price: number; change1: number }
  | { kind: "sector"; key: string; label: string; sub: string; slug: string }
  | { kind: "go"; key: string; label: string; sub: string; to: (typeof PAGES)[number]["to"] };

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const edition = useMarketEdition();
  const sections = useMemo(() => {
    const query = q.trim().toLowerCase();
    const hit = (text: string) => text.toLowerCase().includes(query);
    const assets = (query ? ASSETS.filter((n) => hit(`${n.symbol} ${n.name} ${n.category}`)) : [...ASSETS].sort((a, b) => b.change1 - a.change1))
      .slice(0, query ? 6 : 5)
      .map(
        (n): Result => ({
          kind: "asset",
          key: `asset-${n.id}`,
          label: n.symbol,
          sub: n.name,
          price: n.price,
          change1: n.change1,
        }),
      );
    const sectors = (query ? SECTORS.filter((s) => hit(`${s.name} ${s.id}`)) : [...SECTORS].sort((a, b) => b.rotation - a.rotation))
      .slice(0, query ? 4 : 3)
      .map(
        (s): Result => ({
          kind: "sector",
          key: `sector-${s.id}`,
          label: s.name,
          sub: `Rotation ${Math.round(s.rotation)} · ${s.count} assets`,
          slug: s.id,
        }),
      );
    const pages = (query ? PAGES.filter((page) => hit(`${page.label} ${page.sub}`)) : []).map(
      (page): Result => ({ kind: "go", key: page.id, label: page.label, sub: page.sub, to: page.to }),
    );
    return [
      { title: query ? "Assets" : "Moving today", rows: assets },
      { title: query ? "Sectors" : "In focus", rows: sectors },
      { title: "Pages", rows: pages },
    ].filter((section) => section.rows.length > 0);
  }, [q, edition]);
  const flat = sections.flatMap((section) => section.rows);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Search">
      <button type="button" className="absolute inset-0 bg-ink/20" aria-label="Close search" onClick={onClose} />
      <div className="absolute top-16 right-3 left-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(18,26,39,0.16)] md:right-[max(1.25rem,calc(50vw-36rem+1.25rem))] md:left-auto md:w-[28rem]">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(flat.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                document.querySelector<HTMLAnchorElement>("[data-search-active]")?.click();
              } else if (e.key === "Escape") onClose();
            }}
            placeholder="Search a coin, a sector, or a page"
            className="h-12 w-full bg-transparent text-base outline-none"
          />
          <button type="button" className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="max-h-[min(26rem,70dvh)] overflow-auto py-2">
          {sections.map((section) => (
            <section key={section.title}>
              <p className="px-4 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted uppercase">{section.title}</p>
              <ul>
                {section.rows.map((row) => {
                  const index = flat.indexOf(row);
                  const active = index === cursor;
                  const className = `flex w-full items-center gap-3 px-4 py-2.5 text-left ${active ? "bg-blue-soft" : "hover:bg-bg"}`;
                  const body = (
                    <>
                      {row.kind === "asset" ? <Token symbol={row.label} size={28} /> : <span className="grid size-7 place-items-center rounded-full bg-bg text-muted"><Activity className="size-4" aria-hidden /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.label}</span>
                        <span className="block truncate text-xs text-muted">{row.sub}</span>
                      </span>
                      {row.kind === "asset" && (
                        <span className="text-right">
                          <span className="num block text-sm font-medium">{formatUsd(row.price)}</span>
                          <span className={`num block text-xs ${row.change1 >= 0 ? "text-pos" : "text-neg"}`}>{formatPct(row.change1)}</span>
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={row.key}>
                      {row.kind === "asset" ? (
                        <Link to="/asset/$id" params={{ id: row.key.slice(6) }} search={{ tab: "overview" }} preload="intent" data-search-active={active ? "" : undefined} onMouseEnter={() => setCursor(index)} onClick={onClose} className={className}>
                          {body}
                        </Link>
                      ) : row.kind === "sector" ? (
                        <Link to="/sectors/$slug" params={{ slug: row.slug }} preload="intent" data-search-active={active ? "" : undefined} onMouseEnter={() => setCursor(index)} onClick={onClose} className={className}>
                          {body}
                        </Link>
                      ) : (
                        <Link to={row.to} preload="intent" data-search-active={active ? "" : undefined} onMouseEnter={() => setCursor(index)} onClick={onClose} className={className}>
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {flat.length === 0 && <p className="px-4 py-8 text-sm text-muted">Nothing matches that.</p>}
        </div>
      </div>
    </div>
  );
}

export function PageHead({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4 md:mb-8 md:pb-6">
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="mt-2 max-w-3xl text-3xl md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted md:mt-3 md:text-[15px]">{text}</p>
      </div>
      <p className="chip">
        <i />
        {asOf} · {bookLabel()}
      </p>
    </div>
  );
}

export function ScoreNote({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-muted">{children}</p>;
}

export function Ticker({ id, symbol, name }: { id?: number; symbol: string; name?: string }) {
  const inner = (
    <span className="inline-flex items-start gap-2">
      <Token symbol={symbol} size={22} />
      <span>
        <span className="block text-sm font-semibold leading-none">{symbol}</span>
        {name && <span className="mt-1 block text-xs text-muted">{name}</span>}
      </span>
    </span>
  );
  if (id == null) return inner;
  return (
    <Link to="/asset/$id" params={{ id: String(id) }} search={{ tab: "overview" }} className="hover:text-blue">
      {inner}
    </Link>
  );
}
