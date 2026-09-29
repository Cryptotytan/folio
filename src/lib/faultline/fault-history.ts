import { useSyncExternalStore } from "react";
import { quoteState, type Asset } from "@/lib/faultline/view";

export type FaultEvent = {
  id: string;
  at: string;
  kind: "opened" | "updated" | "closed";
  assetId: number;
  symbol: string;
  name: string;
  faultType: string | null;
  faultMag: number | null;
  faultText: string | null;
};

type Seen = Record<string, { assetId: number; name: string; mag: number; type: string | null; text: string | null }>;
type Store = { events: FaultEvent[]; seen: Seen };

const KEY = "faultline-fault-history";
const EMPTY: Store = { events: [], seen: {} };
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
    if (!parsed || !Array.isArray(parsed.events) || typeof parsed.seen !== "object" || parsed.seen == null) return cache;
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

let journalOn = false;

export function mergeServerFaults(incoming: FaultEvent[]) {
  journalOn = true;
  if (!incoming.length || typeof localStorage === "undefined") return;
  const store = read();
  const ids = new Set(store.events.map((event) => event.id));
  const extra = incoming.filter((event) => event && event.id && !ids.has(event.id));
  if (!extra.length) return;
  write({ ...store, events: extra.concat(store.events) });
}

export function recordFaults(active: Asset[]) {
  if (journalOn) return;
  if (typeof localStorage === "undefined") return;
  if (quoteState() !== "live") return;
  const store = read();
  const now = new Date().toISOString();
  const live = new Set(active.map((a) => a.symbol));
  if (store.events.length === 0 && Object.keys(store.seen).length === 0) {
    const seen: Seen = {};
    for (const asset of active) {
      seen[asset.symbol] = {
        assetId: asset.id,
        name: asset.name,
        mag: Math.round((asset.faultMag ?? 0) * 10) / 10,
        type: asset.faultType,
        text: asset.faultText,
      };
    }
    write({ events: [], seen });
    return;
  }
  const events = store.events.slice();
  const seen: Seen = { ...store.seen };
  let changed = false;
  for (const asset of active) {
    const mag = Math.round((asset.faultMag ?? 0) * 10) / 10;
    const prev = seen[asset.symbol];
    if (!prev) {
      events.unshift(event(now, "opened", asset, mag));
      changed = true;
    } else if (prev.type !== asset.faultType || Math.abs(prev.mag - mag) >= 0.5) {
      events.unshift(event(now, "updated", asset, mag));
      changed = true;
    }
    seen[asset.symbol] = { assetId: asset.id, name: asset.name, mag, type: asset.faultType, text: asset.faultText };
  }
  for (const symbol of Object.keys(seen)) {
    if (live.has(symbol)) continue;
    const prev = seen[symbol];
    events.unshift({
      id: `${symbol}-${now}-closed`,
      at: now,
      kind: "closed",
      assetId: prev.assetId,
      symbol,
      name: prev.name,
      faultType: prev.type,
      faultMag: prev.mag,
      faultText: prev.text,
    });
    delete seen[symbol];
    changed = true;
  }
  if (changed) write({ events, seen });
}

function event(at: string, kind: FaultEvent["kind"], asset: Asset, mag: number): FaultEvent {
  return {
    id: `${asset.symbol}-${at}-${kind}`,
    at,
    kind,
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    faultType: asset.faultType,
    faultMag: mag,
    faultText: asset.faultText,
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function events() {
  return read().events;
}

export function useFaultHistory() {
  return useSyncExternalStore(subscribe, events, () => EMPTY.events);
}
