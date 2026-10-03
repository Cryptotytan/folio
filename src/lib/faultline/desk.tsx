import { useEffect, useSyncExternalStore } from "react";
import { loadListedBook, type ListedBook } from "@/lib/faultline/listed.functions";
import {
  ASSETS,
  SECTORS,
  bookLabel,
  bookReady,
  cracks,
  dnaRanked,
  editionStamp,
  faults,
  healthRanked,
  market,
  pulse,
  quiet,
  subscribeEdition,
  syncEdition,
  type Asset,
} from "@/lib/faultline/view";

export type DeskKind = "crypto" | "equities" | "cmc";

type Snap = { book: ListedBook | null; error: boolean };

const books: Record<"equities" | "cmc", Snap> = {
  equities: { book: null, error: false },
  cmc: { book: null, error: false },
};
let equitiesFresh = false;
const flights = new Map<string, Promise<void>>();
let kind: DeskKind = "crypto";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof localStorage !== "undefined") {
  try {
    const stored = JSON.parse(localStorage.getItem("folio-equities") || "") as ListedBook;
    if (stored?.assets?.length) books.equities = { book: stored, error: false };
  } catch {
    /* the first visit has no saved tape */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function deskKind() {
  return kind;
}

export function setDesk(next: DeskKind) {
  if (kind === next) return;
  kind = next;
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem("folio-desk", next);
  emit();
  if (next !== "crypto") ensureListed(next);
}

export function ensureListed(next: "equities" | "cmc", force = false) {
  if (flights.has(next)) return flights.get(next);
  if (!force && next === "equities" && equitiesFresh && books.equities.book) return;
  if (!force && next === "cmc" && books.cmc.book) return;
  const job = loadListedBook({ data: next })
    .then((book) => {
      const failed = book.assets.length === 0;
      if (failed && books[next].book) return;
      books[next] = { book: failed ? books[next].book : book, error: failed && !books[next].book };
      if (next === "equities" && !failed) {
        equitiesFresh = true;
        try {
          localStorage.setItem("folio-equities", JSON.stringify(book));
        } catch {
          /* a full tape is optional */
        }
      }
      emit();
    })
    .catch(() => {
      books[next] = { book: books[next].book, error: !books[next].book };
      emit();
    })
    .finally(() => {
      flights.delete(next);
    });
  flights.set(next, job);
  return job;
}

export function listedAsset(id: number) {
  return books.equities.book?.assets.find((asset) => asset.id === id) ?? books.cmc.book?.assets.find((asset) => asset.id === id) ?? null;
}

export function listedPath(id: number) {
  return books.equities.book?.paths[String(id)] ?? books.cmc.book?.paths[String(id)] ?? [];
}

function cryptoDesk() {
  return {
    kind: "crypto" as const,
    ready: bookReady(),
    error: false,
    assets: ASSETS,
    sectors: SECTORS,
    market,
    pulse,
    faults,
    dnaRanked,
    healthRanked,
    cracks,
    quiet,
    label: bookLabel(),
    source: bookLabel() === "Live quotes" ? "Exchange" : "Waiting",
  };
}

function listedDesk(next: "equities" | "cmc", snap: Snap) {
  const book = snap.book;
  const assets = book?.assets ?? [];
  const sectors = book?.sectors ?? [];
  const rankedDna = [...assets].sort((a, b) => (b.dna ?? -1) - (a.dna ?? -1));
  const rankedHealth = [...assets].sort((a, b) => (b.health ?? -1) - (a.health ?? -1));
  const faulted = assets.filter((asset) => (asset.faultMag ?? 0) >= 3).sort((a, b) => (b.faultMag ?? 0) - (a.faultMag ?? 0));
  return {
    kind: next,
    ready: Boolean(book),
    error: snap.error,
    assets,
    sectors,
    market: book?.market ?? { mcap: 0, volume: 0, capChange: 0, btcDominance: 0, activeFaults: 0, severeFaults: 0, mcapSpark: [], volSpark: [] },
    pulse: book?.pulse ?? { breadth: 0, volumeActivity: 0, volatility: 0, sentiment: 0, state: "Steady" },
    faults: faulted,
    dnaRanked: rankedDna,
    healthRanked: rankedHealth,
    cracks: assets.filter((asset) => asset.change7 > 0 && (asset.health ?? 100) < 45).slice(0, 4),
    quiet: assets.filter((asset) => Math.abs(asset.change1) < 0.008 && (asset.faultMag ?? 0) < 3).slice(0, 3),
    label: next === "equities" ? "Stocks and commodities" : "CoinMarketCap",
    source: snap.error && !snap.book?.assets.length ? "Did not answer" : next === "equities" && !equitiesFresh ? "Last close" : "Exchange",
  };
}

export function useDesk() {
  syncEdition();
  const selected = useSyncExternalStore(subscribe, deskKind, deskKind);
  useSyncExternalStore(subscribeEdition, editionStamp, editionStamp);
  const stamp = useSyncExternalStore(subscribe, () => (selected === "crypto" ? 0 : books[selected].book?.assets.length ?? (books[selected].error ? -1 : 0)), () => 0);
  useEffect(() => {
    if (selected === "crypto") return;
    ensureListed(selected);
    const timer = window.setInterval(() => ensureListed(selected, true), 120_000);
    return () => window.clearInterval(timer);
  }, [selected]);
  void stamp;
  if (selected === "crypto") return cryptoDesk();
  return listedDesk(selected, books[selected]);
}

export function useEquities() {
  const count = useSyncExternalStore(subscribe, () => books.equities.book?.assets.length ?? 0, () => 0);
  useEffect(() => {
    ensureListed("equities");
  }, []);
  void count;
  return books.equities.book?.assets ?? [];
}

export function useListedAsset(id: number): Asset | null {
  const stamp = useSyncExternalStore(subscribe, () => `${books.equities.book?.assets.length ?? 0}:${books.cmc.book?.assets.length ?? 0}`, () => "0");
  void stamp;
  return listedAsset(id);
}

export function DeskSwitch() {
  const selected = useSyncExternalStore(subscribe, deskKind, deskKind);
  useEffect(() => {
    const saved = sessionStorage.getItem("folio-desk");
    if (saved === "equities") setDesk(saved);
    const warm = window.setTimeout(() => ensureListed("equities"), 1500);
    return () => window.clearTimeout(warm);
  }, []);
  const options: { id: DeskKind; label: string }[] = [
    { id: "crypto", label: "Crypto" },
    { id: "equities", label: "Stocks & commodities" },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Market">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected === option.id}
            className={`h-8 rounded-full px-3 text-sm ${selected === option.id ? "bg-ink text-white" : "text-muted"}`}
            onClick={() => setDesk(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
