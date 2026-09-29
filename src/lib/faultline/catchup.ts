import { useSyncExternalStore } from "react";
import { healthState } from "@/lib/faultline/format";
import { ASSETS, faults, quoteState } from "@/lib/faultline/view";

export type Notice = {
  id: string;
  at: string;
  asset: number;
  symbol: string;
  name: string;
  tab: "faults" | "health";
  title: string;
  text: string;
};

type FaultSeen = { id: number; name: string; mag: number; type: string | null; text: string | null };
type HealthSeen = { id: number; name: string; band: string; score: number };
type Store = {
  primed: boolean;
  pending: Notice[];
  revealed: Notice[];
  seenFaults: Record<string, FaultSeen>;
  seenHealth: Record<string, HealthSeen>;
};

const KEY = "faultline-catchup";
const EMPTY: Store = { primed: false, pending: [], revealed: [], seenFaults: {}, seenHealth: {} };
let cache = EMPTY;
let raw = "";
const listeners = new Set<() => void>();

function read(): Store {
  if (typeof localStorage === "undefined") return cache;
  try {
    const next = localStorage.getItem(KEY) || "";
    if (next === raw) return cache;
    raw = next;
    if (!next) {
      cache = EMPTY;
      return cache;
    }
    const parsed = JSON.parse(next) as Store;
    if (!parsed || !Array.isArray(parsed.pending) || !Array.isArray(parsed.revealed)) return cache;
    cache = parsed;
    return cache;
  } catch {
    return cache;
  }
}

function write(next: Store) {
  cache = next;
  raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordCatchup() {
  if (typeof localStorage === "undefined") return;
  if (quoteState() !== "live") return;
  const store = read();
  const seenFaults: Record<string, FaultSeen> = {};
  for (const asset of faults) {
    seenFaults[asset.symbol] = {
      id: asset.id,
      name: asset.name,
      mag: Math.round((asset.faultMag ?? 0) * 10) / 10,
      type: asset.faultType,
      text: asset.faultText,
    };
  }
  const seenHealth: Record<string, HealthSeen> = {};
  for (const asset of ASSETS) {
    if (asset.health == null) continue;
    seenHealth[asset.symbol] = { id: asset.id, name: asset.name, band: healthState(asset.health), score: asset.health };
  }
  if (!store.primed) {
    write({ ...store, primed: true, seenFaults, seenHealth });
    return;
  }
  const pending = store.pending.slice();
  const now = new Date().toISOString();
  const before = pending.length;
  for (const symbol of Object.keys(seenFaults)) {
    const next = seenFaults[symbol];
    const prev = store.seenFaults[symbol];
    if (!prev) {
      pending.unshift({
        id: `${symbol}-${now}-fault`,
        at: now,
        asset: next.id,
        symbol,
        name: next.name,
        tab: "faults",
        title: `${symbol} crossed into a fault`,
        text: next.text || "Signals that usually agree are now apart.",
      });
    } else if (prev.type !== next.type || Math.abs(prev.mag - next.mag) >= 0.5) {
      pending.unshift({
        id: `${symbol}-${now}-fault-up`,
        at: now,
        asset: next.id,
        symbol,
        name: next.name,
        tab: "faults",
        title: `${symbol} fault changed`,
        text: next.text || `${prev.mag.toFixed(1)} to ${next.mag.toFixed(1)}.`,
      });
    }
  }
  for (const symbol of Object.keys(store.seenFaults)) {
    if (seenFaults[symbol]) continue;
    const prev = store.seenFaults[symbol];
    pending.unshift({
      id: `${symbol}-${now}-fault-off`,
      at: now,
      asset: prev.id,
      symbol,
      name: prev.name,
      tab: "faults",
      title: `${symbol} fault cleared`,
      text: prev.text || "The contradiction is no longer large enough to list.",
    });
  }
  for (const symbol of Object.keys(seenHealth)) {
    const next = seenHealth[symbol];
    const prev = store.seenHealth[symbol];
    if (prev && next.band !== prev.band && next.score < prev.score) {
      pending.unshift({
        id: `${symbol}-${now}-health`,
        at: now,
        asset: next.id,
        symbol,
        name: next.name,
        tab: "health",
        title: `${symbol} dropped a health band`,
        text: `${prev.band} to ${next.band}.`,
      });
    }
  }
  if (pending.length === before) return;
  write({ ...store, pending, seenFaults, seenHealth });
}

export function mergeServerNotices(incoming: Notice[]) {
  if (!incoming.length || typeof localStorage === "undefined") return;
  const store = read();
  const ids = new Set([...store.pending, ...store.revealed].map((note) => note.id));
  const extra = incoming.filter((note) => note && note.id && !ids.has(note.id));
  if (!extra.length) return;
  write({ ...store, pending: extra.concat(store.pending) });
}

export function revealCatchup() {
  const store = read();
  if (!store.pending.length) return;
  write({ ...store, pending: [], revealed: [...store.pending, ...store.revealed] });
}

export function useRevealedChanges() {
  return useSyncExternalStore(subscribe, () => read().revealed, () => EMPTY.revealed);
}

export function usePendingChanges() {
  return useSyncExternalStore(subscribe, () => read().pending.length, () => 0);
}
