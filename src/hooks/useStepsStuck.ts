"use client";

import { useSyncExternalStore } from "react";
import { pendingSnapshot, stepsStuck, subscribePending } from "@/lib/supabase/sync";

export function useStepsStuck() {
  useSyncExternalStore(subscribePending, pendingSnapshot, () => 0);
  return stepsStuck();
}
