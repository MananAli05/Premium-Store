"use client";

import { useSyncExternalStore } from "react";
import { timeoutSignal } from "@/lib/timeoutSignal";

export type Signal = { bars: number; ms: number | null };

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/auth/v1/health`;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const EVERY_MS = 10_000;
const TIMEOUT_MS = 5_000;

let signal: Signal = { bars: 5, ms: null };
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function barsFor(ms: number) {
  if (ms < 200) return 5;
  if (ms < 400) return 4;
  if (ms < 800) return 3;
  if (ms < 1500) return 2;
  return 1;
}

function update(next: Signal) {
  signal = next;
  listeners.forEach((listener) => listener());
}

async function ping() {
  if (document.hidden) return;
  if (!navigator.onLine) return update({ bars: 0, ms: null });

  const started = performance.now();
  try {
    await fetch(url, { headers: { apikey: key }, cache: "no-store", signal: timeoutSignal(TIMEOUT_MS) });
    const ms = Math.round(performance.now() - started);
    update({ bars: barsFor(ms), ms });
  } catch {
    update({ bars: 0, ms: null });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    ping();
    timer = setInterval(ping, EVERY_MS);
    window.addEventListener("online", ping);
    window.addEventListener("offline", ping);
    document.addEventListener("visibilitychange", ping);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
      window.removeEventListener("online", ping);
      window.removeEventListener("offline", ping);
      document.removeEventListener("visibilitychange", ping);
    }
  };
}

export function useSignal() {
  return useSyncExternalStore(subscribe, () => signal, () => signal);
}
