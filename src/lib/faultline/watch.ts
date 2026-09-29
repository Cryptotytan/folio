import { useSyncExternalStore } from "react";

const KEY = "faultline-watch";
const EMPTY: number[] = [];
let cache = EMPTY;
const listeners = new Set<() => void>();

function read() {
  if (typeof localStorage === "undefined") return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    const next = Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : EMPTY;
    if (next.length === cache.length && next.every((n, i) => n === cache[i])) return cache;
    cache = next;
    return cache;
  } catch {
    return cache;
  }
}

function write(next: number[]) {
  cache = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((listener) => listener());
}

export function toggleWatch(id: number) {
  const current = read();
  write(current.includes(id) ? current.filter((n) => n !== id) : [...current, id]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatch() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
