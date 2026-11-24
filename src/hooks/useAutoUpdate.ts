"use client";

import { useEffect } from "react";
import { hasUnsentSteps } from "@/lib/supabase/sync";

const runningVersion = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

async function latestVersion() {
  const response = await fetch("/api/version", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const { version } = (await response.json().catch(() => ({}))) as { version?: string };
  return version || null;
}

export function useAutoUpdate(ready: boolean) {
  useEffect(() => {
    if (!ready || !runningVersion) return;

    const updateIfNew = async () => {
      if (document.visibilityState !== "visible" || hasUnsentSteps()) return;
      const latest = await latestVersion();
      if (latest && latest !== runningVersion && !hasUnsentSteps()) window.location.reload();
    };

    document.addEventListener("visibilitychange", updateIfNew);
    return () => document.removeEventListener("visibilitychange", updateIfNew);
  }, [ready]);
}
