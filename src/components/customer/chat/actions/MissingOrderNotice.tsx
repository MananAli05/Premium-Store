"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { refreshData } from "@/lib/supabase/sync";
import BackToMenuButton from "./BackToMenuButton";

const WAIT_MS = 10_000;

export default function MissingOrderNotice({ customerId }: { customerId: string }) {
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    void refreshData();
    const timer = setTimeout(() => setGaveUp(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (gaveUp) return <BackToMenuButton customerId={customerId} />;

  return (
    <div className="max-w-[560px] mx-auto flex items-center justify-center gap-2 py-3 text-[13.5px] text-[var(--muted)]">
      <Loader2 size={16} className="animate-spin" />
      Loading your order…
    </div>
  );
}
