"use client";

import { useSyncExternalStore } from "react";

/** Linhas favoritas, guardadas neste aparelho. */
const KEY = "gomob.lines.fav.v1";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const EMPTY: string[] = [];

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    cache = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, 60) : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function toggleFavoriteLine(code: string): boolean {
  const cur = read();
  const on = !cur.includes(code);
  cache = on ? [code, ...cur].slice(0, 60) : cur.filter((c) => c !== code);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  listeners.forEach((l) => l());
  return on;
}

export function useFavoriteLines(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}
